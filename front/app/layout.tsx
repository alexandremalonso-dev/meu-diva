import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meu Divã',
  description: 'Plataforma de saúde emocional',
  icons: {
    icon: '/favicon.ico',
  },
};

// 🔥 CORRIGIDO: o app inteiro (autenticado, altamente interativo) estava
// sendo servido com cache estático do Next.js (x-nextjs-cache: HIT,
// s-maxage=1 ano) — fazendo qualquer deploy novo nunca aparecer para os
// usuários, mesmo com build/restart corretos. force-dynamic desliga esse
// cache para todo o app.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}