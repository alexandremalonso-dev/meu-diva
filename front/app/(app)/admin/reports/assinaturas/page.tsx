"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from '@/lib/utils';
import { 
  Loader2, TrendingUp, Download, Search, X,
  ChevronLeft, ChevronRight, Filter, CheckCircle, XCircle,
  Calendar, CreditCard, AlertTriangle, CheckCircle2, Users,
  History, Receipt
} from "lucide-react";
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface SubscriptionReport {
  id: number; therapist_id: number; therapist_name: string; therapist_email: string;
  therapist_foto_url?: string; plan: string; status: string; stripe_subscription_id?: string;
  current_period_start?: string; current_period_end?: string; cancel_at_period_end: boolean;
  created_at: string; updated_at: string; days_until_expiration?: number;
  is_overdue?: boolean; payment_status?: string; payment_provider?: string;
}
interface BillingEntry { id: string; date: string; amount: number; status: string; description: string; }
interface EarningEntry { date: string; session_price: number; commission_rate: number; commission_amount: number; net_amount: number; }
interface MpSummarized { charged_quantity: number; charged_amount: number; last_charged_date: string | null; last_charged_amount: number; semaphore: string; next_payment_date: string | null; status: string; }
interface HistoryData {
  therapist_name: string; plan: string; billing_history: BillingEntry[];
  mp_summarized: MpSummarized | null;
  earnings_summary: { total_sessions: number; total_earned: number; total_commission_paid: number; recent: EarningEntry[]; };
}
interface PlanRevenue { plan: string; quantidade: number; receita_mensal: number; receita_anual: number; }
interface SummaryReport { total_assinantes: number; total_ativos: number; total_atraso: number; total_cancelados: number; receita_total_mensal: number; receita_total_historico: number; renovacoes_proximas: number; }
interface ChartDataPoint { month: string; assinantes: number; receita: number; }

const PLAN_OPTIONS = [
  { value: "todos", label: "Todos os planos" }, { value: "essencial", label: "Essencial" },
  { value: "profissional", label: "Profissional" }, { value: "premium", label: "Premium" }
];
const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" }, { value: "active", label: "Ativas" },
  { value: "paused", label: "Pausadas" }, { value: "past_due", label: "Atrasadas" },
  { value: "canceled", label: "Canceladas" }
];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const getFotoUrl = (f?: string) => { if (!f) return null; if (f.startsWith('http')) return f; return getFotoSrc(f) ?? ""; };
const getPlanColor = (p: string) => p === "profissional" ? "bg-blue-100 text-blue-700" : p === "premium" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700";
const getStatusColor = (s: string, o?: boolean) => s === "paused" ? "bg-yellow-100 text-yellow-700" : (s === "active" && !o) ? "bg-green-100 text-green-700" : (s === "past_due" || o) ? "bg-red-100 text-red-700" : s === "canceled" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700";
const getStatusLabel = (s: string, o?: boolean): string => s === "paused" ? "Pausada" : (s === "active" && !o) ? "Ativa" : (s === "past_due" || o) ? "Atrasada" : s === "canceled" ? "Cancelada" : s;

