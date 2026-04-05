import { Router } from "express";
import Stripe from "stripe";
import pool from "../db.js";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

/* Prices (cents) */
const MONTHLY_CENTS = 400;   // $4.00/mo
const ANNUAL_CENTS  = 3840;  // $38.40/yr  (saves $9.60 vs 12×$4)

/** Safe frontend URL — never derive from request Origin to avoid open-redirect */
function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? "https://localhost";
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

/* ── POST /stripe/create-checkout-session ── */
router.post("/stripe/create-checkout-session", requireAuth, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({
      error: "Stripe no está configurado. Añade STRIPE_SECRET_KEY en las variables de entorno.",
    });
    return;
  }

  const { plan = "monthly", promoCode } = req.body as {
    plan?: "monthly" | "annual";
    promoCode?: string;
  };

  /* ── Validate promo code (read-only — increment happens in webhook) ──
   *
   * NOTE: max_uses enforcement is best-effort at checkout creation time.
   * Concurrent sessions initiated within the same window may each receive
   * the discounted price even if max_uses has been reached between reads.
   * The webhook enforces the hard cap atomically via the conditional UPDATE:
   *   UPDATE promo_codes SET uses_count = uses_count + 1
   *   WHERE code = $1 AND (max_uses IS NULL OR uses_count < max_uses)
   * …so the counter never overflows, but a small number of extra discounted
   * checkout sessions can be created before the count catches up. If strict
   * enforcement is required, introduce a reservation/claim step here.
   */
  let discountPercent = 0;
  if (promoCode) {
    const pcRes = await pool.query(
      `SELECT discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes WHERE code = $1`,
      [promoCode.toUpperCase().trim()]
    );
    if (pcRes.rows.length > 0) {
      const pc = pcRes.rows[0];
      const expired = pc.expires_at && new Date(pc.expires_at) < new Date();
      const maxed   = pc.max_uses !== null && pc.uses_count >= pc.max_uses;
      if (pc.active && !expired && !maxed) {
        discountPercent = pc.discount_percent as number;
      }
    }
  }

  const baseAmount  = plan === "annual" ? ANNUAL_CENTS : MONTHLY_CENTS;
  const unitAmount  = Math.round(baseAmount * (1 - discountPercent / 100));
  const interval    = (plan === "annual" ? "year" : "month") as "year" | "month";
  const label       = plan === "annual"
    ? `AnimeFlex MegaFan — Anual${discountPercent ? ` (−${discountPercent}%)` : ""}`
    : `AnimeFlex MegaFan — Mensual${discountPercent ? ` (−${discountPercent}%)` : ""}`;

  /* ── Fetch/create Stripe customer ── */
  const userRes = await pool.query(
    "SELECT email, username, stripe_customer_id FROM users WHERE id = $1",
    [req.userId]
  );
  if (userRes.rows.length === 0) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const { email, username, stripe_customer_id } = userRes.rows[0];

  const origin = getFrontendUrl();

  try {
    /* Reuse existing Stripe customer or let Stripe create one */
    const customerParam = stripe_customer_id
      ? { customer: stripe_customer_id as string }
      : { customer_email: email as string };

    const session = await stripe.checkout.sessions.create({
      ...customerParam,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval },
            product_data: {
              name: label,
              description: `Membresía MegaFan ${plan === "annual" ? "anual" : "mensual"} — ${username as string}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId:          String(req.userId),
        plan,
        promoCode:       promoCode ?? "",
        discountPercent: String(discountPercent),
      },
      success_url: `${origin}/membership?stripe=success`,
      cancel_url:  `${origin}/membership?stripe=cancel`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message ?? "Error creando sesión de pago" });
  }
});

/* ── POST /stripe/webhook ── */
router.post("/stripe/webhook", async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  /* Require BOTH Stripe SDK and webhook secret configured */
  if (!stripe || !webhookSecret) {
    console.warn(
      "Stripe webhook received but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured. Ignoring."
    );
    res.sendStatus(200);
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, plan, promoCode, discountPercent } = session.metadata ?? {};

    if (userId) {
      const expiresAt = new Date();
      if (plan === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      /* Persist subscription ID (needed for portal) and customer ID */
      const stripeCustomer = session.customer as string | null;
      const stripeSubId    = session.subscription as string | null;

      await pool.query(
        `UPDATE users
            SET membership_tier       = 'megafan',
                subscription_expires_at = $1,
                stripe_customer_id    = COALESCE($2, stripe_customer_id),
                stripe_subscription_id = COALESCE($3, stripe_subscription_id)
          WHERE id = $4`,
        [expiresAt.toISOString(), stripeCustomer, stripeSubId, parseInt(userId)]
      );

      /* Atomically increment promo code uses_count */
      if (promoCode) {
        await pool.query(
          `UPDATE promo_codes SET uses_count = uses_count + 1
            WHERE code = $1
              AND (max_uses IS NULL OR uses_count < max_uses)
              AND (expires_at IS NULL OR expires_at > NOW())
              AND active = TRUE`,
          [promoCode]
        );
      }
    }
  }

  res.sendStatus(200);
});

/* ── GET /stripe/portal ── */
router.get("/stripe/portal", requireAuth, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe no está configurado" });
    return;
  }

  const userRes = await pool.query(
    "SELECT stripe_customer_id FROM users WHERE id = $1",
    [req.userId]
  );
  const customerId = userRes.rows[0]?.stripe_customer_id as string | null;

  if (!customerId) {
    res.status(400).json({
      error: "No se encontró cliente de Stripe para este usuario",
    });
    return;
  }

  const origin = getFrontendUrl();
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/membership`,
    });
    res.json({ url: portalSession.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Error abriendo portal" });
  }
});

/* ── POST /promo-codes/validate (public) ── */
router.post("/promo-codes/validate", optionalAuth, async (req, res) => {
  const { code, plan = "monthly" } = req.body as {
    code?: string;
    plan?: string;
  };
  if (!code) {
    res.status(400).json({ error: "Código requerido" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT code, discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes WHERE code = $1`,
      [code.toUpperCase().trim()]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Código no encontrado" });
      return;
    }

    const pc = result.rows[0];
    if (!pc.active) {
      res.status(400).json({ error: "Este código no está activo" });
      return;
    }
    if (pc.expires_at && new Date(pc.expires_at) < new Date()) {
      res.status(400).json({ error: "Este código ha expirado" });
      return;
    }
    if (pc.max_uses !== null && pc.uses_count >= pc.max_uses) {
      res.status(400).json({ error: "Este código ya alcanzó su límite de usos" });
      return;
    }

    const baseAmount      = plan === "annual" ? ANNUAL_CENTS : MONTHLY_CENTS;
    const discountedAmount = Math.round(baseAmount * (1 - pc.discount_percent / 100));

    res.json({
      valid:            true,
      code:             pc.code,
      discountPercent:  pc.discount_percent,
      originalCents:    baseAmount,
      discountedCents:  discountedAmount,
    });
  } catch (err: any) {
    console.error("Promo validate error:", err);
    res.status(500).json({ error: "Error validando el código" });
  }
});

export default router;
