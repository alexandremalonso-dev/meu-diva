"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FiltrosBusca } from "@/components/busca/FiltrosBusca";
import { CardTerapeuta } from "@/components/busca/CardTerapeuta";
import { MobileCardTerapeuta } from "@/components/mobile/MobileCardTerapeuta";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import {
  Search,
  LayoutDashboard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  Loader2,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Terapeuta {
  id: number;
  user_id: number;
  full_name: string;
  specialties?: string;
  session_price?: number;
  foto_url?: string;
  rating?: number;
  reviews_count?: number;
  abordagem?: string;
  bio?: string;
  gender?: string;
  verified?: boolean;
  instagram_url?: string | null;
  video_url?: string | null;
  treatment?: string | null;
  is_available_now?: boolean;
  accepts_corporate_sessions?: boolean;
}

interface Filtros {
  nome: string;
  especialidade: string;
  abordagem: string;
  genero: string;
  preco_min: number;
  preco_max: number;
  lgbtqia_ally: boolean;
  duracao_30min: boolean;
  duracao_50min: boolean;
  disponivel_agora: boolean;
  aceita_corporativo: boolean;
}

export default function BuscaPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-12 h-12 text-[#E03673] animate-spin" />
      </div>
    }>
      <BuscaContent />
    </Suspense>
  );
}

function BuscaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<Filtros>({
    nome: searchParams?.get("nome") || "",
    especialidade: searchParams?.get("especialidade") || "",
    abordagem: searchParams?.get("abordagem") || "",
    genero: searchParams?.get("genero") || "",
    preco_min: Number(searchParams?.get("preco_min")) || 0,
    preco_max: Number(searchParams?.get("preco_max")) || 500,
    lgbtqia_ally: searchParams?.get("lgbtqia_ally") === "true",
    duracao_30min: searchParams?.get("duracao_30min") === "true",
    duracao_50min: searchParams?.get("duracao_50min") === "true",
    disponivel_agora: searchParams?.get("disponivel_agora") === "true",
    aceita_corporativo: searchParams?.get("aceita_corporativo") === "true",
  });

  const [totalResultados, setTotalResultados] = useState(0);
  const [pagina, setPagina] = useState(Number(searchParams?.get("page")) || 1);
  const limit = 10;

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

  const buscarTerapeutas = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();

      if (filtros.nome) params.append("nome", filtros.nome);
      if (filtros.especialidade) params.append("especialidade", filtros.especialidade);
      if (filtros.abordagem) params.append("abordagem", filtros.abordagem);
      if (filtros.genero) params.append("genero", filtros.genero);
      if (filtros.preco_min > 0) params.append("preco_min", filtros.preco_min.toString());
      if (filtros.preco_max < 500) params.append("preco_max", filtros.preco_max.toString());
      if (filtros.lgbtqia_ally) params.append("lgbtqia_ally", "true");
      if (filtros.duracao_30min) params.append("duracao_30min", "true");
      if (filtros.duracao_50min) params.append("duracao_50min", "true");
      if (filtros.disponivel_agora) params.append("disponivel_agora", "true");
      if (filtros.aceita_corporativo) params.append("aceita_corporativo", "true");
      params.append("page", pagina.toString());
      params.append("limit", limit.toString());

      const url = `${BACKEND_URL}/public/terapeutas?${params.toString()}`;
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error(`Erro ${response.status}`);

      const data = await response.json();
      setTerapeutas(data);
      setTotalResultados(data.length);

      const urlParams = new URLSearchParams();
      if (filtros.nome) urlParams.set("nome", filtros.nome);
      if (filtros.especialidade) urlParams.set("especialidade", filtros.especialidade);
      if (filtros.abordagem) urlParams.set("abordagem", filtros.abordagem);
      if (filtros.genero) urlParams.set("genero", filtros.genero);
      if (filtros.preco_min > 0) urlParams.set("preco_min", filtros.preco_min.toString());
      if (filtros.preco_max < 500) urlParams.set("preco_max", filtros.preco_max.toString());
      if (filtros.lgbtqia_ally) urlParams.set("lgbtqia_ally", "true");
      if (filtros.duracao_30min) urlParams.set("duracao_30min", "true");
      if (filtros.duracao_50min) urlParams.set("duracao_50min", "true");
      if (filtros.disponivel_agora) urlParams.set("disponivel_agora", "true");
      if (filtros.aceita_corporativo) urlParams.set("aceita_corporativo", "true");
      if (pagina > 1) urlParams.set("page", pagina.toString());

      router.replace(`/busca${urlParams.toString() ? `?${urlParams.toString()}` : ""}`);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar terapeutas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarTerapeutas();
  }, [filtros, pagina]);

  const aplicarFiltros = (novosFiltros: Partial<Filtros>) => {
    setFiltros({ ...filtros, ...novosFiltros });
    setPagina(1);
  };

  const limparFiltros = () => {
    setFiltros({
      nome: "", especialidade: "", abordagem: "", genero: "",
      preco_min: 0, preco_max: 500,
      lgbtqia_ally: false, duracao_30min: false, duracao_50min: false, disponivel_agora: false,
      aceita_corporativo: false,
    });
    setPagina(1);
  };

  const totalPaginas = Math.ceil(totalResultados / limit);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      {!isMobile && (isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />)}

      {/* Hero da busca */}
      <div style={{ backgroundColor: "#2F80D3" }}>
        <div className="max-w-6xl mx-auto px-4 py-12">
          {isLoggedIn && (
            <div className="flex justify-end mb-6">
              <Link href="/patient/dashboard">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: "rgba(255,255,255,0.2)" }}>
                  <LayoutDashboard size={16} />
                  Voltar para o Dashboard
                </button>
              </Link>
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Search size={32} className="text-white" />
            Encontre o terapeuta ideal
          </h1>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.9)" }}>
            Filtre por especialidade, abordagem, preço e mais para encontrar o profissional que melhor atende às suas necessidades.
          </p>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        <FiltrosBusca
          filtros={filtros}
          onFiltrar={aplicarFiltros}
          onLimpar={limparFiltros}
        />

        {loading ? (
          <div className="text-center py-12">
            <Loader2 size={48} className="mx-auto text-[#E03673] animate-spin" />
            <p className="mt-4 text-gray-600">Buscando terapeutas...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <p className="text-red-500">{error}</p>
            <button
              onClick={buscarTerapeutas}
              className="mt-4 px-6 py-2 bg-[#2F80D3] text-white rounded-lg inline-flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>
          </div>
        ) : terapeutas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <Users size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg text-gray-600">Nenhum terapeuta encontrado</p>
            <p className="text-sm text-gray-500 mt-2">Tente ajustar os filtros ou limpar as seleções</p>
            <button
              onClick={limparFiltros}
              className="mt-4 px-6 py-2 bg-[#E03673] text-white rounded-lg inline-flex items-center gap-2"
            >
              <Filter size={14} />
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600">
                <strong>{totalResultados}</strong> terapeutas encontrados
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {terapeutas.map((terapeuta) => (
                isMobile ? (
                  <MobileCardTerapeuta
                    key={`mobile_${terapeuta.id}`}
                    terapeuta={terapeuta}
                  />
                ) : (
                  <CardTerapeuta
                    key={`${terapeuta.id}_${terapeuta.rating}_${terapeuta.reviews_count}`}
                    terapeuta={{
                      ...terapeuta,
                      instagram_url: terapeuta.instagram_url,
                      video_url: terapeuta.video_url,
                      treatment: terapeuta.treatment,
                      is_available_now: terapeuta.is_available_now,
                      accepts_corporate_sessions: terapeuta.accepts_corporate_sessions,
                    }}
                  />
                )
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPagina(pagina - 1)}
                  disabled={pagina === 1}
                  className={`px-4 py-2 rounded-lg flex items-center gap-1 transition-all ${
                    pagina === 1
                      ? "bg-gray-300 text-white opacity-50 cursor-not-allowed"
                      : "bg-[#E03673] text-white hover:bg-[#c02c5e]"
                  }`}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <span className="px-4 py-2 text-gray-600 bg-white rounded-lg">
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPagina(pagina + 1)}
                  disabled={pagina === totalPaginas}
                  className={`px-4 py-2 rounded-lg flex items-center gap-1 transition-all ${
                    pagina === totalPaginas
                      ? "bg-gray-300 text-white opacity-50 cursor-not-allowed"
                      : "bg-[#E03673] text-white hover:bg-[#c02c5e]"
                  }`}
                >
                  Próximo
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!isMobile && (isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />)}

    </div>
  );
}