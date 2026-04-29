"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import Link from "next/link";
import { Mail, Loader2, Search, User, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Invite {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  patient_name?: string;
  patient_email?: string;
  patient_foto_url?: string;
  therapist_name?: string;
  therapist_email?: string;
  therapist_foto_url?: string;
}

export default function AdminInvitesPage() {
  const { execute: apiCall } = useApi();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [filtered, setFiltered] = useState<Invite[]>([]);
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
  const [actionLoading, setActionLoading] = useState<Record<number,boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterInvites(); }, [invites, searchPatient, selectedTherapistId, statusFilter, yearFilter, monthFilter, startDate, endDate]);

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  async function loadData() {
    try {
      setLoading(true);
      
      const [appointmentsData, usersData, patientsData, therapistsProfileData] = await Promise.all([
        apiCall({ url: "/api/appointments/admin/all", requireAuth: true }),
        apiCall({ url: "/api/users", requireAuth: true }),
        apiCall({ url: "/api/patients", requireAuth: true }),
        apiCall({ url: "/api/therapists", requireAuth: true })
      ]);
      
      const therapistsList = (usersData as any[]).filter((u: any) => u.role === "therapist");
      const patientsList = (usersData as any[]).filter((u: any) => u.role === "patient");
      setTherapists(therapistsList.map((t: any) => ({ id: t.id, name: t.full_name || t.email })));

      const patientFotoMap = new Map<number, string>();
      if (Array.isArray(patientsData)) {
        (patientsData as any[]).forEach((p: any) => {
          if (p.user_id && p.foto_url) patientFotoMap.set(p.user_id, p.foto_url);
          if (p.id && p.foto_url && !patientFotoMap.has(p.id)) patientFotoMap.set(p.id, p.foto_url);
        });
      }
      
      const therapistFotoMap = new Map<number, string>();
      if (Array.isArray(therapistsProfileData)) {
        (therapistsProfileData as any[]).forEach((t: any) => {
          if (t.user_id && t.foto_url) therapistFotoMap.set(t.user_id, t.foto_url);
        });
      }

      const inviteStatuses = ["proposed", "pending", "accepted", "confirmed", "declined"];
      
      const allInvites = (appointmentsData as any[])
        .filter((apt: any) => inviteStatuses.includes(apt.status))
        .map((apt: any) => {
          const therapist = therapistsList.find((t: any) => t.id === apt.therapist_user_id);
          const patient = patientsList.find((p: any) => p.id === apt.patient_user_id);
          
          let displayStatus = apt.status;
          if (apt.status === "proposed") displayStatus = "pending";
          if (apt.status === "confirmed") displayStatus = "accepted";
          if (apt.status === "declined") displayStatus = "declined";
          
          return {
            id: apt.id,
            patient_user_id: apt.patient_user_id,
            therapist_user_id: apt.therapist_user_id,
            starts_at: apt.starts_at,
            ends_at: apt.ends_at,
            duration_minutes: apt.duration_minutes || 50,
            status: displayStatus,
            created_at: apt.created_at,
            therapist_name: therapist?.full_name || therapist?.email || `Terapeuta ${apt.therapist_user_id}`,
            therapist_email: therapist?.email,
            therapist_foto_url: therapistFotoMap.get(apt.therapist_user_id) || null,
            patient_name: patient?.full_name || `Paciente ${apt.patient_user_id}`,
            patient_email: patient?.email,
            patient_foto_url: patientFotoMap.get(apt.patient_user_id) || null,
          };
        });
      
      allInvites.sort((a: Invite, b: Invite) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setInvites(allInvites);
      
      const years = [...new Set<number>(allInvites.map((i: Invite) => new Date(i.starts_at).getFullYear()))].sort((a: number, b: number) => b - a);
      setAvailableYears(years);
      
      console.log("📋 Convites carregados:", allInvites.length);
      
    } catch (err) {
      console.error("Erro ao carregar convites:", err);
      setError("Erro ao carregar convites");
    } finally {
      setLoading(false);
    }
  }

  function filterInvites() {
    let f = [...invites];
    if (searchPatient) { const term = searchPatient.toLowerCase(); f = f.filter((i: Invite) => i.patient_name?.toLowerCase().includes(term) || i.patient_email?.toLowerCase().includes(term)); }
    if (selectedTherapistId) f = f.filter((i: Invite) => i.therapist_user_id === parseInt(selectedTherapistId));
    if (statusFilter !== "todos") f = f.filter((i: Invite) => i.status === statusFilter);
    if (yearFilter) f = f.filter((i: Invite) => new Date(i.starts_at).getFullYear() === parseInt(yearFilter));
    if (monthFilter) f = f.filter((i: Invite) => new Date(i.starts_at).getMonth() === parseInt(monthFilter));
    if (startDate) f = f.filter((i: Invite) => i.starts_at.split("T")[0] >= startDate);
    if (endDate) f = f.filter((i: Invite) => i.starts_at.split("T")[0] <= endDate);
    setFiltered(f);
    setCurrentPage(1);
  }

  async function handleCancel(id: number) {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall({ url: `/api/appointments/${id}/status`, method: "PATCH", body: { status: "cancelled_by_therapist" }, requireAuth: true });
      await loadData();
    } catch { 
      setError("Erro ao cancelar convite"); 
      setTimeout(() => setError(""), 3000); 
    } finally { 
      setActionLoading(prev => ({ ...prev, [id]: false })); 
    }
  }

  const hasFilters = searchPatient || selectedTherapistId || statusFilter !== "todos" || yearFilter || monthFilter || startDate || endDate;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  const getStatusBadge = (status: string) => {
    const map: Record<string, {cls:string;label:string;icon:JSX.Element|null}> = {
      pending: { cls: "bg-yellow-100 text-yellow-700", label: "Pendente", icon: <Clock className="w-3 h-3" /> },
      accepted: { cls: "bg-green-100 text-green-700", label: "Aceito", icon: <CheckCircle className="w-3 h-3" /> },
      declined: { cls: "bg-red-100 text-red-700", label: "Recusado", icon: <XCircle className="w-3 h-3" /> },
    };
    const s = map[status] || { cls: "bg-gray-100 text-gray-700", label: status, icon: null };
    return <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${s.cls}`}>{s.icon}{s.label}</span>;
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#E03673] animate-spin" /></div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Mail className="w-6 h-6 text-[#E03673]" /><h1 className="text-2xl font-bold text-gray-900">Todos os Convites</h1></div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><RefreshCw className="w-4 h-4" />Atualizar</button>
            <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Voltar</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && <button onClick={() => { setSearchPatient(""); setSelectedTherapistId(""); setStatusFilter("todos"); setYearFilter(""); setMonthFilter(""); setStartDate(""); setEndDate(""); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchPatient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchPatient(e.target.value)} placeholder="Nome ou email" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
              <select value={selectedTherapistId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTherapistId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos</option>{therapists.map((t: {id:number;name:string}) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="accepted">Aceitos</option>
                <option value="declined">Recusados</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select value={yearFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setYearFilter(e.target.value); setMonthFilter(""); setStartDate(""); setEndDate(""); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>{availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                <select value={monthFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonthFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>{MONTHS.map((m: string, i: number) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label><input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Data final</label><input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Total", v: invites.length },
            { l: "Pendentes", v: invites.filter((i: Invite) => i.status === "pending").length },
            { l: "Aceitos", v: invites.filter((i: Invite) => i.status === "accepted").length },
            { l: "Recusados", v: invites.filter((i: Invite) => i.status === "declined").length },
          ].map((s: {l:string;v:number}) => (
            <div key={s.l} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-gray-900">{s.v}</p>
              <p className="text-sm text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100"><Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhum convite encontrado</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">{filtered.length} convite{filtered.length!==1?"s":""}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Duração</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((inv: Invite) => {
                    const patientFotoUrl = getFotoUrl(inv.patient_foto_url);
                    const therapistFotoUrl = getFotoUrl(inv.therapist_foto_url);
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm text-gray-600">#{inv.id}</td>
                        <td className="p-3">
                          <div className="text-sm font-medium text-gray-900">{new Date(inv.starts_at).toLocaleDateString("pt-BR")}</div>
                          <div className="text-xs text-gray-500">{new Date(inv.starts_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
                          <div className="text-xs text-gray-400">Enviado: {new Date(inv.created_at).toLocaleDateString("pt-BR")}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {patientFotoUrl ? (
                                <img 
                                  src={patientFotoUrl} 
                                  alt={inv.patient_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = inv.patient_name?.charAt(0).toUpperCase() || "P";
                                      e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {inv.patient_name?.charAt(0).toUpperCase() || "P"}
                                </span>
                              )}
                            </div>
                            <div><div className="text-sm font-medium text-gray-900">{inv.patient_name}</div><div className="text-xs text-gray-500">{inv.patient_email}</div></div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {therapistFotoUrl ? (
                                <img 
                                  src={therapistFotoUrl} 
                                  alt={inv.therapist_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = inv.therapist_name?.charAt(0).toUpperCase() || "T";
                                      e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {inv.therapist_name?.charAt(0).toUpperCase() || "T"}
                                </span>
                              )}
                            </div>
                            <div><div className="text-sm font-medium text-gray-900">{inv.therapist_name}</div><div className="text-xs text-gray-500">{inv.therapist_email}</div></div>
                          </div>
                        </td>
                        <td className="p-3 text-center text-sm text-gray-700">{inv.duration_minutes} min</td>
                        <td className="p-3 text-center">{getStatusBadge(inv.status)}</td>
                        <td className="p-3 text-center">
                          {inv.status === "pending" && (
                            <button onClick={() => handleCancel(inv.id)} disabled={actionLoading[inv.id]}
                              className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 mx-auto">
                              {actionLoading[inv.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancelar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-gray-500 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-500 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}