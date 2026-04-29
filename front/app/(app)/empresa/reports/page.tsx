"use client";

import Link from "next/link";
import { DollarSign, TrendingUp, Receipt, Users } from "lucide-react";

export default function EmpresaReportsMenuPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 mt-2">Análise financeira e de desempenho da sua empresa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Relatório Financeiro (Faturamento da empresa) */}
        <Link href="/empresa/reports/financeiro" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4 mx-auto">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Financeiro
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Acompanhe o faturamento, consumo e gestão financeira da sua empresa.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              sessões realizadas e valores
            </div>
          </div>
        </Link>

        {/* Relatório de Assinaturas (Colaboradores ativos) */}
        <Link href="/empresa/reports/assinaturas" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#2F80D3]/20 h-full flex flex-col text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center mb-4 mx-auto">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#2F80D3] transition-colors">
              Assinaturas
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Acompanhe os colaboradores ativos e utilização de sessões.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              planos e colaboradores
            </div>
          </div>
        </Link>

        {/* Analytics / Insights */}
        <Link href="/empresa/reports/analytics" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#10B981]/20 h-full flex flex-col text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#10B981] to-[#10B981]/80 flex items-center justify-center mb-4 mx-auto">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#10B981] transition-colors">
              Analytics
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Métricas de saúde mental, evolução e insights dos colaboradores.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              dados agregados e anonimizados
            </div>
          </div>
        </Link>

        {/* Faturamento (Notas Fiscais) */}
        <Link href="/empresa/faturamento" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4 mx-auto">
              <Receipt className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Faturamento
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Acompanhe suas faturas e notas fiscais emitidas.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              documentos fiscais
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}