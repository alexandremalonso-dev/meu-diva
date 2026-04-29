"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">Meu Divã</span>
          </Link>
          
          <div className="hidden md:flex md:gap-6">
            <Link
              href="/busca"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/busca') ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Encontrar terapeuta
            </Link>
            <Link
              href="/como-funciona"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/como-funciona') ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Como funciona
            </Link>
            <Link
              href="/precos"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/precos') ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Preços
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/auth/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Entrar
          </Link>
          <Link href="/auth/signup" className={buttonVariants({ size: "sm" })}>
            Cadastrar
          </Link>
        </div>
      </div>
    </nav>
  );
}