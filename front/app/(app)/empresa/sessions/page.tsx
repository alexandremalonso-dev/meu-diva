"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import Link from "next/link";
import {
  Calendar, Loader2, Eye, Search, X,
  ChevronLeft, ChevronRight, CheckCircle,
  XCircle, HelpCircle, AlertCircle, TrendingUp,
  Users, DollarSign, Clock, Filter, User
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Session {
  id: number;
  date: string;
  colaborador_id: number;
  colaborador_name: string;
  colaborador_email: string;
  colaborador_departamento?: string;
  therapist_name: string;
  therapist_id: number;
  status: string;
  session_price: number;
  is_completed: boolean;
  is_invoiced: boolean;
  has_medical_record: boolean;
}

interface ChartDataPoint {
  month: string;
  sessions: number;
  revenue: number;
}

// Função para formatar data sem horas
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

// Função para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

// Função para obter status
const getStatusIcon = (session: Session) => {
  if (session.is_completed) return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (session.status?.includes("cancelled")) return <XCircle className="w-4 h-4 text-red-500" />;
  if (session.status === "confirmed" || session.status === "scheduled") return <Clock className="w-4 h-4 text-yellow-500" />;
  return <HelpCircle className="w-4 h-4 text-gray-500" />;
};

const getStatusLabel = (session: Session) => {
  if (session.is_completed) return "Realizada";
  if (session.status === "confirmed") return "Confirmada";
  if (session.status === "scheduled") return "Agendada";
  if (session.status === "proposed") return "Convite pendente";
  if (session.status === "cancelled_by_patient") return "Cancelada (colaborador)";
  if (session.status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
  return session.status;
};

const getInvoiceStatusLabel = (isInvoiced: boolean) => {
  return isInvoiced ? "Faturado" : "A faturar";
};

const getInvoiceStatusColor = (isInvoiced: boolean) => {
  return isInvoiced ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";
};

export default function EmpresaSessionsPage() {
  const { execute: apiCall } = useApi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<{id:number;name:string}[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchColaborador, setSearchColaborador] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState("");
  const [selectedDepartamento, setSelectedDepartamento] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<"sessions" | "revenue">("sessions");
  const itemsPerPage = 15;

  // Estatísticas
  const [stats, setStats] = useState({
    total: 0,
    realizadas: 0,
    agendadas: 0,
    canceladas: 0,
    receita_total: 0,
    a_faturar: 0
  });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterSessions(); }, [sessions, searchColaborador, selectedTherapistId, selectedDepartamento, statusFilter, yearFilter, monthFilter, startDate, endDate]);

  async function loadData() {
    try {
      setLoading(true);
      
      const data = await apiCall({ url: "/api/empresa/sessions", requireAuth: true });
      
      if (data && Array.isArray(data)) {
        const processed: Session[] = data.map((s: any) => ({
          id: s.id,
          date: s.date,
          colaborador_id: s.colaborador_id,
          colaborador_name: s.colaborador_name,
          colaborador_email: s.colaborador_email,
          colaborador_departamento: s.colaborador_departamento,
          therapist_name: s.therapist_name,
          therapist_id: s.therapist_id,
          status: s.status,
          session_price: s.session_price || 0,
          is_completed: s.status === "completed",
          is_invoiced: s.is_invoiced || false,
          has_medical_record: s.has_medical_record || false
        }));
        
        setSessions(processed);
        
        // Extrair lista única de terapeutas
        const uniqueTherapists = Array.from(
          new Map(processed.map(s => [s.therapist_id, { id: s.therapist_id, name: s.therapist_name }])).values()
        );
        setTherapists(uniqueTherapists);
        
        // Extrair lista única de departamentos
        const uniqueDepartamentos = Array.from(new Set(processed.map(s => s.colaborador_departamento).filter(Boolean)));
        setDepartamentos(uniqueDepartamentos as string[]);
        
        // Anos disponíveis
        const years = [...new Set(processed.map(s => new Date(s.date).getFullYear()))];
        setAvailableYears(years.sort((a,b) => b - a));
        
        // Calcular estatísticas
        const realizadas = processed.filter(s => s.is_completed);
        const agendadas = processed.filter(s => !s.is_completed && !s.status?.includes("cancelled"));
        const canceladas = processed.filter(s => s.status?.includes("cancelled"));
        const receitaTotal = realizadas.reduce((sum, s) => sum + s.session_price, 0);
        const aFaturar = realizadas.filter(s => !s.is_invoiced).reduce((sum, s) => sum + s.session_price, 0);
        
        setStats({
          total: processed.length,
          realizadas: realizadas.length,
          agendadas: agendadas.length,
          canceladas: canceladas.length,
          receita_total: receitaTotal,
          a_faturar: aFaturar
        });
        
        // Dados para gráfico (últimos 6 meses)
        const hoje = new Date();
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const chartPoints: ChartDataPoint[] = [];
        
        for (let i = 5; i >= 0; i--) {
          const mesIndex = (hoje.getMonth() - i + 12) % 12;
          const ano = hoje.getFullYear() - (hoje.getMonth() < mesIndex ? 1 : 0);
          const sessaoMes = processed.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === mesIndex && d.getFullYear() === ano && s.is_completed;
          });
          chartPoints.push({
            month: meses[mesIndex],
            sessions: sessaoMes.length,
            revenue: sessaoMes.reduce((sum, s) => sum + s.session_price, 0)
          });
        }
        
        setChartData(chartPoints);
      }
    } catch (err: any) {
      console.error("Erro ao carregar sessões:", err);
      setError(err.message || "Erro ao carregar sessões");
    } finally { 
      setLoading(false); 
    }
  }

  function filterSessions() {
    let f = [...sessions];
    
    if (searchColaborador) { 
      const term = searchColaborador.toLowerCase(); 
      f = f.filter(s => 
        s.colaborador_name.toLowerCase().includes(term) || 
        s.colaborador_email.toLowerCase().includes(term)
      ); 
    }
    
    if (selectedTherapistId) {
      f = f.filter(s => s.therapist_id === parseInt(selectedTherapistId));
    }
    
    if (selectedDepartamento) {
      f = f.filter(s => s.colaborador_departamento === selectedDepartamento);
    }
    
    if (statusFilter === "completed") {
      f = f.filter(s => s.is_completed);
    } else if (statusFilter === "upcoming") {
      f = f.filter(s => new Date(s.date) > new Date() && !s.is_completed && !s.status?.includes("cancelled"));
    } else if (statusFilter === "cancelled") {
      f = f.filter(s => s.status?.includes("cancelled"));
    } else if (statusFilter === "scheduled") {
      f = f.filter(s => !s.is_completed && !s.status?.includes("cancelled"));
    }
    
    if (yearFilter) {
      f = f.filter(s => new Date(s.date).getFullYear() === parseInt(yearFilter));
    }
    
    if (monthFilter && monthFilter !== "") {
      f = f.filter(s => new Date(s.date).getMonth() === parseInt(monthFilter));
    }
    
    if (startDate) {
      f = f.filter(s => s.date >= startDate);
    }
    
    if (endDate) {
      f = f.filter(s => s.date <= endDate);
    }
    
    // Ordenar por data (mais recente primeiro)
    f.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setFilteredSessions(f);
    setCurrentPage(1);
  }

  const hasFilters = searchColaborador || selectedTherapistId || selectedDepartamento || statusFilter !== "todos" || yearFilter || monthFilter || startDate || endDate;
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Sessões</h1>
          </div>
          <Link href="/empresa/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />Voltar
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">Histórico de sessões realizadas pelos colaboradores</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Total de Sessões</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-600">{stats.realizadas}</p>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-500">Realizadas</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-yellow-600">{stats.agendadas}</p>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-sm text-gray-500">Agendadas</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.receita_total)}</p>
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm text-gray-500">Receita Total</p>
            <p className="text-xs text-yellow-600 mt-1">{formatCurrency(stats.a_faturar)} a faturar</p>
          </div>
        </div>

        {/* Gráfico */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#E03673]" />
                <h3 className="font-semibold text-gray-900">Evolução Mensal</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartMetric("sessions")}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "sessions" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setChartMetric("revenue")}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "revenue" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Receita (R$)
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => chartMetric === "revenue" ? `R$ ${value}` : String(value)} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => chartMetric === "revenue" ? formatCurrency(value) : value} />
                <Legend />
                {chartMetric === "sessions" && (
                  <Line type="monotone" dataKey="sessions" stroke="#E03673" strokeWidth={2} dot={{ fill: '#E03673', r: 4 }} name="Sessões" />
                )}
                {chartMetric === "revenue" && (
                  <Line type="monotone" dataKey="revenue" stroke="#E03673" strokeWidth={2} dot={{ fill: '#E03673', r: 4 }} name="Receita" />
                )}
                <ReferenceLine y={0} stroke="#ccc" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#E03673]" /> Filtros
            </h3>
            {hasFilters && (
              <button 
                onClick={() => {
                  setSearchColaborador("");
                  setSelectedTherapistId("");
                  setSelectedDepartamento("");
                  setStatusFilter("todos");
                  setYearFilter("");
                  setMonthFilter("");
                  setStartDate("");
                  setEndDate("");
                }} 
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  value={searchColaborador} 
                  onChange={e => setSearchColaborador(e.target.value)} 
                  placeholder="Nome ou email" 
                  className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
              <select value={selectedTherapistId} onChange={e => setSelectedTherapistId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {departamentos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                <select value={selectedDepartamento} onChange={e => setSelectedDepartamento(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos</option>
                  {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option>
                <option value="upcoming">Próximas</option>
                <option value="scheduled">Agendadas</option>
                <option value="completed">Realizadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter(""); setStartDate(""); setEndDate(""); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>
                  {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabela de sessões - SEM HORÁRIO */}
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma sessão encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">
              {filteredSessions.length} sessão{filteredSessions.length !== 1 ? "ões" : ""}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Departamento</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedSessions.map(session => (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-sm text-gray-600">
                        {formatDate(session.date)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {session.colaborador_name?.charAt(0).toUpperCase() || "C"}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{session.colaborador_name}</div>
                            <div className="text-xs text-gray-500">{session.colaborador_email}</div>
                          </div>
                        </div>
                       </td>
                      <td className="p-3 text-sm text-gray-600">
                        {session.colaborador_departamento || "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-700">
                        {session.therapist_name}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(session)}
                          <span className="text-xs text-gray-700">{getStatusLabel(session)}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`text-sm font-medium ${session.is_completed ? "text-green-600" : "text-gray-600"}`}>
                          {formatCurrency(session.session_price)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${getInvoiceStatusColor(session.is_invoiced)}`}>
                          {getInvoiceStatusLabel(session.is_invoiced)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
                  disabled={currentPage === 1} 
                  className="p-2 text-gray-500 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} 
                  disabled={currentPage === totalPages} 
                  className="p-2 text-gray-500 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}