"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./public-config";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente del navegador (sesión en cookies). Se usa para Realtime y cargas. */
export function getBrowserClient() {
  client ??= createBrowserClient<Database>(
    SUPABASE_URL!,
    SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
