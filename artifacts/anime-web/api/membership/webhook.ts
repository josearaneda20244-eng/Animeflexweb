import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sql = getSql();
    const event = req.body;
    const eventType = event?.event_type as string;
    const sub = event?.resource;

    if (!sub?.id) return res.json({ received: true });

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const expiresAt = sub.billing_info?.next_billing_time ?? null;
      if (expiresAt) {
        await sql`
          UPDATE users
          SET membership_tier = 'megafan',
              stripe_subscription_id = ${sub.id},
              subscription_expires_at = ${expiresAt}
          WHERE stripe_subscription_id = ${sub.id}
        `;
      }
    }

    if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      await sql`
        UPDATE users
        SET membership_tier = 'free',
            stripe_subscription_id = NULL,
            subscription_expires_at = NULL
        WHERE stripe_subscription_id = ${sub.id}
      `;
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("PayPal webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
