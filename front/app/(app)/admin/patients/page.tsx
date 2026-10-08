"use client";

import { useEffect, useState, useRef } from "react";
import { useApi } from "@/lib/useApi";
import Link from "next/link";
import { Users, Loader2, AlertCircle, Search, ArrowLeft, MoreVertical, X, CheckCircle, XCircle, ChevronLeft, ChevronRight, Trash2, Power, Eye } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';
import { startImpersonation } from "@/lib/impersonation";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type Patient = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  foto_url?: string;
  session_count: number;
  is_frequent: boolean;
  is_active: boolean;
  created_at: string;
  therapist_name?: string;
  therapist_id?: number;
};

export default function AdminPatientsPage() {
  const { execute: apiCall } = useApi();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filtered, setFiltered] = useState<Patient[]>([]);
  const [therapists, setTherapists] = useState<{id:number;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // 🔥 Menu de ações
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPatients(); }, []);
  useEffect(() => { filterPatients(); }, [patients, searchTerm, selectedTherapist, yearFilter, monthFilter]);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔥 Função para obter URL correta da foto
  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  async function loadPatients() {
    try {
      setLoading(true);
      
      // 1. Buscar todos os usuários, appointments e perfis de pacientes
      const [usersData, apts, patientsData] = await Promise.all([
        apiCall({ url: "/api/users", requireAuth: true }),
        apiCall({ url: "/api/appointments/admin/all", requireAuth: true }),
        apiCall({ url: "/api/patients", requireAuth: true })
      ]);
      
      const therapistsList = usersData.filter((u:any) => u.role === "therapist");
      setTherapists(therapistsList.map((t:any) => ({ id: t.id, name: t.full_name || t.email })));

      // 2. Montar mapa user_id → foto_url a partir dos perfis de pacientes
      const fotoMap = new Map<number, string>();
      if (Array.isArray(patientsData)) {
        patientsData.forEach((p: any) => {
          if (p.user_id && p.foto_url) fotoMap.set(p.user_id, p.foto_url);
          if (p.id && p.foto_url && !fotoMap.has(p.id)) fotoMap.set(p.id, p.foto_url);
        });
      }

      const patientsList = usersData.filter((u:any) => u.role === "patient");
      const processed = patientsList.map((p:any) => {
        const pApts = apts.filter((a:any) => a.patient_user_id === p.id);
        const completed = pApts.filter((a:any) => a.status === "completed").length;
        const therapistMap = new Map();
        pApts.forEach((a:any) => { 
          if (a.therapist?.full_name) {
            therapistMap.set(a.therapist_user_id, { 
              id: a.therapist_user_id, 
              name: a.therapist.full_name, 
              count: (therapistMap.get(a.therapist_user_id)?.count||0)+1 
            });
          }
        });
        const top = Array.from(therapistMap.values()).sort((a:any,b:any) => b.count-a.count)[0];
        
        // 🔥 Foto do paciente: primeiro tenta do mapa, depois do appointment
        const foto_url = fotoMap.get(p.id) || null;
        
        return { 
          id: p.id, 
          full_name: p.full_name || p.email, 
          email: p.email, 
          phone: p.phone, 
          foto_url, 
          session_count: completed, 
          is_frequent: completed >= 3, 
          // 🔥 CORRIGIDO: usa o status real do usuário (is_active), o campo
          // is_blocked anterior não vinha conectado a nenhum dado real
          is_active: p.is_active, 
          created_at: p.created_at, 
          therapist_name: top?.name, 
          therapist_id: top?.id 
        };
      });
      processed.sort((a:Patient,b:Patient) => b.session_count - a.session_count);
      setPatients(processed);
      setAvailableYears([...new Set<number>(processed.map((p:Patient) => new Date(p.created_at).getFullYear()))].sort((a:number,b:number) => b-a));
    } catch { 
      setError("Erro ao carregar pacientes"); 
    } finally { 
      setLoading(false); 
    }
  }

  function filterPatients() {
    let f = [...patients];
    if (searchTerm.trim()) { const t = searchTerm.toLowerCase(); f = f.filter(p => p.full_name?.toLowerCase().includes(t) || p.email?.toLowerCase().includes(t) || p.phone?.includes(t)); }
    if (selectedTherapist) f = f.filter(p => p.therapist_id === parseInt(selectedTherapist));
    if (yearFilter) f = f.filter(p => new Date(p.created_at).getFullYear() === parseInt(yearFilter));
    if (monthFilter) f = f.filter(p => new Date(p.created_at).getMonth() === parseInt(monthFilter));
    setFiltered(f);
    setCurrentPage(1);
  }

  // 🔥 Ativar/Inativar
  async function handleToggleActive(patient: Patient) {
    setActionLoading(true);
    try {
      await apiCall({
        url: `/api/admin/users/${patient.id}/status`,
        method: "PATCH",
        body: { is_active: !patient.is_active },
        requireAuth: true
      });
      setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, is_active: !p.is_active } : p));
    } catch {
      setError("Erro ao alterar status do paciente");
      setTimeout(() => setError(""), 3000);
    } finally {
      setActionLoading(false);
      setOpenMenuId(null);
    }
  }

  // 🔥 Ver como (impersonação)
  async function handleViewAs(patient: Patient) {
    setActionLoading(true);
    try {
      await startImpersonation(patient.id);
    } catch {
      setError("Erro ao iniciar simulação de acesso");
      setTimeout(() => setError(""), 3000);
      setActionLoading(false);
      setOpenMenuId(null);
    }
  }

  // 🔥 Excluir (após confirmação)
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await apiCall({
        url: `/api/admin/users/${deleteTarget.id}`,
        method: "DELETE",
        requireAuth: true
      });
      setPatients(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Erro ao excluir paciente");
      setTimeout(() => setError(""), 3000);
    } finally {
      setActionLoading(false);
    }
  }

  const hasFilters = searchTerm || selectedTherapist || yearFilter || monthFilter;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#E03673] animate-spin" /></div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Users className="w-6 h-6 text-[#E03673]" /><h1 className="text-2xl font-bold text-gray-900">Todos os Pacientes</h1></div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Voltar</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        {/* Filtros sempre visíveis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && <button onClick={() => { setSearchTerm(""); setSelectedTherapist(""); setYearFilter(""); setMonthFilter(""); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nome, email ou telefone..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
              <select value={selectedTherapist} onChange={e => setSelectedTherapist(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano de cadastro</label>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter(""); }} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês de cadastro</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>{MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{l:"Total",v:patients.length},{l:"Frequentes",v:patients.filter(p=>p.is_frequent).length},{l:"Inativos",v:patients.filter(p=>!p.is_active).length},{l:"Total sessões",v:patients.reduce((s,p)=>s+p.session_count,0)}].map(s => (
            <div key={s.l} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><p className="text-2xl font-bold text-gray-900">{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhum paciente encontrado</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">{filtered.length} paciente{filtered.length!==1?"s":""}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(p => {
                    const fotoUrl = getFotoUrl(p.foto_url);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {fotoUrl ? (
                                <img 
                                  src={fotoUrl} 
                                  alt={p.full_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = p.full_name?.charAt(0).toUpperCase() || "P";
                                      e.currentTarget.parentElement.className = "w-10 h-10 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-sm font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-sm font-bold">
                                  {p.full_name?.charAt(0).toUpperCase() || "P"}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                {p.full_name}
                                {p.is_frequent && <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">⭐ Frequente</span>}
                              </div>
                              {p.phone && <p className="text-xs text-gray-500">{p.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">{p.email}</td>
                        <td className="p-3 text-sm text-gray-700">{p.therapist_name||"-"}</td>
                        <td className="p-3 text-center text-sm text-gray-700">{p.session_count}</td>
                        <td className="p-3 text-center">
                          {p.is_active
                            ? <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Ativo</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Inativo</span>}
                        </td>
                        <td className="p-3 text-center relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                            className="p-1.5 text-gray-400 hover:text-[#2F80D3] hover:bg-gray-100 rounded-lg transition-colors"
                            title="Ações"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === p.id && (
                            <div ref={menuRef} className="absolute right-3 top-10 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-left">
                              <button
                                onClick={() => handleViewAs(p)}
                                disabled={actionLoading || !p.is_active}
                                title={!p.is_active ? "Reative o paciente antes de simular o acesso" : undefined}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <Eye className="w-4 h-4" />
                                Ver como
                              </button>
                              <button
                                onClick={() => handleToggleActive(p)}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <Power className="w-4 h-4" />
                                {p.is_active ? "Inativar" : "Reativar"}
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(p); setOpenMenuId(null); }}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                              </button>
                            </div>
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
                <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="p-2 text-gray-500 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="p-2 text-gray-500 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔥 Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Excluir paciente</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que deseja excluir <strong>{deleteTarget.full_name}</strong>? Essa ação anonimiza os dados de identificação e não pode ser desfeita. O histórico de sessões será preservado.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
