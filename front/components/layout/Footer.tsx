import { Heart } from "lucide-react";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  branco: "#FFFFFF",
};

export function Footer() {
  return (
    <footer className="border-t py-4 px-6 text-center" style={{ backgroundColor: CORES.azul, borderTopColor: "rgba(255,255,255,0.2)" }}>
      <p className="text-sm text-white/80 flex items-center justify-center gap-2">
        <Heart size={14} className="text-white/60" />
        © {new Date().getFullYear()} Meu Divã - Plataforma de Saúde Emocional
        <Heart size={14} className="text-white/60" />
      </p>
    </footer>
  );
}