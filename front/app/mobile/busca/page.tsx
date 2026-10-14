"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, RefreshCw, Users, ChevronLeft, ChevronRight, X, Loader2, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { MobileCardTerapeuta } from "@/components/mobile/MobileCardTerapeuta";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.meudivaonline.com";

const ESPECIALIDADES = ["Ansiedade","Depressão","Relacionamentos","Trauma","TDAH","TOC","Burnout","Luto","Autoestima","Carreira","Família","Sexualidade","Identidade de gênero","Fobias","Transtornos alimentares"];
const ABORDAGENS = ["TCC","Psicanálise","Humanista","Sistêmica","ACT","DBT","EMDR","Gestalt","Psicanalítica","Cognitiva"];
const MODALIDADES = ["Online","Presencial","Híbrido"];
const GENEROS = ["Feminino","Masculino","Não-binário","Prefiro não informar"];

interface Filtros {
  nome: string;
  especialidade: string;
  abordagem: string;
  modalidade: string;
  genero: string;
  preco_min: number;
  preco_max: number;
  disponivel_agora: boolean;
}

const FILTROS_INICIAIS: Filtros = {
  nome: "", especialidade: "", abordagem: "", modalidade: "",
  genero: "", preco_min: 0, preco_max: 500, disponivel_agora: false,
};

