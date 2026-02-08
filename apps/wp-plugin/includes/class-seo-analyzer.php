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
            'h1'            => $this->extract_h1($content),
            'headings'      => $this->extract_headings($content),
            'word_count'    => str_word_count(wp_strip_all_tags($content)),
            'last_modified' => $post->post_modified_gmt,
        ];
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
