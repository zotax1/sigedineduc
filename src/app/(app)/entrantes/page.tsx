import type { Metadata } from "next";
import { DocumentListPage } from "@/components/documents/document-list-page";
import type { SearchParams } from "@/lib/filters";

export const metadata: Metadata = { title: "Documentos entrantes" };

export default async function IncomingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <DocumentListPage direction="ENTRANTE" searchParams={await searchParams} />;
}
