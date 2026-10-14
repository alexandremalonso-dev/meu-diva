"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, Calendar, User, Search, Filter, ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STATUS_LABEL: Record<string, string> = {
  completed: "Realizada",
  confirmed: "Confirmada",
  cancelled_by_patient: "Cancelada (paciente)",
  cancelled_by_therapist: "Cancelada (terapeuta)",
};

function getStatusStyle(status: string, isCompleted: boolean) {
  if (status === "completed" || isCompleted) return { color: "#059669", bg: "#D1FAE5" };
  if (status.includes("cancelled")) return { color: "#DC2626", bg: "#FEE2E2" };
  return { color: "#D97706", bg: "#FEF3C7" };
}

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

const ITEMS_PER_PAGE = 15;

export default function TerapeutaFinanceiroPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonths, setSelectedMonths] = useState([new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchPatient, setSearchPatient] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("basico");

  useEffect(() => {
    (async () => {
      try {
        const [data, sub] = await Promise.all([
          api("/api/therapist/financial-report"),
          api("/api/payments/therapist/subscription").catch(() => null),
        ]);
        setSessions(Array.isArray(data) ? data : []);
        if (sub?.subscription?.plan) setSubscriptionPlan(sub.subscription.plan);
      } catch { setError("Erro ao carregar relatório."); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const d = new Date(s.date || s.starts_at || "");
      const monthMatch = selectedMonths.includes(d.getMonth()) && d.getFullYear() === selectedYear;
      const patientMatch = !searchPatient || s.patient_name?.toLowerCase().includes(searchPatient.toLowerCase()) || s.patient_email?.toLowerCase().includes(searchPatient.toLowerCase());
      const statusMatch = statusFilter === "todos" || s.status === statusFilter;
      return monthMatch && patientMatch && statusMatch;
    });
  }, [sessions, selectedMonths, selectedYear, searchPatient, statusFilter]);

  const summary = useMemo(() => ({
    total: filtered.filter(s => s.is_completed || s.status === "completed").reduce((a, s) => a + (s.net_amount || 0), 0),
    sessions: filtered.filter(s => s.is_completed || s.status === "completed").length,
    pending: filtered.filter(s => s.status === "confirmed" && !s.is_completed).length,
    cancelled: filtered.filter(s => s.status.includes("cancelled")).length,
  }), [filtered]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    setPage(1);
  };

  const PLAN_COMMISSION: Record<string, number> = { basico: 20, essencial: 20, profissional: 10, premium: 3 };
  const commission = PLAN_COMMISSION[subscriptionPlan] || 20;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Relatório Financeiro</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Comissão atual: {commission}% · Plano {subscriptionPlan}</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Total recebido", value: brl(summary.total), color: "#059669", bg: "#D1FAE5" },
            { label: "Sessões realizadas", value: summary.sessions, color: COLORS.secondary, bg: "#DBEAFE" },
            { label: "Aguardando", value: summary.pending, color: "#D97706", bg: "#FEF3C7" },
            { label: "Canceladas", value: summary.cancelled, color: "#DC2626", bg: "#FEE2E2" },
          ].map((s, i) => (
            <div key={i} style={{ background: "white", borderRadius: 12, padding: "12px 14px", border: "0.5px solid #E5E7EB" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filtro de meses */}
        <div style={{ background: "white", borderRadius: 14, padding: 14, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setSelectedYear(y => y - 1)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={14} /></button>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} style={{ background: showFilters ? COLORS.primary + "15" : "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: showFilters ? COLORS.primary : "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Filter size={12} /> Filtros
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {MONTHS.map((m, i) => (
              <button key={i} onClick={() => toggleMonth(i)}
                style={{ padding: "6px 0", borderRadius: 8, border: "none", background: selectedMonths.includes(i) ? COLORS.primary : "#F3F4F6", color: selectedMonths.includes(i) ? "white" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {m}
              </button>
            ))}
          </div>

          {showFilters && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                <input value={searchPatient} onChange={e => { setSearchPatient(e.target.value); setPage(1); }} placeholder="Buscar paciente..."
                  style={{ width: "100%", padding: "10px 10px 10px 32px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }}>
                <option value="todos">Todos os status</option>
                <option value="completed">Realizada</option>
                <option value="confirmed">Confirmada (pendente)</option>
                <option value="cancelled_by_patient">Cancelada pelo paciente</option>
                <option value="cancelled_by_therapist">Cancelada pelo terapeuta</option>
              </select>
            </div>
          )}
        </div>

        {/* Lista de sessões */}
        <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #E5E7EB", overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Loader2 size={28} className="animate-spin" color={COLORS.primary} /></div>
          ) : paginated.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Calendar size={32} color="#D1D5DB" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhuma sessão no período</div>
            </div>
          ) : (
            paginated.map((s, i) => {
              const statusStyle = getStatusStyle(s.status, s.is_completed);
              const photo = getPhotoSrc(s.patient_foto_url);
              return (
                <div key={s.id || i} style={{ padding: "12px 14px", borderBottom: i < paginated.length - 1 ? "0.5px solid #F3F4F6" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={16} color="#9CA3AF" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.patient_name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.date} {s.time && `· ${s.time}`}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.status === "cancelled_by_therapist" ? "#DC2626" : "#059669" }}>
                      {s.status === "cancelled_by_therapist" ? "-" : ""}{brl(s.net_amount || 0)}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 8, background: statusStyle.bg, color: statusStyle.color }}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderTop: "0.5px solid #E5E7EB" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "none", border: "none", cursor: "pointer", color: page === 1 ? "#D1D5DB" : COLORS.dark }}><ChevronLeft size={20} /></button>
              <span style={{ fontSize: 13, color: "#6B7280" }}>Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "none", border: "none", cursor: "pointer", color: page === totalPages ? "#D1D5DB" : COLORS.dark }}><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