function BuscaContent() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [terapeutas, setTerapeutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [totalResultados, setTotalResultados] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

  const buscar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (filtros.nome) params.append("nome", filtros.nome);
      if (filtros.especialidade) params.append("especialidade", filtros.especialidade);
      if (filtros.abordagem) params.append("abordagem", filtros.abordagem);
      if (filtros.modalidade) params.append("modalidade", filtros.modalidade);
      if (filtros.genero) params.append("genero", filtros.genero);
      if (filtros.preco_min > 0) params.append("preco_min", filtros.preco_min.toString());
      if (filtros.preco_max < 500) params.append("preco_max", filtros.preco_max.toString());
      if (filtros.disponivel_agora) params.append("disponivel_agora", "true");
      params.append("page", pagina.toString());
      params.append("limit", "10");
      params.append("search", "true");

      const res = await fetch(`${BACKEND_URL}/public/terapeutas?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setTerapeutas(data);
      const total = res.headers.get("x-total-count");
      setTotalResultados(total ? parseInt(total) : data.length);
    } catch (e: any) {
      setError(e.message || "Erro ao buscar terapeutas");
    } finally {
      setLoading(false);
    }
  }, [filtros, pagina]);

  useEffect(() => { buscar(); }, [buscar]);

  const aplicarFiltro = (key: keyof Filtros, value: any) => {
    setFiltros(f => ({ ...f, [key]: value }));
    setPagina(1);
  };

  const limpar = () => { setFiltros(FILTROS_INICIAIS); setSearchText(""); setPagina(1); };

  const totalPaginas = Math.ceil(totalResultados / 10);

  const temFiltrosAtivos = filtros.especialidade || filtros.abordagem || filtros.modalidade ||
    filtros.genero || filtros.preco_min > 0 || filtros.preco_max < 500 || filtros.disponivel_agora;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: COLORS.secondary, padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { aplicarFiltro("nome", searchText); } }}
              placeholder="Buscar por nome ou especialidade..."
              style={{ width: "100%", padding: "10px 40px 10px 36px", borderRadius: 10, border: "none", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}
            />
            {searchText && (
              <button onClick={() => { setSearchText(""); aplicarFiltro("nome", ""); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ background: temFiltrosAtivos ? "white" : "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "8px 10px", color: temFiltrosAtivos ? COLORS.secondary : "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontWeight: 600, fontSize: 12 }}>
            <SlidersHorizontal size={16} /> Filtros{temFiltrosAtivos ? " •" : ""}
          </button>
        </div>

        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
          {loading ? "Buscando..." : `${totalResultados} terapeuta${totalResultados !== 1 ? "s" : ""} encontrado${totalResultados !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div style={{ background: "white", padding: 16, borderBottom: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Filtros</div>
            {temFiltrosAtivos && (
              <button onClick={limpar} style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                Limpar tudo
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Especialidade */}
            <div>
              <label style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, display: "block" }}>Especialidade</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ESPECIALIDADES.map(e => (
                  <button key={e} onClick={() => aplicarFiltro("especialidade", filtros.especialidade === e ? "" : e)}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${filtros.especialidade === e ? COLORS.primary : "#E5E7EB"}`, background: filtros.especialidade === e ? COLORS.primary : "white", color: filtros.especialidade === e ? "white" : COLORS.dark, fontSize: 12, cursor: "pointer" }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Abordagem */}
            <div>
              <label style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, display: "block" }}>Abordagem</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ABORDAGENS.map(a => (
                  <button key={a} onClick={() => aplicarFiltro("abordagem", filtros.abordagem === a ? "" : a)}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${filtros.abordagem === a ? COLORS.secondary : "#E5E7EB"}`, background: filtros.abordagem === a ? COLORS.secondary : "white", color: filtros.abordagem === a ? "white" : COLORS.dark, fontSize: 12, cursor: "pointer" }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Gênero + Modalidade */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, display: "block" }}>Gênero</label>
                <select value={filtros.genero} onChange={e => aplicarFiltro("genero", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }}>
                  <option value="">Todos</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, display: "block" }}>Modalidade</label>
                <select value={filtros.modalidade} onChange={e => aplicarFiltro("modalidade", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }}>
                  <option value="">Todas</option>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Disponível agora */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => aplicarFiltro("disponivel_agora", !filtros.disponivel_agora)}
                style={{ width: 44, height: 24, borderRadius: 12, background: filtros.disponivel_agora ? COLORS.primary : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: filtros.disponivel_agora ? 23 : 3, transition: "left 0.2s" }} />
              </button>
              <span style={{ fontSize: 13, color: COLORS.dark }}>Disponível agora</span>
            </div>

            {/* Preço */}
            <div>
              <label style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, display: "block" }}>
                Preço máximo: R$ {filtros.preco_max === 500 ? "Qualquer" : filtros.preco_max}
              </label>
              <input type="range" min={0} max={500} step={10} value={filtros.preco_max}
                onChange={e => aplicarFiltro("preco_max", Number(e.target.value))}
                style={{ width: "100%", accentColor: COLORS.primary }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF" }}>
                <span>R$ 0</span><span>R$ 500+</span>
              </div>
            </div>

            <button onClick={() => setShowFilters(false)}
              style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Ver resultados
            </button>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div style={{ padding: 12 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 }}>
            <Loader2 size={36} className="animate-spin" color={COLORS.primary} />
            <div style={{ fontSize: 14, color: "#6B7280" }}>Buscando terapeutas...</div>
          </div>
        ) : error ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#DC2626", marginBottom: 12 }}>{error}</div>
            <button onClick={buscar} style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        ) : terapeutas.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center" }}>
            <Users size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>Nenhum terapeuta encontrado</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>Tente ajustar ou limpar os filtros</div>
            <button onClick={limpar} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            {terapeutas.map(t => (
              <MobileCardTerapeuta key={t.id} terapeuta={t} isLoggedIn={isLoggedIn} />
            ))}

            {totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 }}>
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  style={{ background: pagina === 1 ? "#F3F4F6" : COLORS.primary, color: pagina === 1 ? "#9CA3AF" : "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: pagina === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronLeft size={16} /> Anterior
                </button>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{pagina} / {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  style={{ background: pagina === totalPaginas ? "#F3F4F6" : COLORS.primary, color: pagina === totalPaginas ? "#9CA3AF" : "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: pagina === totalPaginas ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  Próximo <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MobileBuscaPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin" color="#E03673" />
      </div>
    }>
      <BuscaContent />
    </Suspense>
  );
}
