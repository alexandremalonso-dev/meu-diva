"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserPhotos } from "@/hooks/useUserPhotos";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { 
  Users, Loader2, AlertCircle, Search, ArrowLeft, Eye, X, 
  CheckCircle, XCircle, ChevronLeft, ChevronRight, UserPlus,
  Calendar, Mail, Phone, UserCheck, UserX, Clock, Filter,
  Trash2, RefreshCw, Edit
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Colaborador {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  cpf?: string;
  phone?: string;
  foto_url?: string;
  cargo?: string;
  departamento?: string;
  is_active: boolean;
  access_ends_at?: string;
  created_at: string;
  sessoes_realizadas: number;
  sessoes_disponiveis: number;
  plano: string;
  plano_nome: string;
  preco_por_colaborador: number;
}

interface ResumoStats {
  total: number;
  ativos: number;
  inativos: number;
  sessoes_realizadas: number;
  sessoes_disponiveis: number;
  taxa_utilizacao: number;
}

// 🔥 PLANOS DISPONÍVEIS
const PLANOS_OPCOES = [
  { value: "prata", label: "Prata", sessoes: 1, preco: 45 },
  { value: "ouro", label: "Ouro", sessoes: 2, preco: 80 },
  { value: "diamante", label: "Diamante", sessoes: 4, preco: 140 }
];

const getPlanoLabel = (plano: string): string => {
  const p = PLANOS_OPCOES.find(p => p.value === plano);
  return p ? p.label : plano;
};

const getPlanoColor = (plano: string): string => {
  const cores: Record<string, string> = {
    "prata": "bg-gray-100 text-gray-700",
    "ouro": "bg-blue-100 text-blue-700",
    "diamante": "bg-purple-100 text-purple-700"
  };
  return cores[plano] || "bg-gray-100 text-gray-700";
};

const getPlanoSessoes = (plano: string): number => {
  const p = PLANOS_OPCOES.find(p => p.value === plano);
  return p ? p.sessoes : 1;
};

