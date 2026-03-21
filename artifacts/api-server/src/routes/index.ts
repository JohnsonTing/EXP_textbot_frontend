import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(conversationsRouter);
router.use(dashboardRouter);

export default router;
