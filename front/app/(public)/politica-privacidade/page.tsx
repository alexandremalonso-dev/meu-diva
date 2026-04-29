"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function PoliticaPrivacidadePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-12 h-12 text-[#E03673] animate-spin" /></div>}>
      <PoliticaPrivacidadeContent />
    </Suspense>
  );
}

function PoliticaPrivacidadeContent() {
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
              <Shield className="w-10 h-10" />
              <h1 className="text-3xl font-bold">Política de Privacidade</h1>
            </div>
            <p className="text-white/80 mt-2">Última atualização: 27 de março de 2026</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introdução</h2>
              <p className="text-gray-600 leading-relaxed">
                O Meu Divã ("nós", "nosso" ou "plataforma") está comprometido com a proteção da sua privacidade
                e com a transparência sobre como coletamos, usamos e protegemos seus dados pessoais.
                Esta Política de Privacidade descreve nossas práticas em conformidade com a Lei Geral de Proteção
                de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados que coletamos</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-800 mb-1">2.1 Dados fornecidos por você</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Nome completo, e-mail, telefone</li>
                    <li>CPF (para emissão de recibos e pagamentos)</li>
                    <li>Dados de perfil profissional (para terapeutas: CRP, especialidades, bio)</li>
                    <li>Dados bancários e PIX (para recebimentos de terapeutas)</li>
                    <li>Informações sobre suas sessões, prontuários e queixas</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800 mb-1">2.2 Dados coletados automaticamente</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Endereço IP, tipo de dispositivo, navegador</li>
                    <li>Data e hora de acesso</li>
                    <li>Páginas visitadas e interações na plataforma</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Como usamos seus dados</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Para fornecer e manter os serviços da plataforma</li>
                <li>Para facilitar a conexão entre pacientes e terapeutas</li>
                <li>Para processar pagamentos e emissão de recibos</li>
                <li>Para cumprir obrigações legais e regulatórias</li>
                <li>Para melhorar nossos serviços e sua experiência</li>
                <li>Para comunicação sobre atualizações e informações importantes</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Base legal para tratamento</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Tratamos seus dados pessoais com base nas seguintes hipóteses legais:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Execução de contrato (serviços de teleterapia)</li>
                <li>Cumprimento de obrigação legal (emissão de recibos, LGPD)</li>
                <li>Consentimento explícito (quando aplicável)</li>
                <li>Interesse legítimo (melhorias da plataforma)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Compartilhamento de dados</h2>
              <p className="text-gray-600 leading-relaxed mb-3">Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Terapeutas (para pacientes) e pacientes (para terapeutas), conforme necessário para a prestação dos serviços</li>
                <li>Provedores de serviços de pagamento (Stripe, bancos)</li>
                <li>Autoridades judiciais ou regulatórias, quando exigido por lei</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Nunca compartilhamos seus dados com terceiros para fins de marketing sem seu consentimento explícito.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Seus direitos (LGPD)</h2>
              <p className="text-gray-600 leading-relaxed mb-3">Como titular de dados, você tem os seguintes direitos:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Confirmação da existência de tratamento</li>
                <li>Acesso aos seus dados</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li>Portabilidade dos dados</li>
                <li>Eliminação dos dados tratados com consentimento</li>
                <li>Revogação do consentimento</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Segurança dos dados</h2>
              <p className="text-gray-600 leading-relaxed">
                Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados,
                incluindo criptografia, controle de acesso e monitoramento contínuo.
                Seus dados são armazenados em servidores seguros na nuvem.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Retenção de dados</h2>
              <p className="text-gray-600 leading-relaxed">
                Seus dados são mantidos enquanto sua conta estiver ativa e pelo período necessário para cumprir
                obrigações legais (como emissão de recibos e prontuários), que é de no mínimo 5 anos conforme
                determinação dos órgãos de classe.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contato do Encarregado (DPO)</h2>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-gray-600 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#E03673]" />
                  <strong>E-mail:</strong> privacidade@meudivaonline.com
                </p>
                <p className="text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#E03673]" />
                  <strong>Telefone:</strong> (31) 4042-5012
                </p>
                <p className="text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E03673]" />
                  <strong>Endereço:</strong> Jesus Machado Gontijo, 57 - Belo Horizonte, MG
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Atualizações desta política</h2>
              <p className="text-gray-600 leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre mudanças
                significativas através da plataforma ou por e-mail. Recomendamos revisar esta página regularmente.
              </p>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Ao utilizar o Meu Divã, você concorda com os termos desta Política de Privacidade.
                Se você não concorda com estes termos, por favor, não utilize nossos serviços.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <Link href="/termos-uso" className="text-[#E03673] hover:underline">Termos de Uso</Link>
            <span className="mx-2">•</span>
            <Link href="/" className="text-[#E03673] hover:underline">Voltar para o início</Link>
          </div>
        </div>
      </main>

      {!isMobile && (isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />)}
    </div>
  );
}