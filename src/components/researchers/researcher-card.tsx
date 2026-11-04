import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RESEARCHER_AFFILIATION_SHORT, type ResearcherAffiliation } from "@/lib/domain";
import type { ResearcherCardData } from "@/lib/queries/researchers";
import { cn } from "@/lib/utils";
import { ResearcherAvatar } from "./researcher-avatar";

const AFFILIATION_TONE: Record<ResearcherAffiliation, "primary" | "info" | "success"> = {
  FACULTAD: "primary",
  INEDUC: "info",
  AMBOS: "success",
};

/** Resumen de títulos: los dos primeros y cuántos más hay. */
function titlesSummary(titles: string[]) {
  if (titles.length === 0) return "Sin títulos registrados";
  const shown = titles.slice(0, 2).join(" · ");
  return titles.length > 2 ? `${shown} · y ${titles.length - 2} más` : shown;
}

export function ResearcherCard({ researcher, href }: { researcher: ResearcherCardData; href?: string }) {
  const body = (
    <article className="flex h-full items-start gap-3 rounded-lg border bg-card p-3.5 transition-shadow group-hover:shadow-md" aria-label={researcher.full_name}>
      <ResearcherAvatar name={researcher.full_name} photoUrl={researcher.photoUrl} />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary">{researcher.full_name}</h3>
        <p className="font-mono text-xs tracking-wide text-primary">{researcher.code}</p>
        <p className={cn("line-clamp-2 text-xs leading-relaxed", researcher.academic_titles.length ? "text-muted-foreground" : "italic text-muted-foreground/80")} title={researcher.academic_titles.join("\n")}>
          {titlesSummary(researcher.academic_titles)}
        </p>
        <Badge tone={AFFILIATION_TONE[researcher.affiliation]} className="mt-0.5">
          {RESEARCHER_AFFILIATION_SHORT[researcher.affiliation]}
        </Badge>
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className="group block rounded-lg" aria-label={`Editar a ${researcher.full_name}`}>
      {body}
    </Link>
  ) : (
    <div className="h-full">{body}</div>
  );
}
