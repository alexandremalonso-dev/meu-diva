"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getFotoSrc } from '@/lib/utils';
import {
  Users, Loader2, AlertCircle, Search, ArrowLeft,
  User, Eye, X, CheckCircle, XCircle, ChevronLeft, ChevronRight
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdminUser {
  id: number;
  email: string;
  role: string;
  full_name?: string;
  foto_url?: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { execute: apiCall } = useApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { filterUsers(); }, [users, searchTerm, roleFilter, statusFilter, monthFilter, yearFilter]);

  async function loadUsers() {
    try {
      setLoading(true);
      
      // 1. Buscar todos os usuários
      const usersData = await apiCall({ url: "/api/users", requireAuth: true });
      
      // 2. Buscar perfis de terapeutas, pacientes e admin para obter as fotos
      const [therapistsData, patientsData, adminProfileData] = await Promise.allSettled([
        apiCall({ url: "/api/therapists", requireAuth: true }),
        apiCall({ url: "/api/patients", requireAuth: true }),
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
      
      // Pacientes
      if (patientsData.status === "fulfilled" && Array.isArray(patientsData.value)) {
        patientsData.value.forEach((p: any) => {
          if (p.user_id && p.foto_url) fotoMap.set(p.user_id, p.foto_url);
          if (p.id && p.foto_url && !fotoMap.has(p.id)) fotoMap.set(p.id, p.foto_url);
        });
      }
      
      // 🔥 ADMIN - buscar foto do perfil do admin logado
      if (adminProfileData.status === "fulfilled" && adminProfileData.value) {
        const adminProfile = adminProfileData.value;
        if (adminProfile.user_id && adminProfile.foto_url) {
          fotoMap.set(adminProfile.user_id, adminProfile.foto_url);
        }
      }

      // 4. Combinar dados
      const usersWithFotos = usersData.map((u: any) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        full_name: u.full_name,
        is_active: u.is_active,
        created_at: u.created_at,
        foto_url: fotoMap.get(u.id) || null,
      }));

      setUsers(usersWithFotos);
      
      const years = [...new Set<number>(usersWithFotos.map((u: AdminUser) => new Date(u.created_at).getFullYear()))].sort((a, b) => b - a);
      setAvailableYears(years);
    } catch { 
      setError("Erro ao carregar usuários"); 
    } finally { 
      setLoading(false); 
    }
  }

  function filterUsers() {
    let filtered = [...users];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      filtered = filtered.filter(u => u.full_name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t));
    }
    if (roleFilter !== "todos") filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter !== "todos") filtered = filtered.filter(u => u.is_active === (statusFilter === "ativo"));
    if (yearFilter) filtered = filtered.filter(u => new Date(u.created_at).getFullYear() === parseInt(yearFilter));
    if (monthFilter) filtered = filtered.filter(u => new Date(u.created_at).getMonth() === parseInt(monthFilter));
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }

  async function handleToggleActive(userId: number, current: boolean) {
    try {
      await apiCall({ url: `/api/users/${userId}/status`, method: "PATCH", body: { is_active: !current }, requireAuth: true });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u));
    } catch { setError("Erro ao alterar status"); setTimeout(() => setError(""), 3000); }
  }

  const resetFilters = () => { setSearchTerm(""); setRoleFilter("todos"); setStatusFilter("todos"); setMonthFilter(""); setYearFilter(""); };
  const hasFilters = searchTerm || roleFilter !== "todos" || statusFilter !== "todos" || monthFilter || yearFilter;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = { 
      admin: "bg-purple-100 text-purple-700", 
      therapist: "bg-green-100 text-green-700", 
      patient: "bg-blue-100 text-blue-700" 
    };
    const labels: Record<string, string> = { 
      admin: "Admin", 
      therapist: "Terapeuta", 
      patient: "Paciente" 
    };
    return <span className={`px-2 py-1 text-xs rounded-full ${styles[role] || "bg-gray-100 text-gray-700"}`}>{labels[role] || role}</span>;
  };

  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#E03673] animate-spin" /></div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Todos os Usuários</h1>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar ao dashboard
          </Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">Visualize e gerencie todos os usuários cadastrados na plataforma</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        {/* Filtros sempre visíveis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && (
              <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Nome ou email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option>
                <option value="admin">Admin</option>
                <option value="therapist">Terapeuta</option>
                <option value="patient">Paciente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano de cadastro</label>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter(""); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês de cadastro</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: users.length },
            { label: "Administradores", value: users.filter(u => u.role === "admin").length },
            { label: "Terapeutas", value: users.filter(u => u.role === "therapist").length },
            { label: "Pacientes", value: users.filter(u => u.role === "patient").length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabela */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 text-sm text-gray-500">
              Mostrando {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Usuário</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Perfil</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Cadastro</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedUsers.map(u => {
                    const fotoUrl = getFotoUrl(u.foto_url);
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm text-gray-600">#{u.id}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {fotoUrl ? (
                                <img 
                                  src={fotoUrl} 
                                  alt={u.full_name || u.email} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.innerHTML = u.full_name?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || "U";
                                      e.currentTarget.parentElement.className = "w-10 h-10 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-sm font-bold flex-shrink-0";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-sm font-bold">
                                  {u.full_name?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || "U"}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{u.full_name || "-"}</p>
                              <p className="text-xs text-gray-400">ID: {u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">{u.email}</td>
                        <td className="p-3">{getRoleBadge(u.role)}</td>
                        <td className="p-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${u.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                          >
                            {u.is_active ? <><CheckCircle className="w-3 h-3" />Ativo</> : <><XCircle className="w-3 h-3" />Inativo</>}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => router.push(`/admin/users/${u.id}`)}
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
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-gray-500 disabled:opacity-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-500 disabled:opacity-50">
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