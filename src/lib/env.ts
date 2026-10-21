import { z } from "zod";

/**
 * Variables de entorno. Las públicas (NEXT_PUBLIC_*) se incrustan en el
 * cliente durante la compilación; las demás solo existen en el servidor.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY es obligatoria"),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError) {
  return error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cachedPublic: PublicEnv | null = null;
export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  // Acceso explícito para que Next.js incruste los valores en el cliente.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Configuración incompleta de SIGED-INEDUC:\n${format(parsed.error)}`);
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

let cachedServer: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() solo puede usarse en el servidor.");
  }
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse({
    ...publicEnv(),
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Configuración incompleta de SIGED-INEDUC:\n${format(parsed.error)}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}
