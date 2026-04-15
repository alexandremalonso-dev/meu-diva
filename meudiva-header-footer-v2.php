
// ============================================
// HEADER E FOOTER INSTITUCIONAIS v2
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
}
#meudiva-nav > a {
    padding: 8px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#meudiva-nav > a:hover {
    color: white;
    background: rgba(255,255,255,0.1);
}
#meudiva-header-btns {
    display: flex;
    align-items: center;
    gap: 12px;
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
    padding: 8px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    align-items: center;
    gap: 4px;
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
    font-size: 0.875rem;
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
    padding: 40px 32px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    max-width: 1200px;
    margin: 0 auto;
}
#meudiva-footer h3 {
    color: white;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#meudiva-footer p,
#meudiva-footer li,
#meudiva-footer span {
    color: rgba(255,255,255,0.8);
    font-size: 0.875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
}
#meudiva-footer ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
#meudiva-footer a {
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.875rem;
}
#meudiva-footer a:hover { color: white; }
#meudiva-footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.25);
    padding: 20px 32px;
    text-align: center;
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
        <div>
            <h3>Meu Diva</h3>
            <p>Seu espaco de cuidado, escuta e saude mental.</p>
        </div>
        <div>
            <h3>Links Rapidos</h3>
            <ul>
                <li><a href="<?php echo esc_url($home); ?>">Inicio</a></li>
                <li><a href="<?php echo esc_url($home . '/para-voce'); ?>">Para voce</a></li>
                <li><a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Para terapeutas</a></li>
                <li><a href="<?php echo esc_url($home . '/para-empresas'); ?>">Para empresas</a></li>
                <li><a href="<?php echo esc_url($home . '/cases'); ?>">Cases</a></li>
                <li><a href="<?php echo esc_url($home . '/nr1-guia'); ?>">NR-1 Guia</a></li>
                <li><a href="<?php echo esc_url($home . '/sobre'); ?>">Sobre nos</a></li>
            </ul>
        </div>
        <div>
            <h3>Contato</h3>
            <ul>
                <li>contato@meudivaonline.com</li>
                <li>(31) 4042-5012</li>
                <li>seg-sex, 9h as 18h</li>
            </ul>
        </div>
    </div>
    <div id="meudiva-footer-bottom">
        <span>&copy; <?php echo $year; ?> Meu Diva. Todos os direitos reservados.</span>
    </div>
</footer>
<?php }, 100);
