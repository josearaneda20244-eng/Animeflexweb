import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

/* Prices (USD) */
const MONTHLY_USD = "4.00";
const ANNUAL_USD  = "38.40";

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret   = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:  `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/**
 * Validate a promo code and — atomically — increment uses_count in a transaction.
 * Returns the discount_percent (0 if invalid/expired/maxed).
 */
async function applyPromoCode(code: string): Promise<number> {
  if (!code) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes WHERE code = $1 FOR UPDATE`,
      [code.toUpperCase().trim()]
    );
    if (result.rows.length === 0) { await client.query("ROLLBACK"); return 0; }
    const pc      = result.rows[0];
    const expired = pc.expires_at && new Date(pc.expires_at) < new Date();
    const maxed   = pc.max_uses !== null && pc.uses_count >= pc.max_uses;
    if (!pc.active || expired || maxed) { await client.query("ROLLBACK"); return 0; }
    await client.query(
      `UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = $1`,
      [pc.id]
    );
    await client.query("COMMIT");
    return pc.discount_percent as number;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function applyDiscount(amountStr: string, discountPercent: number): string {
  const amount    = parseFloat(amountStr);
  const discounted = amount * (1 - discountPercent / 100);
  return discounted.toFixed(2);
}

/* ── POST /membership ── */
router.post("/membership", requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({
      error: "PayPal no configurado. Añade PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.",
    });
    return;
  }

  const { action, subscriptionId, promoCode, plan = "monthly" } = req.body as {
    action: string;
    subscriptionId?: string;
    promoCode?: string;
    plan?: "monthly" | "annual";
  };

  try {
    /* ── CREATE PAYPAL ORDER (with discount) ── */
    if (action === "create-order") {
      const validPlan = plan === "annual" ? "annual" : "monthly";
      const baseAmount = validPlan === "annual" ? ANNUAL_USD : MONTHLY_USD;
      let finalAmount  = baseAmount;
      let resolvedPromo: string | null = null;

      if (promoCode) {
        /* Validate read-only; increment happens on capture */
        const pcRes = await pool.query(
          `SELECT discount_percent, max_uses, uses_count, expires_at, active
             FROM promo_codes WHERE code = $1`,
          [promoCode.toUpperCase().trim()]
        );
        if (pcRes.rows.length > 0) {
          const pc      = pcRes.rows[0];
          const expired = pc.expires_at && new Date(pc.expires_at) < new Date();
          const maxed   = pc.max_uses !== null && pc.uses_count >= pc.max_uses;
          if (pc.active && !expired && !maxed) {
            finalAmount   = applyDiscount(baseAmount, pc.discount_percent);
            resolvedPromo = promoCode.toUpperCase().trim();
          }
        }
      }

      const token = await getPayPalToken();
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: finalAmount,
              },
              description: `AnimeFlex MegaFan ${validPlan === "annual" ? "Anual" : "Mensual"}`,
            },
          ],
        }),
      });
      const order = await orderRes.json() as { id?: string; error?: string };
      if (!order.id) {
        res.status(500).json({ error: "Error creando orden de PayPal" });
        return;
      }

      /* ── Persist server-side state; client cannot alter plan/amount later ── */
      await pool.query(
        `INSERT INTO paypal_pending_orders (order_id, user_id, plan, promo_code, expected_usd)
              VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id) DO NOTHING`,
        [order.id, req.userId, validPlan, resolvedPromo, finalAmount]
      );

      res.json({ orderId: order.id });
      return;
    }

    /* ── CAPTURE PAYPAL ORDER + ACTIVATE MEMBERSHIP ── */
    if (action === "capture-order") {
      const { orderId } = req.body as { orderId?: string };
      if (!orderId) {
        res.status(400).json({ error: "Falta orderId" });
        return;
      }

      /*
       * Atomically claim the pending-order record for this user.
       * DELETE returns the row only once — prevents double-capture and
       * ensures a different user cannot capture someone else's order.
       */
      const claimRes = await pool.query(
        `DELETE FROM paypal_pending_orders
          WHERE order_id = $1 AND user_id = $2
          RETURNING plan, promo_code, expected_usd`,
        [orderId, req.userId]
      );
      if (claimRes.rows.length === 0) {
        res.status(403).json({ error: "Orden no encontrada o ya procesada" });
        return;
      }
      const { plan: serverPlan, promo_code: serverPromo, expected_usd: expectedUsd }
        = claimRes.rows[0] as { plan: "monthly" | "annual"; promo_code: string | null; expected_usd: string };

      const token = await getPayPalToken();
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const captured = await captureRes.json() as {
        status?: string;
        purchase_units?: Array<{
          payments?: { captures?: Array<{ status: string; amount?: { value: string; currency_code: string } }> };
        }>;
      };

      const captureEntry = captured.purchase_units?.[0]?.payments?.captures?.[0];
      const captureStatus = captureEntry?.status;
      if (captured.status !== "COMPLETED" && captureStatus !== "COMPLETED") {
        res.status(400).json({ error: "El pago PayPal no fue completado" });
        return;
      }

      /* Verify captured amount matches what we created the order for */
      const capturedValue = captureEntry?.amount?.value;
      if (capturedValue && parseFloat(capturedValue) < parseFloat(expectedUsd) - 0.01) {
        console.error(
          `PayPal amount mismatch: expected ${expectedUsd}, got ${capturedValue} for order ${orderId}`
        );
        res.status(400).json({ error: "El monto capturado no coincide con el esperado" });
        return;
      }

      /* Calculate expiry using server-side plan (not client-supplied value) */
      const expiresAt = new Date();
      if (serverPlan === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      await pool.query(
        `UPDATE users
            SET membership_tier = 'megafan',
                subscription_expires_at = $1
          WHERE id = $2`,
        [expiresAt.toISOString(), req.userId]
      );

      /* Apply & track promo code using server-side code (not client-supplied) */
      let discountPercent = 0;
      if (serverPromo) {
        discountPercent = await applyPromoCode(serverPromo);
      }

      res.json({ ok: true, tier: "megafan", discountPercent });
      return;
    }

    /* ── ACTIVATE PAYPAL SUBSCRIPTION (no coupon / regular flow) ── */
    if (action === "activate") {
      if (!subscriptionId) {
        res.status(400).json({ error: "Falta subscriptionId" });
        return;
      }

      const token  = await getPayPalToken();
      const subRes = await fetch(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization:  `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const sub = await subRes.json() as {
        status: string;
        billing_info?: { next_billing_time?: string };
      };

      if (sub.status !== "ACTIVE") {
        res.status(400).json({ error: "La suscripción no está activa en PayPal" });
        return;
      }

      const expiresAt = sub.billing_info?.next_billing_time ?? null;
      await pool.query(
        `UPDATE users
            SET membership_tier = 'megafan',
                paypal_subscription_id = $1,
                subscription_expires_at = $2
          WHERE id = $3`,
        [subscriptionId, expiresAt, req.userId]
      );

      res.json({ ok: true, tier: "megafan" });
      return;
    }

    /* ── PORTAL (PayPal manage) ── */
    if (action === "portal") {
      const portalUrl =
        process.env.PAYPAL_MODE === "sandbox"
          ? "https://www.sandbox.paypal.com/myaccount/autopay/"
          : "https://www.paypal.com/myaccount/autopay/";
      res.json({ url: portalUrl });
      return;
    }

    res.status(400).json({ error: "Acción no válida" });
  } catch (err: any) {
    console.error("Membership API error:", err);
    res.status(500).json({ error: err.message ?? "Error interno" });
  }
});

export default router;
