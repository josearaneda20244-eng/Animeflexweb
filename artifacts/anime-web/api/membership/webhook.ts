import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-06-30.basil" });
    const sql = getSql();

    const rawBody = await getRawBody(req);
    const sig = req.headers["stripe-signature"] as string;

    let event: import("stripe").Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    const sub = event.data.object as import("stripe").Stripe.Subscription;

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const isActive = sub.status === "active" || sub.status === "trialing";
      const tier = isActive ? "megafan" : "free";
      const expiresAt = isActive && sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      if (expiresAt) {
        await sql`
          UPDATE users
          SET membership_tier = ${tier},
              stripe_subscription_id = ${sub.id},
              subscription_expires_at = ${expiresAt}
          WHERE stripe_customer_id = ${customerId}
        `;
      } else {
        await sql`
          UPDATE users
          SET membership_tier = ${tier},
              stripe_subscription_id = ${sub.id},
              subscription_expires_at = NULL
          WHERE stripe_customer_id = ${customerId}
        `;
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await sql`
        UPDATE users
        SET membership_tier = 'free',
            stripe_subscription_id = NULL,
            subscription_expires_at = NULL
        WHERE stripe_customer_id = ${customerId}
      `;
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
