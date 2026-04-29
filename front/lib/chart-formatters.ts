// ============================================
// FUNÇÕES AUXILIARES PARA FORMATTERS DO RECHARTS
// ============================================

/**
 * Formata valor monetário para tooltip do recharts
 * @param value - Valor numérico
 * @returns String formatada
 */
export const formatCurrencyTooltip = (value: number): string => {
  return `R$ ${value.toFixed(2)}`;
};

/**
 * Formata valor monetário com label para tooltip
 * @param value - Valor numérico
 * @param name - Nome da série
 * @returns Array com valor formatado e label
 */
export const formatCurrencyWithLabel = (value: number, name: string): [string, string] => {
  return [`R$ ${value.toFixed(2)}`, name];
};

// Tipo para usar nos formatters do recharts
export type RechartsFormatter = (value: number, name: string) => [string, string];