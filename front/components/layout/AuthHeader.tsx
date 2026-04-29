"use client";

import Link from "next/link";
import Image from "next/image";

const CORES = {
  azul: "#2F80D3",
  rosa: "#FFFFFF",
};

export function AuthHeader() {
  return (
    <header className="w-full shadow-md sticky top-0 z-50" style={{ backgroundColor: CORES.azul }}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "128px" }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: CORES.rosa }}>
              <Image 
                src="/logo.png" 
                alt="Meu Divã" 
                width={80} 
                height={80} 
                className="w-[110%] h-[110%] object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Meu Divã</h1>
          </Link>

          {/* Links de navegação para páginas públicas */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/busca"
              className="text-white hover:text-white/80 transition-colors text-sm font-medium"
            >
              Encontrar terapeuta
            </Link>
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium text-white border border-white/50 rounded-lg hover:bg-white/10 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 text-sm font-medium bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Cadastrar
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}