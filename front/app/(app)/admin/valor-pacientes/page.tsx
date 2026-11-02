"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { DollarSign, Save, Loader2, AlertCircle, CheckCircle, Edit2, Plus, X, Info, Power } from "lucide-react";

interface PatientPlan {
  id: number;
  nome: string;
  chave: string;
  preco_mensal: number;
  sessoes_mensais: number;
  valor_repassado_terapeuta: number;
  receita_por_assinante: number;
  descricao?: string | null;
  mp_plan_id?: string | null;
  ativo: boolean;
  validade_meses?: number;
  acumula_proximo_mes?: boolean;
}

interface BillingInfo {
  mp_plan_id: string;
  mp_status: string | null;
  mp_price: number | null;
  billing_day: number | null;
  proportional: boolean | null;
  free_trial: { frequency: number; frequency_type: string } | null;
  back_url: string | null;
  erro?: string;
  desatualizado?: boolean;
}

const REDIRECT_SUGGESTION = "https://app.meudivaonline.com/patient/dashboard?pacote=ok";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const num = (v: string) => parseFloat(String(v).replace(",", "."));

const emptyNew = {
  nome: "",
  chave: "",
  preco_mensal: "",
  sessoes_mensais: "",
  valor_repassado_terapeuta: "50",
  descricao: "",
  mp_plan_id: "",
  validade_meses: "1",
  acumula_proximo_mes: false,
};

