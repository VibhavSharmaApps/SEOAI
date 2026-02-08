<?php
/**
 * REST API — exposes WordPress data to the Workforce dashboard.
 *
 * CRITICAL ENDPOINT: /wp-json/workforce/v1/execute
 * Accepts JSON payloads to update posts, meta, and schema.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Workforce_REST_API
{
    private const NAMESPACE = 'workforce/v1';

    /**
     * Register REST API routes.
     */
    public static function register_routes(): void
    {
        // ============================================================
        // MAIN ENDPOINT: /execute
        // Unified endpoint for all SEO operations
        // ============================================================
        register_rest_route(self::NAMESPACE, '/execute', [
            'methods'             => 'POST',
            'callback'            => [self::class, 'execute'],
            'permission_callback' => [self::class, 'verify_api_key'],
            'args'                => [
                'action' => [
                    'required'          => true,
                    'type'              => 'string',
                    'enum'              => ['update_post', 'update_meta', 'update_schema', 'batch'],
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'post_id' => [
                    'required'          => false,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
                'payload' => [
                    'required' => true,
                    'type'     => 'object',
                ],
            ],
        ]);

        // Health check endpoint
        register_rest_route(self::NAMESPACE, '/status', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'status'],
            'permission_callback' => [self::class, 'verify_api_key'],
        ]);
    }

    /**
     * Verify the API key from the request header.
     * Uses constant-time comparison to prevent timing attacks.
     */
    public static function verify_api_key(WP_REST_Request $request): bool
    {
        $provided_key = $request->get_header('X-Workforce-Key');
        $stored_key   = get_option('workforce_api_key', '');

        if (empty($stored_key)) {
            return false;
        }

        return hash_equals($stored_key, $provided_key ?? '');
    }

    /**
     * Execute SEO operation (unified endpoint).
     */
    public static function execute(WP_REST_Request $request): WP_REST_Response
    {
        $action  = $request->get_param('action');
        $post_id = $request->get_param('post_id');
        $payload = $request->get_param('payload');

        // Validate post exists if post_id provided
        if ($post_id && !get_post($post_id)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Invalid post ID',
            ], 404);
        }

        switch ($action) {
            case 'update_post':
                return self::handle_update_post($post_id, $payload);

            case 'update_meta':
                return self::handle_update_meta($post_id, $payload);

            case 'update_schema':
                return self::handle_update_schema($post_id, $payload);

            case 'batch':
                return self::handle_batch($payload);

            default:
                return new WP_REST_Response([
                    'success' => false,
                    'error'   => 'Unknown action',
                ], 400);
        }
    }

    /**
     * Handle update_post action — safely update post content, title, excerpt.
     * 
     * Supports:
     * - Direct content updates
     * - H1 injection (prepend or replace)
     * - Title, excerpt, status updates
     */
    private static function handle_update_post(int $post_id, array $payload): WP_REST_Response
    {
        $post = get_post($post_id);
        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Post not found',
            ], 404);
        }

        $update_data = ['ID' => $post_id];
        $updated_fields = [];

        // Update title
        if (isset($payload['title'])) {
            $update_data['post_title'] = sanitize_text_field($payload['title']);
            $updated_fields[] = 'title';
        }

        // Update content (with safe HTML)
        if (isset($payload['content'])) {
            $update_data['post_content'] = wp_kses_post($payload['content']);
            $updated_fields[] = 'content';
        }

        // Prepend or replace H1 (for SEO gap fixing)
        if (isset($payload['prepend_h1'])) {
            $h1 = sanitize_text_field($payload['prepend_h1']);
            $current_content = $post->post_content;

            // Check if content already has an H1
            if (preg_match('/<h1[^>]*>(.*?)<\/h1>/i', $current_content, $matches)) {
                // Replace existing H1
                $h1_html = '<h1>' . esc_html($h1) . '</h1>';
                $update_data['post_content'] = preg_replace(
                    '/<h1[^>]*>.*?<\/h1>/i',
                    $h1_html,
                    $current_content,
                    1
                );
                $updated_fields[] = 'h1_replaced';
            } else {
                // Prepend new H1
                $h1_html = '<h1>' . esc_html($h1) . '</h1>' . "\n\n";
                $update_data['post_content'] = $h1_html . $current_content;
                $updated_fields[] = 'h1_prepended';
            }
        }

        // Update excerpt
        if (isset($payload['excerpt'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($payload['excerpt']);
            $updated_fields[] = 'excerpt';
        }

        // Update status (with whitelist validation)
        if (isset($payload['status'])) {
            $allowed_statuses = ['publish', 'draft', 'pending', 'private'];
            $status = sanitize_text_field($payload['status']);
            if (in_array($status, $allowed_statuses, true)) {
                $update_data['post_status'] = $status;
                $updated_fields[] = 'status';
            }
        }

        // Execute the update
        $result = wp_update_post($update_data, true);

        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => $result->get_error_message(),
            ], 500);
        }

        // Log the update for audit trail
        self::log_seo_update($post_id, 'update_post', $updated_fields);

        return new WP_REST_Response([
            'success' => true,
            'post_id' => $post_id,
            'updated' => $updated_fields,
            'timestamp' => current_time('mysql'),
        ]);
    }

    /**
     * Handle update_meta action — safely update SEO meta tags.
     * 
     * Features:
     * - Length validation (50-60 for title, 150-160 for description)
     * - Auto-truncation with ellipsis if too long
     * - Updates all major SEO plugin meta fields (Yoast, Rank Math, AIOSEO)
     * - Audit trail logging
     */
    private static function handle_update_meta(int $post_id, array $payload): WP_REST_Response
    {
        $post = get_post($post_id);
        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Post not found',
            ], 404);
        }

        $updated = [];

        // Meta title (validate length: 50-60 chars optimal)
        if (isset($payload['meta_title'])) {
            $meta_title = sanitize_text_field($payload['meta_title']);
            
            // Validate length
            if (strlen($meta_title) > 70) {
                $meta_title = substr($meta_title, 0, 67) . '...';
            }

            if (strlen($meta_title) > 0) {
                // Update all common SEO plugin fields
                update_post_meta($post_id, '_yoast_wpseo_title', $meta_title);
                update_post_meta($post_id, 'rank_math_title', $meta_title);
                update_post_meta($post_id, '_aioseo_title', $meta_title);
                
                $updated[] = 'meta_title';
            }
        }

        // Meta description (validate length: 150-160 chars optimal)
        if (isset($payload['meta_description'])) {
            $meta_desc = sanitize_textarea_field($payload['meta_description']);
            
            // Validate length
            if (strlen($meta_desc) > 170) {
                $meta_desc = substr($meta_desc, 0, 157) . '...';
            }

            if (strlen($meta_desc) > 0) {
                // Update all common SEO plugin fields
                update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
                update_post_meta($post_id, 'rank_math_description', $meta_desc);
                update_post_meta($post_id, '_aioseo_description', $meta_desc);
                
                $updated[] = 'meta_description';
            }
        }

        // Focus keyword
        if (isset($payload['focus_keyword'])) {
            $keyword = sanitize_text_field($payload['focus_keyword']);
            
            if (strlen($keyword) > 0) {
                update_post_meta($post_id, '_yoast_wpseo_focuskw', $keyword);
                update_post_meta($post_id, 'rank_math_focus_keyword', $keyword);
                update_post_meta($post_id, '_aioseo_focus_keyphrase', $keyword);
                
                $updated[] = 'focus_keyword';
            }
        }

        // Open Graph title
        if (isset($payload['og_title'])) {
            $og_title = sanitize_text_field($payload['og_title']);
            if (strlen($og_title) > 0) {
                update_post_meta($post_id, '_yoast_wpseo_opengraph-title', $og_title);
                update_post_meta($post_id, 'rank_math_facebook_title', $og_title);
                $updated[] = 'og_title';
            }
        }

        // Open Graph description
        if (isset($payload['og_description'])) {
            $og_desc = sanitize_textarea_field($payload['og_description']);
            if (strlen($og_desc) > 0) {
                update_post_meta($post_id, '_yoast_wpseo_opengraph-description', $og_desc);
                update_post_meta($post_id, 'rank_math_facebook_description', $og_desc);
                $updated[] = 'og_description';
            }
        }

        // Custom meta fields (workforce_ prefixed only for security)
        if (isset($payload['custom_meta']) && is_array($payload['custom_meta'])) {
            foreach ($payload['custom_meta'] as $key => $value) {
                if (strpos($key, 'workforce_') === 0) {
                    update_post_meta(
                        $post_id,
                        sanitize_key($key),
                        sanitize_text_field($value)
                    );
                    $updated[] = "custom_meta:{$key}";
                }
            }
        }

        // Log the update
        self::log_seo_update($post_id, 'meta_update', $updated);

        return new WP_REST_Response([
            'success' => true,
            'post_id' => $post_id,
            'updated' => $updated,
            'timestamp' => current_time('mysql'),
        ]);
    }

    /**
     * Handle update_schema action — inject JSON-LD schema markup.
     */
    private static function handle_update_schema(int $post_id, array $payload): WP_REST_Response
    {
        if (!isset($payload['schema'])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Schema data is required',
            ], 400);
        }

        // Validate JSON structure
        if (!is_array($payload['schema']) || !isset($payload['schema']['@type'])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Invalid schema format (must be JSON-LD with @type)',
            ], 400);
        }

        // Store schema as JSON in post meta
        update_post_meta($post_id, '_workforce_schema', wp_json_encode($payload['schema']));

        // Store schema type for easy querying
        update_post_meta(
            $post_id,
            '_workforce_schema_type',
            sanitize_text_field($payload['schema']['@type'])
        );

        // Log the update
        self::log_seo_update($post_id, 'schema_update', [$payload['schema']['@type']]);

        return new WP_REST_Response([
            'success' => true,
            'post_id' => $post_id,
            'schema_type' => $payload['schema']['@type'],
            'timestamp' => current_time('mysql'),
        ]);
    }

    /**
     * Handle batch action — execute multiple operations in one request.
     */
    private static function handle_batch(array $payload): WP_REST_Response
    {
        if (!isset($payload['operations']) || !is_array($payload['operations'])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Operations array is required for batch action',
            ], 400);
        }

        $results = [];
        $failed = 0;

        foreach ($payload['operations'] as $index => $operation) {
            $action = $operation['action'] ?? null;
            $post_id = $operation['post_id'] ?? null;
            $op_payload = $operation['payload'] ?? [];

            if (!$action || !$post_id) {
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'error' => 'Missing action or post_id',
                ];
                $failed++;
                continue;
            }

            // Execute the operation
            $response = null;
            switch ($action) {
                case 'update_post':
                    $response = self::handle_update_post($post_id, $op_payload);
                    break;
                case 'update_meta':
                    $response = self::handle_update_meta($post_id, $op_payload);
                    break;
                case 'update_schema':
                    $response = self::handle_update_schema($post_id, $op_payload);
                    break;
            }

            if ($response) {
                $data = $response->get_data();
                $results[] = [
                    'index' => $index,
                    'success' => $data['success'] ?? false,
                    'post_id' => $post_id,
                    'data' => $data,
                ];
                if (!($data['success'] ?? false)) {
                    $failed++;
                }
            } else {
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'error' => 'Unknown action',
                ];
                $failed++;
            }
        }

        return new WP_REST_Response([
            'success' => $failed === 0,
            'total' => count($payload['operations']),
            'succeeded' => count($payload['operations']) - $failed,
            'failed' => $failed,
            'results' => $results,
        ]);
    }

    /**
     * Health check / status endpoint.
     */
    public static function status(WP_REST_Request $request): WP_REST_Response
    {
        return new WP_REST_Response([
            'status'    => 'ok',
            'version'   => WORKFORCE_VERSION,
            'site_url'  => home_url(),
            'site_name' => get_bloginfo('name'),
            'wp_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'endpoints' => [
                'execute' => rest_url('workforce/v1/execute'),
                'status'  => rest_url('workforce/v1/status'),
            ],
        ]);
    }

    /**
     * Log SEO updates for audit trail.
     * Stores update history as post meta for transparency.
     */
    private static function log_seo_update(int $post_id, string $operation, array $fields): void
    {
        $log = get_post_meta($post_id, '_workforce_seo_log', true);
        if (!is_array($log)) {
            $log = [];
        }

        $log[] = [
            'operation' => $operation,
            'fields'    => $fields,
            'timestamp' => current_time('mysql'),
            'source'    => 'workforce_ai',
        ];

        // Keep only last 100 entries
        $log = array_slice($log, -100);

        update_post_meta($post_id, '_workforce_seo_log', $log);
    }
}
