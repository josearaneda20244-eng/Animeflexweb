import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "./_lib/auth";
import { getSql } from "./_lib/db";

const PAYPAL_BASE = process.env.PAYPAL_MODE === "sandbox"
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
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({
      error: "PayPal no configurado. Añade PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en las variables de entorno de Vercel.",
    });
  }

  const payload = await verifyToken(req, res);
  if (!payload) return;

  const { action, subscriptionId } = req.body ?? {};

  try {
    const sql = getSql();

    // ── ACTIVAR membresía tras aprobación de PayPal ──
    if (action === "activate") {
      if (!subscriptionId) return res.status(400).json({ error: "Falta subscriptionId" });

      const token = await getPayPalToken();
      const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const sub = await subRes.json();

      if (sub.status !== "ACTIVE") {
        return res.status(400).json({ error: "La suscripción no está activa en PayPal" });
      }

      const expiresAt = sub.billing_info?.next_billing_time ?? null;

      await sql`
        UPDATE users
        SET membership_tier = 'megafan',
            stripe_subscription_id = ${subscriptionId},
            subscription_expires_at = ${expiresAt}
        WHERE id = ${payload.userId}
      `;

      return res.json({ ok: true, tier: "megafan" });
    }

    // ── CANCELAR / GESTIONAR (redirige a PayPal) ──
    if (action === "portal") {
      const portalUrl = process.env.PAYPAL_MODE === "sandbox"
        ? "https://www.sandbox.paypal.com/myaccount/autopay/"
        : "https://www.paypal.com/myaccount/autopay/";
      return res.json({ url: portalUrl });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (err: any) {
    console.error("Membership API error:", err);
    return res.status(500).json({ error: err.message ?? "Error interno" });
  }
}
