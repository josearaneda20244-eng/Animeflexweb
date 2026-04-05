import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import animeRouter from "./anime.js";
import authRouter from "./auth.js";
import userRouter, { publicUserRouter } from "./user.js";
import adminRouter from "./admin.js";
import commentsRouter from "./comments.js";
import membershipRouter from "./membership.js";
import ratingsRouter from "./ratings.js";
import announcementsRouter from "./announcements.js";
import searchLogRouter from "./search.js";
import storageRouter from "./storage.js";
import stripeRouter from "./stripe.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(animeRouter);
router.use(authRouter);
router.use(publicUserRouter);
// Public routes must come BEFORE userRouter (which applies requireAuth globally)
router.use(commentsRouter);
router.use(ratingsRouter);
router.use(announcementsRouter);
router.use(searchLogRouter);
// Stripe + promo codes (validate is public, checkout requires auth internally)
router.use(stripeRouter);
// Auth-required routes
router.use(userRouter);
router.use(adminRouter);
router.use(membershipRouter);

export default router;
