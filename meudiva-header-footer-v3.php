
// ============================================
// HEADER E FOOTER INSTITUCIONAIS v3
// ============================================

add_action('wp_head', function() { ?>
<style>
.site-header, #masthead, .wp-block-template-part { display: none !important; }
.site-footer, #colophon { display: none !important; }

#meudiva-header {
    background-color: #2F80D3;
    position: sticky;
    top: 0;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    width: 100%;
}
#meudiva-header-inner {
    width: 100%;
    padding: 0 32px;
    height: 128px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
#meudiva-logo {
    display: flex;
    align-items: center;
    gap: 14px;
    text-decoration: none;
    flex-shrink: 0;
}
#meudiva-logo-img {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
}
#meudiva-logo-img img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
#meudiva-logo-text {
    font-size: 1.6rem;
    font-weight: 700;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#meudiva-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    margin-right: 24px;
}
#meudiva-nav > a {
    padding: 8px 18px;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: 0.01em;
}
#meudiva-nav > a:hover {
    color: white;
    background: rgba(255,255,255,0.1);
}
#meudiva-header-btns {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}
.meudiva-btn-entrar {
    padding: 8px 18px;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    border: 1px solid rgba(255,255,255,0.45);
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.meudiva-btn-entrar:hover { background: rgba(255,255,255,0.1); color: white; }
.meudiva-btn-cta {
    padding: 8px 18px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    background: #E03673;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.meudiva-btn-cta:hover { opacity: 0.9; color: white; }

/* Dropdown */
.meudiva-dropdown {
    position: relative;
    display: inline-flex;
    align-items: center;
}
.meudiva-dropdown-toggle {
    padding: 8px 18px;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    text-decoration: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.01em;
}
.meudiva-dropdown:hover .meudiva-dropdown-toggle {
    color: white;
    background: rgba(255,255,255,0.1);
}
.meudiva-dropdown-menu {
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    padding: 8px;
    min-width: 180px;
    z-index: 99999;
    flex-direction: column;
    gap: 2px;
}
.meudiva-dropdown:hover .meudiva-dropdown-menu {
    display: flex;
}
.meudiva-dropdown-menu a {
    padding: 10px 14px;
    font-size: 0.9rem;
    color: #1a1a2e;
    border-radius: 8px;
    text-decoration: none;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: all 0.2s;
}
.meudiva-dropdown-menu a:hover {
    background: #fce7ef;
    color: #E03673;
}

/* Footer */
#meudiva-footer {
    background-color: #2F80D3;
    width: 100%;
    margin-top: 64px;
}
#meudiva-footer-grid {
    padding: 48px 32px 40px;
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr 1fr;
    gap: 40px;
    max-width: 1200px;
    margin: 0 auto;
}
#meudiva-footer h3 {
    color: white;
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
}
#meudiva-footer p {
    color: rgba(255,255,255,0.8);
    font-size: 0.875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.7;
    margin: 0;
}
#meudiva-footer ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
#meudiva-footer li {
    color: rgba(255,255,255,0.8);
    font-size: 0.875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#meudiva-footer a {
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.875rem;
    transition: color 0.2s;
}
#meudiva-footer a:hover { color: white; }
#meudiva-footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.2);
    padding: 20px 32px;
    text-align: center;
    max-width: 1200px;
    margin: 0 auto;
}
#meudiva-footer-bottom span {
    color: rgba(255,255,255,0.55);
    font-size: 0.82rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
</style>
<?php }, 100);

add_action('wp_body_open', function() {
    $home = home_url();
    $logo_url = $home . '/wp-content/uploads/logo.png';
?>
<header id="meudiva-header">
    <div id="meudiva-header-inner">

        <a href="<?php echo esc_url($home); ?>" id="meudiva-logo">
            <div id="meudiva-logo-img">
                <img src="<?php echo esc_url($logo_url); ?>" alt="Meu Diva">
            </div>
            <span id="meudiva-logo-text">Meu Diva</span>
        </a>

        <nav id="meudiva-nav">
            <a href="<?php echo esc_url($home); ?>">Inicio</a>
            <a href="<?php echo esc_url($home . '/para-voce'); ?>">Para voce</a>
            <a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Para terapeutas</a>
            <div class="meudiva-dropdown">
                <a href="<?php echo esc_url($home . '/para-empresas'); ?>" class="meudiva-dropdown-toggle">
                    Para empresas <span>&#9660;</span>
                </a>
                <div class="meudiva-dropdown-menu">
                    <a href="<?php echo esc_url($home . '/para-empresas'); ?>">Visao geral</a>
                    <a href="<?php echo esc_url($home . '/cases'); ?>">Cases</a>
                    <a href="<?php echo esc_url($home . '/nr1-guia'); ?>">NR-1 Guia</a>
                </div>
            </div>
        </nav>

        <div id="meudiva-header-btns">
            <a href="https://app.meudivaonline.com/auth/login" class="meudiva-btn-entrar">Entrar</a>
            <a href="https://app.meudivaonline.com/busca" class="meudiva-btn-cta">Encontrar terapeuta</a>
        </div>

    </div>
</header>
<?php }, 1);

add_action('wp_footer', function() {
    $home = home_url();
    $year = date('Y');
?>
<footer id="meudiva-footer">
    <div id="meudiva-footer-grid">

        <!-- Coluna 1: Marca -->
        <div>
            <h3>Meu Diva</h3>
            <p>Seu espaco de cuidado, escuta e saude mental.<br><br>Conectamos voce a terapeutas qualificados de forma simples, segura e acessivel.</p>
            <p style="margin-top:16px;">
                <a href="mailto:contato@meudivaonline.com">contato@meudivaonline.com</a><br>
                (31) 4042-5012
            </p>
        </div>

        <!-- Coluna 2: Para voce -->
        <div>
            <h3>Para voce</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-voce'); ?>">Como funciona</a></li>
                <li><a href="<?php echo esc_url($home . '/busca'); ?>">Encontrar terapeuta</a></li>
                <li><a href="<?php echo esc_url($home . '/planos'); ?>">Planos e precos</a></li>
                <li><a href="<?php echo esc_url($home . '/sobre'); ?>">Sobre nos</a></li>
                <li><a href="<?php echo esc_url($home . '/politica-privacidade'); ?>">Privacidade</a></li>
                <li><a href="<?php echo esc_url($home . '/termos-uso'); ?>">Termos de uso</a></li>
            </ul>
        </div>

        <!-- Coluna 3: Para terapeutas -->
        <div>
            <h3>Para terapeutas</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Como funciona</a></li>
                <li><a href="<?php echo esc_url($home . '/para-terapeutas#planos'); ?>">Planos</a></li>
                <li><a href="<?php echo esc_url($home . '/auth/register'); ?>">Cadastrar-se</a></li>
                <li><a href="<?php echo esc_url($home . '/auth/login'); ?>">Entrar</a></li>
            </ul>
        </div>

        <!-- Coluna 4: Para empresas -->
        <div>
            <h3>Para empresas</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-empresas'); ?>">Visao geral</a></li>
                <li><a href="<?php echo esc_url($home . '/cases'); ?>">Cases de sucesso</a></li>
                <li><a href="<?php echo esc_url($home . '/nr1-guia'); ?>">Guia NR-1</a></li>
                <li><a href="<?php echo esc_url($home . '/para-empresas#falar-especialista'); ?>">Falar com especialista</a></li>
            </ul>
        </div>

    </div>
    <div id="meudiva-footer-bottom">
        <span>&copy; <?php echo $year; ?> Meu Diva. Todos os direitos reservados.</span>
    </div>
</footer>
<?php }, 100);
