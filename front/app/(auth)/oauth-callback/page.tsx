'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  const host = window.location.hostname;
  if (host.includes('app.meudivaonline.com') || host.includes('meudiva-frontend-prod')) {
    return 'https://api.meudivaonline.com';
  }
  if (host.includes('meudiva-frontend-non-prod') || host.includes('homologacao')) {
    return 'https://meudiva-api-non-prod-365415900882.southamerica-east1.run.app';
  }
  return 'http://localhost:8000';
}

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
      setTimeout(() => router.push('/auth/login'), 3000);
      return;
    }

    if (!accessToken || !refreshToken) {
      setStatus('error');
      setErrorMessage('Tokens não recebidos');
      setTimeout(() => router.push('/auth/login'), 3000);
      return;
    }

    // Salva tokens
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);

    // Detecta contexto mobile por 3 métodos em ordem de confiabilidade:
    // 1. Flag salva antes do redirect OAuth (mais confiável)
    // 2. Capacitor nativo disponível
    // 3. User-Agent do iOS (fallback)
    const mobileFlag = localStorage.getItem('mobile_oauth_context') === 'true';
    const isCapacitorNative = !!(window as any).Capacitor?.isNativePlatform?.();
    const isIOSUserAgent = /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      !(window as any).MSStream;

    const isMobile = mobileFlag || isCapacitorNative;

    // Limpa a flag após uso
    localStorage.removeItem('mobile_oauth_context');

    if (isMobile) {
      setStatus('success');
      setTimeout(() => {
        window.location.href = '/mobile/dashboard';
      }, 1500);
      return;
    }

    // Web: busca role para redirecionar corretamente
    const baseUrl = getApiBaseUrl();
    fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .then((user) => {
        setStatus('success');
        setTimeout(() => {
          if (user.role === 'therapist') window.location.href = '/therapist/dashboard';
          else if (user.role === 'admin') window.location.href = '/admin/dashboard';
          else if (user.role === 'empresa') window.location.href = '/empresa/dashboard';
          else window.location.href = '/patient/dashboard';
        }, 1500);
      })
      .catch(() => {
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/patient/dashboard';
        }, 1500);
      });

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