"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, Download, Search, X, ChevronLeft, ChevronRight, Filter, Users,
  CheckCircle, AlertTriangle, XCircle, CreditCard, Package, Ticket, DollarSign, CheckCircle2, TrendingUp,
} from "lucide-react";
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Assinatura {
  id: number;
  status: string;
  user_id: number;
  paciente_nome?: string | null;
  paciente_email: string;
  plano_chave: string;
  plano_nome: string;
  preco_mensal: number;
  sessoes_mensais: number;
  total_pago: number;
  cobrancas: number;
  ultima_cobranca: string | null;
  proxima_cobranca: string | null;
  sessoes_restantes: number;
  mp_subscription_id: string;
  created_at: string | null;
}

interface Resumo {
  assinantes: number;
  ativas: number;
  em_analise: number;
  pausadas: number;
  canceladas: number;
  receita_mensal_estimada: number;
  cobrado_no_mes: number;
  sessoes_vendidas_no_mes: number;
  sessoes_disponiveis: number;
  sessoes_usadas_no_mes: number;
}

interface PorPlano {
  chave: string;
  nome: string;
  ativo: boolean;
  assinantes_ativos: number;
  receita_mensal: number;
}

interface PontoSerie {
  mes: string;
  assinantes_pagantes: number;
  receita: number;
  sessoes_vendidas: number;
  sessoes_usadas: number;
  novas_assinaturas: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1] || m}/${y.slice(2)}`;
};

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "authorized", label: "Ativas" },
  { value: "pending", label: "Em análise" },
  { value: "paused", label: "Pausadas" },
  { value: "cancelled", label: "Canceladas" },
];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const statusLabel = (s: string) =>
  s === "authorized" ? "Ativa" : s === "pending" ? "Em análise" : s === "paused" ? "Pausada" : s === "cancelled" ? "Cancelada" : s;
const statusColor = (s: string) =>
  s === "authorized" ? "bg-green-100 text-green-700"
  : s === "pending" || s === "paused" ? "bg-yellow-100 text-yellow-700"
  : s === "cancelled" ? "bg-gray-100 text-gray-500"
  : "bg-gray-100 text-gray-700";

const csvCell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function AdminPacientesAssinaturasPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [porPlano, setPorPlano] = useState<PorPlano[]>([]);
  const [rows, setRows] = useState<Assinatura[]>([]);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [chartMetric, setChartMetric] = useState<"assinantes" | "receita" | "sessoes">("assinantes");
  const [planFilter, setPlanFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const d = await apiCall({ url: "/api/admin/pacientes/assinaturas", requireAuth: true });
      setResumo(d?.summary || null);
      setPorPlano(Array.isArray(d?.por_plano) ? d.por_plano : []);
      setRows(Array.isArray(d?.assinaturas) ? d.assinaturas : []);
      setSerie(Array.isArray(d?.serie_mensal) ? d.serie_mensal : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar o relatório");
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (planFilter !== "todos" && r.plano_chave !== planFilter) return false;
    if (statusFilter !== "todos" && r.status !== statusFilter) return false;
    if (search) {
      const t = search.toLowerCase();
      if (!(r.paciente_email || "").toLowerCase().includes(t) && !(r.paciente_nome || "").toLowerCase().includes(t)) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * perPage, current * perPage);

  const exportCsv = () => {
    const head = ["ID", "Paciente", "E-mail", "Plano", "Status", "Sessões restantes", "Cobranças", "Total pago", "Última cobrança", "Próxima cobrança", "ID Mercado Pago"];
    const lines = filtered.map((r) => [
      r.id, r.paciente_nome || "", r.paciente_email, r.plano_nome, statusLabel(r.status), r.sessoes_restantes,
      r.cobrancas, r.total_pago.toFixed(2).replace(".", ","), formatDate(r.ultima_cobranca), formatDate(r.proxima_cobranca), r.mp_subscription_id,
    ].map(csvCell).join(";"));
    const csv = [head.map(csvCell).join(";"), ...lines].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "assinaturas_pacientes.csv";
    a.click();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const cards = resumo
    ? [
        { label: "Assinantes", value: String(resumo.assinantes), sub: "com pacote ativo, em análise ou pausado", icon: <Users className="w-5 h-5 text-[#E03673]" /> },
        { label: "Assinaturas ativas", value: String(resumo.ativas), sub: `${resumo.em_analise} em análise · ${resumo.pausadas} pausadas`, icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
        { label: "Canceladas", value: String(resumo.canceladas), sub: "assinaturas", icon: <XCircle className="w-5 h-5 text-gray-500" /> },
        { label: "Receita mensal estimada", value: formatCurrency(resumo.receita_mensal_estimada), sub: "soma do preço dos planos ativos", icon: <DollarSign className="w-5 h-5 text-green-600" /> },
        { label: "Cobrado no mês", value: formatCurrency(resumo.cobrado_no_mes), sub: "cobranças aprovadas neste mês", icon: <CreditCard className="w-5 h-5 text-blue-500" /> },
        { label: "Sessões vendidas no mês", value: String(resumo.sessoes_vendidas_no_mes), sub: "créditos gerados neste mês", icon: <Package className="w-5 h-5 text-[#E03673]" /> },
        { label: "Sessões disponíveis", value: String(resumo.sessoes_disponiveis), sub: "créditos válidos ainda não usados", icon: <Ticket className="w-5 h-5 text-[#2F80D3]" /> },
        { label: "Sessões usadas no mês", value: String(resumo.sessoes_usadas_no_mes), sub: "consultas marcadas com crédito neste mês", icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinaturas de Pacientes</h1>
          <p className="text-gray-600 mt-1">Pacotes de sessões vendidos diretamente aos pacientes: assinantes, receita e sessões.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setPlanFilter("todos"); setStatusFilter("todos"); setSearch(""); setPage(1); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" /> Limpar filtros
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c42d63] transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={load} className="ml-auto underline">Tentar de novo</button>
        </div>
      )}

      {/* 📈 GRÁFICO — no topo, como nos demais relatórios. Dados REAIS mês a mês (cobranças e sessões). */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução dos Pacotes de Pacientes</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setChartMetric("assinantes")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "assinantes" ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700"}`}>Assinantes</button>
            <button onClick={() => setChartMetric("receita")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "receita" ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700"}`}>Receita (R$)</button>
            <button onClick={() => setChartMetric("sessoes")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "sessoes" ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700"}`}>Sessões</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ReLineChart data={serie.map((p) => ({ ...p, rotulo: rotuloMes(p.mes) }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tickFormatter={(v: number) => (chartMetric === "receita" ? `R$ ${v}` : String(v))} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => (chartMetric === "receita" ? formatCurrency(v) : v)} />
            <Legend />
            {chartMetric === "assinantes" && (
              <Line type="monotone" dataKey="assinantes_pagantes" stroke="#E03673" strokeWidth={2} dot={{ fill: "#E03673", r: 4 }} name="Assinantes com cobrança aprovada no mês" />
            )}
            {chartMetric === "receita" && (
              <Line type="monotone" dataKey="receita" stroke="#2F80D3" strokeWidth={2} dot={{ fill: "#2F80D3", r: 4 }} name="Cobrado no mês" />
            )}
            {chartMetric === "sessoes" && (
              <Line type="monotone" dataKey="sessoes_vendidas" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 4 }} name="Sessões vendidas" />
            )}
            {chartMetric === "sessoes" && (
              <Line type="monotone" dataKey="sessoes_usadas" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 4 }} name="Sessões usadas" />
            )}
            <ReferenceLine y={0} stroke="#ccc" />
          </ReLineChart>
        </ResponsiveContainer>
        {serie.every((p) => p.receita === 0 && p.sessoes_vendidas === 0) && (
          <p className="text-xs text-gray-400 mt-2 text-center">Ainda não há cobranças aprovadas nos últimos 12 meses. O gráfico começa a preencher na primeira venda.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">{c.label}</span>{c.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {porPlano.map((p) => (
          <div key={p.chave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{p.nome}{!p.ativo ? " (inativo)" : ""}</span>
              <Package className="w-4 h-4 text-[#E03673]" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{p.assinantes_ativos}</p>
            <p className="text-sm text-gray-500 mt-1">assinantes ativos · {formatCurrency(p.receita_mensal)}/mês</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Filter className="w-4 h-4 text-[#E03673]" /> Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              <option value="todos">Todos os planos</option>
              {porPlano.map((p) => <option key={p.chave} value={p.chave}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar paciente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome ou e-mail" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões restantes</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Total pago</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Última cobrança</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Próxima cobrança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhuma assinatura encontrada</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3">
                    <p className="text-sm font-medium text-gray-900">{r.paciente_nome || "—"}</p>
                    <p className="text-xs text-gray-500">{r.paciente_email}</p>
                  </td>
                  <td className="p-3"><span className="text-xs px-2 py-1 rounded-full bg-pink-50 text-[#E03673]">{r.plano_nome}</span></td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${statusColor(r.status)}`}>{statusLabel(r.status)}</span></td>
                  <td className="p-3 text-center text-sm font-semibold text-gray-900">{r.sessoes_restantes}</td>
                  <td className="p-3 text-right text-sm text-gray-700">{formatCurrency(r.total_pago)}<span className="block text-xs text-gray-400">{r.cobrancas} {r.cobrancas === 1 ? "cobrança" : "cobranças"}</span></td>
                  <td className="p-3 text-sm text-gray-600">{formatDate(r.ultima_cobranca)}</td>
                  <td className="p-3 text-sm text-gray-600">{r.status === "cancelled" ? "—" : formatDate(r.proxima_cobranca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <button onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm text-gray-600">Página {current} de {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        "Sessões restantes" é o saldo do paciente (todas as assinaturas dele). Consultas canceladas devolvem o crédito. A receita estimada é a soma do preço dos planos ativos; o valor realmente cobrado está em "Cobrado no mês".
      </p>
    </div>
  );
}
