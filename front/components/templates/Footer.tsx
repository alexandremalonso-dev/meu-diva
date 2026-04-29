"use client";

import Link from 'next/link';
import { CenteredFooter, FooterIcon } from '@/features/landing/CenteredFooter';
import { Section } from '@/features/landing/Section';
import { AppConfig } from '@/utils/AppConfig';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Section className="bg-background pb-0">
      <CenteredFooter
        logo={<FooterIcon />}
        name={AppConfig.name}
        icon="🛋️"
      >
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Home
        </Link>
        <Link href="/busca" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Buscar terapeutas
        </Link>
        <Link href="/como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Como funciona
        </Link>
        <Link href="/precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Preços
        </Link>
        <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Entrar
        </Link>
        <Link href="/auth/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cadastrar
        </Link>
      </CenteredFooter>
    </Section>
  );
};