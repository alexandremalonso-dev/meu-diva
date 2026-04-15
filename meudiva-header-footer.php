// ============================================
// HEADER E FOOTER INSTITUCIONAIS
// Injeta via hooks — funciona em qualquer tema
// ============================================

// Remove o header padrão do tema e injeta o nosso
add_action('wp_head', function() {
    ?>
    <style>
        /* Reset header do tema */
        .site-header,
        #masthead,
        .wp-block-template-part[class*="header"],
        header.wp-block-template-part {
            display: none !important;
        }

        /* Nosso header */
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
            height: 80px;
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
            width: 48px;
            height: 48px;
            border-radius: 8px;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        #meudiva-logo-img img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scale(1.5);
        }
        #meudiva-logo-text {
            font-size: 1.5rem;
            font-weight: 700;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #meudiva-nav {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        #meudiva-nav a {
            padding: 8px 16px;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgba(255,255,255,0.8);
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #meudiva-nav a:hover {
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
            color: white !important;
            border: 1px solid rgba(255,255,255,0.45);
            border-radius: 8px;
            text-decoration: none !important;
            transition: all 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .meudiva-btn-entrar:hover {
            background: rgba(255,255,255,0.1);
        }
        .meudiva-btn-cta {
            padding: 8px 18px;
            font-size: 0.875rem;
            font-weight: 600;
            color: white !important;
            background: #E03673;
            border-radius: 8px;
            text-decoration: none !important;
            transition: all 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .meudiva-btn-cta:hover { opacity: 0.9; }

        /* Nosso footer */
        #meudiva-footer {
            background-color: #2F80D3;
            width: 100%;
            margin-top: 64px;
        }
        #meudiva-footer .footer-grid {
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
            color: rgba(255,255,255,0.8) !important;
            text-decoration: none !important;
        }
        #meudiva-footer a:hover { color: white !important; }
        #meudiva-footer .footer-bottom {
            border-top: 1px solid rgba(255,255,255,0.25);
            padding: 20px 32px;
            text-align: center;
        }

        /* Esconde footer padrão do tema */
        .site-footer,
        #colophon,
        .wp-block-template-part[class*="footer"] {
            display: none !important;
        }

        @media (max-width: 1024px) {
            #meudiva-nav { display: none; }
        }
        @media (max-width: 768px) {
            #meudiva-footer .footer-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
    <?php
}, 100);

// Injeta header após <body>
add_action('wp_body_open', function() {
    $home = home_url();
    $logo_url = $home . '/wp-content/uploads/logo.png';
    ?>
    <header id="meudiva-header">
        <div id="meudiva-header-inner">

            <a href="<?php echo esc_url($home); ?>" id="meudiva-logo">
                <div id="meudiva-logo-img">
                    <img src="<?php echo esc_url($logo_url); ?>" alt="Meu Divã">
                </div>
                <span id="meudiva-logo-text">Meu Divã</span>
            </a>

            <nav id="meudiva-nav">
                <a href="<?php echo esc_url($home . '/para-voce'); ?>">Para você</a>
                <a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Para terapeutas</a>
                <a href="<?php echo esc_url($home . '/para-empresas'); ?>">Para empresas</a>
                <a href="<?php echo esc_url($home . '/cases'); ?>">Cases</a>
                <a href="<?php echo esc_url($home . '/nr1-guia'); ?>">NR-1 Guia</a>
            </nav>

            <div id="meudiva-header-btns">
                <a href="https://app.meudivaonline.com/auth/login" class="meudiva-btn-entrar">Entrar</a>
                <a href="https://app.meudivaonline.com/busca" class="meudiva-btn-cta">Encontrar terapeuta</a>
            </div>

        </div>
    </header>
    <?php
}, 1);

// Injeta footer antes de </body>
add_action('wp_footer', function() {
    $home = home_url();
    $year = date('Y');
    ?>
    <footer id="meudiva-footer">
        <div class="footer-grid">
            <div>
                <h3>Meu Divã</h3>
                <p>Seu espaço de cuidado, escuta e saúde mental.</p>
            </div>
            <div>
                <h3>Links Rápidos</h3>
                <ul>
                    <li><a href="<?php echo esc_url($home . '/sobre'); ?>">Sobre nós</a></li>
                    <li><a href="<?php echo esc_url($home . '/termos-uso'); ?>">Termos de uso</a></li>
                    <li><a href="<?php echo esc_url($home . '/politica-privacidade'); ?>">Política de privacidade</a></li>
                </ul>
            </div>
            <div>
                <h3>Contato</h3>
                <ul>
                    <li>contato@meudivaonline.com</li>
                    <li>(31) 4042-5012</li>
                    <li>seg-sex, 9h às 18h</li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <span>© <?php echo $year; ?> Meu Divã. Todos os direitos reservados.</span>
        </div>
    </footer>
    <?php
}, 100);
