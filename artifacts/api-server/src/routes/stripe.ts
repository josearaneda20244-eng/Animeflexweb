import { Router } from "express";
import Stripe from "stripe";
import pool from "../db.js";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

/* Prices (cents) */
const MONTHLY_CENTS = 400;   // $4.00
const ANNUAL_CENTS  = 3840;  // $38.40 (save $9.60 vs 12×$4)

/* ── POST /stripe/create-checkout-session ── */
router.post("/stripe/create-checkout-session", requireAuth, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe no está configurado. Añade STRIPE_SECRET_KEY en las variables de entorno." });
    return;
  }

  const { plan = "monthly", promoCode } = req.body as { plan?: "monthly" | "annual"; promoCode?: string };

  /* ── Validate promo code ── */
  let discountPercent = 0;
  if (promoCode) {
    const pcRes = await pool.query(
      `SELECT id, discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes
        WHERE code = $1`,
      [promoCode.toUpperCase().trim()]
    );
    if (pcRes.rows.length > 0) {
      const pc = pcRes.rows[0];
      const expired = pc.expires_at && new Date(pc.expires_at) < new Date();
      const maxed   = pc.max_uses !== null && pc.uses_count >= pc.max_uses;
      if (pc.active && !expired && !maxed) {
        discountPercent = pc.discount_percent;
      }
    }
  }

  const baseAmount = plan === "annual" ? ANNUAL_CENTS : MONTHLY_CENTS;
  const amount     = Math.round(baseAmount * (1 - discountPercent / 100));
  const label      = plan === "annual" ? "AnimeFlex MegaFan — Anual" : "AnimeFlex MegaFan — Mensual";

  /* ── Fetch user email for customer ── */
  const userRes = await pool.query("SELECT email, username FROM users WHERE id = $1", [req.userId]);
  if (userRes.rows.length === 0) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const { email, username } = userRes.rows[0];

  const origin = process.env.FRONTEND_URL ?? (req.headers.origin as string) ?? "http://localhost:5173";

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: label,
              description: `Membresía MegaFan ${plan === "annual" ? "anual" : "mensual"} para ${username}`,
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(req.userId),
        plan,
        promoCode: promoCode ?? "",
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
router.post(
  "/stripe/webhook",
  // Raw body needed for signature verification — handled by express.raw() in app config
  async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    /* Require both Stripe SDK and webhook secret — reject silently if unconfigured */
    if (!stripe || !webhookSecret) {
      console.warn("Stripe webhook received but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured. Ignoring.");
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
        /* Calculate expiry */
        const expiresAt = new Date();
        if (plan === "annual") {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        await pool.query(
          `UPDATE users
              SET membership_tier = 'megafan',
                  subscription_expires_at = $1,
                  stripe_customer_id = $2
            WHERE id = $3`,
          [expiresAt.toISOString(), session.customer as string ?? null, parseInt(userId)]
        );

        /* Increment promo code uses_count */
        if (promoCode) {
          await pool.query(
            `UPDATE promo_codes SET uses_count = uses_count + 1 WHERE code = $1`,
            [promoCode]
          );
        }
      }
    }

    res.sendStatus(200);
  }
);

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
  const customerId = userRes.rows[0]?.stripe_customer_id;

  if (!customerId) {
    res.status(400).json({ error: "No se encontró cliente de Stripe para este usuario" });
    return;
  }

  const origin = process.env.FRONTEND_URL ?? (req.headers.origin as string) ?? "http://localhost:5173";

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
  const { code, plan = "monthly" } = req.body as { code?: string; plan?: string };
  if (!code) {
    res.status(400).json({ error: "Código requerido" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT code, discount_percent, max_uses, uses_count, expires_at, active
         FROM promo_codes
        WHERE code = $1`,
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

    const baseAmount = plan === "annual" ? ANNUAL_CENTS : MONTHLY_CENTS;
    const discountedAmount = Math.round(baseAmount * (1 - pc.discount_percent / 100));

    res.json({
      valid: true,
      code: pc.code,
      discountPercent: pc.discount_percent,
      originalCents: baseAmount,
      discountedCents: discountedAmount,
    });
  } catch (err: any) {
    console.error("Promo validate error:", err);
    res.status(500).json({ error: "Error validando el código" });
  }
});

export default router;
