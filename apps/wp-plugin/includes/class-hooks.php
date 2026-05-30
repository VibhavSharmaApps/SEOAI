<?php
/**
 * WordPress hooks — push post changes to the Workforce dashboard.
 *
 * Listens to save_post and before_delete_post so the dashboard's pages
 * cache stays in sync without the user clicking "Refresh from WP" after
 * every edit.
 *
 * Authentication: every outbound payload is signed with HMAC-SHA256 using
 * the per-site `workforce_webhook_secret` option. The dashboard verifies
 * the signature in /api/webhooks/wordpress/{siteId} before trusting the
 * payload.
 *
 * Delivery: wp_remote_post with blocking=false + 5-second timeout so a
 * slow / unreachable dashboard doesn't hang post saves. The dashboard
 * supports a 5-minute timestamp replay window, so if delivery fails the
 * next manual "Refresh from WP" click will resync everything.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Workforce_Hooks
{
    /**
     * Wire up the WP action hooks. Called from the main plugin file
     * during construction.
     */
    public static function init(): void
    {
        add_action('save_post', [self::class, 'on_save_post'], 10, 3);
        add_action('before_delete_post', [self::class, 'on_delete_post'], 10, 1);
    }

    /**
     * Fired after a post or page is saved (created or updated). Skips
     * autosaves, revisions, and non-post/page types so we only emit
     * events the dashboard actually caches.
     *
     * @param int     $post_id ID of the post being saved.
     * @param WP_Post $post    The post object.
     * @param bool    $update  Whether this is an update vs first save.
     */
    public static function on_save_post(int $post_id, $post, bool $update): void
    {
        if (wp_is_post_autosave($post_id)) {
            return;
        }
        if (wp_is_post_revision($post_id)) {
            return;
        }
        if (!is_object($post)) {
            return;
        }
        if (!in_array($post->post_type, ['post', 'page'], true)) {
            return;
        }
        // Skip transitional statuses — only publish and draft are cached
        // dashboard-side anyway.
        if (!in_array($post->post_status, ['publish', 'draft'], true)) {
            return;
        }

        $payload = [
            'event'     => 'post.updated',
            'timestamp' => time(),
            'page'      => [
                'wp_post_id'    => (int) $post_id,
                'post_type'     => $post->post_type,
                'title'         => get_the_title($post),
                'url'           => get_permalink($post),
                'status'        => $post->post_status,
                'last_modified' => $post->post_modified_gmt,
            ],
        ];

        self::send_webhook($payload);
    }

    /**
     * Fired BEFORE a post is permanently deleted (post_status === 'trash'
     * is just an update — actual delete fires this). We send only the
     * post_id since the row is about to be removed anyway.
     */
    public static function on_delete_post(int $post_id): void
    {
        $post = get_post($post_id);
        if (!$post || !in_array($post->post_type, ['post', 'page'], true)) {
            return;
        }

        $payload = [
            'event'      => 'post.deleted',
            'timestamp'  => time(),
            'wp_post_id' => (int) $post_id,
        ];

        self::send_webhook($payload);
    }

    /**
     * Sign and POST the payload to the dashboard's webhook receiver.
     * Silent no-op when any of the required settings are missing so a
     * partially-configured plugin doesn't spam errors during setup.
     */
    private static function send_webhook(array $payload): void
    {
        $api_url        = rtrim(get_option('workforce_api_url', ''), '/');
        $webhook_secret = get_option('workforce_webhook_secret', '');
        $site_id        = get_option('workforce_site_id', '');

        if (empty($api_url) || empty($webhook_secret) || empty($site_id)) {
            return;
        }

        $body      = wp_json_encode($payload);
        $signature = hash_hmac('sha256', $body, $webhook_secret);
        $url       = $api_url . '/api/webhooks/wordpress/' . rawurlencode($site_id);

        // blocking=false returns quickly after TCP setup so we don't hang
        // post saves. Timeout is a backstop for slow DNS / unreachable
        // dashboards. Errors are silent because there's no UI to surface
        // them to; the dashboard's "Refresh from WP" button is the
        // recovery path.
        wp_remote_post($url, [
            'method'   => 'POST',
            'timeout'  => 5,
            'blocking' => false,
            'headers'  => [
                'Content-Type'           => 'application/json',
                'X-Workforce-Signature'  => $signature,
            ],
            'body'     => $body,
        ]);
    }
}
