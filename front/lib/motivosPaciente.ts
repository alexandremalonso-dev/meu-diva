// asaas-motivos: nome escrito certo (com acento) de cada queixa/motivo do paciente, que o sistema guarda pelo CODIGO interno ("depressao").
export const MOTIVOS_PACIENTE: Record<string, string> = {
  ansiedade: "Ansiedade",
  depressao: "Depressão",
  estresse: "Estresse",
  relacionamento: "Relacionamentos",
  relacionamentos: "Relacionamentos",
  autoestima: "Autoestima",
  autoconhecimento: "Autoconhecimento",
  carreira: "Carreira",
  luto: "Luto",
  trauma: "Trauma",
  burnout: "Burnout",
  panico: "Pânico",
  fobias: "Fobias",
  toc: "TOC",
  alimentares: "Transtornos Alimentares",
  sexualidade: "Sexualidade",
  tdah: "TDAH",
  tea: "TEA",
  conflitos_familiares: "Conflitos Familiares",
  ciumes: "Ciúmes",
  lgbt: "LGBT+",
};

// Codigo conhecido -> nome certo. Codigo novo (so letras minusculas, numeros e _) -> arrumado ("meu_tema" vira "Meu tema"). Texto livre (com espaco, maiuscula ou pontuacao) fica EXATAMENTE como foi escrito.
export function rotuloMotivo(valor: string): string {
  const v = String(valor ?? "");
  if (Object.prototype.hasOwnProperty.call(MOTIVOS_PACIENTE, v)) return MOTIVOS_PACIENTE[v];
  if (/^[a-z0-9_]+$/.test(v)) return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");
  return v;
}
