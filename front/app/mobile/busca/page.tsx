"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, X, Loader2, Users, RefreshCw,
  ChevronLeft, ChevronRight
} from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { MobileCardTerapeuta } from "@/components/mobile/MobileCardTerapeuta";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  dark: "#3A3B21",
};

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
  accepts_corporate_sessions?: boolean;
  is_available_now?: boolean;
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

const filtrosIniciais: Filtros = {
  nome: "",
  especialidade: "",
  abordagem: "",
  genero: "",
  preco_min: 0,
  preco_max: 500,
  lgbtqia_ally: false,
  duracao_30min: false,
  duracao_50min: false,
  disponivel_agora: false,
  aceita_corporativo: false,
};

export default function MobileBuscaPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={40} color="#E03673" />
      </div>
    }>
      <MobileBuscaContent />
    </Suspense>
  );
}

function MobileBuscaContent() {
  const router = useRouter();
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciais);
  const [showFilters, setShowFilters] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);
  const limit = 10;

  const buscar = async (f = filtros, p = pagina) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (f.nome) params.append("nome", f.nome);
      if (f.especialidade) params.append("especialidade", f.especialidade);
      if (f.abordagem) params.append("abordagem", f.abordagem);
      if (f.genero) params.append("genero", f.genero);
      if (f.preco_min > 0) params.append("preco_min", f.preco_min.toString());
      if (f.preco_max < 500) params.append("preco_max", f.preco_max.toString());
      if (f.lgbtqia_ally) params.append("lgbtqia_ally", "true");
      if (f.duracao_30min) params.append("duracao_30min", "true");
      if (f.duracao_50min) params.append("duracao_50min", "true");
      if (f.disponivel_agora) params.append("disponivel_agora", "true");
      if (f.aceita_corporativo) params.append("aceita_corporativo", "true");
      params.append("page", p.toString());
      params.append("limit", limit.toString());

      const response = await fetch(`${BACKEND_URL}/public/terapeutas?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const data = await response.json();
      setTerapeutas(data || []);
      setTotalResultados(data?.length || 0);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar terapeutas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { buscar(); }, []);

  const aplicar = () => {
    setPagina(1);
    buscar(filtros, 1);
    setShowFilters(false);
  };

  const limpar = () => {
    const novosFiltros = filtrosIniciais;
    setFiltros(novosFiltros);
    setPagina(1);
    buscar(novosFiltros, 1);
    setShowFilters(false);
  };

  const totalPaginas = Math.ceil(totalResultados / limit);

  const temFiltrosAtivos = filtros.nome || filtros.especialidade || filtros.abordagem ||
    filtros.genero || filtros.preco_min > 0 || filtros.preco_max < 500 ||
    filtros.lgbtqia_ally || filtros.duracao_30min || filtros.duracao_50min ||
    filtros.disponivel_agora || filtros.aceita_corporativo;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Buscar Terapeuta" showBack backTo="/mobile/dashboard" />

      {/* BARRA DE BUSCA */}
      <div style={{ backgroundColor: COLORS.secondary, padding: "16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={filtros.nome}
              onChange={(e) => setFiltros(f => ({ ...f, nome: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
              placeholder="Nome, especialidade, abordagem..."
              style={{
                width: "100%", padding: "10px 12px 10px 36px",
                borderRadius: 10, border: "none", fontSize: 14,
                backgroundColor: "white", outline: "none",
                color: COLORS.dark, boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={aplicar}
            style={{ backgroundColor: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Buscar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? "white" : "rgba(255,255,255,0.2)",
              color: showFilters ? COLORS.secondary : "white",
              border: "none", borderRadius: 8, padding: "6px 12px",
              fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Filter size={12} />
            Filtros {temFiltrosAtivos ? "●" : ""}
          </button>
          {temFiltrosAtivos && (
            <button
              onClick={limpar}
              style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      {showFilters && (
        <div style={{ backgroundColor: "white", padding: 16, borderBottom: `1px solid ${COLORS.grayBorder}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark, marginBottom: 4, display: "block" }}>Especialidade</label>
              <input
                type="text"
                value={filtros.especialidade}
                onChange={(e) => setFiltros(f => ({ ...f, especialidade: e.target.value }))}
                placeholder="Ex: ansiedade, depressão..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.grayBorder}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark, marginBottom: 4, display: "block" }}>Abordagem</label>
              <input
                type="text"
                value={filtros.abordagem}
                onChange={(e) => setFiltros(f => ({ ...f, abordagem: e.target.value }))}
                placeholder="Ex: TCC, psicanálise..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.grayBorder}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark, marginBottom: 4, display: "block" }}>Gênero</label>
              <select
                value={filtros.genero}
                onChange={(e) => setFiltros(f => ({ ...f, genero: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.grayBorder}`, fontSize: 13, outline: "none", backgroundColor: "white" }}
              >
                <option value="">Todos</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="nao-binario">Não-binário</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark, marginBottom: 4, display: "block" }}>Preço máximo: R$ {filtros.preco_max}</label>
              <input
                type="range"
                min={0} max={500} step={10}
                value={filtros.preco_max}
                onChange={(e) => setFiltros(f => ({ ...f, preco_max: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF" }}>
                <span>R$ 0</span><span>R$ 500+</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { key: "lgbtqia_ally", label: "Aliado LGBTQIA+" },
                { key: "duracao_30min", label: "Sessões de 30min" },
                { key: "duracao_50min", label: "Sessões de 50min" },
                { key: "disponivel_agora", label: "Disponível agora" },
                { key: "aceita_corporativo", label: "Aceita plano empresa" },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={(filtros as any)[key]}
                    onChange={(e) => setFiltros(f => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={aplicar}
                style={{ flex: 1, backgroundColor: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Aplicar filtros
              </button>
              <button
                onClick={limpar}
                style={{ backgroundColor: COLORS.gray, color: COLORS.dark, border: `1px solid ${COLORS.grayBorder}`, borderRadius: 10, padding: "10px 16px", fontSize: 14, cursor: "pointer" }}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Loader2 size={40} color={COLORS.primary} style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14 }}>Buscando terapeutas...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: "#EF4444", fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button
              onClick={() => buscar()}
              style={{ backgroundColor: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        ) : terapeutas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Users size={48} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14 }}>Nenhum terapeuta encontrado</p>
            <button
              onClick={limpar}
              style={{ marginTop: 12, backgroundColor: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              <strong>{totalResultados}</strong> terapeutas encontrados
            </p>

            {terapeutas.map((terapeuta) => (
              <MobileCardTerapeuta key={terapeuta.id} terapeuta={terapeuta} />
            ))}

            {totalPaginas > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => { setPagina(p => p - 1); buscar(filtros, pagina - 1); }}
                  disabled={pagina === 1}
                  style={{ backgroundColor: pagina === 1 ? "#E5E7EB" : COLORS.primary, color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: pagina === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ padding: "8px 12px", backgroundColor: "white", borderRadius: 8, fontSize: 13, color: "#6B7280" }}>
                  {pagina} / {totalPaginas}
                </span>
                <button
                  onClick={() => { setPagina(p => p + 1); buscar(filtros, pagina + 1); }}
                  disabled={pagina === totalPaginas}
                  style={{ backgroundColor: pagina === totalPaginas ? "#E5E7EB" : COLORS.primary, color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: pagina === totalPaginas ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}