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

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(animeRouter);
router.use(authRouter);
router.use(publicUserRouter);
router.use(userRouter);
router.use(adminRouter);
router.use(commentsRouter);
router.use(membershipRouter);
router.use(ratingsRouter);
router.use(announcementsRouter);
router.use(searchLogRouter);

export default router;
