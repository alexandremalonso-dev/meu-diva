"use client";

import Link from "next/link";
import { Heart, Shield, Users, Award, Building2, TrendingUp } from "lucide-react";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function SobrePage() {
  return (
    <>
      <InstitucionalHeader />
      
      <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/5 to-[#E03673]/5 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-[#E03673] mb-4">Sobre o Meu Divã</h1>
            <p className="text-lg text-gray-600">Cuidado, escuta e saúde mental ao alcance de todos</p>
          </div>

          {/* Missão */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-8 h-8 text-[#E03673]" />
              <h2 className="text-2xl font-semibold text-gray-800">Nossa Missão</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Democratizar o acesso à terapia de qualidade, conectando pacientes a terapeutas qualificados 
              em uma plataforma segura, acolhedora e acessível.
            </p>
          </div>

          {/* Valores */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-[#2F80D3]" />
              <h2 className="text-2xl font-semibold text-gray-800">Nossos Valores</h2>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li>• Acolhimento e empatia em cada interação</li>
              <li>• Privacidade e segurança dos dados</li>
              <li>• Qualidade e excelência no atendimento</li>
              <li>• Acessibilidade para todos</li>
            </ul>
          </div>

          {/* Para quem é - 3 colunas */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-8 h-8 text-[#10B981]" />
                <h2 className="text-xl font-semibold text-gray-800">Para Pacientes</h2>
              </div>
              <p className="text-gray-600">
                Encontre terapeutas qualificados, agende sessões online e cuide da sua saúde mental 
                no conforto da sua casa.
              </p>
            </div>

            {/* Para Terapeutas - COM LINK */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-3 mb-4">
                <Award className="w-8 h-8 text-[#E03673]" />
                <h2 className="text-xl font-semibold text-gray-800">Para Terapeutas</h2>
              </div>
              <p className="text-gray-600">
                Amplie seu alcance, gerencie sua agenda e receba pacientes de forma simples e eficiente.
              </p>
              <Link 
                href="/planos" 
                className="inline-flex items-center gap-2 mt-4 text-sm text-[#E03673] hover:underline"
              >
                Conheça os planos para terapeutas
                <TrendingUp className="w-4 h-4" />
              </Link>
            </div>

            {/* Para Empresas - COM LINK */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-8 h-8 text-[#2F80D3]" />
                <h2 className="text-xl font-semibold text-gray-800">Para Empresas</h2>
              </div>
              <p className="text-gray-600">
                Promova o bem-estar emocional dos seus colaboradores com planos corporativos, 
                gestão de saúde mental e acompanhamento personalizado.
              </p>
              <Link 
                href="/planos-empresa" 
                className="inline-flex items-center gap-2 mt-4 text-sm text-[#2F80D3] hover:underline"
              >
                Conheça os planos empresariais
                <TrendingUp className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </>
  );
}