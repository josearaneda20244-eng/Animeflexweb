import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../_lib/auth";
import { getSql } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const payload = await verifyToken(req, res);
  if (!payload) return;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-06-30.basil" });
    const sql = getSql();

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

    const origin = req.headers.origin || req.headers.referer?.split("/anime-web")[0] + "/anime-web" || "https://replit.dev";
    const base = origin.includes("anime-web") ? origin : `${origin}/anime-web`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${base}/membership?success=true`,
      cancel_url: `${base}/membership?canceled=true`,
      metadata: { userId: String(payload.userId) },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: err.message ?? "Error al crear sesión de pago" });
  }
}
