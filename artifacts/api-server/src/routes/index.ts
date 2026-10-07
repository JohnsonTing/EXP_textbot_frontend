import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import dashboardRouter from "./dashboard";
import agentsRouter from "./agents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(contactsRouter);
router.use(conversationsRouter);
router.use(dashboardRouter);
router.use(agentsRouter);

export default router;
