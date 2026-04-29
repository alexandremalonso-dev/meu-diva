"use client";

import Link from "next/link";
import { 
  BarChart3, 
  Users, 
  Building2, 
  CreditCard, 
  DollarSign, 
  Briefcase, 
  TrendingUp,
  Receipt,
  Store,
  Timer,
  Clock
} from "lucide-react";

export default function ReportsMenuPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Relatórios Financeiros</h1>
        <p className="text-gray-500 mt-2">Análise completa da plataforma Meu Divã</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Relatório Geral */}
        <Link href="/admin/reports/geral" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Relatório Geral
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Visão geral financeira da plataforma. Receitas totais, ticket médio, cancelamentos.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              valores brutos por sessão
            </div>
          </div>
        </Link>

        {/* Relatório por Terapeuta */}
        <Link href="/admin/reports/terapeutas" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#2F80D3]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#2F80D3] transition-colors">
              Relatório por Terapeuta
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Valores líquidos a receber por terapeuta. Comissões já descontadas.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              valores líquidos após comissão
            </div>
          </div>
        </Link>

        {/* Relatório da Plataforma */}
        <Link href="/admin/reports/plataforma" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#10B981]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#10B981]/80 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#10B981] transition-colors">
              Relatório da Plataforma
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Comissões recebidas pela plataforma. Receita por plano e projeções.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              valores das comissões
            </div>
          </div>
        </Link>

        {/* Duração das Sessões */}
        <Link href="/admin/reports/duracao-sessoes" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4">
              <Timer className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Duração das Sessões
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Análise da duração efetiva das sessões. Sessões zeradas, curtas e tempo de conexão.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              tempo real de conexão de terapeutas e pacientes
            </div>
          </div>
        </Link>

        {/* 🔥 CORRIGIDO: Assinatura da Empresa - rota correta */}
        <Link href="/admin/reports/empresas-assinaturas" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4">
              <Store className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Assinatura da Empresa
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Gestão de planos e assinaturas de empresas clientes. Colaboradores ativos e receita mensal.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              planos: Prata, Ouro, Diamante
            </div>
          </div>
        </Link>

        {/* Faturamento da Empresa (Cobrança) */}
        <Link href="/admin/empresas/faturamento" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#2F80D3]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#2F80D3] transition-colors">
              Faturamento da Empresa
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Acompanhe o faturamento a ser cobrado de cada empresa cliente. Envie notas fiscais.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              valor a faturar × colaboradores ativos
            </div>
          </div>
        </Link>

        {/* Relatório de Assinaturas (Terapeutas) */}
        <Link href="/admin/reports/assinaturas" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#F59E0B]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 flex items-center justify-center mb-4">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#F59E0B] transition-colors">
              Assinaturas Terapeutas
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Gestão de planos e assinaturas dos terapeutas. Status e renovações.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              planos e status de pagamento
            </div>
          </div>
        </Link>

        {/* Relatório de Pagamentos aos Terapeutas */}
        <Link href="/admin/reports/payments" className="group">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all hover:border-[#E03673]/20 h-full flex flex-col">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#E03673] transition-colors">
              Pagamentos aos Terapeutas
            </h2>
            <p className="text-gray-500 text-sm mt-2 flex-1">
              Gerencie os pagamentos e notas fiscais dos terapeutas. Valores pendentes e pagos.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              valores líquidos a pagar
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}