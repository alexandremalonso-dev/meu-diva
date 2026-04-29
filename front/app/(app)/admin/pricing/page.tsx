"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { DollarSign, Save, Loader2, AlertCircle, CheckCircle, Edit2, Plus, Trash2 } from "lucide-react";

interface PlanPrice {
  plan: string;
  price_cents: number;
  price_brl: number;
  name: string;
}

export default function AdminPricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [prices, setPrices] = useState<PlanPrice[]>([
    { plan: "profissional", price_cents: 7900, price_brl: 79.00, name: "Profissional" },
    { plan: "premium", price_cents: 14900, price_brl: 149.00, name: "Premium" }
  ]);
  const [loading, setLoading] = useState(false);
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

  const handleEdit = (plan: PlanPrice) => {
    setEditingPlan(plan.plan);
    setEditValue(plan.price_brl.toString());
  };

  const handleSave = async (plan: PlanPrice) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      setError("Valor inválido");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Chamar API para atualizar preço
      await apiCall({
        url: "/api/admin/pricing/update",
        method: "POST",
        body: { plan: plan.plan, price_brl: newPrice },
        requireAuth: true
      });

      // Atualizar local
      setPrices(prev =>
        prev.map(p =>
          p.plan === plan.plan
            ? { ...p, price_brl: newPrice, price_cents: newPrice * 100 }
            : p
        )
      );
      
      setSuccess(`Preço do plano ${plan.name} atualizado para R$ ${newPrice.toFixed(2)}`);
      setEditingPlan(null);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar preço");
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Configuração de Preços</h1>
        </div>
        <p className="text-gray-500">
          Gerencie os valores dos planos de assinatura para terapeutas.
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
          <p className="text-sm text-gray-500">Altere os valores dos planos Profissional e Premium</p>
        </div>

        <div className="divide-y divide-gray-200">
          {prices.map((plan) => (
            <div key={plan.plan} className="px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500">
                  Identificador: {plan.plan}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {editingPlan === plan.plan ? (
                  <>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="pl-8 pr-3 py-2 w-32 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleSave(plan)}
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
                ) : (
                  <>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(plan.price_brl)}
                    </span>
                    <span className="text-sm text-gray-400">/mês</span>
                    <button
                      onClick={() => handleEdit(plan)}
                      className="p-2 text-gray-400 hover:text-[#E03673] transition-colors"
                      title="Editar preço"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-yellow-50 border-t border-yellow-200">
          <p className="text-sm text-yellow-700">
            ⚠️ Atenção: Alterar os preços afeta diretamente os valores cobrados dos terapeutas.
            Os preços estão em centavos no Stripe e serão convertidos automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}