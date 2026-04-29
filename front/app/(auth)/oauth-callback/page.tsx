'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// 🔥 COMPONENTE PRINCIPAL ENVOLTO EM SUSPENSE
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2F80D3] to-[#E03673]">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader2 className="w-16 h-16 text-[#E03673] animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">Carregando...</h2>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}

// 🔥 CONTEÚDO REAL DA PÁGINA
function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = searchParams?.get('access_token');
    const refreshToken = searchParams?.get('refresh_token');
    const error = searchParams?.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
      return;
    }

    if (accessToken && refreshToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      
      setStatus('success');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } else {
      setStatus('error');
      setErrorMessage('Tokens não recebidos');
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2F80D3] to-[#E03673]">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-[#E03673] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800">Autenticando...</h2>
            <p className="text-gray-500 mt-2">Aguarde enquanto processamos seu login</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800">Login realizado!</h2>
            <p className="text-gray-500 mt-2">Redirecionando para o dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800">Erro no login</h2>
            <p className="text-gray-500 mt-2">{errorMessage || 'Ocorreu um erro ao tentar fazer login'}</p>
            <p className="text-gray-400 text-sm mt-4">Redirecionando para o login...</p>
          </>
        )}
      </div>
    </div>
  );
}