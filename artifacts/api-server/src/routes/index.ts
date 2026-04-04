import { Router, type IRouter } from "express";
  import healthRouter from "./health.js";
  import animeRouter from "./anime.js";
  import authRouter from "./auth.js";
  import userRouter from "./user.js";
  import adminRouter from "./admin.js";

  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(animeRouter);
  router.use(authRouter);
  router.use(userRouter);
  router.use(adminRouter);

  export default router;
  