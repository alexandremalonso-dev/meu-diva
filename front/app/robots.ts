// SEO-MEUDIVA v1: robots.txt do sistema
import type { MetadataRoute } from "next";

const SITE = (process.env.SEO_SITE_URL || "https://app.meudivaonline.com").replace(/\/$/, "");

// Política: o sistema fica FORA do Google, exceto os perfis públicos dos terapeutas e as páginas legais.
// O site de marketing (WordPress) é a vitrine do resto. É uma LISTA DE PERMISSÕES: toda rota nova nasce bloqueada.
// /_next/static e /_next/image precisam ficar liberados para o Google conseguir montar a página.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/terapeuta/", "/politica-privacidade", "/termos-uso", "/_next/static/", "/_next/image"],
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
