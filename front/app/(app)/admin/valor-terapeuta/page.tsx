"use client";
// asaas-valor-terapeuta: valor dos planos do TERAPEUTA. O que é salvo aqui é o valor cobrado pelo Asaas nas novas assinaturas e o que as telas mostram (GET /api/plans/).

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { DollarSign, Save, Loader2, AlertCircle, CheckCircle, Edit2, Lock, Info } from "lucide-react";

interface PlanRow {
  plan: string;
  name: string;
  description: string;
  sellable: boolean;
}

interface DbPrice {
  price_brl: number;
  price_cents: number;
  updated_at?: string | null;
}

// Ordem de exibição. O Básico é interno (cortesia): não tem preço e não é vendido.
const PLAN_ROWS: PlanRow[] = [
  { plan: "basico", name: "Básico", description: "Cortesia interna. Não aparece na adesão e não é vendido.", sellable: false },
  { plan: "essencial", name: "Essencial", description: "Plano de entrada pago.", sellable: true },
  { plan: "profissional", name: "Profissional", description: "Comissão reduzida e mais recursos.", sellable: true },
  { plan: "premium", name: "Premium", description: "Comissão mínima e destaque máximo.", sellable: true },
];

const MIN_PRICE = 0.5;
const MAX_PRICE = 4000;

export default function AdminValorTerapeutaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [dbPrices, setDbPrices] = useState<Record<string, DbPrice>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Verificar se é admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  const loadPrices = async () => {
    try {
      const data = await apiCall({ url: "/api/admin/pricing/get", requireAuth: true });
      setDbPrices(data || {});
      setError("");
    } catch (err: any) {
      setError(err.message || "Erro ao carregar os preços");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const handleEdit = (row: PlanRow) => {
    setEditingPlan(row.plan);
    setEditValue(String(dbPrices[row.plan]?.price_brl ?? ""));
    setError("");
    setSuccess("");
  };

  const handleSave = async (row: PlanRow) => {
    const newPrice = parseFloat(editValue.replace(",", "."));
    if (isNaN(newPrice) || newPrice < MIN_PRICE || newPrice > MAX_PRICE) {
      setError(`Informe um valor entre ${formatCurrency(MIN_PRICE)} e ${formatCurrency(MAX_PRICE)}.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiCall({
        url: "/api/admin/pricing/update",
        method: "POST",
        body: { plan: row.plan, price_brl: newPrice },
        requireAuth: true
      });

      await loadPrices();
      setSuccess(`Plano ${row.name} atualizado para ${formatCurrency(newPrice)}. O novo valor já vale para novas assinaturas e aparece em todas as telas.`);
      setEditingPlan(null);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar preço");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Valor dos Planos do Terapeuta</h1>
        </div>
        <p className="text-gray-500">
          Defina o valor mensal de cada plano de assinatura para terapeutas.
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Planos de Assinatura</h2>
          <p className="text-sm text-gray-500">
            A cobrança é feita pelo Asaas com o valor salvo em cada linha.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {PLAN_ROWS.map((row) => {
            const shown = dbPrices[row.plan]?.price_brl;

            return (
              <div key={row.plan} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">{row.name}</h3>
                  <p className="text-sm text-gray-500">{row.description}</p>
                  <p className="text-xs text-gray-400">Identificador: {row.plan}</p>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-4">
                    {editingPlan === row.plan ? (
                      <>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.5"
                            max="4000"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="pl-8 pr-3 py-2 w-32 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleSave(row)}
                          disabled={saving}
                          className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : row.sellable ? (
                      <>
                        <span className="text-xl font-bold text-gray-900">
                          {shown != null ? formatCurrency(shown) : "—"}
                        </span>
                        <span className="text-sm text-gray-400">/mês</span>
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-2 text-gray-400 hover:text-[#E03673] transition-colors"
                          title="Editar valor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-gray-500">Grátis</span>
                        <span title="Plano interno, sem preço">
                          <Lock className="w-4 h-4 text-gray-300" />
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{row.sellable ? "Cobrança pelo Asaas com este valor" : "Sem cobrança"}</p>
                  {row.sellable && shown == null && (
                    <p className="text-xs text-amber-600 font-medium mt-1">Sem valor cadastrado: a venda deste plano está bloqueada.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100 flex gap-3 text-sm text-blue-900">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>O valor salvo aqui é cobrado pelo Asaas nas novas assinaturas e aparece nas telas que mostram os planos.</p>
            <p>Quem já assina continua com o valor da época da assinatura. Terapeutas que ainda assinam pelo Mercado Pago seguem o valor do plano de lá.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
