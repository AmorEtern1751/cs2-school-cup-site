import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tournamentRouter from "./tournament";
import liveRouter from "./live";
import serverRouter from "./server";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tournamentRouter);
router.use(liveRouter);
router.use(serverRouter);
router.use(adminRouter);

export default router;
