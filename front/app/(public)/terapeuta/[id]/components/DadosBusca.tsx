"use client";

import type { TerapeutaPublico } from '../types';

// 🎨 PALETA DE CORES
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

// Ícones para cada categoria
const ICONES = {
  abordagens: "🧠",
  especialidades: "⭐",
  motivos: "💭",
  atuo: "🎯",
  idiomas: "🌎",
  genero: "👤",
  etnia: "🌍",
  formacao: "📚",
  aliado: "🏳️‍🌈",
  experiencia: "📊",
};

// Componente para renderizar uma tag azul
const BlueTag = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      backgroundColor: CORES.azul,
      color: CORES.branco,
      padding: "8px 16px",
      borderRadius: "24px",
      fontSize: "13px",
      fontWeight: "500",
      display: "inline-block",
      textAlign: "center",
    }}
  >
    {children}
  </span>
);

// Componente Card
function Card({ titulo, icone, conteudo }: { titulo: string; icone: string; conteudo: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: CORES.branco,
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        padding: "20px 16px",
        transition: "all 0.2s ease",
        cursor: "pointer",
        border: `1px solid ${CORES.cinzaBorda}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)";
      }}
    >
      {/* Ícone */}
      <div
        style={{
          fontSize: "32px",
          marginBottom: "12px",
          textAlign: "center",
        }}
      >
        {icone}
      </div>

      {/* Título */}
      <h3
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: CORES.rosa,
          textAlign: "center",
          marginBottom: "16px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {titulo}
      </h3>

      {/* Conteúdo */}
      <div
        style={{
          textAlign: "center",
        }}
      >
        {conteudo}
      </div>
    </div>
  );
}

// Função para renderizar múltiplas tags
const renderMultipleTags = (items: string[], placeholder: string = "Não informado") => {
  if (!items || items.length === 0) {
    return <BlueTag>{placeholder}</BlueTag>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
      {items.map((item, index) => (
        <BlueTag key={index}>{item}</BlueTag>
      ))}
    </div>
  );
};

// Função para renderizar texto único
const renderSingleText = (text: string | null | undefined, placeholder: string = "Não informado") => {
  if (!text) return <BlueTag>{placeholder}</BlueTag>;
  return <BlueTag>{text}</BlueTag>;
};

// 🔥 FUNÇÃO PARA RENDERIZAR O CARD LGBTQIAPN+ COM DUAS TAGS SEPARADAS
const renderLGBTQCard = (value: boolean | undefined) => {
  if (!value) return <BlueTag>Não informado</BlueTag>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
      <BlueTag>✓ Aliado</BlueTag>
      <BlueTag>✓ Pertencente</BlueTag>
    </div>
  );
};

// Função para renderizar experiência
const renderExperiencia = (totalSessions: number | undefined) => {
  if (totalSessions === undefined || totalSessions === null) {
    return <BlueTag>Carregando...</BlueTag>;
  }
  if (totalSessions === 0) {
    return <BlueTag>Ainda nenhuma sessão realizada</BlueTag>;
  }
  const sessaoText = totalSessions === 1 ? 'sessão' : 'sessões';
  const realizadaText = totalSessions === 1 ? 'realizada' : 'realizadas';
  return (
    <BlueTag>
      {totalSessions} {sessaoText} {realizadaText}
    </BlueTag>
  );
};

interface DadosBuscaProps {
  terapeuta: TerapeutaPublico;
}

export function DadosBusca({ terapeuta }: DadosBuscaProps) {
  const cards = [
    {
      titulo: "Abordagens",
      icone: ICONES.abordagens,
      conteudo: renderMultipleTags(terapeuta.approaches || [])
    },
    {
      titulo: "Especialidades",
      icone: ICONES.especialidades,
      conteudo: renderMultipleTags(terapeuta.specialties_list || [])
    },
    {
      titulo: "Motivos que atendo",
      icone: ICONES.motivos,
      conteudo: renderMultipleTags(terapeuta.reasons || [])
    },
    {
      titulo: "Atuo como",
      icone: ICONES.atuo,
      conteudo: renderMultipleTags(
        (terapeuta.service_types || []).map(item => 
          item === 'psicanalista' ? 'Psicanalista' : 
          item === 'psicologo' ? 'Psicólogo' :
          item === 'nutricionista' ? 'Nutricionista' :
          item === 'psiquiatra' ? 'Psiquiatra' : item
        )
      )
    },
    {
      titulo: "Idiomas",
      icone: ICONES.idiomas,
      conteudo: renderMultipleTags(terapeuta.languages_list || [])
    },
    {
      titulo: "Gênero",
      icone: ICONES.genero,
      conteudo: renderSingleText(terapeuta.gender)
    },
    {
      titulo: "Etnia",
      icone: ICONES.etnia,
      conteudo: renderSingleText(terapeuta.ethnicity)
    },
    {
      titulo: "Formação",
      icone: ICONES.formacao,
      conteudo: renderSingleText(terapeuta.formation)
    },
    {
      titulo: "LGBTQIAPN+",
      icone: ICONES.aliado,
      conteudo: renderLGBTQCard(terapeuta.lgbtqia_ally)
    },
    {
      titulo: "Experiência",
      icone: ICONES.experiencia,
      conteudo: renderExperiencia(terapeuta.total_sessions)
    }
  ];

  return (
    <div style={{ 
      backgroundColor: CORES.branco, 
      borderRadius: "16px", 
      boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)", 
      overflow: "hidden",
    }}>
      {/* Cabeçalho */}
      <div style={{ 
        padding: "24px 24px 16px 24px",
        borderBottom: `1px solid ${CORES.cinzaBorda}`,
      }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: CORES.azul, margin: 0 }}>
          🔍 Como posso ajudar você?
        </h2>
        <p style={{ fontSize: "14px", marginTop: "8px", color: CORES.cinzaTexto }}>
          Essas são as áreas e especialidades que trabalho para melhor atender você.
        </p>
      </div>

      {/* Grid de Cards - 2 colunas */}
      <div style={{ padding: "24px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(2, 1fr)", 
          gap: "20px"
        }}>
          {cards.map((card, index) => (
            <Card
              key={index}
              titulo={card.titulo}
              icone={card.icone}
              conteudo={card.conteudo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}