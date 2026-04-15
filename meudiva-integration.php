<?php
/**
 * Plugin Name: Meu Divã Integration
 * Plugin URI: https://meudivaonline.com
 * Description: Integração entre WordPress e a plataforma Meu Divã (API, autenticação, exibição de terapeutas, revalidação Next.js)
 * Version: 1.0.0
 * Author: Meu Divã
 * Text Domain: meudiva-integration
 */

// Prevenir acesso direto
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// CONSTANTES
// ============================================
define('MEUDIVA_API_URL', 'https://meudiva-api-prod-592671373665.southamerica-east1.run.app');
define('MEUDIVA_API_NON_PROD_URL', 'https://meudiva-api-prod-592671373665.southamerica-east1.run.app');
define('MEUDIVA_FRONTEND_URL', 'https://meudiva-frontend-prod-592671373665.sa-east1.run.app');
define('REVALIDATE_SECRET', 'meudiva_revalidate_xK9mP2qL');
define('MEUDIVA_VERSION', '1.0.0');

// ============================================
// FUNÇÕES DE INTEGRAÇÃO COM A API
// ============================================

/**
 * Busca terapeutas em destaque da API
 */
function meudiva_get_featured_therapists($limit = 6) {
    $api_url = MEUDIVA_API_URL . '/public/terapeutas?limit=' . $limit;
    
    $response = wp_remote_get($api_url, [
        'timeout' => 30,
        'headers' => [
            'Content-Type' => 'application/json'
        ]
    ]);
    
    if (is_wp_error($response)) {
        return [];
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    // Decodificar caracteres especiais em cada terapeuta
    if (is_array($data)) {
        foreach ($data as $key => $therapist) {
            foreach ($therapist as $field => $value) {
                if (is_string($value)) {
                    $data[$key][$field] = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
                }
            }
        }
    }
    
    return is_array($data) ? $data : [];
}

/**
 * Busca estatísticas públicas da plataforma
 */
function meudiva_get_public_stats() {
    $api_url = MEUDIVA_API_URL . '/public/stats/';
    
    $response = wp_remote_get($api_url, [
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        return [
            'therapists' => 0,
            'sessions' => 0,
            'satisfaction' => 98
        ];
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    return $data;
}

// ============================================
// SHORTCODES
// ============================================

/**
 * Shortcode para exibir terapeutas em destaque
 * Uso: [meudiva_therapists limit="6"]
 */
function meudiva_therapists_shortcode($atts) {
    $atts = shortcode_atts([
        'limit' => 6
    ], $atts);
    
    $therapists = meudiva_get_featured_therapists($atts['limit']);
    
    if (empty($therapists)) {
        return '<p>Nenhum terapeuta encontrado.</p>';
    }
    
    ob_start();
    ?>
    <div class="meudiva-therapists-grid">
        <?php foreach ($therapists as $therapist): ?>
            <div class="meudiva-therapist-card">
                <div class="meudiva-therapist-avatar">
                    <?php if (!empty($therapist['foto_url'])): ?>
                        <?php 
                        $foto_url = $therapist['foto_url'];
                        if (!preg_match('/^https?:\/\//', $foto_url)) {
                            $foto_url = 'https://storage.googleapis.com/meudiva-prod-fotos/therapists/' . basename($foto_url);
                        }
                        ?>
                        <img src="<?php echo esc_url($foto_url); ?>" alt="<?php echo esc_attr($therapist['full_name']); ?>">
                    <?php else: ?>
                        <div class="meudiva-avatar-placeholder">
                            <?php echo substr($therapist['full_name'], 0, 1); ?>
                        </div>
                    <?php endif; ?>
                </div>
                <h3><?php echo esc_html($therapist['full_name']); ?></h3>
                <p class="meudiva-specialty"><?php echo esc_html($therapist['specialties'] ?? 'Terapeuta'); ?></p>
                <a href="<?php echo MEUDIVA_FRONTEND_URL; ?>/terapeuta/<?php echo $therapist['id']; ?>" class="meudiva-btn">Ver Perfil</a>
            </div>
        <?php endforeach; ?>
    </div>
    <?php
    
    return ob_get_clean();
}
add_shortcode('meudiva_therapists', 'meudiva_therapists_shortcode');

/**
 * Shortcode para exibir estatísticas
 * Uso: [meudiva_stats]
 */
function meudiva_stats_shortcode() {
    $stats = meudiva_get_public_stats();
    
    ob_start();
    ?>
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
    <?php
    
    return ob_get_clean();
}
add_shortcode('meudiva_stats', 'meudiva_stats_shortcode');

// ============================================
// REVALIDAÇÃO DO NEXT.JS VIA ACF
// ============================================

/**
 * Meu Divã — Revalidação do Next.js via ACF
 * Dispara webhook após salvar campos ACF em páginas
 */
add_action('acf/save_post', function($post_id) {

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;

    $post = get_post($post_id);

    if (!$post) return;
    if (!in_array($post->post_status, ['publish', 'future'])) return;
    if (!in_array($post->post_type, ['page', 'post'])) return;

    $slug   = $post->post_name;
    $type   = $post->post_type;

    // URL do frontend no Cloud Run
    $endpoint = MEUDIVA_FRONTEND_URL . '/api/revalidate';

    wp_remote_post($endpoint, [
        'method'   => 'POST',
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => json_encode([
            'secret' => REVALIDATE_SECRET,
            'slug'   => $slug,
            'type'   => $type,
        ]),
        'timeout'  => 10,
        'blocking' => false,
    ]);

}, 20);

// ============================================
// ASSETS (CSS/JS)
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
    // Criar páginas necessárias se não existirem
    $pages = [
        'terapeutas' => 'Terapeutas',
        'planos' => 'Planos',
        'como-funciona' => 'Como Funciona'
    ];
    
    foreach ($pages as $slug => $title) {
        $page = get_page_by_path($slug);
        if (!$page) {
            wp_insert_post([
                'post_title' => $title,
                'post_name' => $slug,
                'post_content' => '[meudiva_therapists]',
                'post_status' => 'publish',
                'post_type' => 'page'
            ]);
        }
    }
}
register_activation_hook(__FILE__, 'meudiva_activate');