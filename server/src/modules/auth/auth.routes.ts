import { Router } from "express";
import { requireAuth } from "./auth.middleware.js";
import { login, logout, me, refresh } from "./auth.controller.js";
import { loginRateLimit } from "../../common/middleware/rateLimit.js";

export const authRouter = Router();
authRouter.post("/login", loginRateLimit, login);
authRouter.post("/refresh", refresh);
authRouter.get("/me", requireAuth, me);
authRouter.post("/logout", requireAuth, logout);
