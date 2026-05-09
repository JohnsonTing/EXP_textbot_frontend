import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/me", authMiddleware, (req, res) => {
  res.json({ name: req.user!.name, email: req.user!.email, role: req.user!.role });
});

export default router;
