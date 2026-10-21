import type { Metadata } from "next";
import { DocumentListPage } from "@/components/documents/document-list-page";
import type { SearchParams } from "@/lib/filters";

export const metadata: Metadata = { title: "Documentos salientes" };

export default async function OutgoingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <DocumentListPage direction="SALIENTE" searchParams={await searchParams} />;
}
