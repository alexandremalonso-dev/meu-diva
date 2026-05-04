import Link from "next/link";
import Image from "next/image";

const REDES = [
  { nome: "Instagram", href: "https://instagram.com/meudiva.online", cor: "#E1306C", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { nome: "YouTube", href: "https://youtube.com/@meudivaonline", cor: "#FF0000", path: "M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" },
  { nome: "WhatsApp", href: "https://wa.me/553121812810", cor: "#25D366", path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" },
  { nome: "LinkedIn", href: "https://linkedin.com/company/meudiva", cor: "#0A66C2", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
];

export function InstitucionalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#2F80D3", width: "100%", marginTop: "64px" }}>

      {/* Grid principal — 6 colunas */}
      <div style={{ padding: "48px 32px 40px", display: "grid", gridTemplateColumns: "0.6fr 1.2fr 1fr 1fr 1fr 0.8fr", gap: "36px", maxWidth: "1200px", margin: "0 auto" }}>

        {/* Coluna 0: Favicon + Instituto A Via */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingTop: "8px" }}>
          <Link href="/">
            <Image src="/favicon-meudiva.png" alt="Meu Divã" width={160} height={160} style={{ objectFit: "contain" }} />
          </Link>
          <div style={{ width: "48px", height: "1px", background: "rgba(255,255,255,0.25)", margin: "14px 0" }} />
          <Image src="/logo-instituto-alonso.png" alt="Instituto A Via" width={72} height={72} style={{ objectFit: "contain", opacity: 0.75 }} />
          <div style={{ textAlign: "center", marginTop: "8px", opacity: 0.6, fontSize: "0.72rem", lineHeight: 1.6, color: "rgba(255,255,255,0.8)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
            Uma solução do<br />
            <strong style={{ opacity: 1, color: "white", fontSize: "0.78rem" }}>Instituto A Via</strong>
          </div>
        </div>

        {/* Coluna 1: Marca */}
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>Meu Divã</h3>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.875rem", lineHeight: 1.7, margin: 0 }}>
            Seu espaço de cuidado, escuta e saúde mental.
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.875rem", lineHeight: 1.7, margin: "12px 0 0" }}>
            Conectamos você a terapeutas qualificados de forma simples, segura e acessível.
          </p>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            <a href="mailto:contato@meudivaonline.com" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", display: "block" }}>contato@meudivaonline.com</a>
            <span style={{ color: "rgba(255,255,255,0.8)" }}>(31) 2181-2810</span>
          </p>
          <p style={{ marginTop: "12px", opacity: 0.6, fontSize: "0.78rem", lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
            CNPJ: 37.655.845/0001-25
          </p>
        </div>

        {/* Coluna 2: Para você */}
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>Para você</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            <li><Link href="/para-voce" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Como funciona</Link></li>
            <li><Link href="/busca" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Encontrar terapeuta</Link></li>
            <li><Link href="/planos" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Planos e preços</Link></li>
            <li><Link href="https://app.meudivaonline.com/sobre" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Sobre nós</Link></li>
            <li><Link href="/politica-privacidade" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Privacidade</Link></li>
            <li><Link href="/termos-uso" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Termos de uso</Link></li>
          </ul>
        </div>

        {/* Coluna 3: Para terapeutas */}
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>Para terapeutas</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            <li><Link href="/para-terapeutas" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Como funciona</Link></li>
            <li><Link href="/para-terapeutas#planos" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Planos</Link></li>
            <li><Link href="/auth/register" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Cadastrar-se</Link></li>
            <li><Link href="/auth/login" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Entrar</Link></li>
          </ul>
        </div>

        {/* Coluna 4: Para empresas */}
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>Para empresas</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            <li><Link href="/para-empresas" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Visão geral</Link></li>
            <li><Link href="/cases" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Cases de sucesso</Link></li>
            <li><Link href="/nr1-guia" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Guia NR-1</Link></li>
            <li><Link href="/para-empresas#falar-especialista" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>Falar com especialista</Link></li>
          </ul>
        </div>

        {/* Coluna 5: Redes sociais */}
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>Siga-nos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {REDES.map(rede => (
              <a key={rede.nome} href={rede.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}>
                <span style={{ width: "36px", height: "36px", borderRadius: "10px", background: rede.cor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d={rede.path} /></svg>
                </span>
                {rede.nome}
              </a>
            ))}
          </div>
        </div>

      </div>

      {/* Linha de apps — entre grid e copyright */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", padding: "20px 32px", maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "32px", flexWrap: "wrap" }}>
        <p style={{ color: "white", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>Baixe o app</p>

        {/* Apple App Store */}
        <a href="https://apps.apple.com/app/meu-diva" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <div style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            <div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", lineHeight: 1 }}>Disponível na</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "white", lineHeight: 1.3 }}>App Store</div>
            </div>
          </div>
          <Image src="/qr-apple.png" alt="QR Code App Store" width={72} height={72} style={{ borderRadius: "8px", background: "white", padding: "3px" }} />
        </a>

        {/* Google Play */}
        <a href="https://play.google.com/store/apps/details?id=com.meudiva" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <div style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3.18 23.76c.3.17.63.24.97.21l12.93-7.47-2.79-2.79-11.11 10.05zM.5 1.9C.19 2.28 0 2.82 0 3.5v17c0 .68.19 1.22.5 1.6l.08.08 9.53-9.53v-.22L.58 1.82.5 1.9zM20.32 10.19L17.08 8.3 14 11.38l3.08 3.08 3.24-1.88c.93-.54.93-1.42 0-1.96zM4.15.24L17.08 7.7l-3.08 3.08L3.18.24c.3-.17.64-.25.97-.22.33.03.64.14.89.29z"/></svg>
            <div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", lineHeight: 1 }}>Disponível no</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "white", lineHeight: 1.3 }}>Google Play</div>
            </div>
          </div>
          <Image src="/qr-google.png" alt="QR Code Google Play" width={72} height={72} style={{ borderRadius: "8px", background: "white", padding: "3px" }} />
        </a>
      </div>

      {/* Copyright */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", padding: "20px 32px", textAlign: "center", maxWidth: "1200px", margin: "0 auto" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.82rem" }}>
          © {year} Meu Divã. Todos os direitos reservados.
        </span>
      </div>

    </footer>
  );
}