<?php
/**
 * SEO Analyzer — extracts SEO data from WordPress content.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Workforce_SEO_Analyzer
{
    public function extract_page_data($post): array
    {
        $post = get_post($post);
        if (!$post) {
            return [];
        }

        $content = apply_filters('the_content', $post->post_content);

        return [
            'wp_post_id'    => $post->ID,
            'post_type'     => $post->post_type,
            'title'         => get_the_title($post),
            'url'           => get_permalink($post),
            'content'       => $content,
            'excerpt'       => $post->post_excerpt,
            'meta_title'    => $this->get_meta_title($post->ID),
            'meta_desc'     => $this->get_meta_description($post->ID),
            'focus_keyword' => $this->get_focus_keyword($post->ID),
            'h1'            => $this->extract_h1($content) ?: get_the_title($post),
            'headings'      => $this->extract_headings($content),
            'word_count'    => str_word_count(wp_strip_all_tags($content)),
            'last_modified' => $post->post_modified_gmt,
            'faq_candidates' => $this->extract_potential_faq($content),
            'current_schema' => $this->get_existing_schema($post->ID),
        ];
    }

    /**
     * Read schema JSON-LD for the given post, detecting both our own
     * schema and third-party SEO plugins' schema.
     *
     * Priority order:
     *   1. Our own _workforce_schema meta (full JSON-LD string).
     *   2. Third-party plugins (Rank Math, AIOSEO) — we can only detect
     *      PRESENCE, not extract their actual schema, because they store
     *      it in incompatible formats (serialized PHP arrays, custom
     *      editor formats). When present, we return a minimal valid
     *      JSON-LD marker so the dashboard's "has schema" check passes
     *      and we don't generate a competing schema that would compete
     *      with theirs in the page <head>.
     *
     * Returns null when no schema is detected anywhere.
     */
    private function get_existing_schema(int $post_id): ?string
    {
        // Our own schema first — full JSON-LD that the dashboard can read
        // back and display verbatim.
        $our_schema = get_post_meta($post_id, '_workforce_schema', true);
        if (is_string($our_schema) && $our_schema !== '') {
            return $our_schema;
        }

        // No schema from us — check whether another SEO plugin already
        // manages schema for this post. If yes, surface a placeholder so
        // the dashboard treats this as "schema exists" and skips the
        // missing_schema gap entirely. The original third-party schema
        // continues to be rendered by its plugin; we just stay out of
        // the way.
        if ($this->has_third_party_schema($post_id)) {
            return '{"@context":"https://schema.org","@type":"WebPage"}';
        }

        return null;
    }

    /**
     * Detect whether a third-party SEO plugin has already set up schema
     * for the given post. Returns true on the first match — we don't care
     * WHICH plugin set the schema, only that one did.
     *
     * Plugin-specific notes:
     *   - Rank Math: stores per-type schema as serialized arrays under
     *     `rank_math_schema_<Type>`. The bare `rank_math_schema` key holds
     *     a flag when any schema is configured.
     *   - AIOSEO: stores schema config under `_aioseo_schema_type_options`.
     *   - Yoast: generates schema dynamically at render time with no
     *     persistent meta key. Detection would require parsing the
     *     rendered HTML, which is too expensive for this read path —
     *     skipped for now and tracked as a future enhancement.
     */
    private function has_third_party_schema(int $post_id): bool
    {
        $rank_math_keys = [
            'rank_math_schema',
            'rank_math_schema_Article',
            'rank_math_schema_BlogPosting',
            'rank_math_schema_NewsArticle',
            'rank_math_schema_WebPage',
            'rank_math_schema_Product',
        ];
        foreach ($rank_math_keys as $key) {
            if (!empty(get_post_meta($post_id, $key, true))) {
                return true;
            }
        }

        if (!empty(get_post_meta($post_id, '_aioseo_schema_type_options', true))) {
            return true;
        }

        return false;
    }

    public function get_all_pages(array $post_types = ['post', 'page'], int $limit = 500): array
    {
        $posts = get_posts([
            'post_type'      => $post_types,
            'post_status'    => ['publish', 'draft'],
            'posts_per_page' => $limit,
            'orderby'        => 'modified',
            'order'          => 'DESC',
        ]);

        $pages = [];
        foreach ($posts as $post) {
            $pages[] = $this->extract_page_data($post);
        }

        return $pages;
    }

    private function extract_h1(string $content): string
    {
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/i', $content, $matches)) {
            return wp_strip_all_tags($matches[1]);
        }
        return '';
    }

    public function extract_headings(string $content): array
    {
        $headings = [];
        if (preg_match_all('/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/si', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $headings[] = [
                    'level' => (int) $match[1],
                    'text'  => wp_strip_all_tags($match[2]),
                ];
            }
        }
        return $headings;
    }

    /**
     * Extract potential FAQ content from post
     *
     * Finds all H2/H3 headings that end with a question mark and extracts
     * the paragraph immediately following them as potential FAQ answers.
     *
     * @param string $content Post content HTML
     * @return array Array of FAQ candidates with question and answer
     */
    public function extract_potential_faq(string $content): array
    {
        $faq_candidates = [];

        // Pattern to match H2 or H3 tags ending with question mark, followed by paragraph
        // This captures: heading level, question text, and the following paragraph
        $pattern = '/<h([23])[^>]*>(.*?\?)<\/h[23]>\s*(<p[^>]*>.*?<\/p>)/si';

        if (preg_match_all($pattern, $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $question = wp_strip_all_tags($match[2]);
                $answer = wp_strip_all_tags($match[3]);

                // Only include if both question and answer are not empty
                if (!empty(trim($question)) && !empty(trim($answer))) {
                    $faq_candidates[] = [
                        'question' => trim($question),
                        'answer'   => trim($answer),
                        'heading_level' => (int) $match[1],
                    ];
                }
            }
        }

        return $faq_candidates;
    }

    private function get_meta_title(int $post_id): string
    {
        $title = get_post_meta($post_id, '_yoast_wpseo_title', true);
        if (!empty($title)) return $title;

        $title = get_post_meta($post_id, 'rank_math_title', true);
        if (!empty($title)) return $title;

        $title = get_post_meta($post_id, '_aioseo_title', true);
        if (!empty($title)) return $title;

        return '';
    }

    private function get_meta_description(int $post_id): string
    {
        $desc = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
        if (!empty($desc)) return $desc;

        $desc = get_post_meta($post_id, 'rank_math_description', true);
        if (!empty($desc)) return $desc;

        $desc = get_post_meta($post_id, '_aioseo_description', true);
        if (!empty($desc)) return $desc;

        return '';
    }

    private function get_focus_keyword(int $post_id): string
    {
        $keyword = get_post_meta($post_id, '_yoast_wpseo_focuskw', true);
        if (!empty($keyword)) return $keyword;

        $keyword = get_post_meta($post_id, 'rank_math_focus_keyword', true);
        if (!empty($keyword)) return $keyword;

        $keyword = get_post_meta($post_id, '_aioseo_focus_keyphrase', true);
        if (!empty($keyword)) return $keyword;

        return '';
    }
}
