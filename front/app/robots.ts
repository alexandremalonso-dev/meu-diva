// SEO-MEUDIVA v2: robots.txt do sistema
import type { MetadataRoute } from "next";

const SITE = (process.env.SEO_SITE_URL || "https://app.meudivaonline.com").replace(/\/$/, "");

// Política: o sistema fica FORA do Google, exceto os perfis públicos dos terapeutas e as páginas legais.
// O site de marketing (WordPress) é a vitrine do resto. É uma LISTA DE PERMISSÕES: toda rota nova nasce bloqueada.
// /_next/static e /_next/image precisam ficar liberados para o Google conseguir montar a página.
// O PRÓPRIO /sitemap.xml precisa estar liberado: se o robots.txt o bloquear, o Google não consegue ler o mapa.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/terapeuta/", "/politica-privacidade", "/termos-uso", "/sitemap.xml", "/_next/static/", "/_next/image"],
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
