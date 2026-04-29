"use client";

import { useState } from "react";
import { Search, Filter, X, Sparkles, Clock, Building2 } from "lucide-react";

interface FiltrosBuscaProps {
  filtros: {
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
    aceita_corporativo: boolean; // 🔥 NOVO
  };
  onFiltrar: (filtros: any) => void;
  onLimpar: () => void;
}

// Opções para os selects
const OPCOES_GENERO = ["", "homem", "mulher", "nao_binario", "genero_fluido"];
const OPCOES_ABORDAGEM = [
  "", "Psicanálise", "Cognitivo-Comportamental", "Humanista", 
  "Gestalt", "Fenomenológico-Existencial", "Sistêmica", "Analítica",
  "Psicoterapia Corporal", "Psicodrama", "Arteterapia"
];
const OPCOES_ESPECIALIDADE = [
  "", "Ansiedade", "Depressão", "Relacionamentos", "Autoestima",
  "Luto", "Trauma", "Estresse", "Burnout", "Fobias", "Pânico",
  "TDAH", "Autismo", "Dependência Química", "Transtornos Alimentares"
];

export function FiltrosBusca({ filtros, onFiltrar, onLimpar }: FiltrosBuscaProps) {
  const [localFiltros, setLocalFiltros] = useState(filtros);
  const [buscaInteligente, setBuscaInteligente] = useState("");

  const handleChange = (campo: string, valor: any) => {
    setLocalFiltros({ ...localFiltros, [campo]: valor });
  };

  // Busca inteligente - simplificada
  const aplicarBuscaInteligente = () => {
    if (!buscaInteligente.trim()) return;
    
    const termo = buscaInteligente.trim();
    const termoLower = termo.toLowerCase();
    
    // Mapeamento de termos
    const mapeamentos: Record<string, string> = {
      "psicanalise": "Psicanálise",
      "psicanalista": "Psicanálise",
      "psicologo": "Psicólogo",
      "tcc": "Cognitivo-Comportamental",
      "cognitivo": "Cognitivo-Comportamental",
      "ansiedade": "Ansiedade",
      "depressao": "Depressão",
      "relacionamento": "Relacionamentos",
      "autoestima": "Autoestima",
      "luto": "Luto",
      "trauma": "Trauma",
      "estresse": "Estresse",
      "burnout": "Burnout",
      "fobia": "Fobias",
      "panico": "Pânico",
      "tdah": "TDAH",
      "autismo": "Autismo"
    };
    
    const novosFiltros = { ...localFiltros };
    
    // Verificar mapeamento
    if (mapeamentos[termoLower]) {
      const termoMapeado = mapeamentos[termoLower];
      
      // Verificar se é uma abordagem
      if (OPCOES_ABORDAGEM.includes(termoMapeado)) {
        novosFiltros.abordagem = termoMapeado;
      }
      // Verificar se é uma especialidade
      else if (OPCOES_ESPECIALIDADE.includes(termoMapeado)) {
        novosFiltros.especialidade = termoMapeado;
      }
      else {
        novosFiltros.nome = termo;
      }
    }
    // Verificar se é uma abordagem direta
    else if (OPCOES_ABORDAGEM.some(a => a.toLowerCase() === termoLower)) {
      const encontrado = OPCOES_ABORDAGEM.find(a => a.toLowerCase() === termoLower);
      novosFiltros.abordagem = encontrado || "";
    }
    // Verificar se é uma especialidade direta
    else if (OPCOES_ESPECIALIDADE.some(e => e.toLowerCase() === termoLower)) {
      const encontrado = OPCOES_ESPECIALIDADE.find(e => e.toLowerCase() === termoLower);
      novosFiltros.especialidade = encontrado || "";
    }
    else {
      novosFiltros.nome = termo;
    }
    
    setLocalFiltros(novosFiltros);
    onFiltrar(novosFiltros);
    setBuscaInteligente("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltrar(localFiltros);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      {/* Cabeçalho - AZUL */}
      <div className="px-6 py-4 border-b border-gray-100 bg-[#2F80D3]">
        <div className="flex items-center gap-3">
          <Filter size={20} className="text-white" />
          <h3 className="text-base font-semibold text-white m-0">Filtros de busca</h3>
        </div>
      </div>

      {/* Conteúdo dos filtros */}
      <form onSubmit={handleSubmit} className="p-6">
        {/* BUSCA INTELIGENTE */}
        <div className="mb-6 p-4 bg-[#2F80D3] rounded-xl">
          <label className="text-xs font-medium text-white mb-2 block flex items-center gap-1.5">
            <Sparkles size={14} className="text-white" />
            Busca Inteligente
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={buscaInteligente}
              onChange={(e) => setBuscaInteligente(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && aplicarBuscaInteligente()}
              placeholder="Ex: psicanalista, ansiedade, TCC, inglês..."
              className="flex-1 px-3 py-2.5 border border-white rounded-lg text-sm outline-none bg-white text-gray-600"
            />
            <button
              type="button"
              onClick={aplicarBuscaInteligente}
              className="px-5 py-2.5 bg-white text-[#2F80D3] rounded-lg cursor-pointer text-sm font-medium flex items-center gap-1.5 transition-all hover:opacity-90"
            >
              <Search size={14} />
              Buscar
            </button>
          </div>
          <p className="text-xs text-white/90 mt-2">
            💡 Digite qualquer termo: especialidade, abordagem, tipo de profissional, idioma...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Busca por nome */}
          <div>
            <label className="text-xs font-medium text-[#E03673] mb-1 block">
              Buscar por nome
            </label>
            <input
              type="text"
              value={localFiltros.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              placeholder="Digite o nome do terapeuta..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
            />
          </div>

          {/* Especialidade */}
          <div>
            <label className="text-xs font-medium text-[#E03673] mb-1 block">
              Especialidade
            </label>
            <select
              value={localFiltros.especialidade}
              onChange={(e) => handleChange("especialidade", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
            >
              {OPCOES_ESPECIALIDADE.map((op) => (
                <option key={op} value={op}>{op || "Todas"}</option>
              ))}
            </select>
          </div>

          {/* Abordagem */}
          <div>
            <label className="text-xs font-medium text-[#E03673] mb-1 block">
              Abordagem terapêutica
            </label>
            <select
              value={localFiltros.abordagem}
              onChange={(e) => handleChange("abordagem", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
            >
              {OPCOES_ABORDAGEM.map((op) => (
                <option key={op} value={op}>{op || "Todas"}</option>
              ))}
            </select>
          </div>

          {/* Gênero */}
          <div>
            <label className="text-xs font-medium text-[#E03673] mb-1 block">
              Gênero
            </label>
            <select
              value={localFiltros.genero}
              onChange={(e) => handleChange("genero", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
            >
              {OPCOES_GENERO.map((op) => (
                <option key={op} value={op}>{op || "Todos"}</option>
              ))}
            </select>
          </div>

          {/* Faixa de preço */}
          <div>
            <label className="text-xs font-medium text-[#E03673] mb-1 block">
              Faixa de preço (R$)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={localFiltros.preco_min}
                onChange={(e) => handleChange("preco_min", Number(e.target.value))}
                placeholder="Mínimo"
                className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
              />
              <input
                type="number"
                value={localFiltros.preco_max}
                onChange={(e) => handleChange("preco_max", Number(e.target.value))}
                placeholder="Máximo"
                className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#E03673]/20 focus:border-[#E03673]"
              />
            </div>
          </div>

          {/* Disponível Agora */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFiltros.disponivel_agora}
                onChange={(e) => handleChange("disponivel_agora", e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[#10B981]"
              />
              <Clock size={14} className="text-[#10B981]" />
              <span className="text-sm text-gray-600">Disponível para atendimento imediato</span>
            </label>
          </div>
        </div>

        {/* Filtros adicionais */}
        <div className="flex flex-wrap gap-4 items-center mt-5 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localFiltros.lgbtqia_ally}
              onChange={(e) => handleChange("lgbtqia_ally", e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#E03673]"
            />
            <span className="text-sm text-gray-600">🏳️‍🌈 Aliado/pertencente LGBTQIAPN+</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localFiltros.duracao_30min}
              onChange={(e) => handleChange("duracao_30min", e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#E03673]"
            />
            <span className="text-sm text-gray-600">⏱️ Sessão de 30 min</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localFiltros.duracao_50min}
              onChange={(e) => handleChange("duracao_50min", e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#E03673]"
            />
            <span className="text-sm text-gray-600">⏱️ Sessão de 50 min</span>
          </label>

          {/* 🔥 NOVO: Aceita plano empresa */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localFiltros.aceita_corporativo}
              onChange={(e) => handleChange("aceita_corporativo", e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#E03673]"
            />
            <Building2 size={14} className="text-[#E03673]" />
            <span className="text-sm text-gray-600">Aceita plano empresa</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            type="button"
            onClick={onLimpar}
            className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer flex items-center gap-1.5 text-sm transition-all hover:bg-gray-200"
          >
            <X size={14} />
            Limpar filtros
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[#E03673] text-white rounded-lg cursor-pointer flex items-center gap-1.5 text-sm transition-all hover:bg-[#c02c5e]"
          >
            <Filter size={14} />
            Aplicar filtros
          </button>
        </div>
      </form>
    </div>
  );
}