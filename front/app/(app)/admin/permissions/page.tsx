"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  Users, 
  UserCog, 
  Settings, 
  Lock, 
  Unlock,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Edit,
  Save as SaveIcon,
  X,
  Mic,
  FileText,
  BarChart3,
  Calendar,
  Wallet,
  MessageSquare,
  Video,
  Clock,
  UserPlus,
  CreditCard,
  Activity,
  Building2,
  DollarSign
} from "lucide-react";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: React.ReactNode;
}

interface UserPermissions {
  user_id: number;
  permissions: string[];
}

interface PlanFeature {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
  available_in: string[];
  is_active: boolean;
}

// Lista de todas as permissões disponíveis
const AVAILABLE_PERMISSIONS: Permission[] = [
  { id: "view_dashboard", name: "Ver Dashboard", description: "Acessar o painel principal", category: "Dashboard", icon: <Activity className="w-4 h-4" /> },
  { id: "view_financial_report", name: "Ver Relatório Financeiro", description: "Acessar relatórios financeiros", category: "Financeiro", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "view_sessions_report", name: "Ver Relatório de Sessões", description: "Acessar relatórios de sessões", category: "Financeiro", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "view_commission_report", name: "Ver Relatório de Comissões", description: "Acessar relatórios de comissões", category: "Financeiro", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "view_subscription_report", name: "Ver Relatório de Assinaturas", description: "Acessar relatórios de assinaturas", category: "Financeiro", icon: <CreditCard className="w-4 h-4" /> },
  { id: "view_platform_report", name: "Ver Relatório da Plataforma", description: "Acessar relatórios da plataforma", category: "Financeiro", icon: <Building2 className="w-4 h-4" /> },
  { id: "view_therapist_report", name: "Ver Relatório por Terapeuta", description: "Acessar relatórios por terapeuta", category: "Financeiro", icon: <UserCog className="w-4 h-4" /> },
  { id: "view_payments_report", name: "Ver Relatório de Pagamentos", description: "Acessar relatório de pagamentos aos terapeutas", category: "Financeiro", icon: <DollarSign className="w-4 h-4" /> }, // 🔥 NOVA PERMISSÃO
  { id: "manage_users", name: "Gerenciar Usuários", description: "Criar, editar e remover usuários", category: "Usuários", icon: <Users className="w-4 h-4" /> },
  { id: "manage_therapists", name: "Gerenciar Terapeutas", description: "Gerenciar perfis de terapeutas", category: "Usuários", icon: <UserCog className="w-4 h-4" /> },
  { id: "manage_patients", name: "Gerenciar Pacientes", description: "Gerenciar perfis de pacientes", category: "Usuários", icon: <UserPlus className="w-4 h-4" /> },
  { id: "manage_subscriptions", name: "Gerenciar Assinaturas", description: "Ver e gerenciar assinaturas", category: "Assinaturas", icon: <CreditCard className="w-4 h-4" /> },
  { id: "manage_pricing", name: "Gerenciar Preços", description: "Alterar preços dos planos", category: "Planos", icon: <DollarSign className="w-4 h-4" /> },
  { id: "view_audit_log", name: "Ver Logs de Auditoria", description: "Acessar histórico de ações", category: "Auditoria", icon: <FileText className="w-4 h-4" /> },
  { id: "manage_chat", name: "Gerenciar Chat", description: "Acessar chat administrativo", category: "Comunicação", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "view_monitor", name: "Ver Monitor", description: "Acessar monitor de atividades", category: "Monitoramento", icon: <Activity className="w-4 h-4" /> },
];

