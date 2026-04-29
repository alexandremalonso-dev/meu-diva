"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function ExcluirContaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-12 h-12 text-[#E03673] animate-spin" /></div>}>
      <ExcluirContaContent />
    </Suspense>
  );
}

function ExcluirContaContent() {
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
            <h1 className="text-3xl font-bold">Exclusão de Conta e Dados</h1>
            <p className="text-white/80 mt-2">Meu Divã — meudivaonline.com</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
          <div className="bg-pink-50 border-l-4 border-[#E03673] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#E03673] mb-3">Como solicitar a exclusão</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed">
              <li>Acesse o app <strong>Meu Divã</strong> ou o site <strong>meudivaonline.com</strong></li>
              <li>Faça login na sua conta</li>
              <li>Vá em <strong>Meu Perfil → Configurações → Excluir Conta</strong></li>
              <li>Confirme a exclusão</li>
            </ol>
            <p className="mt-4 text-sm text-gray-600">
              Ou envie um e-mail para{" "}
              <a href="mailto:contato@meudivaonline.com" className="text-[#E03673] hover:underline font-medium">
                contato@meudivaonline.com
              </a>{" "}
              com o assunto <strong>"Solicitação de Exclusão de Conta"</strong>.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados excluídos</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
              <li>Nome, e-mail e informações de perfil</li>
              <li>Foto de perfil</li>
              <li>Histórico de sessões e agendamentos</li>
              <li>Mensagens do chat</li>
              <li>Queixas e anotações terapêuticas</li>
              <li>Dados de pagamento (tokens Stripe)</li>
              <li>Notificações e preferências</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Dados mantidos por obrigação legal</h3>
            <p className="text-yellow-700 text-sm leading-relaxed">
              Registros financeiros e fiscais podem ser mantidos por até <strong>5 anos</strong> conforme exigido
              pela legislação tributária brasileira (Lei nº 9.532/97). Esses dados são anonimizados sempre que possível.
            </p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Prazo de exclusão</h3>
            <p className="text-green-700 text-sm leading-relaxed">
              Após a solicitação, sua conta e dados serão excluídos em até <strong>30 dias</strong>.
              Você receberá uma confirmação por e-mail quando o processo for concluído.
            </p>
          </div>

          <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
            <p>Dúvidas? Entre em contato:{" "}
              <a href="mailto:contato@meudivaonline.com" className="text-[#E03673] hover:underline">
                contato@meudivaonline.com
              </a>
            </p>
            <div className="mt-4">
              <Link href="/politica-privacidade" className="text-[#E03673] hover:underline">Política de Privacidade</Link>
              <span className="mx-2">•</span>
              <Link href="/termos-uso" className="text-[#E03673] hover:underline">Termos de Uso</Link>
              <span className="mx-2">•</span>
              <Link href="/" className="text-[#E03673] hover:underline">Voltar para o início</Link>
            </div>
          </div>
        </div>
      </main>

      {!isMobile && (isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />)}
    </div>
  );
}