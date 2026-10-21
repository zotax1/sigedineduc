"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

const C = {
  s1: "var(--series-1)",
  s2: "var(--series-2)",
  good: "var(--status-good)",
  critical: "var(--status-critical)",
  neutral: "var(--status-neutral)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
};

const axisProps = { stroke: C.axis, fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, boxShadow: "0 4px 16px rgba(15,23,42,.08)" },
  labelStyle: { fontWeight: 600, color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "rgba(22,50,92,0.06)" },
};

function ChartCard({
  title,
  description,
  children,
  table,
  empty,
  height = 256,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  empty?: boolean;
  height?: number;
}) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {empty ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Sin datos para el período seleccionado.</p>
        ) : (
          <div className="w-full" style={{ height }} role="img" aria-label={`Gráfico: ${title}. Los datos están disponibles en la tabla siguiente.`}>
            {children}
          </div>
        )}
        <details className="group text-sm">
          <summary className="cursor-pointer select-none text-[13px] font-medium text-primary hover:underline">Ver datos en tabla</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-md border">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/60">
                <tr>
                  {table.headers.map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className={j > 0 ? "tabular px-3 py-1.5 text-right" : "px-3 py-1.5"}>
                        {typeof c === "number" ? formatNumber(c) : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export type TimelinePoint = { label: string; incoming: number; outgoing: number };

export function TimelineChart({ data, unitLabel }: { data: TimelinePoint[]; unitLabel: string }) {
  const empty = data.every((d) => d.incoming === 0 && d.outgoing === 0);
  return (
    <ChartCard
      title="Documentos entrantes y salientes"
      description={`Registros por ${unitLabel}`}
      empty={empty}
      table={{ headers: ["Período", "Entrantes", "Salientes"], rows: data.map((d) => [d.label, d.incoming, d.outgoing]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} allowDecimals={false} width={48} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="incoming" name="Entrantes" stroke={C.s1} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="outgoing" name="Salientes" stroke={C.s2} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StatusChart({ data }: { data: { label: string; incoming: number; outgoing: number }[] }) {
  return (
    <ChartCard
      title="Documentos por estado actual"
      description="Entrantes y salientes registrados en el período"
      empty={data.length === 0}
      height={Math.max(256, data.length * 30 + 60)}
      table={{ headers: ["Estado", "Entrantes", "Salientes"], rows: data.map((d) => [d.label, d.incoming, d.outgoing]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke={C.grid} />
          <XAxis type="number" {...axisProps} allowDecimals={false} />
          <YAxis type="category" dataKey="label" {...axisProps} width={150} interval={0} fontSize={12} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="incoming" name="Entrantes" fill={C.s1} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="outgoing" name="Salientes" fill={C.s2} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ProceduresByDepartmentChart({ data }: { data: { department: string; pending: number; overdue: number }[] }) {
  return (
    <ChartCard
      title="Trámites pendientes por dependencia"
      description="Pendientes y, de ellos, vencidos"
      empty={data.length === 0}
      table={{ headers: ["Dependencia", "Pendientes", "Vencidos"], rows: data.map((d) => [d.department, d.pending, d.overdue]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="department" {...axisProps} interval={0} fontSize={11} />
          <YAxis {...axisProps} allowDecimals={false} width={48} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pending" name="Pendientes" fill={C.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="overdue" name="Vencidos" fill={C.critical} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PriorityChart({ data }: { data: { name: string; documents: number; procedures: number }[] }) {
  const empty = data.every((d) => d.documents === 0 && d.procedures === 0);
  return (
    <ChartCard
      title="Carga de trabajo por prioridad"
      description="Documentos y trámites abiertos"
      empty={empty}
      table={{ headers: ["Prioridad", "Documentos", "Trámites"], rows: data.map((d) => [d.name, d.documents, d.procedures]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={48} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="documents" name="Documentos" fill={C.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="procedures" name="Trámites" fill={C.s2} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CompletionChart({ completed, pending, cancelled }: { completed: number; pending: number; cancelled: number }) {
  const data = [
    { name: "Completados", value: completed, color: C.good },
    { name: "Pendientes", value: pending, color: C.s1 },
    { name: "Cancelados", value: cancelled, color: C.neutral },
  ];
  const total = completed + pending + cancelled;
  return (
    <ChartCard
      title="Trámites completados y pendientes"
      description={`${formatNumber(total)} trámites iniciados en el período`}
      empty={total === 0}
      table={{ headers: ["Situación", "Trámites"], rows: data.map((d) => [d.name, d.value]) }}
    >
      <div className="flex h-full items-center gap-4">
        <div className="relative h-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip {...tooltipStyle} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-2xl font-semibold">{total ? Math.round((completed / total) * 100) : 0}%</span>
            <span className="text-xs text-muted-foreground">completados</span>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.name} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="tabular ml-auto pl-3 font-medium">{formatNumber(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
