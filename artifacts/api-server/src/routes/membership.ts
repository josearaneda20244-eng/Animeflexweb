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

/* ── POST /membership ── */
router.post("/membership", requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({
      error:
        "PayPal no configurado. Añade PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en las variables de entorno.",
    });
    return;
  }

  const { action, subscriptionId } = req.body as {
    action: string;
    subscriptionId?: string;
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
