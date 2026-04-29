<?php
/**
 * Plugin Name: Meu Divã Integration
 * Plugin URI: https://meudivaonline.com
 * Description: Integração entre WordPress e a plataforma Meu Divã (API, autenticação, exibição de terapeutas, revalidação Next.js)
 * Version: 1.0.0
 * Author: Meu Divã
 * Text Domain: meudiva-integration
 */

if (!defined('ABSPATH')) { exit; }

// ============================================
// CONSTANTES
// ============================================
define('MEUDIVA_API_URL', 'https://api.meudivaonline.com');
define('MEUDIVA_API_NON_PROD_URL', 'https://homologacao-api.meudivaonline.com');
define('MEUDIVA_FRONTEND_URL', 'https://app.meudivaonline.com');
define('REVALIDATE_SECRET', 'meudiva_revalidate_xK9mP2qL');
define('MEUDIVA_VERSION', '1.0.0');

// ============================================
// FUNÇÕES DE INTEGRAÇÃO COM A API
// ============================================

function meudiva_get_featured_therapists($limit = 6) {
    $api_url = MEUDIVA_API_URL . '/public/terapeutas?limit=' . $limit;
    $response = wp_remote_get($api_url, ['timeout' => 30, 'headers' => ['Content-Type' => 'application/json']]);
    if (is_wp_error($response)) return [];
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    if (is_array($data)) {
        foreach ($data as $key => $therapist) {
            foreach ($therapist as $field => $value) {
                if (is_string($value)) $data[$key][$field] = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
            }
        }
    }
    return is_array($data) ? $data : [];
}

function meudiva_get_public_stats() {
    $api_url = MEUDIVA_API_URL . '/public/stats/';
    $response = wp_remote_get($api_url, ['timeout' => 30]);
    if (is_wp_error($response)) return ['therapists' => 0, 'sessions' => 0, 'satisfaction' => 98];
    $body = wp_remote_retrieve_body($response);
    return json_decode($body, true);
}

// ============================================
// SHORTCODES
// ============================================

function meudiva_therapists_shortcode($atts) {
    $atts = shortcode_atts(['limit' => 6], $atts);
    $therapists = meudiva_get_featured_therapists($atts['limit']);
    if (empty($therapists)) return '<p style="color:rgba(255,255,255,0.7);text-align:center;padding:32px;">Nenhum terapeuta encontrado.</p>';
    ob_start(); ?>
    <style>
    .meudiva-therapists-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 16px;
    }
    .meudiva-therapist-card {
        width: 200px;
        flex-shrink: 0;
    }
    .meudiva-therapist-card {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 16px;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        transition: transform 0.2s, background 0.2s;
    }
    .meudiva-therapist-card:hover {
        background: rgba(255,255,255,0.14);
        transform: translateY(-4px);
    }
    .meudiva-therapist-avatar {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        border: 3px solid rgba(255,255,255,0.3);
    }
    .meudiva-therapist-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .meudiva-avatar-placeholder {
        width: 100%;
        height: 100%;
        background: #E03673;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: 700;
        color: white;
    }
    .meudiva-therapist-card h3 {
        color: white;
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .meudiva-specialty {
        color: rgba(255,255,255,0.65);
        font-size: 0.8rem;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1.4;
    }
    .meudiva-btn {
        margin-top: 4px;
        padding: 8px 20px;
        background: #E03673;
        color: white;
        text-decoration: none;
        border-radius: 50px;
        font-size: 0.82rem;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: opacity 0.2s;
        display: inline-block;
    }
    .meudiva-btn:hover { opacity: 0.85; color: white; }
    </style>
    <div class="meudiva-therapists-grid">
        <?php foreach ($therapists as $therapist): ?>
            <div class="meudiva-therapist-card">
                <div class="meudiva-therapist-avatar">
                    <?php if (!empty($therapist['foto_url'])): ?>
                        <?php $foto_url = $therapist['foto_url'];
                        if (!preg_match('/^https?:\/\//', $foto_url)) {
                            $foto_url = 'https://storage.googleapis.com/meudiva-prod-fotos/therapists/' . basename($foto_url);
                        } ?>
                        <img src="<?php echo esc_url($foto_url); ?>" alt="<?php echo esc_attr($therapist['full_name']); ?>">
                    <?php else: ?>
                        <div class="meudiva-avatar-placeholder"><?php echo substr($therapist['full_name'], 0, 1); ?></div>
                    <?php endif; ?>
                </div>
                <h3><?php echo esc_html($therapist['full_name']); ?></h3>
                <p class="meudiva-specialty"><?php echo esc_html($therapist['specialties'] ?? 'Terapeuta'); ?></p>
                <a href="<?php echo MEUDIVA_FRONTEND_URL; ?>/terapeuta/<?php echo $therapist['id']; ?>" class="meudiva-btn">Ver perfil</a>
            </div>
        <?php endforeach; ?>
    </div>
    <?php return ob_get_clean();
}
add_shortcode('meudiva_therapists', 'meudiva_therapists_shortcode');

