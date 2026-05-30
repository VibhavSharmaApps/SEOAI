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

        // ============================================================
        // LIST ENDPOINT: /pages
        // Returns a paginated summary of posts/pages on the site. Used
        // by the dashboard's pages browser — lighter payload than the
        // single-page endpoint below (no content, headings, FAQ candidates).
        //
        // Supports sort (orderby, order), status filter (post_status), and
        // title search (s). All values are whitelisted server-side to keep
        // user-supplied params from feeding straight into WP_Query.
        // ============================================================
        register_rest_route(self::NAMESPACE, '/pages', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'list_pages'],
            'permission_callback' => [self::class, 'verify_api_key'],
            'args'                => [
                'limit' => [
                    'required'          => false,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
                'offset' => [
                    'required'          => false,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
                'orderby' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'order' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'status' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                's' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        // ============================================================
        // AUDIT ENDPOINT: /pages/{post_id}/audit
        // Returns the post's _workforce_seo_log entries (up to 100). Used
        // by the dashboard to show a "Change history" card.
        // ============================================================
        register_rest_route(self::NAMESPACE, '/pages/(?P<post_id>\d+)/audit', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'get_page_audit'],
            'permission_callback' => [self::class, 'verify_api_key'],
            'args'                => [
                'post_id' => [
                    'required'          => true,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
            ],
        ]);

        // ============================================================
        // REVERT ENDPOINT: /pages/{post_id}/revert
        // Reverses a specific audit-log entry by writing the captured
        // `old` values back. Only works on entries with the post-B3
        // shape (changes array of {name, old, new}); entries logged
        // before the refactor have only a `fields` array and aren't
        // revertable. Content/H1 changes are also skipped because
        // capturing the old post_content would bloat the log meta.
        // ============================================================
        register_rest_route(self::NAMESPACE, '/pages/(?P<post_id>\d+)/revert', [
            'methods'             => 'POST',
            'callback'            => [self::class, 'revert_page_audit'],
            'permission_callback' => [self::class, 'verify_api_key'],
            'args'                => [
                'post_id' => [
                    'required'          => true,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
                'entry_index' => [
                    'required'          => true,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
            ],
        ]);

        // ============================================================
        // READ ENDPOINT: /pages/{post_id}
        // Returns the SEO analyzer's extracted data for a single post.
        // Used by the dashboard to populate the SEO gaps page with real
        // WordPress data instead of the hardcoded EXAMPLE_PAGE.
        // ============================================================
        register_rest_route(self::NAMESPACE, '/pages/(?P<post_id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'get_page'],
            'permission_callback' => [self::class, 'verify_api_key'],
            'args'                => [
                'post_id' => [
                    'required'          => true,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ],
            ],
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
        // Each entry: ['name' => string, 'old' => mixed, 'new' => mixed].
        // Drives both the audit log AND any future revert path. Content
        // and H1 changes log `old => null` because storing the full prior
        // content would bloat the per-post meta well past anything
        // reasonable — those changes are intentionally non-revertable.
        $changes = [];

        if (isset($payload['title'])) {
            $new_title = sanitize_text_field($payload['title']);
            $update_data['post_title'] = $new_title;
            $changes[] = ['name' => 'title', 'old' => $post->post_title, 'new' => $new_title];
        }

        if (isset($payload['content'])) {
            $new_content = wp_kses_post($payload['content']);
            $update_data['post_content'] = $new_content;
            $changes[] = ['name' => 'content', 'old' => null, 'new' => null];
        }

        if (isset($payload['prepend_h1'])) {
            $h1 = sanitize_text_field($payload['prepend_h1']);
            $current_content = $post->post_content;

            if (preg_match('/<h1[^>]*>(.*?)<\/h1>/i', $current_content, $matches)) {
                $h1_html = '<h1>' . esc_html($h1) . '</h1>';
                $update_data['post_content'] = preg_replace(
                    '/<h1[^>]*>.*?<\/h1>/i',
                    $h1_html,
                    $current_content,
                    1
                );
                $changes[] = ['name' => 'h1_replaced', 'old' => null, 'new' => $h1];
            } else {
                $h1_html = '<h1>' . esc_html($h1) . '</h1>' . "\n\n";
                $update_data['post_content'] = $h1_html . $current_content;
                $changes[] = ['name' => 'h1_prepended', 'old' => null, 'new' => $h1];
            }
        }

        if (isset($payload['excerpt'])) {
            $new_excerpt = sanitize_textarea_field($payload['excerpt']);
            $update_data['post_excerpt'] = $new_excerpt;
            $changes[] = ['name' => 'excerpt', 'old' => $post->post_excerpt, 'new' => $new_excerpt];
        }

        if (isset($payload['status'])) {
            $allowed_statuses = ['publish', 'draft', 'pending', 'private'];
            $status = sanitize_text_field($payload['status']);
            if (in_array($status, $allowed_statuses, true)) {
                $update_data['post_status'] = $status;
                $changes[] = ['name' => 'status', 'old' => $post->post_status, 'new' => $status];
            }
        }

        $result = wp_update_post($update_data, true);

        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => $result->get_error_message(),
            ], 500);
        }

        self::log_seo_update($post_id, 'update_post', $changes);

        return new WP_REST_Response([
            'success' => true,
            'post_id' => $post_id,
            'updated' => array_column($changes, 'name'),
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

        // Each change: ['name' => string, 'old' => string|null, 'new' => string].
        // The "old" value is the first non-empty existing value across
        // Yoast/Rank Math/AIOSEO meta keys — assumes those have been kept
        // in sync by our own writes. Reverting writes the captured value
        // back to all three keys uniformly.
        $changes = [];

        if (isset($payload['meta_title'])) {
            $meta_title = sanitize_text_field($payload['meta_title']);
            if (strlen($meta_title) > 70) {
                $meta_title = substr($meta_title, 0, 67) . '...';
            }
            if (strlen($meta_title) > 0) {
                $old = self::read_meta_first_of($post_id, [
                    '_yoast_wpseo_title', 'rank_math_title', '_aioseo_title',
                ]);
                update_post_meta($post_id, '_yoast_wpseo_title', $meta_title);
                update_post_meta($post_id, 'rank_math_title', $meta_title);
                update_post_meta($post_id, '_aioseo_title', $meta_title);
                $changes[] = ['name' => 'meta_title', 'old' => $old, 'new' => $meta_title];
            }
        }

        if (isset($payload['meta_description'])) {
            $meta_desc = sanitize_textarea_field($payload['meta_description']);
            if (strlen($meta_desc) > 170) {
                $meta_desc = substr($meta_desc, 0, 157) . '...';
            }
            if (strlen($meta_desc) > 0) {
                $old = self::read_meta_first_of($post_id, [
                    '_yoast_wpseo_metadesc', 'rank_math_description', '_aioseo_description',
                ]);
                update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
                update_post_meta($post_id, 'rank_math_description', $meta_desc);
                update_post_meta($post_id, '_aioseo_description', $meta_desc);
                $changes[] = ['name' => 'meta_description', 'old' => $old, 'new' => $meta_desc];
            }
        }

        if (isset($payload['focus_keyword'])) {
            $keyword = sanitize_text_field($payload['focus_keyword']);
            if (strlen($keyword) > 0) {
                $old = self::read_meta_first_of($post_id, [
                    '_yoast_wpseo_focuskw', 'rank_math_focus_keyword', '_aioseo_focus_keyphrase',
                ]);
                update_post_meta($post_id, '_yoast_wpseo_focuskw', $keyword);
                update_post_meta($post_id, 'rank_math_focus_keyword', $keyword);
                update_post_meta($post_id, '_aioseo_focus_keyphrase', $keyword);
                $changes[] = ['name' => 'focus_keyword', 'old' => $old, 'new' => $keyword];
            }
        }

        if (isset($payload['og_title'])) {
            $og_title = sanitize_text_field($payload['og_title']);
            if (strlen($og_title) > 0) {
                $old = self::read_meta_first_of($post_id, [
                    '_yoast_wpseo_opengraph-title', 'rank_math_facebook_title',
                ]);
                update_post_meta($post_id, '_yoast_wpseo_opengraph-title', $og_title);
                update_post_meta($post_id, 'rank_math_facebook_title', $og_title);
                $changes[] = ['name' => 'og_title', 'old' => $old, 'new' => $og_title];
            }
        }

        if (isset($payload['og_description'])) {
            $og_desc = sanitize_textarea_field($payload['og_description']);
            if (strlen($og_desc) > 0) {
                $old = self::read_meta_first_of($post_id, [
                    '_yoast_wpseo_opengraph-description', 'rank_math_facebook_description',
                ]);
                update_post_meta($post_id, '_yoast_wpseo_opengraph-description', $og_desc);
                update_post_meta($post_id, 'rank_math_facebook_description', $og_desc);
                $changes[] = ['name' => 'og_description', 'old' => $old, 'new' => $og_desc];
            }
        }

        // Custom meta fields (workforce_ prefixed only for security)
        if (isset($payload['custom_meta']) && is_array($payload['custom_meta'])) {
            foreach ($payload['custom_meta'] as $key => $value) {
                if (strpos($key, 'workforce_') === 0) {
                    $clean_key = sanitize_key($key);
                    $clean_value = sanitize_text_field($value);
                    $old = get_post_meta($post_id, $clean_key, true);
                    update_post_meta($post_id, $clean_key, $clean_value);
                    $changes[] = [
                        'name' => "custom_meta:{$clean_key}",
                        'old'  => is_string($old) ? $old : null,
                        'new'  => $clean_value,
                    ];
                }
            }
        }

        self::log_seo_update($post_id, 'meta_update', $changes);

        return new WP_REST_Response([
            'success' => true,
            'post_id' => $post_id,
            'updated' => array_column($changes, 'name'),
            'timestamp' => current_time('mysql'),
        ]);
    }

    /**
     * Return the first non-empty post_meta value across a list of keys.
     * Used to capture the canonical "old" value before a meta update that
     * writes the new value to all of them uniformly.
     */
    private static function read_meta_first_of(int $post_id, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = get_post_meta($post_id, $key, true);
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }
        return null;
    }

    /**
     * Handle update_schema action — inject JSON-LD schema markup.
     *
     * Accepts two shapes:
     *   1. Single-type JSON-LD with a top-level `@type` (Article, FAQPage,
     *      WebPage, etc.).
     *   2. Combined JSON-LD using `@graph` — an array of typed entities
     *      (e.g. Article + FAQPage on the same page). This is the shape
     *      produced by the dashboard's combineSchemas() helper when both
     *      missing_schema and missing_faq fixes are applied together.
     *
     * @graph schemas don't have a single `@type` to index by, so
     * `_workforce_schema_type` is stored as the literal string "@graph" in
     * that case — callers querying by type can use that as the discriminator.
     */
    private static function handle_update_schema(int $post_id, array $payload): WP_REST_Response
    {
        if (!isset($payload['schema'])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Schema data is required',
            ], 400);
        }

        $schema = $payload['schema'];
        if (!is_array($schema)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Invalid schema format (must be a JSON object)',
            ], 400);
        }

        $has_type  = isset($schema['@type']);
        $has_graph = isset($schema['@graph']) && is_array($schema['@graph']);
        if (!$has_type && !$has_graph) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Invalid schema format (must be JSON-LD with @type or @graph)',
            ], 400);
        }

        // Capture prior schema for the audit trail before overwriting.
        $old_schema = get_post_meta($post_id, '_workforce_schema', true);
        $new_schema_json = wp_json_encode($schema);

        update_post_meta($post_id, '_workforce_schema', $new_schema_json);

        $schema_type = $has_type ? $schema['@type'] : '@graph';
        update_post_meta(
            $post_id,
            '_workforce_schema_type',
            sanitize_text_field($schema_type)
        );

        self::log_seo_update($post_id, 'schema_update', [
            [
                'name' => 'schema',
                'old'  => is_string($old_schema) && $old_schema !== '' ? $old_schema : null,
                'new'  => $new_schema_json,
            ],
        ]);

        return new WP_REST_Response([
            'success'     => true,
            'post_id'     => $post_id,
            'schema_type' => $schema_type,
            'timestamp'   => current_time('mysql'),
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
     * List posts/pages on the site for the dashboard's pages browser.
     *
     * Returns a lighter payload than get_page() — only the fields a list
     * view needs (id, title, URL, type, status, modified date). The full
     * SEO extraction stays behind the single-page endpoint below.
     *
     * Pagination: limit defaults to 50 and is capped at 100 to bound the
     * response size on sites with thousands of posts.
     */
    public static function list_pages(WP_REST_Request $request): WP_REST_Response
    {
        $limit = (int) $request->get_param('limit');
        if ($limit <= 0) {
            $limit = 50;
        }
        if ($limit > 100) {
            $limit = 100;
        }

        $offset = (int) $request->get_param('offset');
        if ($offset < 0) {
            $offset = 0;
        }

        // Whitelist sort and filter params — user-supplied strings never
        // reach WP_Query directly. Anything not in the allowed list falls
        // back to the previous default (modified DESC, both statuses).
        $allowed_orderby = ['modified', 'date', 'title'];
        $orderby = (string) $request->get_param('orderby');
        if (!in_array($orderby, $allowed_orderby, true)) {
            $orderby = 'modified';
        }

        $order = strtoupper((string) $request->get_param('order'));
        if ($order !== 'ASC' && $order !== 'DESC') {
            $order = 'DESC';
        }

        $status_raw = (string) $request->get_param('status');
        if ($status_raw === 'publish') {
            $post_status = ['publish'];
        } elseif ($status_raw === 'draft') {
            $post_status = ['draft'];
        } else {
            // Default ("any" or unspecified) — both publish and draft, matching
            // the pre-filter-slice behaviour.
            $post_status = ['publish', 'draft'];
        }

        // Cap the search term to a sane length — WP's `s` is already escaped
        // before SQL, but unbounded user input is still a bad shape.
        $search = (string) $request->get_param('s');
        if (strlen($search) > 200) {
            $search = substr($search, 0, 200);
        }

        $query_args = [
            'post_type'      => ['post', 'page'],
            'post_status'    => $post_status,
            'posts_per_page' => $limit,
            'offset'         => $offset,
            'orderby'        => $orderby,
            'order'          => $order,
        ];
        if ($search !== '') {
            $query_args['s'] = $search;
        }

        $posts = get_posts($query_args);

        $pages = [];
        foreach ($posts as $post) {
            $pages[] = [
                'wp_post_id'    => (int) $post->ID,
                'post_type'     => $post->post_type,
                'title'         => get_the_title($post),
                'url'           => get_permalink($post),
                'last_modified' => $post->post_modified_gmt,
                'status'        => $post->post_status,
            ];
        }

        // Total count for the dashboard's pagination. wp_count_posts is
        // cached by WP core and cheaper than a second WP_Query just to read
        // found_posts. Sum publish + draft across both post types.
        $total = 0;
        foreach (['post', 'page'] as $post_type) {
            $counts = wp_count_posts($post_type);
            $total += (int) ($counts->publish ?? 0) + (int) ($counts->draft ?? 0);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'pages'  => $pages,
                'total'  => $total,
                'limit'  => $limit,
                'offset' => $offset,
            ],
        ]);
    }

    /**
     * Fetch the SEO change history for a single post — read-only.
     *
     * Returns the entries from _workforce_seo_log post meta, normalised to
     * an array (the meta may be missing or non-array for posts that have
     * never been edited through Workforce). Entries are ordered oldest-to-
     * newest since that's how log_seo_update appends; the dashboard reverses
     * for display.
     */
    public static function get_page_audit(WP_REST_Request $request): WP_REST_Response
    {
        $post_id = (int) $request->get_param('post_id');

        $post = $post_id ? get_post($post_id) : null;
        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Post not found',
            ], 404);
        }

        $log = get_post_meta($post_id, '_workforce_seo_log', true);
        if (!is_array($log)) {
            $log = [];
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'entries' => $log,
            ],
        ]);
    }

    /**
     * Fetch a single post/page's SEO data for the dashboard.
     *
     * Reuses Workforce_SEO_Analyzer::extract_page_data() so this endpoint
     * returns the same shape the analyzer already uses internally (titles,
     * meta, H1, headings, word count, FAQ candidates).
     *
     * Only post and page types are exposed via this endpoint — custom post
     * types like nav_menu_item or attachment are rejected to avoid leaking
     * unrelated data.
     */
    public static function get_page(WP_REST_Request $request): WP_REST_Response
    {
        $post_id = (int) $request->get_param('post_id');

        $post = $post_id ? get_post($post_id) : null;
        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Post not found',
            ], 404);
        }

        if (!in_array($post->post_type, ['post', 'page'], true)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Unsupported post type',
            ], 400);
        }

        // Defensive guard — the analyzer class should always be loaded by
        // the main plugin file, but if something goes wrong with the include
        // order we want a clean 500 instead of a fatal PHP error.
        if (!class_exists('Workforce_SEO_Analyzer')) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'SEO analyzer not available',
            ], 500);
        }

        $analyzer = new Workforce_SEO_Analyzer();
        $data = $analyzer->extract_page_data($post_id);

        if (empty($data)) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Failed to extract page data',
            ], 500);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => $data,
        ]);
    }

    /**
     * Log SEO updates for audit trail + undo.
     *
     * The `changes` parameter is the post-B3 shape: an array of
     * `['name' => string, 'old' => mixed, 'new' => mixed]` entries. This
     * lets the dashboard's revert endpoint replay the `old` values back.
     *
     * Backwards compatibility: entries written before B3 used a flat
     * `fields` array (string[]). The audit-read endpoint serves both
     * shapes verbatim; the dashboard UI discriminates by checking for
     * the presence of `changes` and falls back to `fields` for legacy
     * entries. We also expose a derived `fields` here so old read paths
     * keep working.
     */
    private static function log_seo_update(int $post_id, string $operation, array $changes): void
    {
        $log = get_post_meta($post_id, '_workforce_seo_log', true);
        if (!is_array($log)) {
            $log = [];
        }

        $log[] = [
            'operation' => $operation,
            'changes'   => $changes,
            // Derived field-name list for back-compat readers and a faster
            // path for the dashboard's audit-card UI rendering.
            'fields'    => array_column($changes, 'name'),
            'timestamp' => current_time('mysql'),
            'source'    => 'workforce_ai',
        ];

        // Keep only last 100 entries
        $log = array_slice($log, -100);

        update_post_meta($post_id, '_workforce_seo_log', $log);
    }

    /**
     * Revert a specific audit-log entry by replaying its captured `old`
     * values back to the post. Only post-B3 entries (with a `changes`
     * array) are revertable; pre-refactor entries return a 400.
     *
     * Revertable change types:
     *   - meta_title, meta_description, focus_keyword (all three SEO
     *     plugins get the same value)
     *   - og_title, og_description (Yoast + Rank Math)
     *   - schema (writes the prior JSON back, or deletes if old was null)
     *   - custom_meta:* (single key restore)
     *
     * Non-revertable (silently skipped within an otherwise-revertable
     * entry): content, title, excerpt, status, h1_*. Their `old` is null
     * because storing the prior post_content would bloat the log past
     * any reasonable cap.
     *
     * The revert itself is logged as a new entry with operation='revert'.
     */
    public static function revert_page_audit(WP_REST_Request $request): WP_REST_Response
    {
        $post_id = (int) $request->get_param('post_id');
        $entry_index = (int) $request->get_param('entry_index');

        $post = $post_id ? get_post($post_id) : null;
        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Post not found',
            ], 404);
        }

        $log = get_post_meta($post_id, '_workforce_seo_log', true);
        if (!is_array($log) || !isset($log[$entry_index])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Audit entry not found',
            ], 404);
        }

        $entry = $log[$entry_index];
        if (!isset($entry['changes']) || !is_array($entry['changes'])) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Entry pre-dates the undo refactor and cannot be reverted',
            ], 400);
        }

        $reverted_names = [];
        $skipped_names  = [];

        foreach ($entry['changes'] as $change) {
            if (!isset($change['name'])) continue;
            $name = $change['name'];
            $old  = $change['old'] ?? null;

            if ($name === 'meta_title') {
                self::apply_meta_revert($post_id, ['_yoast_wpseo_title', 'rank_math_title', '_aioseo_title'], $old);
                $reverted_names[] = $name;
            } elseif ($name === 'meta_description') {
                self::apply_meta_revert($post_id, ['_yoast_wpseo_metadesc', 'rank_math_description', '_aioseo_description'], $old);
                $reverted_names[] = $name;
            } elseif ($name === 'focus_keyword') {
                self::apply_meta_revert($post_id, ['_yoast_wpseo_focuskw', 'rank_math_focus_keyword', '_aioseo_focus_keyphrase'], $old);
                $reverted_names[] = $name;
            } elseif ($name === 'og_title') {
                self::apply_meta_revert($post_id, ['_yoast_wpseo_opengraph-title', 'rank_math_facebook_title'], $old);
                $reverted_names[] = $name;
            } elseif ($name === 'og_description') {
                self::apply_meta_revert($post_id, ['_yoast_wpseo_opengraph-description', 'rank_math_facebook_description'], $old);
                $reverted_names[] = $name;
            } elseif ($name === 'schema') {
                if (is_string($old) && $old !== '') {
                    update_post_meta($post_id, '_workforce_schema', $old);
                } else {
                    delete_post_meta($post_id, '_workforce_schema');
                    delete_post_meta($post_id, '_workforce_schema_type');
                }
                $reverted_names[] = $name;
            } elseif (strpos($name, 'custom_meta:') === 0) {
                $key = substr($name, strlen('custom_meta:'));
                if (is_string($old) && $old !== '') {
                    update_post_meta($post_id, $key, $old);
                } else {
                    delete_post_meta($post_id, $key);
                }
                $reverted_names[] = $name;
            } else {
                // content / title / excerpt / status / h1_* — old wasn't
                // captured for size reasons, so we can't revert these.
                $skipped_names[] = $name;
            }
        }

        // Log the revert itself so the audit trail shows the action.
        self::log_seo_update($post_id, 'revert', [
            [
                'name' => 'reverted_entry_index',
                'old'  => null,
                'new'  => (string) $entry_index,
            ],
        ]);

        return new WP_REST_Response([
            'success'  => true,
            'post_id'  => $post_id,
            'reverted' => $reverted_names,
            'skipped'  => $skipped_names,
        ]);
    }

    /**
     * Helper for revert_page_audit: write `old` back to all SEO-plugin meta
     * keys that share a logical field. Treats null/empty as "delete".
     */
    private static function apply_meta_revert(int $post_id, array $keys, $old): void
    {
        $has_value = is_string($old) && $old !== '';
        foreach ($keys as $key) {
            if ($has_value) {
                update_post_meta($post_id, $key, $old);
            } else {
                delete_post_meta($post_id, $key);
            }
        }
    }
}
