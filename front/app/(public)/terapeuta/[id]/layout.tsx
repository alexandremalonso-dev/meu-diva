// SEO-MEUDIVA v3: título, descrição, endereço oficial, imagem do link e dados estruturados do perfil público (roda no servidor)
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = (process.env.SEO_SITE_URL || "https://app.meudivaonline.com").replace(/\/$/, "");
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

type Perfil = {
  id: number;
  full_name?: string | null;
  treatment?: string | null;
  specialties?: string | null;
  professional_type?: string | null;
  bio?: string | null;
  foto_url?: string | null;
  session_price?: number | null;
  instagram_url?: string | null;
};
type Resultado = { estado: "ok"; perfil: Perfil } | { estado: "nao_existe" } | { estado: "erro" };

// Busca anônima (sem login): a API pública já entrega só o que pode ser público. Nunca telefone, e-mail ou assinatura.
async function buscarPerfil(identificador: string): Promise<Resultado> {
  try {
    const r = await fetch(`${BACKEND}/public/terapeutas/${encodeURIComponent(identificador)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (r.status === 404) return { estado: "nao_existe" };
    if (!r.ok) return { estado: "erro" };
    const dados = (await r.json()) as Perfil;
    return dados && typeof dados.id === "number" ? { estado: "ok", perfil: dados } : { estado: "erro" };
  } catch {
    return { estado: "erro" };
  }
}

function nomeCompleto(p: Perfil): string {
  return [p.treatment, p.full_name].filter(Boolean).join(" ").trim() || "Terapeuta";
}
// Profissão no gênero certo quando o cadastro vem como "Psicólogo(a)": usa o tratamento (Sra./Dra. = feminino; Sr./Dr. = masculino)
function profissao(p: Perfil): string {
  const base = (p.professional_type || "").trim();
  if (!base) return "";
  if (/\(a\)/i.test(base)) {
    const t = (p.treatment || "").trim().toLowerCase();
    if (t.startsWith("sra") || t.startsWith("dra")) return base.replace(/o\(a\)/i, "a").replace(/\(a\)/i, "");  // Psicólogo(a) -> Psicóloga
    if (t.startsWith("sr") || t.startsWith("dr")) return base.replace(/\(a\)/i, "");  // Psicólogo(a) -> Psicólogo
  }
  return base;
}
// O que aparece depois do nome: a Especialidade/Profissão/Ocupação (escolha única, o "Tipo Profissional" do cadastro).
// O texto livre "Especialidades" (temas de atendimento, vários valores) não entra no título, na descrição nem no dado estruturado.
function cargo(p: Perfil): string {
  return profissao(p);
}
function limpar(texto: string): string {
  return texto.replace(/https?:\/\/\S+/g, " ").replace(/(^|\s)@[\w.]+/g, " ").replace(/\s+/g, " ").trim();
}
const PALAVRAS_SOLTAS = new Set(["e", "de", "da", "do", "das", "dos", "com", "para", "em", "no", "na", "nos", "nas", "a", "o", "as", "os", "um", "uma", "que", "ou", "por", "ao", "à", "como", "sua", "seu"]);
// Corta em palavra inteira, sem deixar conectivo solto no fim ("... e…"), e acrescenta as reticências.
function cortarPalavras(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  let corte = texto.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  if (espaco > 0) corte = corte.slice(0, espaco);
  const palavras = corte.split(" ");
  while (palavras.length > 1 && PALAVRAS_SOLTAS.has(palavras[palavras.length - 1].toLowerCase().replace(/[.,;:]+$/, ""))) palavras.pop();
  return palavras.join(" ").replace(/[\s,.;:]+$/, "") + "…";
}
const SUFIXO_TITULO = " | Meu Divã";
// Encurta o cargo em palavra inteira, sem reticências e sem conectivo solto; devolve "" se nem a primeira palavra couber.
function encurtarCargo(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  let corte = texto.slice(0, max);
  if (texto[max] !== " ") {
    const e = corte.lastIndexOf(" ");
    if (e <= 0) return "";
    corte = corte.slice(0, e);
  }
  const palavras = corte.split(" ");
  while (palavras.length > 0 && PALAVRAS_SOLTAS.has(palavras[palavras.length - 1].toLowerCase().replace(/[.,;:]+$/, ""))) palavras.pop();
  return palavras.join(" ").replace(/[\s,.;:]+$/, "");
}
// Título com até 60 caracteres. Ordem de sacrifício: para a busca o CARGO vale mais que o tratamento (Sra., Dr.):
// 1) tratamento + nome + cargo; 2) nome + cargo; 3) nome + cargo encurtado; 4) só o nome; 5) nome cortado. A marca fica sempre.
function titulo(p: Perfil): string {
  const cg = cargo(p);
  const comTrat = nomeCompleto(p);
  const simples = (p.full_name || "").trim() || comTrat;
  const monta = (n: string, c: string) => `${n}${c ? ", " + c : ""}${SUFIXO_TITULO}`;
  if (cg) {
    for (const n of [comTrat, simples]) {
      const t = monta(n, cg);
      if (t.length <= 60) return t;
    }
    const folga = 60 - (simples.length + 2 + SUFIXO_TITULO.length);
    const encurtado = folga >= 8 ? encurtarCargo(cg, folga) : "";
    if (encurtado) return monta(simples, encurtado);
  }
  for (const n of [comTrat, simples]) {
    const t = monta(n, "");
    if (t.length <= 60) return t;
  }
  return cortarPalavras(simples, 60 - SUFIXO_TITULO.length) + SUFIXO_TITULO; // nome muito longo: corta o nome e preserva a marca
}
function descricao(p: Perfil): string {
  const paragrafos = (p.bio || "").split(/\n\s*\n/).map(limpar).filter((t) => t.length > 0);
  const base = paragrafos.slice(0, 2).join(" ");
  if (base.length >= 60) return cortarPalavras(base, 155);
  const esp = cargo(p) ? `, ${cargo(p)}` : "";
  return cortarPalavras(`Agende sessões de terapia online com ${nomeCompleto(p)}${esp}. Atendimento por vídeo, com privacidade e segurança, no Meu Divã.`, 155);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await buscarPerfil(id);
  // Só marca "não indexar" quando o terapeuta de fato NÃO existe (404). Falha temporária do backend não pode tirar o perfil do Google.
  if (r.estado === "nao_existe") return { title: "Terapeuta não encontrado | Meu Divã", robots: { index: false, follow: false } };
  if (r.estado === "erro") return { title: "Terapeuta | Meu Divã" };
  const p = r.perfil;
  const url = `${SITE}/terapeuta/${p.id}`; // endereço oficial é sempre o número (o slug só vale enquanto o plano estiver ativo)
  const t = titulo(p);
  const d = descricao(p);
  return {
    title: t,
    description: d,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      locale: "pt_BR",
      siteName: "Meu Divã",
      url,
      title: t,
      description: d,
      images: p.foto_url ? [{ url: p.foto_url, alt: nomeCompleto(p) }] : undefined,
    },
    twitter: { card: "summary", title: t, description: d, images: p.foto_url ? [p.foto_url] : undefined },
  };
}

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await buscarPerfil(id);
  let jsonLd: Record<string, unknown> | null = null;
  if (r.estado === "ok") {
    const p = r.perfil;
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: nomeCompleto(p),
      url: `${SITE}/terapeuta/${p.id}`,
      description: descricao(p),
      worksFor: { "@type": "Organization", name: "Meu Divã", url: "https://meudivaonline.com" },
    };
    if (cargo(p)) jsonLd.jobTitle = cargo(p);
    if (p.foto_url) jsonLd.image = p.foto_url;
    if (p.instagram_url && /^https?:\/\//.test(p.instagram_url)) jsonLd.sameAs = [p.instagram_url];
    if (p.session_price && p.session_price > 0) {
      jsonLd.makesOffer = {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: p.session_price.toFixed(2),
        itemOffered: { "@type": "Service", name: "Sessão de terapia online", serviceType: "Terapia online" },
      };
    }
  }
  return (
    <>
      {jsonLd && (
        // "<" escapado: um texto do terapeuta com </script> não consegue sair do bloco
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      {children}
    </>
  );
}