export default function AdminValorPacientesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [planos, setPlanos] = useState<PatientPlan[]>([]);
  const [billing, setBilling] = useState<Record<string, BillingInfo> | null>(null);
  const [billingFailed, setBillingFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ preco: "", sessoes: "", repasse: "", mpId: "", descricao: "", validade: "1", acumula: false });
  const [showAdd, setShowAdd] = useState(false);
  const [novo, setNovo] = useState(emptyNew);

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/admin/dashboard");
  }, [user, router]);

  const loadPlanos = async () => {
    try {
      const data = await apiCall({ url: "/api/admin/pacientes/planos", requireAuth: true });
      setPlanos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar os planos");
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async (refresh = false) => {
    try {
      const data = await apiCall({
        url: `/api/admin/pacientes/planos/billing-check${refresh ? "?refresh=true" : ""}`,
        requireAuth: true,
      });
      setBilling(data || {});
      setBillingFailed(false);
    } catch {
      setBillingFailed(true);
    }
  };

  useEffect(() => {
    loadPlanos();
    loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (p: PatientPlan) => {
    setEditing(p.chave);
    setForm({
      preco: String(p.preco_mensal),
      sessoes: String(p.sessoes_mensais),
      repasse: String(p.valor_repassado_terapeuta),
      mpId: p.mp_plan_id || "",
      descricao: p.descricao || "",
      validade: String(p.validade_meses ?? 1),
      acumula: !!p.acumula_proximo_mes,
    });
    setError("");
    setSuccess("");
  };

  const save = async (p: PatientPlan) => {
    const preco = num(form.preco);
    const sessoes = parseInt(form.sessoes, 10);
    const repasse = num(form.repasse);
    if (isNaN(preco) || preco < 0.5 || preco > 4000) { setError("O preço deve estar entre R$ 0,50 e R$ 4.000,00."); return; }
    if (isNaN(sessoes) || sessoes < 1 || sessoes > 50) { setError("As sessões por mês devem ficar entre 1 e 50."); return; }
    if (isNaN(repasse) || repasse < 0) { setError("Valor do terapeuta inválido."); return; }
    if (repasse * sessoes > preco) { setError("O repasse total aos terapeutas é maior que o preço do plano."); return; }
    const validade = parseInt(form.validade, 10);
    if (isNaN(validade) || validade < 1 || validade > 12) { setError("A validade dos créditos deve ficar entre 1 e 12 meses."); return; }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiCall({
        url: "/api/admin/pacientes/planos/update",
        method: "POST",
        body: {
          chave: p.chave,
          preco_mensal: preco,
          sessoes_mensais: sessoes,
          valor_repassado_terapeuta: repasse,
          mp_plan_id: form.mpId.trim(),
          descricao: form.descricao,
          validade_meses: validade,
          acumula_proximo_mes: form.acumula,
        },
        requireAuth: true,
      });
      await loadPlanos();
      await loadBilling();
      setEditing(null);
      setSuccess(`Plano ${p.nome} atualizado. O novo valor já vale para novas assinaturas e aparece em todas as telas.`);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar o plano");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PatientPlan) => {
    setError("");
    setSuccess("");
    try {
      await apiCall({
        url: "/api/admin/pacientes/planos/toggle-status",
        method: "POST",
        body: { chave: p.chave, ativo: !p.ativo },
        requireAuth: true,
      });
      await loadPlanos();
      setSuccess(`Plano ${p.nome} ${p.ativo ? "desativado" : "ativado"}.`);
    } catch (err: any) {
      setError(err.message || "Erro ao alterar o status");
    }
  };

  const add = async () => {
    const preco = num(novo.preco_mensal);
    const sessoes = parseInt(novo.sessoes_mensais, 10);
    const repasse = num(novo.valor_repassado_terapeuta);
    if (!novo.nome.trim() || !novo.chave.trim()) { setError("Preencha o nome e o identificador."); return; }
    if (isNaN(preco) || preco < 0.5 || preco > 4000) { setError("O preço deve estar entre R$ 0,50 e R$ 4.000,00."); return; }
    if (isNaN(sessoes) || sessoes < 1 || sessoes > 50) { setError("As sessões por mês devem ficar entre 1 e 50."); return; }
    if (isNaN(repasse) || repasse < 0) { setError("Valor do terapeuta inválido."); return; }
    if (repasse * sessoes > preco) { setError("O repasse total aos terapeutas é maior que o preço do plano."); return; }
    const validadeNovo = parseInt(novo.validade_meses, 10);
    if (isNaN(validadeNovo) || validadeNovo < 1 || validadeNovo > 12) { setError("A validade dos créditos deve ficar entre 1 e 12 meses."); return; }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiCall({
        url: "/api/admin/pacientes/planos/add",
        method: "POST",
        body: {
          nome: novo.nome.trim(),
          chave: novo.chave.trim(),
          preco_mensal: preco,
          sessoes_mensais: sessoes,
          valor_repassado_terapeuta: repasse,
          descricao: novo.descricao.trim() || null,
          mp_plan_id: novo.mp_plan_id.trim() || null,
          validade_meses: validadeNovo,
          acumula_proximo_mes: novo.acumula_proximo_mes,
        },
        requireAuth: true,
      });
      await loadPlanos();
      await loadBilling();
      setShowAdd(false);
      setNovo(emptyNew);
      setSuccess("Plano criado.");
    } catch (err: any) {
      setError(err.message || "Erro ao criar o plano");
    } finally {
      setSaving(false);
    }
  };

  // asaas-precos: a cobrança é feita pelo Asaas com o preço salvo aqui; não comparamos mais com o Mercado Pago (isso gerava alarme falso).
  const renderBilling = (p: PatientPlan, _mp?: BillingInfo) => (
    <div className="text-xs text-gray-500 space-y-0.5">
      <p>Cobrança pelo Asaas: <strong className="text-gray-700">{formatCurrency(p.preco_mensal)}</strong> nas novas assinaturas, aparecendo em todas as telas.</p>
      {p.mp_plan_id && <p className="text-gray-400">Assinaturas antigas do Mercado Pago continuam com o valor do plano de lá.</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const receitaNovo = num(novo.preco_mensal) - num(novo.valor_repassado_terapeuta) * parseInt(novo.sessoes_mensais, 10);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Valores dos Planos de Pacientes</h1>
        </div>
        <p className="text-gray-600">Gerencie os pacotes de sessões vendidos diretamente ao paciente.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Planos de Assinatura do Paciente</h2>
            <p className="text-xs text-gray-500">Cada plano é uma assinatura mensal (cobrada pelo Asaas) que gera créditos de sessão. O preço editado aqui vale na hora para novas assinaturas.</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setError(""); setSuccess(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c42d63] transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Plano
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {planos.length === 0 && <p className="p-8 text-center text-gray-500 text-sm">Nenhum plano cadastrado.</p>}
          {planos.map((p) => {
            const mp = billing ? billing[p.chave] : undefined;
            const isEditing = editing === p.chave;
            return (
              <div key={p.chave} className={`px-6 py-5 ${p.ativo ? "" : "bg-gray-50"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{p.nome}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Identificador: {p.chave}</p>
                    {p.descricao && <p className="text-sm text-gray-600 mt-1">{p.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <>
                        <button onClick={() => startEdit(p)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button onClick={() => toggle(p)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                          <Power className="w-3.5 h-3.5" /> {p.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Preço para adesão (R$/mês)</label>
                      <input value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sessões inclusas por mês</label>
                      <input value={form.sessoes} onChange={(e) => setForm({ ...form, sessoes: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor do terapeuta (R$/sessão, líquido)</label>
                      <input value={form.repasse} onChange={(e) => setForm({ ...form, repasse: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Validade dos créditos (meses)</label>
                      <input value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={form.acumula} onChange={(e) => setForm({ ...form, acumula: e.target.checked })} className="mt-1" />
                        <span>Sessões não usadas passam para o ciclo seguinte<span className="block text-xs text-gray-400">Se desmarcado, o que sobrar expira ao fim da validade.</span></span>
                      </label>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">ID do plano no Mercado Pago (legado: só para assinaturas antigas)</label>
                      <input value={form.mpId} onChange={(e) => setForm({ ...form, mpId: e.target.value })} placeholder="32 caracteres" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                      <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <button onClick={() => save(p)} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c42d63] disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                      </button>
                      <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Preço para adesão</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(p.preco_mensal)}</p>
                      <p className="text-xs text-gray-400">/mês por assinante</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sessões inclusas</p>
                      <p className="text-lg font-bold text-gray-900">{p.sessoes_mensais}</p>
                      <p className="text-xs text-gray-400">sessões/mês</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Valor do terapeuta</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(p.valor_repassado_terapeuta)}</p>
                      <p className="text-xs text-gray-400">por sessão (líquido)</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Receita estimada</p>
                      <p className="text-lg font-bold text-green-700">{formatCurrency(p.receita_por_assinante)}</p>
                      <p className="text-xs text-gray-400">/mês por assinante, antes das taxas</p>
                    </div>
                    <div className="col-span-2 sm:col-span-4 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      Créditos: valem {p.validade_meses ?? 1} {(p.validade_meses ?? 1) === 1 ? "mês" : "meses"} a partir da cobrança ·{" "}
                      {p.acumula_proximo_mes ? "as não usadas passam para o ciclo seguinte" : "as não usadas expiram ao fim da validade"}
                    </div>
                  </div>
                )}

                {!isEditing && <div className="mt-3">{renderBilling(p, mp)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-sm text-blue-900">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>Os créditos de sessão expiram ao fim de cada ciclo pago, como nos planos de empresa.</p>
          <p>O preço definido aqui é o valor cobrado pelo Asaas nas novas assinaturas e o que aparece para os pacientes. Quem já assina continua com o valor da época da assinatura.</p>
          <p>Legado (assinaturas antigas do Mercado Pago), site de redirecionamento sugerido: <span className="font-mono break-all">{REDIRECT_SUGGESTION}</span></p>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Novo plano de paciente</h3>
              <button onClick={() => setShowAdd(false)} disabled={saving} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: No Divã 03" className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Identificador (letras minúsculas, números e _)</label>
                <input value={novo.chave} onChange={(e) => setNovo({ ...novo, chave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="no_diva_03" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preço (R$/mês)</label>
                  <input value={novo.preco_mensal} onChange={(e) => setNovo({ ...novo, preco_mensal: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sessões/mês</label>
                  <input value={novo.sessoes_mensais} onChange={(e) => setNovo({ ...novo, sessoes_mensais: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Terapeuta (R$)</label>
                  <input value={novo.valor_repassado_terapeuta} onChange={(e) => setNovo({ ...novo, valor_repassado_terapeuta: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Validade dos créditos (meses)</label>
                  <input value={novo.validade_meses} onChange={(e) => setNovo({ ...novo, validade_meses: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={novo.acumula_proximo_mes} onChange={(e) => setNovo({ ...novo, acumula_proximo_mes: e.target.checked })} className="mt-1" />
                    <span>Sessões não usadas passam para o ciclo seguinte</span>
                  </label>
                </div>
              </div>
              {!isNaN(receitaNovo) && (
                <p className="text-xs text-gray-500">Receita estimada: <strong className={receitaNovo < 0 ? "text-red-600" : "text-green-700"}>{formatCurrency(receitaNovo)}</strong> por assinante/mês, antes das taxas.</p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID do plano no Mercado Pago (legado, opcional)</label>
                <input value={novo.mp_plan_id} onChange={(e) => setNovo({ ...novo, mp_plan_id: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                <input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} disabled={saving} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c42d63] disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Criar plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
