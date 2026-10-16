import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { errorCodes } from "../../common/errors/errorCodes.js";
import { verifyToken, type AuthClaims } from "./auth.service.js";
import { User } from "../models/user.model.js";

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const claims = token ? verifyToken(token, "access") : null;
  if (!claims) {
    next(
      new AppError({
        message: "Authentication is required.",
        code: errorCodes.UNAUTHORIZED,
        statusCode: 401,
      }),
    );
    return;
  }
  const user = await User.findOne({ _id: claims.sub, isActive: true }).select("role").lean();
  if (!user || user.role !== claims.role) {
    next(
      new AppError({
        message: "Your session is no longer valid. Please sign in again.",
        code: "UNAUTHORIZED",
        statusCode: 401,
      }),
    );
    return;
  }
  req.auth = claims;
  next();
};

export const requireRole =
  (...roles: AuthClaims["role"][]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(
        new AppError({
          message: "You do not have access to this resource.",
          code: errorCodes.FORBIDDEN,
          statusCode: 403,
        }),
      );
      return;
    }
    next();
  };