function meudiva_stats_shortcode() {
    $stats = meudiva_get_public_stats();
    ob_start(); ?>
    <div class="meudiva-stats-grid">
        <div class="meudiva-stat">
            <span class="meudiva-stat-number"><?php echo number_format($stats['therapists'] ?? 0); ?>+</span>
            <span class="meudiva-stat-label">Terapeutas</span>
        </div>
        <div class="meudiva-stat">
            <span class="meudiva-stat-number"><?php echo number_format($stats['sessions'] ?? 0); ?>+</span>
            <span class="meudiva-stat-label">Sessões</span>
        </div>
        <div class="meudiva-stat">
            <span class="meudiva-stat-number"><?php echo $stats['satisfaction'] ?? 98; ?>%</span>
            <span class="meudiva-stat-label">Satisfação</span>
        </div>
    </div>
    <?php return ob_get_clean();
}
add_shortcode('meudiva_stats', 'meudiva_stats_shortcode');

// ============================================
// REVALIDAÇÃO DO NEXT.JS VIA ACF
// ============================================

add_action('acf/save_post', function($post_id) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    $post = get_post($post_id);
    if (!$post) return;
    if (!in_array($post->post_status, ['publish', 'future'])) return;
    if (!in_array($post->post_type, ['page', 'post'])) return;
    wp_remote_post(MEUDIVA_FRONTEND_URL . '/api/revalidate', [
        'method'   => 'POST',
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => json_encode(['secret' => REVALIDATE_SECRET, 'slug' => $post->post_name, 'type' => $post->post_type]),
        'timeout'  => 10,
        'blocking' => false,
    ]);
}, 20);

// ============================================
// ASSETS
// ============================================

function meudiva_enqueue_assets() {
    wp_enqueue_style('meudiva-style', plugin_dir_url(__FILE__) . 'assets/css/style.css', [], MEUDIVA_VERSION);
    wp_enqueue_script('meudiva-script', plugin_dir_url(__FILE__) . 'assets/js/script.js', ['jquery'], MEUDIVA_VERSION, true);
}
add_action('wp_enqueue_scripts', 'meudiva_enqueue_assets');

// ============================================
// ATIVAÇÃO DO PLUGIN
// ============================================

function meudiva_activate() {
    $pages = ['terapeutas' => 'Terapeutas', 'planos' => 'Planos', 'como-funciona' => 'Como Funciona'];
    foreach ($pages as $slug => $title) {
        if (!get_page_by_path($slug)) {
            wp_insert_post(['post_title' => $title, 'post_name' => $slug, 'post_content' => '[meudiva_therapists]', 'post_status' => 'publish', 'post_type' => 'page']);
        }
    }
}
register_activation_hook(__FILE__, 'meudiva_activate');

// ============================================
// HEADER E FOOTER INSTITUCIONAIS v4
// ============================================

