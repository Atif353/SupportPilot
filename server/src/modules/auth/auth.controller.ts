import type { Request, Response } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { errorCodes } from "../../common/errors/errorCodes.js";
import { asRecord, email, requiredString } from "../../common/validation.js";
import { Customer } from "../models/customer.model.js";
import { User } from "../models/user.model.js";
import { verifyToken, verifyPassword } from "./auth.service.js";
import { revokeFamily, rotateSession, startSession } from "./refresh-session.service.js";

export const login = async (req: Request, res: Response): Promise<void> => {
  const body = asRecord(req.body);
  const emailAddress = email(body.email);
  const password = requiredString(body.password, "password", { trim: false, max: 1024 });
  const user = await User.findOne({ email: emailAddress, isActive: true });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AppError({
      message: "Invalid email or password.",
      code: errorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  }
  user.lastLoginAt = new Date();
  await user.save();
  const claims = { sub: user.id, role: user.role as "CUSTOMER" | "SUPPORT" | "ADMIN" };
  const customer =
    user.role === "CUSTOMER" ? await Customer.findOne({ user: user._id }).lean() : null;
  res.json({
    success: true,
    data: {
      ...(await startSession(claims)),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      customerId: customer?._id.toString(),
    },
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = requiredString(asRecord(req.body).refreshToken, "refreshToken");
  const claims = verifyToken(token, "refresh");
  if (!claims)
    throw new AppError({
      message: "Refresh token is invalid or expired.",
      code: errorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  const user = await User.findOne({ _id: claims.sub, isActive: true }).select("role").lean();
  const tokens = user && user.role === claims.role ? await rotateSession(claims) : null;
  if (!tokens)
    throw new AppError({
      message: "Session is no longer valid.",
      code: errorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  res.json({ success: true, data: tokens });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = asRecord(req.body ?? {}).refreshToken;
  const claims = typeof token === "string" ? verifyToken(token, "refresh") : null;
  if (claims?.fam && claims.sub === req.auth?.sub) await revokeFamily(claims.fam);
  res.json({ success: true, data: { loggedOut: true } });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.auth?.sub).select("-passwordHash").lean();
  if (!user)
    throw new AppError({ message: "User not found.", code: errorCodes.NOT_FOUND, statusCode: 404 });
  res.json({ success: true, data: user });
};
