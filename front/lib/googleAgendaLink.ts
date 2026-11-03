// asaas-agenda: link "Adicionar ao Google Agenda" (nao exige conexao nem autorizacao do usuario).
// Os horarios vao em UTC (formato que o Google espera) e o fuso de exibicao e Brasilia.
export function linkGoogleAgenda(p: {
  inicio: Date | string;
  fim: Date | string;
  titulo: string;
  detalhes?: string;
  local?: string | null;
}): string {
  const paraData = (d: Date | string): Date => {
    if (typeof d === "string" && !/(Z|[+-]\d{2}:?\d{2})$/.test(d)) d = d + "Z"; // sem fuso = UTC (o servidor guarda UTC)
    return new Date(d);
  };
  const fmt = (d: Date | string): string => paraData(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: p.titulo,
    dates: `${fmt(p.inicio)}/${fmt(p.fim)}`,
    ctz: "America/Sao_Paulo",
  });
  if (p.detalhes) q.set("details", p.detalhes);
  if (p.local) q.set("location", p.local);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
