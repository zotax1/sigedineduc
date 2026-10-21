/**
 * Configuración pública de Supabase. Se aceptan también los nombres que crea
 * la integración de Supabase en Vercel (NEXT_PUBLIC_SUPABASE_ANON_KEY).
 * Los accesos son literales para que Next.js los incruste en el navegador.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