function HistoryModal({ sub, onClose }: { sub: SubscriptionReport; onClose: () => void }) {
  const { execute: apiCall } = useApi();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall({ url: `/api/admin/reports/therapist-subscription-history/${sub.therapist_id}`, requireAuth: true });
        setData(result);
      } catch {
        setData({ therapist_name: sub.therapist_name, plan: sub.plan, billing_history: [], mp_summarized: null, earnings_summary: { total_sessions: 0, total_earned: 0, total_commission_paid: 0, recent: [] } });
      } finally { setLoading(false); }
    }
    load();
  }, [sub.therapist_id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center"><History className="w-5 h-5 text-[#F59E0B]" /></div>
            <div><h2 className="font-bold text-gray-900">{sub.therapist_name}</h2><p className="text-xs text-gray-500">{sub.therapist_email} · Plano {sub.plan}</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" /></div>
          ) : (
            <>
              {data?.mp_summarized && (
                <div className="p-4 bg-[#F59E0B]/5 rounded-xl border border-[#F59E0B]/20">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#F59E0B]" /> Resumo Mercado Pago
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Cobranças realizadas</p>
                      <p className="text-lg font-bold text-gray-900">{data.mp_summarized.charged_quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Total cobrado</p>
                      <p className="text-lg font-bold text-green-700">{formatCurrency(data.mp_summarized.charged_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Última cobrança</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(data.mp_summarized.last_charged_date)}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(data.mp_summarized.last_charged_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Próxima cobrança</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(data.mp_summarized.next_payment_date)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${data.mp_summarized.semaphore === "green" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {data.mp_summarized.semaphore === "green" ? "Em dia" : "Atenção"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {data && data.earnings_summary.total_sessions > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Resumo de Ganhos na Plataforma</h3>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 bg-green-50 rounded-xl text-center"><p className="text-xs text-green-600 mb-1">Total líquido</p><p className="text-base font-bold text-green-700">{formatCurrency(data.earnings_summary.total_earned)}</p></div>
                    <div className="p-3 bg-red-50 rounded-xl text-center"><p className="text-xs text-red-600 mb-1">Comissões pagas</p><p className="text-base font-bold text-red-600">{formatCurrency(data.earnings_summary.total_commission_paid)}</p></div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center"><p className="text-xs text-blue-600 mb-1">Sessões</p><p className="text-base font-bold text-blue-700">{data.earnings_summary.total_sessions}</p></div>
                  </div>
                  {data.earnings_summary.recent.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Últimas sessões</p>
                      <div className="space-y-2">
                        {data.earnings_summary.recent.map((e, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                            <div><p className="text-gray-600 text-xs">{formatDate(e.date)}</p><p className="text-xs text-gray-400">Comissão {e.commission_rate}% = {formatCurrency(e.commission_amount)}</p></div>
                            <div className="text-right"><p className="font-semibold text-green-700 text-sm">+{formatCurrency(e.net_amount)}</p><p className="text-xs text-gray-400">de {formatCurrency(e.session_price)}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Receipt className="w-4 h-4 text-[#F59E0B]" /> Histórico de Cobranças</h3>
                {!data || data.billing_history.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma cobrança encontrada</p>
                    {sub.payment_provider === "apple_iap" && <p className="text-xs mt-1">Assinatura Apple — histórico no App Store Connect</p>}
                    {sub.plan === "essencial" && <p className="text-xs mt-1">Plano gratuito — sem cobranças</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.billing_history.map(bill => (
                      <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div><p className="text-sm font-medium text-gray-900">{bill.description}</p><p className="text-xs text-gray-500">{formatDate(bill.date)}</p></div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(bill.amount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${bill.status === "approved" ? "bg-green-100 text-green-700" : bill.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {bill.status === "approved" ? "Pago" : bill.status === "pending" ? "Pendente" : bill.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalhes da Assinatura</h3>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div><span className="text-gray-400">Status:</span> <span className={`ml-1 px-1.5 py-0.5 rounded ${getStatusColor(sub.status, sub.is_overdue)}`}>{getStatusLabel(sub.status, sub.is_overdue)}</span></div>
                  <div><span className="text-gray-400">Plano:</span> <span className="ml-1 font-medium capitalize">{sub.plan}</span></div>
                  <div><span className="text-gray-400">Início:</span> <span className="ml-1 font-medium">{formatDate(sub.current_period_start || null)}</span></div>
                  <div><span className="text-gray-400">Vencimento:</span> <span className="ml-1 font-medium">{formatDate(sub.current_period_end || null)}</span></div>
                  <div><span className="text-gray-400">Provedor:</span> <span className="ml-1 font-medium">{sub.payment_provider === "apple_iap" ? "Apple" : "Mercado Pago"}</span></div>
                  {sub.stripe_subscription_id && <div className="col-span-2"><span className="text-gray-400">ID MP:</span> <span className="ml-1 font-mono text-xs">{sub.stripe_subscription_id}</span></div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAssinaturasReportPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionReport[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionReport[]>([]);
  const [planRevenue, setPlanRevenue] = useState<PlanRevenue[]>([]);
  const [summary, setSummary] = useState<SummaryReport>({ total_assinantes: 0, total_ativos: 0, total_atraso: 0, total_cancelados: 0, receita_total_mensal: 0, receita_total_historico: 0, renovacoes_proximas: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<"assinantes" | "receita">("assinantes");
  const [planFilter, setPlanFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTherapist, setSearchTherapist] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSub, setSelectedSub] = useState<SubscriptionReport | null>(null);
  const itemsPerPage = 15;

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [therapistsData, therapistsProfiles, revenueReal] = await Promise.allSettled([
        apiCall({ url: "/api/admin/reports/therapists-by-plan", requireAuth: true }),
        apiCall({ url: "/api/therapists", requireAuth: true }).catch(() => []),
        apiCall({ url: "/api/admin/reports/subscriptions-revenue-real", requireAuth: true }).catch(() => null)
      ]);

      let fotoMap = new Map<number, string>();
      if (therapistsProfiles.status === "fulfilled" && Array.isArray(therapistsProfiles.value)) {
        (therapistsProfiles.value as any[]).forEach((t: any) => {
          if (t.user_id && t.foto_url) fotoMap.set(t.user_id, t.foto_url);
          if (t.id && t.foto_url && !fotoMap.has(t.id)) fotoMap.set(t.id, t.foto_url);
        });
      }

      const revenueData = revenueReal.status === "fulfilled" ? revenueReal.value : null;

      if (therapistsData.status === "fulfilled" && therapistsData.value && Array.isArray(therapistsData.value)) {
        const now = new Date();
        const processed: SubscriptionReport[] = (therapistsData.value as any[]).map((t: any) => {
          // 🔥 isOverdue baseado APENAS no status real do banco (Mercado Pago)
          const isOverdue = t.subscription_status === "past_due";
          let daysUntilExpiration = null;
          if (t.current_period_end) {
            daysUntilExpiration = Math.ceil((new Date(t.current_period_end).getTime() - now.getTime()) / (1000 * 3600 * 24));
          }
          return {
            id: t.therapist_id, therapist_id: t.therapist_id, therapist_name: t.name, therapist_email: t.email,
            therapist_foto_url: fotoMap.get(t.user_id) || fotoMap.get(t.therapist_id),
            plan: t.plan, status: t.subscription_status, stripe_subscription_id: t.stripe_subscription_id,
            current_period_start: t.current_period_start, current_period_end: t.current_period_end,
            cancel_at_period_end: t.cancel_at_period_end || false, created_at: t.created_at, updated_at: t.updated_at,
            days_until_expiration: daysUntilExpiration, is_overdue: isOverdue,
            payment_status: isOverdue ? "past_due" : t.subscription_status, payment_provider: t.payment_provider,
          };
        });
        setSubscriptions(processed);

        // 🔥 só contar planos pagos como "assinantes" e "ativos"
        const pagos = processed.filter(s => s.plan !== "essencial");
        const ativos = processed.filter(s => s.plan !== "essencial" && s.status === "active" && !s.is_overdue);
        const atraso = processed.filter(s => s.is_overdue || s.status === "past_due");
        const cancelados = processed.filter(s => s.status === "canceled");
        const renovacoesProximas = processed.filter(s =>
          s.plan !== "essencial" && s.status === "active" &&
          s.days_until_expiration && s.days_until_expiration <= 7 && s.days_until_expiration > 0
        ).length;

        const planosMap: Record<string, { quantidade: number; receita_mensal: number; receita_anual: number }> = {
          essencial: { quantidade: 0, receita_mensal: 0, receita_anual: 0 },
          profissional: { quantidade: 0, receita_mensal: 0, receita_anual: 0 },
          premium: { quantidade: 0, receita_mensal: 0, receita_anual: 0 }
        };
        processed.forEach(s => {
          if (s.status === "active" && !s.is_overdue && planosMap[s.plan]) {
            const m = s.plan === "profissional" ? 79 : s.plan === "premium" ? 149 : 0;
            planosMap[s.plan].quantidade += 1;
            planosMap[s.plan].receita_mensal += m;
            planosMap[s.plan].receita_anual += m * 12;
          }
        });
        const planRevenueArray: PlanRevenue[] = [
          { plan: "Essencial", ...planosMap.essencial },
          { plan: "Profissional", ...planosMap.profissional },
          { plan: "Premium", ...planosMap.premium }
        ];
        setPlanRevenue(planRevenueArray);

        // 🔥 receita real do MP se disponível, senão fallback para cálculo estimado
        const receitaMensalReal = revenueData?.total_mensal_real ?? planRevenueArray.reduce((s, p) => s + p.receita_mensal, 0);
        const receitaHistorico = revenueData?.total_cobrado_historico ?? planRevenueArray.reduce((s, p) => s + p.receita_anual, 0);

        setSummary({
          total_assinantes: pagos.length,
          total_ativos: ativos.length,
          total_atraso: atraso.length,
          total_cancelados: cancelados.length,
          receita_total_mensal: receitaMensalReal,
          receita_total_historico: receitaHistorico,
          renovacoes_proximas: renovacoesProximas
        });

        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        setChartData(months.map((month, i) => ({ month, assinantes: Math.round(ativos.length * (i + 1) / 12), receita: receitaMensalReal * (i + 1) / 12 })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [user?.id, apiCall]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (subscriptions.length === 0) return;
    let filtered = [...subscriptions];
    if (planFilter !== "todos") filtered = filtered.filter(s => s.plan === planFilter);
    if (statusFilter === "active") filtered = filtered.filter(s => s.status === "active" && !s.is_overdue);
    else if (statusFilter === "paused") filtered = filtered.filter(s => s.status === "paused");
    else if (statusFilter === "past_due") filtered = filtered.filter(s => s.is_overdue || s.status === "past_due");
    else if (statusFilter === "canceled") filtered = filtered.filter(s => s.status === "canceled");
    if (searchTherapist) {
      const t = searchTherapist.toLowerCase();
      filtered = filtered.filter(s => s.therapist_name.toLowerCase().includes(t) || s.therapist_email.toLowerCase().includes(t));
    }
    setFilteredSubscriptions(filtered);
    setCurrentPage(1);
  }, [subscriptions, planFilter, statusFilter, searchTherapist]);

  const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);
  const paginated = filteredSubscriptions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportToCSV = () => {
    const rows = filteredSubscriptions.map(s => [s.therapist_id, s.therapist_name, s.therapist_email, s.plan, getStatusLabel(s.status, s.is_overdue), s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-BR") : "-", s.is_overdue ? "Atrasado" : "Em dia"]);
    const csv = [["ID","Terapeuta","Email","Plano","Status","Vencimento","Pagamento"], ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "relatorio_assinaturas.csv";
    a.click();
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {selectedSub && <HistoryModal sub={selectedSub} onClose={() => setSelectedSub(null)} />}

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
          <p className="text-gray-600 mt-1">Acompanhe o faturamento e gestão financeira de planos e assinaturas dos terapeutas</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setPlanFilter("todos"); setStatusFilter("todos"); setSearchTherapist(""); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"><X className="w-4 h-4" /> Limpar filtros</button>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#d97706] transition-colors"><Download className="w-4 h-4" /> Exportar CSV</button>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#F59E0B]" /><h3 className="font-semibold text-gray-900">Evolução de Assinaturas Pagas</h3></div>
          <div className="flex gap-2">
            <button onClick={() => setChartMetric("assinantes")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "assinantes" ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-700'}`}>Assinantes</button>
            <button onClick={() => setChartMetric("receita")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "receita" ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-700'}`}>Receita (R$)</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => chartMetric === "receita" ? `R$ ${v}` : String(v)} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => chartMetric === "receita" ? formatCurrency(v) : v} />
            <Legend />
            {chartMetric === "assinantes" && <Line type="monotone" dataKey="assinantes" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 4 }} name="Assinantes pagos ativos" />}
            {chartMetric === "receita" && <Line type="monotone" dataKey="receita" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 4 }} name="Receita mensal real" />}
            <ReferenceLine y={0} stroke="#ccc" />
          </ReLineChart>
        </ResponsiveContainer>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: "Assinantes Pagos", value: summary.total_assinantes, sub: "Profissional + Premium", icon: <Users className="w-5 h-5 text-[#F59E0B]" /> },
          { label: "Assinaturas Ativas", value: summary.total_ativos, sub: "planos pagos em dia", icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
          { label: "Em Atraso", value: summary.total_atraso, sub: "status past_due no MP", icon: <AlertTriangle className="w-5 h-5 text-red-500" /> },
          { label: "Canceladas", value: summary.total_cancelados, sub: "assinaturas", icon: <XCircle className="w-5 h-5 text-gray-500" /> },
          { label: "Receita Mensal Real", value: formatCurrency(summary.receita_total_mensal), sub: "último ciclo MP", icon: <CreditCard className="w-5 h-5 text-green-500" /> },
          { label: "Total Histórico MP", value: formatCurrency(summary.receita_total_historico), sub: "desde o início", icon: <TrendingUp className="w-5 h-5 text-blue-500" /> },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">{card.label}</span>{card.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Cards por plano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[{ key: "Essencial" }, { key: "Profissional" }, { key: "Premium" }].map(({ key }) => {
          const plano = planRevenue.find(p => p.plan === key) || { plan: key, quantidade: 0, receita_mensal: 0, receita_anual: 0 };
          return (
            <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{key}</span>
                <CheckCircle2 className={`w-4 h-4 ${key === "Premium" ? "text-purple-500" : key === "Profissional" ? "text-blue-500" : "text-gray-500"}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{plano.quantidade}</p>
              <p className="text-sm text-gray-500 mt-1">terapeutas ativos</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Filter className="w-4 h-4 text-[#F59E0B]" /> Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none">
              {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Terapeuta</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTherapist} onChange={e => setSearchTherapist(e.target.value)} placeholder="Nome ou e-mail" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Renovação</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Histórico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Nenhum terapeuta encontrado</td></tr>
              ) : paginated.map(sub => {
                const fotoUrl = getFotoUrl(sub.therapist_foto_url);
                return (
                  <tr key={sub.therapist_id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-sm text-gray-600">#{sub.therapist_id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#F59E0B] to-[#F59E0B]/80 flex items-center justify-center flex-shrink-0">
                          {fotoUrl ? (
                            <img src={fotoUrl} alt={sub.therapist_name} className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none'; if (e.currentTarget.parentElement) { e.currentTarget.parentElement.innerHTML = sub.therapist_name?.charAt(0).toUpperCase() || "T"; e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#F59E0B]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"; } }} />
                          ) : (
                            <span className="text-white text-xs font-bold">{sub.therapist_name?.charAt(0).toUpperCase() || "T"}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{sub.therapist_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-500">{sub.therapist_email}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${getPlanColor(sub.plan)}`}>{sub.plan === "essencial" ? "Essencial" : sub.plan === "profissional" ? "Profissional" : "Premium"}</span></td>
                    <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(sub.status, sub.is_overdue)}`}>{getStatusLabel(sub.status, sub.is_overdue)}</span></td>
                    <td className="p-3 text-sm text-gray-600">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : "-"}</td>
                    <td className="p-3 text-center">
                      {sub.cancel_at_period_end ? <span className="text-xs text-red-500">Cancelará no vencimento</span>
                        : sub.days_until_expiration !== null && sub.days_until_expiration !== undefined && sub.days_until_expiration <= 7 && sub.days_until_expiration > 0 ? <span className="text-xs text-yellow-500">Renova em {sub.days_until_expiration}d</span>
                        : sub.is_overdue ? <span className="text-xs text-red-500">Atrasado</span>
                        : <span className="text-xs text-green-500">Em dia</span>}
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => setSelectedSub(sub)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg hover:bg-[#F59E0B]/20 transition-colors">
                        <History className="w-3.5 h-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}