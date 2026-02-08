<?php
/**
 * API Client — communicates with the Workforce Next.js dashboard.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Workforce_API_Client
{
    private function get_api_url(): string
    {
        return rtrim(get_option('workforce_api_url', ''), '/');
    }

    private function get_api_key(): string
    {
        return get_option('workforce_api_key', '');
    }

    public function request(string $endpoint, string $method = 'GET', array $body = [])
    {
        $api_url = $this->get_api_url();
        $api_key = $this->get_api_key();

        if (empty($api_url) || empty($api_key)) {
            return new WP_Error(
                'workforce_not_configured',
                __('Workforce API URL and API key must be configured.', 'workforce-seo')
            );
        }

        $args = [
            'method'  => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
                'X-Site-ID'     => get_option('workforce_site_id', ''),
            ],
            'timeout' => 30,
        ];

        if (!empty($body) && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($api_url . $endpoint, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code >= 400) {
            return new WP_Error(
                'workforce_api_error',
                $response_body['error'] ?? __('Unknown API error', 'workforce-seo'),
                ['status' => $status_code]
            );
        }

        return $response_body;
    }

    public function sync_pages(array $pages)
    {
        return $this->request('/api/wordpress/sync-pages', 'POST', ['pages' => $pages]);
    }

    public function test_connection()
    {
        return $this->request('/api/wordpress/status');
    }
}
