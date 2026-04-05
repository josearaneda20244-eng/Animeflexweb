import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/**
 * Validate a promo code and return its discount_percent (0 if invalid/expired).
 * If valid, increments uses_count atomically.
 */
async function applyPromoCode(code: string): Promise<number> {
  if (!code) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes
        WHERE code = $1
        FOR UPDATE`,
      [code.toUpperCase().trim()]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return 0;
    }

    const pc = result.rows[0];
    const expired = pc.expires_at && new Date(pc.expires_at) < new Date();
    const maxed   = pc.max_uses !== null && pc.uses_count >= pc.max_uses;

    if (!pc.active || expired || maxed) {
      await client.query("ROLLBACK");
      return 0;
    }

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

/* ── POST /membership ── */
router.post("/membership", requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({
      error:
        "PayPal no configurado. Añade PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en las variables de entorno.",
    });
    return;
  }

  const { action, subscriptionId, promoCode } = req.body as {
    action: string;
    subscriptionId?: string;
    promoCode?: string;
  };

  try {
    // ── ACTIVAR membresía tras aprobación de PayPal ──
    if (action === "activate") {
      if (!subscriptionId) {
        res.status(400).json({ error: "Falta subscriptionId" });
        return;
      }

      const token = await getPayPalToken();
      const subRes = await fetch(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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

      /* Apply & track promo code if provided */
      let discountPercent = 0;
      if (promoCode) {
        discountPercent = await applyPromoCode(promoCode);
      }

      await pool.query(
        `UPDATE users
         SET membership_tier = 'megafan',
             paypal_subscription_id = $1,
             subscription_expires_at = $2
         WHERE id = $3`,
        [subscriptionId, expiresAt, req.userId]
      );

      res.json({ ok: true, tier: "megafan", discountPercent });
      return;
    }

    // ── PORTAL (redirige a PayPal para cancelar/gestionar) ──
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
