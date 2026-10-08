"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { DollarSign, Save, Loader2, AlertCircle, CheckCircle, Edit2, Lock } from "lucide-react";

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

interface BillingInfo {
  mp_plan_id: string;
  mp_price_brl: number | null;
  mp_status: string | null;
  free_trial: { frequency: number; frequency_type: string } | null;
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

export default function AdminPricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [dbPrices, setDbPrices] = useState<Record<string, DbPrice>>({});
  const [billing, setBilling] = useState<Record<string, BillingInfo> | null>(null);
  const [billingFailed, setBillingFailed] = useState(false);
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

  const loadBilling = async () => {
    try {
      const data = await apiCall({ url: "/api/admin/pricing/billing-check", requireAuth: true });
      setBilling(data || {});
      setBillingFailed(false);
    } catch {
      setBillingFailed(true);
    }
  };

  useEffect(() => {
    loadPrices();
    loadBilling();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const mpLabel = (row: PlanRow, mp?: BillingInfo) => {
    if (!row.sellable) return "Sem cobrança";
    if (billing === null) {
      return billingFailed ? "Cobrança no Mercado Pago: indisponível agora" : "Consultando o Mercado Pago...";
    }
    if (!mp || mp.mp_price_brl == null) return "Plano não encontrado no Mercado Pago";
    const ft = mp.free_trial;
    const unidade = ft ? (ft.frequency_type === "days" ? "dias" : ft.frequency_type === "months" ? "meses" : ft.frequency_type) : "";
    const trial = ft ? ` · ${ft.frequency} ${unidade} grátis` : "";
    return `Cobrado no Mercado Pago: ${formatCurrency(mp.mp_price_brl)}${trial}`;
  };

  const handleEdit = (row: PlanRow) => {
    setEditingPlan(row.plan);
    setEditValue(String(dbPrices[row.plan]?.price_brl ?? ""));
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
      setSuccess(`Preço exibido do plano ${row.name} atualizado para ${formatCurrency(newPrice)}. A cobrança no Mercado Pago não foi alterada.`);
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
          <h1 className="text-2xl font-bold text-gray-900">Configuração de Preços</h1>
        </div>
        <p className="text-gray-500">
          Gerencie os valores exibidos dos planos de assinatura para terapeutas.
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
            Em cada linha, o valor realmente cobrado é consultado no Mercado Pago.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {PLAN_ROWS.map((row) => {
            const shown = dbPrices[row.plan]?.price_brl;
            const mp = billing ? billing[row.plan] : undefined;
            const diverge =
              row.sellable &&
              mp?.mp_price_brl != null &&
              shown != null &&
              Math.abs(mp.mp_price_brl - shown) > 0.005;

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
                          title="Editar preço exibido"
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
                  <p className="text-xs text-gray-500 mt-1">{mpLabel(row, mp)}</p>
                  {diverge && (
                    <p className="text-xs text-red-600 font-medium mt-1">Diverge do valor cobrado</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-yellow-50 border-t border-yellow-200 space-y-1">
          <p className="text-sm text-yellow-700">
            ⚠️ Este valor é o preço exibido ao público. A cobrança dos assinantes é definida no plano do
            Mercado Pago e não muda ao salvar aqui.
          </p>
          <p className="text-sm text-yellow-700">
            Por enquanto, o checkout e o painel do terapeuta ainda têm o preço escrito no código e não leem esta tabela.
          </p>
        </div>
      </div>
    </div>
  );
}
