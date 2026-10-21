import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./public-config";

const PUBLIC_PATHS = ["/login", "/recuperar", "/auth/confirm", "/auth/error"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renueva la sesión en cada solicitud y redirige al inicio de sesión cuando
 * no hay usuario autenticado. La autorización por rol se valida además en
 * cada página, acción del servidor y en la base de datos (RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // Sin configuración no se expone ninguna página interna.
    if (isPublic(request.nextUrl.pathname)) return response;
    return NextResponse.redirect(new URL("/login?error=configuracion", request.url));
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  let userId: string | null = null;
  let mustChangePassword = false;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = (data?.claims?.sub as string | undefined) ?? null;
    const appMeta = data?.claims?.app_metadata as { must_change_password?: boolean } | undefined;
    mustChangePassword = appMeta?.must_change_password === true;
  } catch {
    userId = null;
  }

  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (userId && mustChangePassword && pathname !== "/actualizar-contrasena" && !pathname.startsWith("/auth/") && !pathname.startsWith("/api/")) {
    const redirect = NextResponse.redirect(new URL("/actualizar-contrasena?motivo=temporal", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (userId && pathname === "/login") {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return response;
}
