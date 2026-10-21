import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { DocumentFiltersForm } from "./document-filters";
import { DocumentListShell, DocumentTable } from "./document-table";
import { ExportMenu } from "./export-menu";
import { getSessionUser } from "@/lib/auth";
import { getCatalogs } from "@/lib/queries/catalogs";
import { listDocuments } from "@/lib/queries/documents";
import { hasActiveDocumentFilters, parseDocumentFilters, withParams, type SearchParams } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import type { DocumentDirection } from "@/lib/domain";

const COPY = {
  ENTRANTE: {
    title: "Documentos entrantes",
    description: "Comunicaciones y documentos recibidos por INEDUC de otras dependencias, facultades o instituciones.",
    basePath: "/entrantes",
    newLabel: "Registrar entrante",
    report: "entrantes",
  },
  SALIENTE: {
    title: "Documentos salientes",
    description: "Documentos emitidos por INEDUC. Ruta obligatoria: INEDUC → Dirección de Investigación → Decanato.",
    basePath: "/salientes",
    newLabel: "Registrar saliente",
    report: "salientes",
  },
} as const;

export async function DocumentListPage({ direction, searchParams }: { direction: DocumentDirection; searchParams: SearchParams }) {
  const user = await getSessionUser();
  const copy = COPY[direction];
  const filters = parseDocumentFilters(searchParams, direction);
  const [catalogs, result] = await Promise.all([getCatalogs(), listDocuments(filters)]);
  const filtered = hasActiveDocumentFilters(filters);
  const newButton = user?.isAdmin ? (
    <Button asChild>
      <Link href={`${copy.basePath}/nuevo`}>
        <Plus aria-hidden /> {copy.newLabel}
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <ExportMenu report={copy.report} query={withParams(searchParams, {})} />
            {newButton}
          </>
        }
      />
      <DocumentListShell>
        <DocumentFiltersForm basePath={copy.basePath} filters={filters} catalogs={catalogs} direction={direction} />
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-muted-foreground" aria-live="polite">
          <span>
            <span className="tabular font-semibold text-foreground">{formatNumber(result.total)}</span>{" "}
            {result.total === 1 ? "documento encontrado" : "documentos encontrados"}
          </span>
        </div>
        {result.error ? (
          <div className="p-4">
            <Alert tone="danger">No se pudieron cargar los documentos. Intente de nuevo.</Alert>
          </div>
        ) : (
          <DocumentTable
            rows={result.rows}
            total={result.total}
            filters={filters}
            params={searchParams}
            basePath={copy.basePath}
            direction={direction}
            filtered={filtered}
            emptyAction={newButton}
          />
        )}
      </DocumentListShell>
    </>
  );
}
