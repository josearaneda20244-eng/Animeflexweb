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
       * READ the pending-order record first — do NOT delete yet.
       * Deleting before capture completion would make retry impossible if
       * the PayPal call or DB update fails mid-way.
       */
      const readRes = await pool.query(
        `SELECT plan, promo_code, expected_usd
           FROM paypal_pending_orders
          WHERE order_id = $1 AND user_id = $2`,
        [orderId, req.userId]
      );
      if (readRes.rows.length === 0) {
        res.status(403).json({ error: "Orden no encontrada o ya procesada" });
        return;
      }
      const { plan: serverPlan, promo_code: serverPromo, expected_usd: expectedUsd }
        = readRes.rows[0] as { plan: "monthly" | "annual"; promo_code: string | null; expected_usd: string };

      /* Capture the PayPal order (network call outside any DB transaction) */
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
        name?: string; /* PayPal error field */
      };

      const captureEntry = captured.purchase_units?.[0]?.payments?.captures?.[0];
      const captureStatus = captureEntry?.status;

      /* Handle already-captured idempotency: ORDER_ALREADY_CAPTURED → treat as success */
      const alreadyCaptured = captured.name === "ORDER_ALREADY_CAPTURED";

      if (!alreadyCaptured && captured.status !== "COMPLETED" && captureStatus !== "COMPLETED") {
        res.status(400).json({ error: "El pago PayPal no fue completado" });
        return;
      }

      /* Verify captured amount matches what we created the order for */
      if (!alreadyCaptured) {
        const capturedValue = captureEntry?.amount?.value;
        if (capturedValue && parseFloat(capturedValue) < parseFloat(expectedUsd) - 0.01) {
          console.error(
            `PayPal amount mismatch: expected ${expectedUsd}, got ${capturedValue} for order ${orderId}`
          );
          res.status(400).json({ error: "El monto capturado no coincide con el esperado" });
          return;
        }
      }

      /* Calculate expiry using server-side plan (not client-supplied value) */
      const expiresAt = new Date();
      if (serverPlan === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      /*
       * Atomically: delete pending order + activate membership.
       * DELETE returns 0 rows if a concurrent request already processed this
       * order → idempotent; we still respond with success since payment was taken.
       */
      const dbClient = await pool.connect();
      let discountPercent = 0;
      try {
        await dbClient.query("BEGIN");

        const deleteRes = await dbClient.query(
          `DELETE FROM paypal_pending_orders
            WHERE order_id = $1 AND user_id = $2
            RETURNING promo_code, plan AS server_plan`,
          [orderId, req.userId]
        );

        /* If 0 rows, concurrent request already processed this — still activate */
        await dbClient.query(
          `UPDATE users
              SET membership_tier = 'megafan',
                  subscription_expires_at = $1
            WHERE id = $2`,
          [expiresAt.toISOString(), req.userId]
        );

        /*
         * Increment promo uses_count inside this same transaction — atomic with
         * membership activation. Only run if this request "won" the delete race
         * (deleteRes.rows.length > 0 means no concurrent request beat us).
         */
        if (deleteRes.rows.length > 0 && serverPromo) {
          const promoRes = await dbClient.query(
            `UPDATE promo_codes
                SET uses_count = uses_count + 1
              WHERE code = $1
                AND active = TRUE
                AND (max_uses IS NULL OR uses_count < max_uses)
                AND (expires_at IS NULL OR expires_at > NOW())
              RETURNING discount_percent`,
            [serverPromo]
          );
          discountPercent = promoRes.rows[0]?.discount_percent ?? 0;
        }

        /* Use server-trusted plan: prefer the one returned by DELETE (same row);
         * fall back to the pre-read serverPlan (same DB record, read before capture).
         * Never fall back to req.body.plan to prevent client-supplied plan poisoning. */
        const trustedPlan: string = deleteRes.rows[0]?.server_plan ?? serverPlan;

        /* Log transaction (ignore conflict — idempotent retry) */
        await dbClient.query(
          `INSERT INTO paypal_transactions (order_id, user_id, amount_usd, plan, promo_code, status)
           VALUES ($1, $2, $3, $4, $5, 'completed')
           ON CONFLICT (order_id) DO NOTHING`,
          [orderId, req.userId, parseFloat(expectedUsd), trustedPlan, serverPromo ?? null]
        );

        await dbClient.query("COMMIT");
      } catch (err) {
        await dbClient.query("ROLLBACK");
        throw err;
      } finally {
        dbClient.release();
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
