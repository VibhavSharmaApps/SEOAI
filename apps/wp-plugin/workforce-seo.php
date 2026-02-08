<?php
/**
 * Plugin Name: Workforce SEO
 * Plugin URI:  https://workforce-seo.com
 * Description: AI-powered SEO automation platform — autonomous content generation, meta optimization, schema injection, and internal linking via the Workforce dashboard.
 * Version:     0.1.0
 * Author:      Workforce SEO
 * Author URI:  https://workforce-seo.com
 * License:     GPL-2.0-or-later
 * Text Domain: workforce-seo
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// Plugin constants
define( 'WORKFORCE_VERSION', '0.1.0' );
define( 'WORKFORCE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WORKFORCE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WORKFORCE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Load core classes
require_once WORKFORCE_PLUGIN_DIR . 'includes/class-api-client.php';
require_once WORKFORCE_PLUGIN_DIR . 'includes/class-seo-analyzer.php';
require_once WORKFORCE_PLUGIN_DIR . 'includes/class-admin-page.php';
require_once WORKFORCE_PLUGIN_DIR . 'includes/class-rest-api.php';

/**
 * Main plugin class.
 */
final class Workforce_SEO
{
    /** @var Workforce_SEO|null Singleton instance */
    private static ?Workforce_SEO $instance = null;

    /** @var Workforce_API_Client API client for the Workforce dashboard */
    public Workforce_API_Client $api;

    /** @var Workforce_SEO_Analyzer SEO analysis utilities */
    public Workforce_SEO_Analyzer $seo;

    /**
     * Get the singleton instance.
     */
    public static function instance(): Workforce_SEO
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor — wire up hooks.
     */
    private function __construct()
    {
        $this->api = new Workforce_API_Client();
        $this->seo = new Workforce_SEO_Analyzer();

        // Admin menu and settings
        add_action('admin_menu', [Workforce_Admin_Page::class, 'register_menu']);
        add_action('admin_init', [Workforce_Admin_Page::class, 'register_settings']);

        // Register REST API endpoints (Dashboard -> WordPress communication)
        add_action('rest_api_init', [Workforce_REST_API::class, 'register_routes']);

        // Enqueue admin assets
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );

        // Activation / deactivation hooks
        register_activation_hook( __FILE__, [ $this, 'activate' ] );
        register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );
    }

    /**
     * Enqueue admin CSS and JS.
     */
    public function enqueue_admin_assets(string $hook): void
    {
        // Only load on our plugin pages
        if (strpos($hook, 'workforce') === false) {
            return;
        }

        wp_enqueue_style(
            'workforce-admin',
            WORKFORCE_PLUGIN_URL . 'assets/css/admin.css',
            [],
            WORKFORCE_VERSION
        );

        wp_enqueue_script(
            'workforce-admin',
            WORKFORCE_PLUGIN_URL . 'assets/js/admin.js',
            ['jquery'],
            WORKFORCE_VERSION,
            true
        );

        wp_localize_script('workforce-admin', 'workforce', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('workforce_nonce'),
            'rest_url' => rest_url('workforce/v1/'),
        ]);
    }

    /**
     * Plugin activation.
     */
    public function activate(): void
    {
        // Set default options
        add_option('workforce_api_url', '');
        add_option('workforce_api_key', '');
        add_option('workforce_site_id', '');
        flush_rewrite_rules();
    }

    /**
     * Plugin deactivation.
     */
    public function deactivate(): void
    {
        flush_rewrite_rules();
    }
}

/**
 * Returns the main plugin instance.
 */
function workforce_seo(): Workforce_SEO
{
    return Workforce_SEO::instance();
}

// Boot the plugin
workforce_seo();
