import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:4000/api/v1"),
});

export const clientEnv = clientEnvSchema.parse(import.meta.env);
