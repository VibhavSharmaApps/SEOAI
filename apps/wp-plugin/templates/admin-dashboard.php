<?php
/**
 * Workforce SEO — Admin Dashboard template (placeholder).
 * The real management UI lives in the Workforce SEO web dashboard; this page
 * is just an entry point inside WP admin.
 */

if (!defined('ABSPATH')) {
    exit;
}

$dashboard_url = get_option('workforce_api_url', '');
$api_key       = get_option('workforce_api_key', '');
?>
<div class="wrap">
    <h1><?php esc_html_e('Workforce SEO', 'workforce-seo'); ?></h1>
    <p>
        <?php esc_html_e('Manage your SEO automation from the Workforce SEO dashboard.', 'workforce-seo'); ?>
    </p>
    <?php if (empty($api_key)) : ?>
        <div class="notice notice-warning inline">
            <p>
                <?php
                printf(
                    /* translators: %s: settings page URL */
                    esc_html__('No API key configured yet. %sOpen settings%s to paste the key from your dashboard.', 'workforce-seo'),
                    '<a href="' . esc_url(admin_url('admin.php?page=workforce-seo-settings')) . '">',
                    '</a>'
                );
                ?>
            </p>
        </div>
    <?php else : ?>
        <p>
            <?php esc_html_e('This site is configured. Visit the Workforce SEO dashboard to manage your SEO and content.', 'workforce-seo'); ?>
        </p>
        <?php if (!empty($dashboard_url)) : ?>
            <p>
                <a href="<?php echo esc_url($dashboard_url); ?>" target="_blank" rel="noopener" class="button button-primary">
                    <?php esc_html_e('Open dashboard', 'workforce-seo'); ?>
                </a>
            </p>
        <?php endif; ?>
    <?php endif; ?>
</div>
