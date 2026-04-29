"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  DollarSign, Save, Loader2, AlertCircle, CheckCircle, 
  Edit2, Plus, Building2, Users, TrendingUp, X, Info
} from "lucide-react";

interface EmpresaPlano {
  id?: number;
  nome: string;
  chave: string;
  preco_mensal_por_colaborador: number;
  sessoes_inclusas_por_colaborador: number;
  valor_repassado_terapeuta: number;  // 🔥 NOVO CAMPO
  ativo: boolean;
  descricao?: string;
  created_at?: string;
  updated_at?: string;
}

export default function AdminValorEmpresaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [planos, setPlanos] = useState<EmpresaPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSessoes, setEditSessoes] = useState("");
  const [editValorTerapeuta, setEditValorTerapeuta] = useState("");  // 🔥 NOVO
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlano, setNewPlano] = useState<EmpresaPlano>({
    nome: "",
    chave: "",
    preco_mensal_por_colaborador: 0,
    sessoes_inclusas_por_colaborador: 0,
    valor_repassado_terapeuta: 50,
    ativo: true,
    descricao: ""
  });

  // Verificar se é admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  // Carregar planos do backend
  useEffect(() => {
    loadPlanos();
  }, []);

  const loadPlanos = async () => {
    setLoading(true);
    try {
      const data = await apiCall({
        url: "/api/admin/empresas/planos",
        requireAuth: true
      });
      if (data && Array.isArray(data) && data.length > 0) {
        setPlanos(data);
      } else {
        setPlanos([
          { 
            nome: "Prata", 
            chave: "prata", 
            preco_mensal_por_colaborador: 45, 
            sessoes_inclusas_por_colaborador: 1,
            valor_repassado_terapeuta: 50,
            ativo: true,
            descricao: "Ideal para empresas que estão começando"
          },
          { 
            nome: "Ouro", 
            chave: "ouro", 
            preco_mensal_por_colaborador: 80, 
            sessoes_inclusas_por_colaborador: 2,
            valor_repassado_terapeuta: 50,
            ativo: true,
            descricao: "Para empresas que buscam maior engajamento"
          },
          { 
            nome: "Diamante", 
            chave: "diamante", 
            preco_mensal_por_colaborador: 140, 
            sessoes_inclusas_por_colaborador: 4,
            valor_repassado_terapeuta: 50,
            ativo: true,
            descricao: "Para empresas que priorizam bem-estar integral"
          }
        ]);
      }
    } catch (err) {
      console.error("Erro ao carregar planos:", err);
      setPlanos([
        { 
          nome: "Prata", 
          chave: "prata", 
          preco_mensal_por_colaborador: 45, 
          sessoes_inclusas_por_colaborador: 1,
          valor_repassado_terapeuta: 50,
          ativo: true,
          descricao: "Ideal para empresas que estão começando"
        },
        { 
          nome: "Ouro", 
          chave: "ouro", 
          preco_mensal_por_colaborador: 80, 
          sessoes_inclusas_por_colaborador: 2,
          valor_repassado_terapeuta: 50,
          ativo: true,
          descricao: "Para empresas que buscam maior engajamento"
        },
        { 
          nome: "Diamante", 
          chave: "diamante", 
          preco_mensal_por_colaborador: 140, 
          sessoes_inclusas_por_colaborador: 4,
          valor_repassado_terapeuta: 50,
          ativo: true,
          descricao: "Para empresas que priorizam bem-estar integral"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plano: EmpresaPlano) => {
    setEditingPlan(plano.chave);
    setEditValue(plano.preco_mensal_por_colaborador.toString());
    setEditSessoes(plano.sessoes_inclusas_por_colaborador.toString());
    setEditValorTerapeuta(plano.valor_repassado_terapeuta?.toString() || "50");
  };

  const handleSave = async (plano: EmpresaPlano) => {
    const newPrice = parseFloat(editValue);
    const newSessoes = parseInt(editSessoes);
    const newValorTerapeuta = parseFloat(editValorTerapeuta);
    
    if (isNaN(newPrice) || newPrice <= 0) {
      setError("Valor inválido");
      return;
    }
    if (isNaN(newSessoes) || newSessoes <= 0) {
      setError("Número de sessões inválido");
      return;
    }
    if (isNaN(newValorTerapeuta) || newValorTerapeuta <= 0) {
      setError("Valor para terapeuta inválido");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiCall({
        url: "/api/admin/empresas/planos/update",
        method: "POST",
        body: { 
          chave: plano.chave, 
          preco_mensal_por_colaborador: newPrice,
          sessoes_inclusas_por_colaborador: newSessoes,
          valor_repassado_terapeuta: newValorTerapeuta
        },
        requireAuth: true
      });

      setPlanos(prev =>
        prev.map(p =>
          p.chave === plano.chave
            ? { 
                ...p, 
                preco_mensal_por_colaborador: newPrice,
                sessoes_inclusas_por_colaborador: newSessoes,
                valor_repassado_terapeuta: newValorTerapeuta
              }
            : p
        )
      );
      
      setSuccess(`Plano ${plano.nome} atualizado: R$ ${newPrice.toFixed(2)}/colaborador, ${newSessoes} sessões/mês, Terapeuta recebe R$ ${newValorTerapeuta.toFixed(2)}`);
      setEditingPlan(null);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar plano");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlano = async () => {
    if (!newPlano.nome || !newPlano.chave || newPlano.preco_mensal_por_colaborador <= 0 || newPlano.sessoes_inclusas_por_colaborador <= 0) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await apiCall({
        url: "/api/admin/empresas/planos/add",
        method: "POST",
        body: newPlano,
        requireAuth: true
      });

      setPlanos(prev => [...prev, { ...newPlano, id: result.id }]);
      setSuccess(`Plano ${newPlano.nome} adicionado com sucesso!`);
      setShowAddModal(false);
      setNewPlano({
        nome: "",
        chave: "",
        preco_mensal_por_colaborador: 0,
        sessoes_inclusas_por_colaborador: 0,
        valor_repassado_terapeuta: 50,
        ativo: true,
        descricao: ""
      });
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar plano");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (plano: EmpresaPlano) => {
    setSaving(true);
    try {
      await apiCall({
        url: "/api/admin/empresas/planos/toggle-status",
        method: "POST",
        body: { chave: plano.chave, ativo: !plano.ativo },
        requireAuth: true
      });
      setPlanos(prev =>
        prev.map(p =>
          p.chave === plano.chave ? { ...p, ativo: !p.ativo } : p
        )
      );
      setSuccess(`Plano ${plano.nome} ${!plano.ativo ? "ativado" : "desativado"} com sucesso`);
    } catch (err: any) {
      setError(err.message || "Erro ao alterar status do plano");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Valores dos Planos Empresariais</h1>
        </div>
        <p className="text-gray-500">
          Gerencie os preços e configurações dos planos para empresas clientes
        </p>
      </div>

      {/* Mensagens de erro/sucesso */}
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

      {/* Tabela de Planos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-900">Planos de Assinatura Empresarial</h2>
            <p className="text-sm text-gray-500">Gerencie os planos: Prata, Ouro, Diamante e personalize novos planos</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Plano
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {planos.filter(p => p.ativo).map((plano) => (
            <div key={plano.chave} className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{plano.nome}</h3>
                  <p className="text-sm text-gray-500">Identificador: {plano.chave}</p>
                  {plano.descricao && (
                    <p className="text-sm text-gray-600 mt-1">{plano.descricao}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${plano.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plano.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(plano)}
                    className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors"
                    title={plano.ativo ? "Desativar plano" : "Ativar plano"}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-100">
                {/* Preço por colaborador */}
                <div>
                  <p className="text-xs text-gray-500">Preço por colaborador</p>
                  {editingPlan === plano.chave ? (
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                      />
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(plano.preco_mensal_por_colaborador)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">/mês por colaborador</p>
                </div>
                
                {/* Sessões inclusas */}
                <div>
                  <p className="text-xs text-gray-500">Sessões inclusas</p>
                  {editingPlan === plano.chave ? (
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editSessoes}
                      onChange={(e) => setEditSessoes(e.target.value)}
                      className="mt-1 px-3 py-1.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    />
                  ) : (
                    <p className="text-xl font-bold text-gray-900">
                      {plano.sessoes_inclusas_por_colaborador}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">sessões/mês</p>
                </div>

                {/* 🔥 NOVO: Valor repassado ao terapeuta */}
                <div>
                  <p className="text-xs text-gray-500">Valor do Terapeuta</p>
                  {editingPlan === plano.chave ? (
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editValorTerapeuta}
                        onChange={(e) => setEditValorTerapeuta(e.target.value)}
                        className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                      />
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(plano.valor_repassado_terapeuta || 50)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">por sessão (líquido)</p>
                </div>

                {/* Receita estimada */}
                <div>
                  <p className="text-xs text-gray-500">Receita estimada (100 colaboradores)</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(plano.preco_mensal_por_colaborador * 100)}
                  </p>
                  <p className="text-xs text-gray-400">/mês</p>
                </div>
              </div>
              
              {/* Botões de ação */}
              <div className="flex justify-end items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                {editingPlan === plano.chave ? (
                  <>
                    <button
                      onClick={() => handleSave(plano)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingPlan(null)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleEdit(plano)}
                    className="p-2 text-gray-400 hover:text-[#E03673] transition-colors"
                    title="Editar plano"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé com informações */}
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Os valores são por colaborador ativo por mês. A receita total é calculada automaticamente nos relatórios.
          </p>
          <p className="text-sm text-blue-700 mt-1 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Para criar um novo plano, clique em "Novo Plano" acima. Os novos planos aparecerão automaticamente nos relatórios e na página de planos para empresas.
          </p>
        </div>
      </div>

      {/* Modal para adicionar novo plano */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 bg-[#E03673] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Novo Plano Empresarial</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-white hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  value={newPlano.nome}
                  onChange={(e) => setNewPlano({ ...newPlano, nome: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  placeholder="Ex: Platinum, Bronze, Enterprise"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identificador (chave) *</label>
                <input
                  type="text"
                  value={newPlano.chave}
                  onChange={(e) => setNewPlano({ ...newPlano, chave: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  placeholder="Ex: platinum, enterprise"
                />
                <p className="text-xs text-gray-400 mt-1">Usado internamente, letras minúsculas sem espaços</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$/colaborador) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={newPlano.preco_mensal_por_colaborador || ""}
                      onChange={(e) => setNewPlano({ ...newPlano, preco_mensal_por_colaborador: parseFloat(e.target.value) })}
                      className="w-full pl-8 pr-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sessões/mês *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={newPlano.sessoes_inclusas_por_colaborador || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, sessoes_inclusas_por_colaborador: parseInt(e.target.value) })}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  />
                </div>
              </div>

              {/* 🔥 NOVO CAMPO NO MODAL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Terapeuta (R$/sessão) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={newPlano.valor_repassado_terapeuta || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, valor_repassado_terapeuta: parseFloat(e.target.value) })}
                    className="w-full pl-8 pr-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Valor líquido que o terapeuta recebe por sessão</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                <textarea
                  value={newPlano.descricao || ""}
                  onChange={(e) => setNewPlano({ ...newPlano, descricao: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  rows={2}
                  placeholder="Descreva os benefícios deste plano"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPlano}
                disabled={saving}
                className="px-4 py-2 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}