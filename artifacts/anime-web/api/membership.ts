import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "./_lib/auth";
import { getSql } from "./_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const payload = await verifyToken(req, res);
  if (!payload) return;

  const { action } = req.body ?? {};

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sql = getSql();

    // ── CHECKOUT ──
    if (action === "checkout") {
      const rows = await sql`SELECT id, email, stripe_customer_id FROM users WHERE id = ${payload.userId}`;
      const user = rows[0];
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      let customerId = user.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email as string,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${payload.userId}`;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded",
        redirect_on_completion: "never",
        metadata: { userId: String(payload.userId) },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return res.json({ clientSecret: session.client_secret });
    }

    // ── PORTAL ──
    if (action === "portal") {
      const rows = await sql`SELECT stripe_customer_id FROM users WHERE id = ${payload.userId}`;
      const user = rows[0];
      if (!user?.stripe_customer_id) {
        return res.status(400).json({ error: "No tienes una suscripción activa" });
      }

      const origin = req.headers.origin ?? "https://animeflex.vercel.app";
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id as string,
        return_url: `${origin}/membership`,
      });
      return res.json({ url: session.url });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (err: any) {
    console.error("Membership API error:", err);
    return res.status(500).json({ error: err.message ?? "Error interno" });
  }
}
