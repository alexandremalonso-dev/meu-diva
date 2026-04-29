"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Video, Users, Shield, Brain, Calendar, Heart, Building2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

function HomePageContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header - usa o mesmo padrão da página de busca */}
      {isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />}

      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-[#2F80D3] to-[#E03673] text-white py-20">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-6">
              <Brain className="w-5 h-5" />
              <span className="text-sm font-medium">Saúde emocional ao seu alcance</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Cuide da sua saúde mental<br />
              com quem entende do assunto
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Conecte-se com terapeutas qualificados e comece sua jornada de autoconhecimento e bem-estar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/busca"
                className="bg-white text-[#E03673] px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2"
              >
                Encontrar terapeuta
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/auth/signup"
                className="border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition-all inline-flex items-center gap-2"
              >
                Começar agora
              </Link>
            </div>
          </div>
        </section>

        {/* Para quem é a plataforma */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Para quem é o Meu Divã?
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Uma plataforma completa para todos que buscam cuidado emocional ou querem oferecer atendimento.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Pacientes */}
              <div className="bg-white rounded-xl p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-[#E03673]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-[#E03673]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Para Pacientes</h3>
                <p className="text-gray-600 mb-4">
                  Encontre terapeutas qualificados, agende sessões online e cuide da sua saúde mental no conforto da sua casa.
                </p>
                <ul className="text-left space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Busca avançada por especialidade</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Agendamento online</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Sessões por videochamada</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Prontuário digital</li>
                </ul>
                <Link href="/busca" className="inline-flex items-center gap-2 mt-6 text-[#E03673] font-medium hover:gap-3 transition-all">
                  Encontrar terapeuta <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Terapeutas */}
              <div className="bg-white rounded-xl p-8 text-center shadow-lg border-2 border-[#E03673]/20 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#E03673] text-white text-xs px-3 py-1 rounded-full">
                  Destaque
                </div>
                <div className="w-16 h-16 bg-[#2F80D3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-[#2F80D3]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Para Terapeutas</h3>
                <p className="text-gray-600 mb-4">
                  Amplie seu alcance, gerencie sua agenda e receba pacientes de forma simples e eficiente.
                </p>
                <ul className="text-left space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Perfil profissional no marketplace</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Agenda e gestão de sessões</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Videochamada integrada</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Relatórios financeiros</li>
                </ul>
                <Link href="/planos" className="inline-flex items-center gap-2 mt-6 text-[#2F80D3] font-medium hover:gap-3 transition-all">
                  Conhecer planos <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Empresas */}
              <div className="bg-white rounded-xl p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-[#F59E0B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-[#F59E0B]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Para Empresas</h3>
                <p className="text-gray-600 mb-4">
                  Promova o bem-estar emocional dos seus colaboradores com planos corporativos personalizados.
                </p>
                <ul className="text-left space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Gestão de colaboradores</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Dashboard do RH</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Relatórios consolidados</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Conformidade NR-1</li>
                </ul>
                <Link href="/planos-empresa" className="inline-flex items-center gap-2 mt-6 text-[#F59E0B] font-medium hover:gap-3 transition-all">
                  Planos empresariais <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Como funciona - Passo a passo */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Como funciona?
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Em poucos passos você começa sua jornada de cuidado emocional.
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#E03673] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">1</div>
                <h3 className="font-semibold text-lg mb-2">Cadastre-se</h3>
                <p className="text-gray-500">Crie sua conta gratuitamente em poucos minutos</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#2F80D3] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">2</div>
                <h3 className="font-semibold text-lg mb-2">Encontre um terapeuta</h3>
                <p className="text-gray-500">Filtre por especialidade, preço e abordagem</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#F59E0B] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">3</div>
                <h3 className="font-semibold text-lg mb-2">Agende sua sessão</h3>
                <p className="text-gray-500">Escolha o melhor dia e horário</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#10B981] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">4</div>
                <h3 className="font-semibold text-lg mb-2">Inicie o cuidado</h3>
                <p className="text-gray-500">Conecte-se via videochamada e comece sua jornada</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Por que escolher o Meu Divã?
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Uma plataforma completa para cuidar da sua saúde mental com segurança e praticidade.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-[#E03673]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-[#E03673]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Sessões online</h3>
                <p className="text-gray-600">
                  Atendimento 100% online com videochamadas seguras e privadas via Jitsi Meet.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-[#2F80D3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-[#2F80D3]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Segurança e sigilo</h3>
                <p className="text-gray-600">
                  Seus dados são protegidos com criptografia e total sigilo profissional.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-[#F59E0B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-[#F59E0B]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Agendamento flexível</h3>
                <p className="text-gray-600">
                  Escolha os horários que melhor se adequam à sua rotina.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-20 bg-gradient-to-r from-[#2F80D3] to-[#E03673] text-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para começar sua jornada?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Junte-se a milhares de pessoas que já cuidam da saúde mental com o Meu Divã.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 bg-white text-[#E03673] px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
              >
                Criar conta gratuita
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/busca"
                className="inline-flex items-center gap-2 border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition-all"
              >
                Encontrar terapeuta
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <ChatProvider>
        <HomePageContent />
      </ChatProvider>
    </AuthProvider>
  );
}