// Features disponíveis por plano
const PLAN_FEATURES: PlanFeature[] = [
  { id: "max_patients_10", name: "Limite de 10 pacientes", description: "Até 10 pacientes ativos", available_in: ["essencial"], is_active: true },
  { id: "max_patients_50", name: "Limite de 50 pacientes", description: "Até 50 pacientes ativos", available_in: ["profissional"], is_active: true },
  { id: "max_patients_unlimited", name: "Pacientes ilimitados", description: "Sem limite de pacientes", available_in: ["premium"], is_active: true },
  { id: "commission_20", name: "Comissão 20%", description: "Taxa de comissão de 20%", available_in: ["essencial"], is_active: true },
  { id: "commission_10", name: "Comissão 10%", description: "Taxa de comissão de 10%", available_in: ["profissional"], is_active: true },
  { id: "commission_3", name: "Comissão 3%", description: "Taxa de comissão de 3%", available_in: ["premium"], is_active: true },
  { id: "financial_reports", name: "Relatórios Financeiros", description: "Acesso a relatórios financeiros", available_in: ["profissional", "premium"], is_active: true },
  { id: "advanced_stats", name: "Estatísticas Avançadas", description: "Métricas e análises detalhadas", available_in: ["profissional", "premium"], is_active: true },
  { id: "priority_support", name: "Suporte Prioritário", description: "Atendimento prioritário", available_in: ["premium"], is_active: true },
  { id: "chat_support", name: "Chat de Suporte", description: "Suporte via chat", available_in: ["profissional", "premium"], is_active: true },
  { id: "ai_microphone", name: "Microfone com IA", description: "Transcrição e rascunho de prontuário com IA", available_in: ["premium"], is_active: false },
  { id: "video_call", name: "Videochamada", description: "Sessões por videochamada", available_in: ["essencial", "profissional", "premium"], is_active: true },
  { id: "digital_prontuary", name: "Prontuário Digital", description: "Registro de prontuários", available_in: ["essencial", "profissional", "premium"], is_active: true },
  { id: "calendar_sync", name: "Sincronização com Google Calendar", description: "Sync bidirecional", available_in: ["profissional", "premium"], is_active: false },
];

const ROLES = [
  { id: "admin", name: "Administrador", icon: Shield, color: "text-red-500", bgColor: "bg-red-50" },
  { id: "therapist", name: "Terapeuta", icon: UserCog, color: "text-blue-500", bgColor: "bg-blue-50" },
  { id: "patient", name: "Paciente", icon: Users, color: "text-green-500", bgColor: "bg-green-50" }
];

const PLANS = [
  { id: "essencial", name: "Essencial", color: "text-gray-500", bgColor: "bg-gray-100" },
  { id: "profissional", name: "Profissional", color: "text-blue-500", bgColor: "bg-blue-50" },
  { id: "premium", name: "Premium", color: "text-[#E03673]", bgColor: "bg-pink-50" }
];

