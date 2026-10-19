// SEO-MEUDIVA v2: mapa do site do sistema (perfis públicos dos terapeutas + páginas legais)
import type { MetadataRoute } from "next";

const SITE = (process.env.SEO_SITE_URL || "https://app.meudivaonline.com").replace(/\/$/, "");
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: `${SITE}/politica-privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/termos-uso`, changeFrequency: "yearly", priority: 0.2 },
  ];
  // Só entra quem o backend considera indexável: aprovado, conta ativa, perfil completo e fora da conta de teste.
  // Se o backend falhar, o erro SOBE de propósito (o mapa responde 500): o Google tenta de novo mais tarde,
  // em vez de receber uma lista sem os perfis e concluir que eles saíram do mapa.
  const r = await fetch(`${BACKEND}/public/terapeutas/seo/mapa`, { cache: "no-store" });
  if (!r.ok) throw new Error(`mapa dos terapeutas indisponível (${r.status})`);
  const lista = (await r.json()) as Array<{ id: number; atualizado_em?: string | null }>;
  const perfis: MetadataRoute.Sitemap = lista.map((t) => ({
    url: `${SITE}/terapeuta/${t.id}`,
    lastModified: t.atualizado_em ? new Date(t.atualizado_em) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [...perfis, ...fixas];
}
