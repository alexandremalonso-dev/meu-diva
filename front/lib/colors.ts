// front/lib/colors.ts
// Paleta de cores padrão do projeto Meu Divã
// Centralizado para manter consistência em toda a aplicação

export const CORES = {
  // Cores primárias
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  azul: "#2F80D3",
  azulEscuro: "#2563EB",
  
  // Cores secundárias
  ciano: "#49CCD4",
  verde: "#10B981",
  verdeEscuro: "#059669",
  amarelo: "#F59E0B",
  laranja: "#FBB811",
  vermelho: "#EF4444",
  vermelhoEscuro: "#DC2626",
  
  // Cores de plano
  prata: "#6B7280",
  ouro: "#3B82F6",
  diamante: "#9333EA",
  
  // Neutros
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  cinzaClaro: "#F9FAFB",
  cinzaEscuro: "#4B5563",
  
  // Fundos e textos
  branco: "#FFFFFF",
  preto: "#111827",
  
  // Status
  sucesso: "#10B981",
  alerta: "#F59E0B",
  erro: "#EF4444",
  info: "#3B82F6",
} as const;

// Helper para gradientes (lição #2)
export const gradiente = {
  rosa: `linear-gradient(135deg, ${CORES.rosa} 0%, ${CORES.rosa}80 100%)`,
  azul: `linear-gradient(135deg, ${CORES.azul} 0%, ${CORES.azul}80 100%)`,
  verde: `linear-gradient(135deg, ${CORES.verde} 0%, ${CORES.verde}80 100%)`,
  amarelo: `linear-gradient(135deg, ${CORES.amarelo} 0%, ${CORES.amarelo}80 100%)`,
};

// Helper para classes Tailwind baseadas em cores
export const badgeStatus = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  inactive: "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  invoiced: "bg-blue-100 text-blue-700",
};

export const planoCores = {
  prata: "bg-gray-100 text-gray-700",
  ouro: "bg-blue-100 text-blue-700",
  diamante: "bg-purple-100 text-purple-700",
};

export type CorPrimaria = keyof typeof CORES;