export default function AdminPermissionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>(PLAN_FEATURES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "plans">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(AVAILABLE_PERMISSIONS.map((p: any) => p.category)));

  // Carregar usuários
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiCall({ url: "/api/users", requireAuth: true });
      setUsers(data.filter((u: any) => u.role !== "patient"));
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar permissões do usuário selecionado
  const loadUserPermissions = async (userId: number) => {
    try {
      const data = await apiCall({ 
        url: `/api/admin/permissions/user/${userId}`, 
        requireAuth: true 
      });
      setUserPermissions(data);
    } catch (err) {
      console.error("Erro ao carregar permissões:", err);
      // Inicializar com permissões padrão baseadas na role
      const roleDefaultPermissions = AVAILABLE_PERMISSIONS
        .filter((p: any) => {
          if (selectedUser?.role === "admin") return true;
          if (selectedUser?.role === "therapist") {
            return !p.id.includes("report") && p.id !== "manage_users" && p.id !== "manage_pricing" && p.id !== "view_audit_log";
          }
          return false;
        })
        .map((p: any) => p.id);
      setUserPermissions({ user_id: userId, permissions: roleDefaultPermissions });
    }
  };

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard");
    } else {
      loadUsers();
    }
  }, [user, router]);

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions(selectedUser.id);
    }
  }, [selectedUser]);

  const togglePermission = (permissionId: string) => {
    if (!userPermissions) return;
    
    setUserPermissions({
      ...userPermissions,
      permissions: userPermissions.permissions.includes(permissionId)
        ? userPermissions.permissions.filter((p: any) => p !== permissionId)
        : [...userPermissions.permissions, permissionId]
    });
  };

  const togglePlanFeature = (featureId: string, planId: string) => {
    setPlanFeatures(prev =>
      prev.map((f: any) =>
        f.id === featureId
          ? {
              ...f,
              available_in: f.available_in.includes(planId)
                ? f.available_in.filter((p: any) => p !== planId)
                : [...f.available_in, planId]
            }
          : f
      )
    );
  };

  const toggleFeatureActive = (featureId: string) => {
    setPlanFeatures(prev =>
      prev.map((f: any) =>
        f.id === featureId
          ? { ...f, is_active: !f.is_active }
          : f
      )
    );
  };

  const saveUserPermissions = async () => {
    if (!selectedUser || !userPermissions) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      await apiCall({
        url: "/api/admin/permissions/user/save",
        method: "POST",
        body: { user_id: selectedUser.id, permissions: userPermissions.permissions },
        requireAuth: true
      });
      setSuccess(`Permissões de ${selectedUser.full_name} salvas com sucesso!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const savePlanFeatures = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      await apiCall({
        url: "/api/admin/permissions/plans/features/save",
        method: "POST",
        body: { features: planFeatures },
        requireAuth: true
      });
      setSuccess("Configurações dos planos salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredUsers = users.filter((u: any) =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = [...new Set(AVAILABLE_PERMISSIONS.map((p: any) => p.category))];

  if (loading && users.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Permissionamento de Acesso</h1>
        </div>
        <p className="text-gray-500">
          Gerencie permissões individuais por usuário e features disponíveis por plano.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "text-[#E03673] border-b-2 border-[#E03673]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Permissões por Usuário
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "plans"
              ? "text-[#E03673] border-b-2 border-[#E03673]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Features por Plano
        </button>
      </div>

      {/* Permissões por Usuário */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de usuários */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedUser?.id === u.id ? "bg-[#E03673]/5 border-l-4 border-l-[#E03673]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{u.full_name || u.email}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === "admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {u.role === "admin" ? "Admin" : "Terapeuta"}
                    </span>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Permissões do usuário selecionado */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {selectedUser ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      Permissões de {selectedUser.full_name || selectedUser.email}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Role: {selectedUser.role === "admin" ? "Administrador" : "Terapeuta"}
                    </p>
                  </div>
                  <button
                    onClick={saveUserPermissions}
                    disabled={saving}
                    className="px-4 py-2 bg-[#E03673] text-white rounded-lg text-sm font-medium hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {categories.map((category) => {
                    const categoryPermissions = AVAILABLE_PERMISSIONS.filter((p: any) => p.category === category);
                    const isExpanded = expandedCategories.has(category);
                    const allChecked = categoryPermissions.every(p => userPermissions?.permissions.includes(p.id));
                    const someChecked = categoryPermissions.some(p => userPermissions?.permissions.includes(p.id));
                    
                    return (
                      <div key={category}>
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            <span className="font-medium text-gray-800">{category}</span>
                            <div className={`w-2 h-2 rounded-full ${allChecked ? "bg-green-500" : someChecked ? "bg-yellow-500" : "bg-gray-300"}`} />
                          </div>
                          <span className="text-xs text-gray-400">
                            {categoryPermissions.filter((p: any) => userPermissions?.permissions.includes(p.id)).length}/{categoryPermissions.length}
                          </span>
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {categoryPermissions.map((permission) => {
                              const hasPermission = userPermissions?.permissions.includes(permission.id) || false;
                              return (
                                <button
                                  key={permission.id}
                                  onClick={() => togglePermission(permission.id)}
                                  className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                                    hasPermission
                                      ? "bg-green-50 border border-green-200"
                                      : "bg-gray-50 border border-gray-100 hover:bg-gray-100"
                                  }`}
                                >
                                  <div className={`p-1.5 rounded-full ${hasPermission ? "bg-green-100" : "bg-gray-200"}`}>
                                    {permission.icon}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-sm font-medium ${hasPermission ? "text-green-700" : "text-gray-700"}`}>
                                      {permission.name}
                                    </p>
                                    <p className="text-xs text-gray-400">{permission.description}</p>
                                  </div>
                                  {hasPermission ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Selecione um usuário para editar as permissões</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features por Plano */}
      {activeTab === "plans" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Features por Plano</h3>
              <p className="text-sm text-gray-500">Quais funcionalidades cada plano oferece</p>
            </div>
            <button
              onClick={savePlanFeatures}
              disabled={saving}
              className="px-4 py-2 bg-[#E03673] text-white rounded-lg text-sm font-medium hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
              Salvar
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {planFeatures.map((feature) => (
              <div key={feature.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleFeatureActive(feature.id)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        feature.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      {feature.is_active && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div>
                      <h4 className="font-medium text-gray-800 flex items-center gap-2">
                        {feature.id === "ai_microphone" && <Mic className="w-4 h-4 text-[#E03673]" />}
                        {feature.id === "financial_reports" && <BarChart3 className="w-4 h-4 text-blue-500" />}
                        {feature.id === "calendar_sync" && <Calendar className="w-4 h-4 text-green-500" />}
                        {feature.name}
                      </h4>
                      <p className="text-sm text-gray-500">{feature.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {PLANS.map((plan: any) => (
                      <button
                        key={plan.id}
                        onClick={() => togglePlanFeature(feature.id, plan.id)}
                        disabled={!feature.is_active}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          feature.available_in.includes(plan.id)
                            ? `${plan.bgColor} ${plan.color} border-2 border-transparent`
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        } ${!feature.is_active ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {feature.available_in.includes(plan.id) ? (
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 inline mr-1" />
                        )}
                        {plan.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}