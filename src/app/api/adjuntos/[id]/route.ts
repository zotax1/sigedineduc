import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga de adjuntos: verifica la autorización con la sesión del usuario
 * (RLS sobre metadatos y sobre el almacenamiento) y redirige a una URL
 * firmada válida durante 60 segundos.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debe iniciar sesión." }, { status: 401 });

  const { data: attachment } = await supabase
    .from("document_attachments")
    .select("storage_path, original_filename")
    .eq("id", id)
    .maybeSingle();
  if (!attachment) return NextResponse.json({ error: "Adjunto no encontrado o sin autorización." }, { status: 404 });

  const inline = request.nextUrl.searchParams.get("ver") === "1";
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(attachment.storage_path, 60, inline ? undefined : { download: attachment.original_filename });
  if (error || !data) return NextResponse.json({ error: "No tiene autorización para descargar este archivo." }, { status: 403 });

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
