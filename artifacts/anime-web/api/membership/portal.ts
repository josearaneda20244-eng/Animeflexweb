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

    const rows = await sql`SELECT stripe_customer_id FROM users WHERE id = ${payload.userId}`;
    const user = rows[0];
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: "No tienes una suscripción activa" });
    }

    const origin = req.headers.origin || req.headers.referer?.split("/anime-web")[0] + "/anime-web" || "https://replit.dev";
    const base = origin.includes("anime-web") ? origin : `${origin}/anime-web`;

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id as string,
      return_url: `${base}/membership`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Portal error:", err);
    return res.status(500).json({ error: err.message ?? "Error al abrir portal" });
  }
}
