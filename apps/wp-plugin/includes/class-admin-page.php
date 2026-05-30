<?php
/**
 * Admin Page — WordPress admin interface for Workforce SEO.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Workforce_Admin_Page
{
    public static function register_menu(): void
    {
        add_menu_page(
            __('Workforce SEO', 'workforce-seo'),
            __('Workforce SEO', 'workforce-seo'),
            'manage_options',
            'workforce-seo',
            [self::class, 'render_page'],
            'dashicons-chart-line',
            30
        );

        add_submenu_page(
            'workforce-seo',
            __('Settings', 'workforce-seo'),
            __('Settings', 'workforce-seo'),
            'manage_options',
            'workforce-seo-settings',
            [self::class, 'render_settings_page']
        );
    }

    public static function register_settings(): void
    {
        register_setting('workforce_settings', 'workforce_api_url', [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => '',
        ]);

        register_setting('workforce_settings', 'workforce_api_key', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        ]);

        register_setting('workforce_settings', 'workforce_site_id', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        ]);

        register_setting('workforce_settings', 'workforce_webhook_secret', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        ]);
    }

    public static function render_page(): void
    {
        $template = WORKFORCE_PLUGIN_DIR . 'templates/admin-dashboard.php';
        if (file_exists($template)) {
            include $template;
        }
    }

    public static function render_settings_page(): void
    {
        $template = WORKFORCE_PLUGIN_DIR . 'templates/admin-settings.php';
        if (file_exists($template)) {
            include $template;
        }
    }
}