add_action('wp_head', function() { ?>
<style>
.site-header, #masthead, .wp-block-template-part { display: none !important; }
.site-footer, #colophon { display: none !important; }

#meudiva-header {
    background-color: #ffffff;
    position: sticky;
    top: 0;
    z-index: 9999;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    border-bottom: 1px solid #eef2f9;
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
    width: 144px;
    height: 144px;
    border-radius: 10px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
}
#meudiva-logo-img img { width: 100%; height: 100%; object-fit: contain; }
#meudiva-logo-text {
    font-size: 1.6rem;
    font-weight: 700;
    color: #2F80D3;
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
    color: #2F80D3;
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: 0.01em;
}
#meudiva-nav > a:hover { color: white; background: #E03673; border-radius: 8px; }
#meudiva-header-btns { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.meudiva-btn-entrar {
    padding: 8px 18px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #2F80D3;
    border: 1px solid #2F80D3;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.meudiva-btn-entrar:hover { background: #F4F8FF; color: #2F80D3; }
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
.meudiva-dropdown { position: relative; display: inline-flex; align-items: center; }
.meudiva-dropdown-toggle {
    padding: 8px 18px;
    font-size: 1rem;
    font-weight: 600;
    color: #2F80D3;
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
.meudiva-dropdown:hover .meudiva-dropdown-toggle { color: white; background: #E03673; }
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
.meudiva-dropdown:hover .meudiva-dropdown-menu { display: flex; }
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
.meudiva-dropdown-menu a:hover { background: #fce7ef; color: #E03673; }

/* Footer */
#meudiva-footer { background-color: #2F80D3; width: 100%; margin-top: 64px; }
#meudiva-footer-grid {
    padding: 48px 32px 40px;
    display: grid;
    grid-template-columns: 0.6fr 1.2fr 1fr 1fr 1fr 0.8fr;
    gap: 36px;
    max-width: 1200px;
    margin: 0 auto;
}
#meudiva-footer h3 {
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.7;
}
#meudiva-footer p {
    color: rgba(255,255,255,0.8);
    font-size: 0.875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.7;
    margin: 0;
}
#meudiva-footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
#meudiva-footer li { color: rgba(255,255,255,0.8); font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
#meudiva-footer a { color: rgba(255,255,255,0.8); text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.875rem; transition: color 0.2s; }
#meudiva-footer a:hover { color: white; }

/* Logo coluna 1 */
#meudiva-footer-logo {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    display: block;
}
#meudiva-footer-logo img { width: 100%; height: 100%; object-fit: contain; }

/* Redes sociais */
.meudiva-social-links {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 4px;
}
.meudiva-social-link {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    font-size: 0.875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: all 0.2s;
}
.meudiva-social-link:hover { color: white; }
.meudiva-social-link:hover .meudiva-social-icon { opacity: 1; transform: scale(1.1); }
.meudiva-social-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.85;
    transition: all 0.2s;
}
.meudiva-social-icon svg { width: 18px; height: 18px; fill: white; }

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

