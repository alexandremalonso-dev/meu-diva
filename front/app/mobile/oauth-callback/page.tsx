'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MobileOAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#E03673", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 48, height: 48, color: "white" }} />
      </div>
    }>
      <MobileOAuthCallbackContent />
    </Suspense>
  );
}

function MobileOAuthCallbackContent() {
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
        window.location.href = '/mobile/login';
      }, 3000);
      return;
    }

    if (!accessToken || !refreshToken) {
      setStatus('error');
      setErrorMessage('Tokens não recebidos');
      setTimeout(() => {
        window.location.href = '/mobile/login';
      }, 3000);
      return;
    }

    // Salva tokens
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);

    setStatus('success');

    // Sempre redireciona para o dashboard mobile
    setTimeout(() => {
      window.location.href = '/mobile/dashboard';
    }, 1500);

  }, [searchParams]);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#E03673",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: 20,
        padding: 32,
        width: "100%",
        maxWidth: 340,
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        {status === 'loading' && (
          <>
            <Loader2 style={{ width: 56, height: 56, color: "#E03673", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>Autenticando...</h2>
            <p style={{ fontSize: 14, color: "#6b7280" }}>Aguarde enquanto processamos seu login</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle style={{ width: 56, height: 56, color: "#10b981", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>Login realizado!</h2>
            <p style={{ fontSize: 14, color: "#6b7280" }}>Redirecionando para o dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle style={{ width: 56, height: 56, color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>Erro no login</h2>
            <p style={{ fontSize: 14, color: "#6b7280" }}>{errorMessage || 'Ocorreu um erro ao tentar fazer login'}</p>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>Redirecionando para o login...</p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}