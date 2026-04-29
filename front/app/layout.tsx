import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meu Divã',
  description: 'Plataforma de saúde emocional',
  icons: {
    icon: '/favicon.ico',
  },
};

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