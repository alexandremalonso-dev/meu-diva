"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

export function InstitucionalHeader() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        borderBottom: "1px solid #eef2f9",
      }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "128px" }}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 sm:gap-4">
            <div
              className="rounded-xl overflow-hidden flex items-center justify-center"
              style={{ width: "144px", height: "144px", background: "transparent" }}
            >
              <Image
                src="/favicon-meudiva.png"
                alt="Meu Divã"
                width={144}
                height={144}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: "#2F80D3" }}
            >
              Meu Divã
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-1 ml-auto mr-6">

            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-base font-semibold transition-all"
              style={{ color: "#2F80D3" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#E03673"; (e.target as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#2F80D3"; }}
            >
              Início
            </Link>

            <Link
              href="/para-voce"
              className="px-4 py-2 rounded-lg text-base font-semibold transition-all"
              style={{ color: "#2F80D3" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#E03673"; (e.target as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#2F80D3"; }}
            >
              Para você
            </Link>

            <Link
              href="/para-terapeutas"
              className="px-4 py-2 rounded-lg text-base font-semibold transition-all"
              style={{ color: "#2F80D3" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#E03673"; (e.target as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#2F80D3"; }}
            >
              Para terapeutas
            </Link>

            {/* Dropdown Para empresas */}
            <div
              className="relative"
              onMouseEnter={() => setDropdownAberto(true)}
              onMouseLeave={() => setDropdownAberto(false)}
            >
              <Link
                href="/para-empresas"
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-base font-semibold transition-all"
                style={{ color: dropdownAberto ? "white" : "#2F80D3", background: dropdownAberto ? "#E03673" : "transparent" }}
              >
                Para empresas
                <ChevronDown className="w-4 h-4" />
              </Link>
              {dropdownAberto && (
                <div
                  className="absolute top-full left-0 rounded-xl shadow-xl py-2"
                  style={{ background: "white", minWidth: "180px", zIndex: 99999, border: "1px solid #eef2f9", marginTop: "8px" }}
                >
                  <Link href="/para-empresas" className="block px-4 py-3 text-sm font-medium transition-all hover:bg-red-50" style={{ color: "#1a1a2e" }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = "#fce7ef"; (e.target as HTMLElement).style.color = "#E03673"; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#1a1a2e"; }}
                  >
                    Visão geral
                  </Link>
                  <Link href="/cases" className="block px-4 py-3 text-sm font-medium transition-all" style={{ color: "#1a1a2e" }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = "#fce7ef"; (e.target as HTMLElement).style.color = "#E03673"; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#1a1a2e"; }}
                  >
                    Cases
                  </Link>
                  <Link href="/nr1-guia" className="block px-4 py-3 text-sm font-medium transition-all" style={{ color: "#1a1a2e" }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = "#fce7ef"; (e.target as HTMLElement).style.color = "#E03673"; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "#1a1a2e"; }}
                  >
                    NR-1 Guia
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Botões direita */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
              style={{ color: "#2F80D3", border: "1px solid #2F80D3" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#F4F8FF"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; }}
            >
              Entrar
            </Link>
            <Link
              href="/busca"
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90"
              style={{ backgroundColor: "#E03673" }}
            >
              Encontrar terapeuta
            </Link>
          </div>

          {/* Hamburguer mobile */}
          <button
            className="lg:hidden p-2"
            style={{ color: "#2F80D3" }}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Menu"
          >
            {menuAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div className="lg:hidden px-4 pb-4 flex flex-col gap-1" style={{ backgroundColor: "#ffffff", borderTop: "1px solid #eef2f9" }}>
          {[
            { label: "Início", href: "/" },
            { label: "Para você", href: "/para-voce" },
            { label: "Para terapeutas", href: "/para-terapeutas" },
            { label: "Para empresas", href: "/para-empresas" },
            { label: "Cases", href: "/cases" },
            { label: "NR-1 Guia", href: "/nr1-guia" },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-3 text-sm font-semibold rounded-lg transition-all"
              style={{ color: "#2F80D3" }}
              onClick={() => setMenuAberto(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: "1px solid #eef2f9" }}>
            <Link href="/auth/login" className="flex-1 text-center px-4 py-2 text-sm font-medium rounded-lg" style={{ color: "#2F80D3", border: "1px solid #2F80D3" }} onClick={() => setMenuAberto(false)}>
              Entrar
            </Link>
            <Link href="/busca" className="flex-1 text-center px-4 py-2 text-sm font-semibold text-white rounded-lg" style={{ backgroundColor: "#E03673" }} onClick={() => setMenuAberto(false)}>
              Encontrar terapeuta
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}