export default function EmpresaColaboradoresPage() {
  const router = useRouter();
  const { execute: apiCall } = useApi();
  const { enrichWithPhotos } = useUserPhotos();
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [filtered, setFiltered] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [planoFilter, setPlanoFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("nome");
  const [currentPage, setCurrentPage] = useState(1);
  const [resumo, setResumo] = useState<ResumoStats>({
    total: 0, ativos: 0, inativos: 0,
    sessoes_realizadas: 0, sessoes_disponiveis: 0, taxa_utilizacao: 0
  });
  
  // Modal de edição de plano
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [novoPlano, setNovoPlano] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  
  // Modal de desativação
  const [showDesativarModal, setShowDesativarModal] = useState(false);
  const [desativarData, setDesativarData] = useState("");
  const [desativarMotivo, setDesativarMotivo] = useState("");
  
  const itemsPerPage = 15;

  useEffect(() => { loadColaboradores(); }, []);
  useEffect(() => { filterAndSort(); }, [colaboradores, searchTerm, statusFilter, planoFilter, sortBy]);

  async function loadColaboradores() {
    try {
      setLoading(true);
      
      let data = await apiCall({ url: "/api/empresa/colaboradores", requireAuth: true });
      
      if (data && Array.isArray(data)) {
        data = await enrichWithPhotos(data);
        
        const processed: Colaborador[] = data.map((c: any) => {
          const planoChave = c.plano || "prata";
          const sessoesPorPlano = getPlanoSessoes(planoChave);
          
          return {
            id: c.id,
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email,
            cpf: c.cpf,
            phone: c.phone,
            foto_url: c.foto_url,
            cargo: c.cargo,
            departamento: c.departamento,
            is_active: c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > new Date()),
            access_ends_at: c.access_ends_at,
            created_at: c.created_at,
            sessoes_realizadas: c.sessoes_realizadas || 0,
            sessoes_disponiveis: c.sessoes_disponiveis || sessoesPorPlano,
            plano: planoChave,
            plano_nome: getPlanoLabel(planoChave),
            preco_por_colaborador: c.preco_por_colaborador || 0
          };
        });
        
        setColaboradores(processed);
        
        const ativos = processed.filter(c => c.is_active);
        const sessoesRealizadas = processed.reduce((sum, c) => sum + (c.sessoes_realizadas || 0), 0);
        const sessoesDisponiveis = ativos.reduce((sum, c) => sum + (c.sessoes_disponiveis || 0), 0);
        const taxaUtilizacao = sessoesDisponiveis > 0 ? (sessoesRealizadas / sessoesDisponiveis) * 100 : 0;
        
        setResumo({
          total: processed.length,
          ativos: ativos.length,
          inativos: processed.length - ativos.length,
          sessoes_realizadas: sessoesRealizadas,
          sessoes_disponiveis: sessoesDisponiveis,
          taxa_utilizacao: Math.round(taxaUtilizacao)
        });
      }
    } catch (err: any) {
      console.error("Erro ao carregar colaboradores:", err);
      setError(err.message || "Erro ao carregar colaboradores");
    } finally { 
      setLoading(false); 
    }
  }

  function filterAndSort() {
    let f = [...colaboradores];
    
    if (searchTerm.trim()) { 
      const term = searchTerm.toLowerCase(); 
      f = f.filter(c => 
        c.full_name?.toLowerCase().includes(term) || 
        c.email?.toLowerCase().includes(term) ||
        c.cpf?.includes(term)
      ); 
    }
    
    if (statusFilter === "active") f = f.filter(c => c.is_active);
    else if (statusFilter === "inactive") f = f.filter(c => !c.is_active);
    
    if (planoFilter !== "todos") f = f.filter(c => c.plano === planoFilter);
    
    switch (sortBy) {
      case "nome": f.sort((a,b) => a.full_name.localeCompare(b.full_name)); break;
      case "sessoes": f.sort((a,b) => b.sessoes_realizadas - a.sessoes_realizadas); break;
      case "plano": f.sort((a,b) => a.plano.localeCompare(b.plano)); break;
      case "cadastro": f.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    
    setFiltered(f);
    setCurrentPage(1);
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  
  const hasFilters = searchTerm || statusFilter !== "todos" || planoFilter !== "todos";
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  // 🔥 FUNÇÃO PARA ALTERAR PLANO
  const handleAlterarPlano = async () => {
    if (!selectedColaborador || !novoPlano) {
      setModalError("Selecione um plano");
      return;
    }
    
    setModalLoading(true);
    setModalError("");
    setModalSuccess("");
    
    try {
      await apiCall({
        url: `/api/empresa/colaboradores/${selectedColaborador.user_id}/alterar-plano`,
        method: "POST",
        body: { plano: novoPlano },
        requireAuth: true
      });
      
      const sessoesDisponiveis = getPlanoSessoes(novoPlano);
      const planoNome = getPlanoLabel(novoPlano);
      
      setModalSuccess(`Plano alterado para ${planoNome} com sucesso! ${sessoesDisponiveis} sessões/mês`);
      
      setTimeout(() => {
        setShowEditarModal(false);
        resetModals();
        loadColaboradores();
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Erro ao alterar plano");
    } finally {
      setModalLoading(false);
    }
  };

  // 🔥 FUNÇÃO PARA DESATIVAR
  const handleDesativarClick = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador);
    setDesativarData("");
    setDesativarMotivo("");
    setModalError("");
    setModalSuccess("");
    setShowDesativarModal(true);
  };

  const confirmarDesativar = async () => {
    if (!selectedColaborador) return;
    if (!desativarData) {
      setModalError("Selecione a data de desativação");
      return;
    }
    
    setModalLoading(true);
    setModalError("");
    setModalSuccess("");
    
    try {
      await apiCall({
        url: `/api/empresa/colaboradores/${selectedColaborador.user_id}/desativar`,
        method: "POST",
        body: {
          access_ends_at: desativarData,
          motivo: desativarMotivo || "Desativado pela empresa"
        },
        requireAuth: true
      });
      
      setModalSuccess(`Colaborador desativado com sucesso. Acesso válido até ${new Date(desativarData).toLocaleDateString("pt-BR")}`);
      
      setTimeout(() => {
        setShowDesativarModal(false);
        resetModals();
        loadColaboradores();
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Erro ao desativar colaborador");
    } finally {
      setModalLoading(false);
    }
  };

  // 🔥 FUNÇÃO PARA REATIVAR
  const handleReativarClick = async (colaborador: Colaborador) => {
    setModalLoading(true);
    setModalError("");
    setModalSuccess("");
    try {
      await apiCall({
        url: `/api/empresa/colaboradores/${colaborador.user_id}/reativar`,
        method: "POST",
        body: {},
        requireAuth: true
      });
      setModalSuccess(`Colaborador ${colaborador.full_name} reativado com sucesso!`);
      setTimeout(() => {
        setShowDesativarModal(false);
        resetModals();
        loadColaboradores();
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Erro ao reativar colaborador");
    } finally {
      setModalLoading(false);
    }
  };

  const resetModals = () => {
    setSelectedColaborador(null);
    setNovoPlano("");
    setDesativarData("");
    setDesativarMotivo("");
    setModalError("");
    setModalSuccess("");
    setModalLoading(false);
  };

  const abrirModalEditar = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador);
    setNovoPlano(colaborador.plano);
    setModalError("");
    setModalSuccess("");
    setShowEditarModal(true);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
          </div>
          <div className="flex gap-3">
            <Link 
              href="/empresa/colaboradores/novo" 
              className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Novo Colaborador
            </Link>
            <Link href="/empresa/colaboradores/importar" className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
              <UserPlus className="w-4 h-4" />
              Importar CSV
            </Link>
            <Link href="/empresa/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />Voltar
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{resumo.total}</p>
            <p className="text-sm text-gray-500">Total de Colaboradores</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-600">{resumo.ativos}</p>
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-500">Ativos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-red-600">{resumo.inativos}</p>
              <UserX className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm text-gray-500">Inativos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-blue-600">{resumo.taxa_utilizacao}%</p>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm text-gray-500">Taxa de Utilização</p>
            <p className="text-xs text-gray-400 mt-1">{resumo.sessoes_realizadas}/{resumo.sessoes_disponiveis} sessões</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#E03673]" />
              <h3 className="font-semibold text-gray-900">Filtros</h3>
            </div>
            {hasFilters && (
              <button 
                onClick={() => { setSearchTerm(""); setStatusFilter("todos"); setPlanoFilter("todos"); }} 
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />Limpar
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Nome, email ou CPF..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="todos">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                <select value={planoFilter} onChange={e => setPlanoFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="todos">Todos os planos</option>
                  {PLANOS_OPCOES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="nome">Nome A-Z</option>
                  <option value="sessoes">Mais sessões</option>
                  <option value="plano">Plano</option>
                  <option value="cadastro">Mais recentes</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum colaborador encontrado</p>
            <Link href="/empresa/colaboradores/novo" className="mt-4 inline-block text-[#E03673] hover:underline">
              Cadastrar primeiro colaborador
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">
              {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Contato</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            foto_url={c.foto_url} 
                            name={c.full_name} 
                            userId={c.user_id}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{c.full_name}</p>
                            <p className="text-xs text-gray-500">ID: #{c.user_id}</p>
                            {c.cargo && <p className="text-xs text-gray-400">{c.cargo}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-gray-600">{c.email}</p>
                        {c.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${getPlanoColor(c.plano)}`}>
                          {c.plano_nome}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-lg font-semibold text-gray-900">{c.sessoes_realizadas}</span>
                        <p className="text-xs text-gray-400">de {c.sessoes_disponiveis}</p>
                      </td>
                      <td className="p-3 text-center">
                        {c.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3" />Inativo
                          </span>
                        )}
                        {c.access_ends_at && !c.is_active && (
                          <p className="text-xs text-gray-400 mt-1">Acesso até {formatDate(c.access_ends_at)}</p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => router.push(`/empresa/colaboradores/${c.user_id}`)} 
                            className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => abrirModalEditar(c)}
                            className="p-1.5 text-gray-400 hover:text-[#E03673] transition-colors"
                            title="Alterar plano"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {c.is_active ? (
                            <button 
                              onClick={() => handleDesativarClick(c)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              title="Desativar acesso"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleReativarClick(c)}
                              className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                              title="Reativar acesso"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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

      {/* 🔥 MODAL DE EDIÇÃO DE PLANO */}
      {showEditarModal && selectedColaborador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 bg-[#E03673] text-white">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Alterar Plano</h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">
                Alterar plano de <strong>{selectedColaborador.full_name}</strong>
              </p>
              
              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" /> {modalSuccess}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Novo Plano <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={novoPlano}
                    onChange={(e) => setNovoPlano(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  >
                    {PLANOS_OPCOES.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label} - {p.sessoes} sessões/mês - {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.preco)}/colaborador
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Plano atual: <strong>{selectedColaborador.plano_nome}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Sessões atuais: <strong>{selectedColaborador.sessoes_disponiveis}/mês</strong>
                  </p>
                  {novoPlano && novoPlano !== selectedColaborador.plano && (
                    <p className="text-sm text-green-600 mt-2">
                      → Novo plano: {getPlanoLabel(novoPlano)} ({getPlanoSessoes(novoPlano)} sessões/mês)
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditarModal(false);
                  resetModals();
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                disabled={modalLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleAlterarPlano}
                disabled={modalLoading || !novoPlano || novoPlano === selectedColaborador.plano}
                className="px-4 py-2 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE DESATIVAÇÃO - COR #E03673 */}
      {showDesativarModal && selectedColaborador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 bg-[#E03673] text-white">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Desativar Colaborador</h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">
                Deseja desativar o acesso de <strong>{selectedColaborador.full_name}</strong>?
              </p>
              
              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" /> {modalSuccess}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de término do acesso <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={desativarData}
                    onChange={(e) => setDesativarData(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">O colaborador perderá o acesso após esta data</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                  <textarea
                    value={desativarMotivo}
                    onChange={(e) => setDesativarMotivo(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    rows={2}
                    placeholder="Ex: Desligamento da empresa, Fim do contrato..."
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDesativarModal(false);
                  resetModals();
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                disabled={modalLoading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesativar}
                disabled={modalLoading}
                className="px-4 py-2 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                Confirmar desativação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}