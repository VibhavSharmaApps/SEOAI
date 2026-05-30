<?php
/**
 * Workforce SEO — Admin Settings template.
 * Rendered by Workforce_Admin_Page::render_settings_page().
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap">
    <h1><?php esc_html_e('Workforce SEO Settings', 'workforce-seo'); ?></h1>
    <p>
        <?php esc_html_e('Paste the credentials shown in your Workforce SEO dashboard to connect this site.', 'workforce-seo'); ?>
    </p>
    <form action="options.php" method="post">
        <?php settings_fields('workforce_settings'); ?>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="workforce_api_url"><?php esc_html_e('Dashboard URL', 'workforce-seo'); ?></label>
                </th>
                <td>
                    <input
                        type="url"
                        id="workforce_api_url"
                        name="workforce_api_url"
                        value="<?php echo esc_attr(get_option('workforce_api_url', '')); ?>"
                        class="regular-text"
                        placeholder="https://app.workforceseo.com"
                    />
                    <p class="description">
                        <?php esc_html_e('Optional. Where this site can call back to the Workforce SEO dashboard.', 'workforce-seo'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="workforce_api_key"><?php esc_html_e('API Key', 'workforce-seo'); ?></label>
                </th>
                <td>
                    <input
                        type="text"
                        id="workforce_api_key"
                        name="workforce_api_key"
                        value="<?php echo esc_attr(get_option('workforce_api_key', '')); ?>"
                        class="regular-text code"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <p class="description">
                        <?php esc_html_e('Paste the API key from your Workforce SEO dashboard. Required.', 'workforce-seo'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="workforce_site_id"><?php esc_html_e('Site ID', 'workforce-seo'); ?></label>
                </th>
                <td>
                    <input
                        type="text"
                        id="workforce_site_id"
                        name="workforce_site_id"
                        value="<?php echo esc_attr(get_option('workforce_site_id', '')); ?>"
                        class="regular-text code"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <p class="description">
                        <?php esc_html_e('Shown in the dashboard after you connect this site. Required for real-time sync.', 'workforce-seo'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="workforce_webhook_secret"><?php esc_html_e('Webhook Secret', 'workforce-seo'); ?></label>
                </th>
                <td>
                    <input
                        type="text"
                        id="workforce_webhook_secret"
                        name="workforce_webhook_secret"
                        value="<?php echo esc_attr(get_option('workforce_webhook_secret', '')); ?>"
                        class="regular-text code"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <p class="description">
                        <?php esc_html_e('Paste the webhook secret from your Workforce dashboard. When set, post edits and deletions are pushed to the dashboard in real time so the pages browser stays current.', 'workforce-seo'); ?>
                    </p>
                </td>
            </tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
