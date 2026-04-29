"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getFotoSrc } from '@/lib/utils';
import { Users, Loader2, AlertCircle, Search, ArrowLeft, Eye, X, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Therapist {
  id: number;
  full_name: string;
  email: string;
  foto_url?: string;
  specialties?: string;
  session_price?: number;
  total_sessions: number;
  total_revenue: number;
  is_active: boolean;
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
  rating?: number;
}

export default function AdminTherapistsPage() {
  const router = useRouter();
  const { execute: apiCall } = useApi();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filtered, setFiltered] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [verifiedFilter, setVerifiedFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("sessions");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { loadTherapists(); }, []);
  useEffect(() => { filterAndSort(); }, [therapists, searchTerm, statusFilter, verifiedFilter, sortBy, yearFilter, monthFilter]);

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  async function loadTherapists() {
    try {
      setLoading(true);
      
      // 1. Buscar todos os usuários e appointments
      const [usersData, apts] = await Promise.all([
        apiCall({ url: "/api/users", requireAuth: true }),
        apiCall({ url: "/api/appointments/admin/all", requireAuth: true })
      ]);
      
      // 2. Buscar perfis de terapeutas e admin para obter as fotos
      const [therapistsData, adminProfileData] = await Promise.allSettled([
        apiCall({ url: "/api/therapists", requireAuth: true }),
        apiCall({ url: "/api/admin/profile/me", requireAuth: true }),
      ]);
      
      // 3. Montar mapa user_id → foto_url
      const fotoMap = new Map<number, string>();
      
      // Terapeutas
      if (therapistsData.status === "fulfilled" && Array.isArray(therapistsData.value)) {
        therapistsData.value.forEach((t: any) => {
          if (t.user_id && t.foto_url) fotoMap.set(t.user_id, t.foto_url);
        });
      }
      
      // 🔥 ADMIN - buscar foto do perfil do admin logado (caso apareça na lista)
      if (adminProfileData.status === "fulfilled" && adminProfileData.value) {
        const adminProfile = adminProfileData.value;
        if (adminProfile.user_id && adminProfile.foto_url) {
          fotoMap.set(adminProfile.user_id, adminProfile.foto_url);
        }
      }
      
      const therapistsList = usersData.filter((u:any) => u.role === "therapist");
      const processed: Therapist[] = [];

      for (const t of therapistsList) {
        let profile = null;
        try { profile = await apiCall({ url: `/api/therapists/${t.id}/profile`, requireAuth: true }); } catch {}
        const tApts = apts.filter((a:any) => a.therapist_user_id === t.id);
        const completed = tApts.filter((a:any) => a.status === "completed");
        
        processed.push({
          id: t.id,
          full_name: profile?.full_name || t.full_name || t.email,
          email: t.email,
          specialties: profile?.specialties,
          session_price: profile?.session_price,
          total_sessions: completed.length,
          total_revenue: completed.reduce((s:number, a:any) => s + (a.session_price||0), 0),
          foto_url: fotoMap.get(t.id) || profile?.foto_url || null,
          is_active: t.is_active,
          is_verified: profile?.verified || false,
          is_featured: profile?.featured || false,
          created_at: t.created_at,
          rating: profile?.rating,
        });
      }
      processed.sort((a,b) => b.total_sessions - a.total_sessions);
      setTherapists(processed);
      setAvailableYears([...new Set<number>(processed.map(t => new Date(t.created_at).getFullYear()))].sort((a,b) => b-a));
    } catch { 
      setError("Erro ao carregar terapeutas"); 
    } finally { 
      setLoading(false); 
    }
  }

  function filterAndSort() {
    let f = [...therapists];
    if (searchTerm.trim()) { const t = searchTerm.toLowerCase(); f = f.filter(th => th.full_name?.toLowerCase().includes(t) || th.email?.toLowerCase().includes(t) || th.specialties?.toLowerCase().includes(t)); }
    if (statusFilter === "active") f = f.filter(t => t.is_active);
    else if (statusFilter === "inactive") f = f.filter(t => !t.is_active);
    if (verifiedFilter === "verified") f = f.filter(t => t.is_verified);
    else if (verifiedFilter === "unverified") f = f.filter(t => !t.is_verified);
    if (yearFilter) f = f.filter(t => new Date(t.created_at).getFullYear() === parseInt(yearFilter));
    if (monthFilter) f = f.filter(t => new Date(t.created_at).getMonth() === parseInt(monthFilter));
    switch (sortBy) {
      case "sessions": f.sort((a,b) => b.total_sessions - a.total_sessions); break;
      case "revenue": f.sort((a,b) => b.total_revenue - a.total_revenue); break;
      case "price": f.sort((a,b) => (b.session_price||0) - (a.session_price||0)); break;
      case "name": f.sort((a,b) => a.full_name.localeCompare(b.full_name)); break;
      case "newest": f.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    setFiltered(f);
    setCurrentPage(1);
  }

  const formatCurrency = (v:number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
  const hasFilters = searchTerm || statusFilter !== "todos" || verifiedFilter !== "todos" || yearFilter || monthFilter;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#E03673] animate-spin" /></div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Users className="w-6 h-6 text-[#E03673]" /><h1 className="text-2xl font-bold text-gray-900">Todos os Terapeutas</h1></div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Voltar</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        {/* Filtros sempre visíveis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && <button onClick={() => { setSearchTerm(""); setStatusFilter("todos"); setVerifiedFilter("todos"); setYearFilter(""); setMonthFilter(""); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><X className="w-3 h-3" />Limpar</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nome, email ou especialidade..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verificação</label>
              <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option><option value="verified">Verificados</option><option value="unverified">Não verificados</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="sessions">Mais sessões</option><option value="revenue">Maior receita</option><option value="price">Maior preço</option><option value="name">Nome A-Z</option><option value="newest">Mais recentes</option>
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
          {[{l:"Total",v:therapists.length},{l:"Ativos",v:therapists.filter(t=>t.is_active).length},{l:"Verificados",v:therapists.filter(t=>t.is_verified).length},{l:"Receita total",v:formatCurrency(therapists.reduce((s,t)=>s+t.total_revenue,0))}].map(s => (
            <div key={s.l} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><p className="text-2xl font-bold text-gray-900">{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhum terapeuta encontrado</p></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">{filtered.length} terapeuta{filtered.length!==1?"s":""}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Especialidades</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Receita</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Preço</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(t => {
                    const fotoUrl = getFotoUrl(t.foto_url);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {fotoUrl ? (
                                <img 
                                  src={fotoUrl} 
                                  alt={t.full_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = t.full_name?.charAt(0).toUpperCase() || "T";
                                      e.currentTarget.parentElement.className = "w-12 h-12 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-base font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-base font-bold">
                                  {t.full_name?.charAt(0).toUpperCase() || "T"}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900">{t.full_name}</p>
                                {t.is_verified && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">✓ Verificado</span>}
                                {t.is_featured && <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">⭐ Destaque</span>}
                              </div>
                              <p className="text-xs text-gray-500">{t.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3"><p className="text-sm text-gray-700 max-w-xs truncate">{t.specialties||"-"}</p></td>
                        <td className="p-3 text-center"><span className="text-lg font-semibold text-gray-900">{t.total_sessions}</span><p className="text-xs text-gray-400">sessões</p></td>
                        <td className="p-3 text-center"><span className="text-sm font-semibold text-green-600">{formatCurrency(t.total_revenue)}</span></td>
                        <td className="p-3 text-center"><span className="text-sm text-gray-700">{formatCurrency(t.session_price||0)}</span></td>
                        <td className="p-3 text-center">
                          {t.is_active
                            ? <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Ativo</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Inativo</span>}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => router.push(`/admin/users/${t.id}`)} 
                            className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                            title="Ver detalhes"
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
                <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="p-2 text-gray-500 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="p-2 text-gray-500 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}