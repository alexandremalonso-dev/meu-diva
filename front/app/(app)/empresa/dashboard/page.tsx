"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar, Users, User, ArrowRight, X, Loader2,
  BarChart2, UserPlus, CheckCircle, XCircle, DollarSign, Activity,
  Building2, Briefcase, TrendingUp, Search,
  Mail, Phone, IdCard, Lock, AlertCircle, Receipt
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

import { MenuCard } from "@/app/(app)/therapist/dashboard/components/cards/MenuCard";
import { UserAvatar } from "@/components/ui/UserAvatar";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ColaboradorData {
  id: number;
  user_id: number;
  empresa_id: number;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  is_active: boolean;
  access_ends_at?: string;
  created_at: string;
  foto_url?: string;
}

function StatCard({ title, value, subtitle, icon: Icon }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-4 text-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/80">{title}</span>
        <Icon className="w-5 h-5 text-white/70" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [colaboradores, setColaboradores] = useState<ColaboradorData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"month" | "year">("month");
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_colaboradores: 0,
    ativos: 0,
    valor_mes: 0,
    sessoes_mes: 0,
    faturado_total: 0,
    pago_total: 0
  });
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [formData, setFormData] = useState({
    nome: "", email: "", cpf: "", data_nascimento: "", telefone: "", departamento: "", cargo: ""
  });

  // Carregar todos os dados
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      
      // 1. Colaboradores
      const cols = await apiCall({ url: "/api/empresa/colaboradores", requireAuth: true }).catch(() => []);
      setColaboradores(cols || []);
      
      // 2. Relatório financeiro
      const financeiro = await apiCall({ url: "/api/empresa/reports/financeiro", requireAuth: true }).catch(() => null);
      
      // 3. Notas fiscais
      const invoices = await apiCall({ url: "/api/empresa/reports/cobranca/invoices", requireAuth: true }).catch(() => []);
      
      // Processar stats
      const ativos = cols?.filter((c: any) => c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > new Date())).length || 0;
      const totalFaturado = invoices?.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0;
      const totalPago = invoices?.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0;
      
      setStats({
        total_colaboradores: cols?.length || 0,
        ativos: ativos,
        valor_mes: financeiro?.resumo?.total_a_faturar || 0,
        sessoes_mes: financeiro?.resumo?.total_sessoes_realizadas || 0,
        faturado_total: totalFaturado,
        pago_total: totalPago
      });
      
      // Dados do gráfico
      if (financeiro?.chart_data && financeiro.chart_data.length > 0) {
        setChartData(financeiro.chart_data);
      } else {
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        const dados = [];
        for (let i = 0; i <= hoje.getMonth(); i++) {
          dados.push({ mes: meses[i], receita: 0, sessoes: 0 });
        }
        setChartData(dados);
      }
      
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);

  useEffect(() => { loadData(); }, [loadData]);

  // Formatar
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatPhoneModal = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatCpfModal = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleModalChange = (field: string, value: string) => {
    if (field === "cpf") value = formatCpfModal(value);
    if (field === "telefone") value = formatPhoneModal(value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetModal = () => {
    setFormData({ nome: "", email: "", cpf: "", data_nascimento: "", telefone: "", departamento: "", cargo: "" });
    setModalError("");
    setModalSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.cpf || !formData.data_nascimento) {
      setModalError("Preencha todos os campos obrigatórios");
      return;
    }
    
    setModalLoading(true);
    setModalError("");
    
    try {
      await apiCall({
        url: "/api/empresa/colaboradores/novo",
        method: "POST",
        body: {
          nome: formData.nome,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          data_nascimento: formData.data_nascimento,
          telefone: formData.telefone.replace(/\D/g, ''),
          departamento: formData.departamento,
          cargo: formData.cargo
        },
        requireAuth: true
      });
      
      setModalSuccess("Colaborador cadastrado com sucesso!");
      resetModal();
      setTimeout(() => { setShowModal(false); loadData(); }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Erro ao cadastrar");
    } finally {
      setModalLoading(false);
    }
  };

  const filteredColaboradores = useMemo(() => {
    if (!searchTerm) return colaboradores;
    const term = searchTerm.toLowerCase();
    return colaboradores.filter(c => 
      c.full_name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.cpf?.includes(term)
    );
  }, [colaboradores, searchTerm]);

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
        <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.full_name || user?.email}!</h1>
        <p className="text-sm text-gray-600 mt-1">Painel Empresarial — visão geral da sua organização</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Menu Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MenuCard href="/empresa/dashboard" icon="dashboard" title="Dashboard" description="Visão geral" color="blue" />
          <MenuCard href="/empresa/colaboradores" icon="users" title="Usuários" description="Colaboradores" color="blue" />
          <MenuCard href="/empresa/sessions" icon="calendar" title="Sessões" description="Histórico" color="blue" />
          <MenuCard href="/empresa/reports" icon="reports" title="Relatórios" description="Financeiro" color="blue" />
        </div>

        {/* Cards superiores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total de Usuários" value={stats.total_colaboradores} subtitle={`${stats.ativos} ativos`} icon={Users} />
          <StatCard title="Valor a Faturar" value={formatCurrency(stats.valor_mes)} subtitle="mês atual" icon={TrendingUp} />
          <StatCard title="Faturado" value={formatCurrency(stats.faturado_total)} subtitle="notas emitidas" icon={Receipt} />
          <StatCard title="Pago" value={formatCurrency(stats.pago_total)} subtitle="valores recebidos" icon={CheckCircle} />
        </div>

        {/* Card de Colaboradores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E03673]" />
              Colaboradores
              <span className="text-sm font-normal text-gray-500 ml-1">({colaboradores.length})</span>
            </h3>
            <button onClick={() => { resetModal(); setShowModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-[#E03673] text-white rounded-lg text-sm hover:bg-[#c02c5e] transition-colors">
              <UserPlus className="w-4 h-4" /> Novo Colaborador
            </button>
          </div>
          
          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por nome, e-mail ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 transform -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          
          {/* Lista */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredColaboradores.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum colaborador encontrado</p>
              </div>
            ) : (
              filteredColaboradores.slice(0, 10).map((colab) => (
                <div key={colab.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <UserAvatar fotoUrl={colab.foto_url} name={colab.full_name} size="sm" />
                    <div>
                      <p className="font-medium text-gray-800">{colab.full_name}</p>
                      <p className="text-xs text-gray-500">{colab.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${colab.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {colab.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => router.push(`/empresa/colaboradores/${colab.id}`)} className="text-[#E03673] hover:text-[#c02c5e] text-sm">Ver</button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
            <span>Total: {colaboradores.length}</span>
            <span>Ativos: {colaboradores.filter(c => c.is_active).length}</span>
            <button onClick={() => router.push("/empresa/colaboradores")} className="text-[#E03673] hover:underline">Gerenciar todos →</button>
          </div>
        </div>

        {/* Cards inferiores com gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card Sessões Realizadas */}
          <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-white/70">Sessões Realizadas</p>
                  <p className="text-xl font-bold">{stats.sessoes_mes}</p>
                </div>
              </div>
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as any)} className="bg-white/20 text-white text-sm rounded-lg px-3 py-1.5 border border-white/30">
                <option value="month">Este mês</option>
                <option value="year">Este ano</option>
              </select>
            </div>
            <div className="pt-3 border-t border-white/20">
              <div className="flex justify-between text-xs text-white/70 mb-3">
                <span>{periodFilter === "month" ? "Este mês" : "Este ano"}</span>
                <span>{formatCurrency(stats.valor_mes)} em sessões</span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-white text-gray-900 p-2 rounded shadow-lg text-xs">
                      <p className="font-medium">{payload[0]?.payload?.mes}</p>
                      <p>Sessões: {payload[0]?.payload?.sessoes || 0}</p>
                    </div>
                  ) : null} />
                  <Line type="monotone" dataKey="sessoes" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card Faturamento */}
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-5 text-white">
            <Link href="/empresa/faturamento" className="block">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Faturamento</p>
                    <p className="text-xl font-bold">{formatCurrency(stats.valor_mes)}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70" />
              </div>
            </Link>
            <div className="pt-3 border-t border-white/20">
              <div className="flex justify-between text-xs text-white/70 mb-3">
                <span>{periodFilter === "month" ? "Este mês" : "Este ano"}</span>
                <span>{stats.sessoes_mes} sessões realizadas</span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-white text-gray-900 p-2 rounded shadow-lg text-xs">
                      <p className="font-medium">{payload[0]?.payload?.mes}</p>
                      <p>Faturamento: {formatCurrency(payload[0]?.payload?.receita || 0)}</p>
                    </div>
                  ) : null} />
                  <Line type="monotone" dataKey="receita" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CADASTRO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Novo Colaborador</h3>
              </div>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="p-1 text-white hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {modalSuccess}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                  <input type="text" value={formData.nome} onChange={(e) => handleModalChange("nome", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={formData.email} onChange={(e) => handleModalChange("email", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={formData.cpf} onChange={(e) => handleModalChange("cpf", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" placeholder="000.000.000-00" required />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data nascimento *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="date" value={formData.data_nascimento} onChange={(e) => handleModalChange("data_nascimento", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="tel" value={formData.telefone} onChange={(e) => handleModalChange("telefone", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={formData.departamento} onChange={(e) => handleModalChange("departamento", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={formData.cargo} onChange={(e) => handleModalChange("cargo", e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700 flex items-center gap-2"><Lock className="w-4 h-4" /> Uma senha temporária será enviada para o e-mail.</p>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => { setShowModal(false); resetModal(); }} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={modalLoading} className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2">
                    {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Cadastrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}