import { Router } from "express";
import statusRouter from "./status.js";
import promptsRouter from "./prompts.js";

const router = Router();

router.use("/status", statusRouter);
router.use("/prompts", promptsRouter);

export { router as v1Router };
export default router;