@media (max-width: 1024px) { #meudiva-nav { display: none; } }
@media (max-width: 768px) {
    #meudiva-footer-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
    #meudiva-footer-grid { grid-template-columns: 1fr; }
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
                <img src="<?php echo esc_url($home . '/wp-content/uploads/favicon-meudiva.png'); ?>" alt="Meu Div&#227;">
            </div>
            <span id="meudiva-logo-text">Meu Div&#227;</span>
        </a>

        <nav id="meudiva-nav">
            <a href="<?php echo esc_url($home); ?>">In&#237;cio</a>
            <a href="<?php echo esc_url($home . '/para-voce'); ?>">Para voc&#234;</a>
            <a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Para terapeutas</a>
            <a href="<?php echo esc_url($home . '/perguntas-frequentes'); ?>">FAQ</a>
            <div class="meudiva-dropdown">
                <a href="<?php echo esc_url($home . '/para-empresas'); ?>" class="meudiva-dropdown-toggle">
                    Para empresas <span>&#9660;</span>
                </a>
                <div class="meudiva-dropdown-menu">
                    <a href="<?php echo esc_url($home . '/para-empresas'); ?>">Vis&#227;o geral</a>
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
    $logo_url = $home . '/wp-content/uploads/logo.png';
    $year = date('Y');
?>
<footer id="meudiva-footer">
    <div id="meudiva-footer-grid">

        <!-- Coluna 0: Favicon + Instituto -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:0;padding-top:8px;">
            <a href="<?php echo esc_url($home); ?>">
                <img src="<?php echo esc_url($home . '/wp-content/uploads/favicon-meudiva.png'); ?>" alt="Meu Div&#227;" style="width:160px;height:160px;object-fit:contain;">
            </a>
            <!-- Separador -->
            <div style="width:48px;height:1px;background:rgba(255,255,255,0.25);margin:14px 0;"></div>
            <!-- Logo Instituto A Via -->
            <img src="<?php echo esc_url($home . '/wp-content/uploads/logo-instituto-alonso.png'); ?>" alt="Instituto A Via" style="width:72px;height:72px;object-fit:contain;opacity:0.75;">
            <div style="text-align:center;margin-top:8px;opacity:0.6;font-size:0.72rem;line-height:1.6;color:rgba(255,255,255,0.8);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Uma solu&#231;&#227;o do<br>
                <strong style="opacity:1;color:white;font-size:0.78rem;">Instituto A Via</strong>
            </div>
        </div>

        <!-- Coluna 1: Marca -->
        <div>
            <h3>Meu Div&#227;</h3>
            <p>Seu espa&#231;o de cuidado, escuta e sa&#250;de mental.<br><br>Conectamos voc&#234; a terapeutas qualificados de forma simples, segura e acess&#237;vel.</p>
            <p style="margin-top:16px;">
                <a href="mailto:contato@meudivaonline.com">contato@meudivaonline.com</a><br>
                (31) 2181-2810
            </p>
            <p style="margin-top:12px;opacity:0.6;font-size:0.78rem;line-height:1.6;color:rgba(255,255,255,0.8);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                CNPJ: 37.655.845/0001-25
            </p>

        </div>

        <!-- Coluna 2: Para voce -->
        <div>
            <h3>Para voc&#234;</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-voce'); ?>">Como funciona</a></li>
                <li><a href="<?php echo esc_url($home . '/busca'); ?>">Encontrar terapeuta</a></li>
                <li><a href="<?php echo esc_url($home . '/planos'); ?>">Planos e pre&#231;os</a></li>
                <li><a href="https://app.meudivaonline.com/sobre">Sobre n&#243;s</a></li>
                <li><a href="<?php echo esc_url($home . '/perguntas-frequentes'); ?>">Perguntas frequentes</a></li>
                <li><a href="https://app.meudivaonline.com/politica-privacidade">Privacidade</a></li>
                <li><a href="https://app.meudivaonline.com/termos-uso">Termos de uso</a></li>
            </ul>
        </div>

        <!-- Coluna 3: Para terapeutas -->
        <div>
            <h3>Para terapeutas</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-terapeutas'); ?>">Como funciona</a></li>
                <li><a href="<?php echo esc_url($home . '/para-terapeutas#planos'); ?>">Planos</a></li>
                <li><a href="https://app.meudivaonline.com/auth/register">Cadastrar-se</a></li>
                <li><a href="https://app.meudivaonline.com/auth/login">Entrar</a></li>
            </ul>
        </div>

        <!-- Coluna 4: Para empresas -->
        <div>
            <h3>Para empresas</h3>
            <ul>
                <li><a href="<?php echo esc_url($home . '/para-empresas'); ?>">Vis&#227;o geral</a></li>
                <li><a href="<?php echo esc_url($home . '/cases'); ?>">Cases de sucesso</a></li>
                <li><a href="<?php echo esc_url($home . '/nr1-guia'); ?>">Guia NR-1</a></li>
                <li><a href="<?php echo esc_url($home . '/para-empresas#falar-especialista'); ?>">Falar com especialista</a></li>
            </ul>
        </div>

        <!-- Coluna 5: Redes sociais -->
        <div>
            <h3>Siga-nos</h3>
            <div class="meudiva-social-links">

                <a href="https://instagram.com/meudiva.online" target="_blank" rel="noopener" class="meudiva-social-link">
                    <span class="meudiva-social-icon" style="background:#E1306C;">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                    </span>
                    Instagram
                </a>

                <a href="https://youtube.com/@meudivaonline" target="_blank" rel="noopener" class="meudiva-social-link">
                    <span class="meudiva-social-icon" style="background:#FF0000;">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
                        </svg>
                    </span>
                    YouTube
                </a>

                <a href="https://wa.me/553121812810" target="_blank" rel="noopener" class="meudiva-social-link">
                    <span class="meudiva-social-icon" style="background:#25D366;">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                        </svg>
                    </span>
                    WhatsApp
                </a>

                <a href="https://linkedin.com/company/meudiva" target="_blank" rel="noopener" class="meudiva-social-link">
                    <span class="meudiva-social-icon" style="background:#0A66C2;">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                    </span>
                    LinkedIn
                </a>

            </div>
        </div>

    </div>
    <div id="meudiva-footer-bottom">
        <span>&copy; <?php echo $year; ?> Meu Div&#227;. Todos os direitos reservados.</span>
    </div>
</footer>
<?php }, 100);