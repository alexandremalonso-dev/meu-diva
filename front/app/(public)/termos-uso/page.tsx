"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { FileText, ArrowLeft, Shield, User, Briefcase, Loader2 } from "lucide-react";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function TermosUsoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-12 h-12 text-[#E03673] animate-spin" /></div>}>
      <TermosUsoContent />
    </Suspense>
  );
}

function TermosUsoContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {!isMobile && (isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />)}

      <main className="flex-1">
        <div className="bg-gradient-to-r from-[#2F80D3] to-[#E03673] text-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4" />
              Voltar para o início
            </Link>
            <div className="flex items-center gap-3">
              <FileText className="w-10 h-10" />
              <h1 className="text-3xl font-bold">Termos de Uso</h1>
            </div>
            <p className="text-white/80 mt-2">Última atualização: 27 de março de 2026</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceitação dos Termos</h2>
              <p className="text-gray-600 leading-relaxed">
                Ao acessar ou utilizar a plataforma Meu Divã ("plataforma", "serviço"), você declara que leu,
                compreendeu e concorda em ficar vinculado a estes Termos de Uso. Se você não concordar com
                qualquer parte destes termos, não utilize nossos serviços.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descrição do Serviço</h2>
              <p className="text-gray-600 leading-relaxed">
                O Meu Divã é uma plataforma de teleterapia que conecta pacientes e terapeutas qualificados, oferecendo:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3 ml-4">
                <li>Agendamento de sessões online</li>
                <li>Videochamadas seguras via Jitsi Meet</li>
                <li>Registro de prontuários e evolução do atendimento</li>
                <li>Gestão de pagamentos e recibos</li>
                <li>Comunicação entre pacientes e terapeutas</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Elegibilidade</h2>
              <p className="text-gray-600 leading-relaxed">Para utilizar a plataforma, você deve:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3 ml-4">
                <li>Ter pelo menos 18 anos de idade</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Ser responsável pela confidencialidade de sua conta e senha</li>
                <li>Terapeutas devem comprovar suas credenciais profissionais</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Responsabilidades dos Usuários</h2>
              <div className="mt-4">
                <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#E03673]" />
                  4.1 Para Pacientes
                </h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-8">
                  <li>Comparecer às sessões no horário agendado</li>
                  <li>Manter saldo suficiente na carteira para as sessões</li>
                  <li>Fornecer informações verídicas sobre sua saúde</li>
                  <li>Cancelar com antecedência mínima de 24h para estorno</li>
                  <li>Respeitar o terapeuta e os limites éticos da relação profissional</li>
                </ul>
              </div>
              <div className="mt-4">
                <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#E03673]" />
                  4.2 Para Terapeutas
                </h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-8">
                  <li>Manter registro profissional válido e atualizado</li>
                  <li>Oferecer atendimento ético e profissional</li>
                  <li>Manter disponibilidade conforme configurado</li>
                  <li>Registrar prontuários completos e confidenciais</li>
                  <li>Respeitar os limites e sigilo profissional</li>
                </ul>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Política de Cancelamento e Reembolso</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Cancelamentos com 24h ou mais de antecedência: estorno integral</li>
                <li>Cancelamentos com menos de 24h: sem estorno (paciente) / valor retido (terapeuta)</li>
                <li>Cancelamento pelo terapeuta: estorno integral para o paciente</li>
                <li>Problemas técnicos com a plataforma: reagendamento sem custo</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Pagamentos e Cobranças</h2>
              <p className="text-gray-600 leading-relaxed">
                As sessões são pagas antecipadamente através da carteira virtual do Meu Divã.
                O valor da sessão é debitado automaticamente no momento da confirmação.
                O terapeuta recebe o valor após a sessão ser registrada como concluída.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Propriedade Intelectual</h2>
              <p className="text-gray-600 leading-relaxed">
                Todo o conteúdo da plataforma (textos, imagens, logos, código) é de propriedade exclusiva do
                Meu Divã ou licenciado para seu uso. Você não pode copiar, modificar ou distribuir qualquer
                conteúdo sem autorização expressa.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitação de Responsabilidade</h2>
              <p className="text-gray-600 leading-relaxed">
                O Meu Divã atua como uma plataforma de conexão. Não nos responsabilizamos pela qualidade
                do atendimento prestado pelos terapeutas, sendo estes os únicos responsáveis por seus serviços.
                Não garantimos que o serviço seja ininterrupto ou livre de erros.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Rescisão</h2>
              <p className="text-gray-600 leading-relaxed">
                Reservamo-nos o direito de suspender ou encerrar sua conta a qualquer momento,
                por violação destes termos ou por conduta inadequada, sem aviso prévio.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Disposições Gerais</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Estes termos são regidos pelas leis brasileiras</li>
                <li>Foro eleito: Belo Horizonte - MG</li>
                <li>Em caso de conflito, prevalece a versão em português</li>
                <li>Notificações serão enviadas por e-mail ou pela plataforma</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Aviso Importante</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    O Meu Divã não substitui atendimento de emergência. Em caso de crise, procure
                    o CVV (188) ou o serviço de emergência mais próximo (SAMU 192, Polícia 190).
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Ao utilizar o Meu Divã, você concorda com estes Termos de Uso e com nossa{" "}
                <Link href="/politica-privacidade" className="text-[#E03673] hover:underline">
                  Política de Privacidade
                </Link>.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <Link href="/politica-privacidade" className="text-[#E03673] hover:underline">Política de Privacidade</Link>
            <span className="mx-2">•</span>
            <Link href="/" className="text-[#E03673] hover:underline">Voltar para o início</Link>
          </div>
        </div>
      </main>

      {!isMobile && (isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />)}

    </div>
  );
}