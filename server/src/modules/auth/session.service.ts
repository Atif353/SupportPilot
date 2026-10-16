import { verifyToken } from "./auth.service.js";
import { User } from "../models/user.model.js";

export async function authenticateSocket(token: string) {
  const claims = verifyToken(token, "access");
  if (!claims) return null;
  const user = await User.findOne({ _id: claims.sub, isActive: true }).select("role").lean();
  return user?.role === claims.role ? claims : null;
}
