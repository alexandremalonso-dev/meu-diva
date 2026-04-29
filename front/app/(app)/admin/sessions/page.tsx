"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useSidebar } from "@/contexts/SidebarContext";
import Link from "next/link";
import { getFotoSrc } from '@/lib/utils';
import {
  Calendar, Loader2, Eye, Search, User, X,
  ChevronLeft, ChevronRight, CheckCircle,
  XCircle, HelpCircle, AlertCircle
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Session {
  id: number;
  date: string;
  time: string;
  patient_name: string;
  patient_email: string;
  patient_foto_url?: string;
  therapist_name: string;
  therapist_id: number;
  status: string;
  session_price: number;
  is_completed: boolean;
}

export default function AdminSessionsPage() {
  const { openProntuario } = useSidebar();
  const { execute: apiCall } = useApi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [therapists, setTherapists] = useState<{id:number;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterSessions(); }, [sessions, searchPatient, selectedTherapistId, statusFilter, yearFilter, monthFilter, startDate, endDate]);

  // 🔥 Função para obter URL correta da foto
  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  async function loadData() {
    try {
      setLoading(true);
      
      // 1. Buscar todas as sessões e usuários
      const [apts, users] = await Promise.all([
        apiCall({ url: "/api/appointments/admin/all", requireAuth: true }),
        apiCall({ url: "/api/users", requireAuth: true })
      ]);
      
      // 2. Buscar perfis de terapeutas e pacientes para obter as fotos
      const [therapistsData, patientsData] = await Promise.allSettled([
        apiCall({ url: "/api/therapists", requireAuth: true }),
        apiCall({ url: "/api/patients", requireAuth: true }),
      ]);
      
      // 3. Montar mapa user_id → foto_url
      const fotoMap = new Map<number, string>();
      
      // Terapeutas
      if (therapistsData.status === "fulfilled" && Array.isArray(therapistsData.value)) {
        therapistsData.value.forEach((t: any) => {
          if (t.user_id && t.foto_url) fotoMap.set(t.user_id, t.foto_url);
        });
      }
      
      // Pacientes
      if (patientsData.status === "fulfilled" && Array.isArray(patientsData.value)) {
        patientsData.value.forEach((p: any) => {
          if (p.user_id && p.foto_url) fotoMap.set(p.user_id, p.foto_url);
          if (p.id && p.foto_url && !fotoMap.has(p.id)) fotoMap.set(p.id, p.foto_url);
        });
      }
      
      setTherapists(users.filter((u:any) => u.role === "therapist").map((t:any) => ({ id: t.id, name: t.full_name || t.email })));
      
      const processed: Session[] = apts.map((apt:any) => {
        const d = new Date(apt.starts_at);
        const patientUserId = apt.patient_user_id;
        const therapistUserId = apt.therapist_user_id;
        
        return {
          id: apt.id,
          date: d.toISOString().split("T")[0],
          time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          patient_name: apt.patient?.full_name || "Paciente",
          patient_email: apt.patient?.email || "",
          patient_foto_url: fotoMap.get(patientUserId) || apt.patient?.foto_url || null,
          therapist_name: apt.therapist?.full_name || "Terapeuta",
          therapist_id: apt.therapist_user_id,
          status: apt.status,
          session_price: apt.session_price || 0,
          is_completed: apt.status === "completed",
        };
      });
      processed.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(processed);
      setAvailableYears([...new Set<number>(processed.map(s => new Date(s.date).getFullYear()))].sort((a,b) => b-a));
    } catch { 
      setError("Erro ao carregar sessões"); 
    } finally { 
      setLoading(false); 
    }
  }

  function filterSessions() {
    let f = [...sessions];
    if (searchPatient) { const t = searchPatient.toLowerCase(); f = f.filter(s => s.patient_name.toLowerCase().includes(t) || s.patient_email.toLowerCase().includes(t)); }
    if (selectedTherapistId) f = f.filter(s => s.therapist_id === parseInt(selectedTherapistId));
    if (statusFilter === "completed") f = f.filter(s => s.is_completed);
    else if (statusFilter === "upcoming") f = f.filter(s => new Date(s.date) > new Date() && ["scheduled","confirmed"].includes(s.status));
    else if (statusFilter === "cancelled") f = f.filter(s => s.status?.includes("cancelled"));
    else if (statusFilter === "scheduled") f = f.filter(s => ["scheduled","confirmed"].includes(s.status));
    if (yearFilter) f = f.filter(s => new Date(s.date).getFullYear() === parseInt(yearFilter));
    if (monthFilter) f = f.filter(s => new Date(s.date).getMonth() === parseInt(monthFilter));
    if (startDate) f = f.filter(s => s.date >= startDate);
    if (endDate) f = f.filter(s => s.date <= endDate);
    setFilteredSessions(f);
    setCurrentPage(1);
  }

  const formatCurrency = (v:number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
  const hasFilters = searchPatient || selectedTherapistId || statusFilter !== "todos" || yearFilter || monthFilter || startDate || endDate;
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  const getStatusIcon = (s:Session) => {
    if (s.is_completed) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s.status?.includes("cancelled")) return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-yellow-500" />;
  };
  const getStatusLabel = (s:Session) => {
    if (s.is_completed) return "Realizada";
    if (s.status === "confirmed") return "Confirmada";
    if (s.status === "scheduled") return "Agendada";
    if (s.status === "proposed") return "Convite pendente";
    if (s.status === "cancelled_by_patient") return "Cancelada (paciente)";
    if (s.status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    return s.status;
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#E03673] animate-spin" /></div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Calendar className="w-6 h-6 text-[#E03673]" /><h1 className="text-2xl font-bold text-gray-900">Todas as Sessões</h1></div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Voltar</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        {/* Filtros sempre visíveis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && <button onClick={() => { setSearchPatient(""); setSelectedTherapistId(""); setStatusFilter("todos"); setYearFilter(""); setMonthFilter(""); setStartDate(""); setEndDate(""); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchPatient} onChange={e => setSearchPatient(e.target.value)} placeholder="Nome ou email" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
              <select value={selectedTherapistId} onChange={e => setSelectedTherapistId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option><option value="upcoming">Próximas</option><option value="scheduled">Agendadas</option><option value="completed">Realizadas</option><option value="cancelled">Canceladas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter(""); setStartDate(""); setEndDate(""); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>{MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Data final</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{l:"Total",v:sessions.length,c:"text-gray-900"},{l:"Realizadas",v:sessions.filter(s=>s.is_completed).length,c:"text-green-600"},{l:"Agendadas",v:sessions.filter(s=>["scheduled","confirmed"].includes(s.status)).length,c:"text-blue-600"},{l:"Canceladas",v:sessions.filter(s=>s.status?.includes("cancelled")).length,c:"text-red-600"}].map(s => (
            <div key={s.l} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><p className={`text-2xl font-bold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
          ))}
        </div>

        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100"><Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhuma sessão encontrada</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">{filteredSessions.length} sessão{filteredSessions.length!==1?"ões":""}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedSessions.map(session => {
                    const fotoUrl = getFotoUrl(session.patient_foto_url);
                    return (
                      <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm text-gray-600">#{session.id}</td>
                        <td className="p-3"><div className="text-sm font-medium text-gray-900">{session.date}</div><div className="text-xs text-gray-500">{session.time}</div></td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {fotoUrl ? (
                                <img 
                                  src={fotoUrl} 
                                  alt={session.patient_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = session.patient_name?.charAt(0).toUpperCase() || "P";
                                      e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {session.patient_name?.charAt(0).toUpperCase() || "P"}
                                </span>
                              )}
                            </div>
                            <div><div className="text-sm font-medium text-gray-900">{session.patient_name}</div><div className="text-xs text-gray-500">{session.patient_email}</div></div>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-700">{session.therapist_name}</td>
                        <td className="p-3"><div className="flex items-center justify-center gap-1">{getStatusIcon(session)}<span className="text-xs text-gray-700">{getStatusLabel(session)}</span></div></td>
                        <td className="p-3 text-right"><span className={`text-sm font-medium ${session.is_completed ? "text-green-600" : "text-gray-600"}`}>{formatCurrency(session.session_price)}</span></td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => openProntuario(session.id, true)} 
                            className="p-1.5 text-gray-400 hover:text-[#E03673] transition-colors"
                            title="Ver prontuário"
                          >
                            <Eye className="w-4 h-4" />
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
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="p-2 text-gray-500 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="p-2 text-gray-500 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}