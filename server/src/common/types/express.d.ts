import type { AuthClaims } from "../../modules/auth/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthClaims;
    }
  }
}

export {};
