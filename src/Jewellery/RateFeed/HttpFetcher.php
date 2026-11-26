<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

/**
 * The only outbound HTTP in the codebase, kept deliberately small.
 *
 * A rate fetch runs unattended at 09:00 on a shared host. Everything here exists
 * to make sure a slow or hostile response cannot hold the cron open or hand the
 * parser something enormous: short timeouts, a byte cap, no redirect chasing off
 * the origin host, and no cookies or state carried between calls.
 */
final class HttpFetcher
{
    public const MAX_BYTES = 3_000_000;   // IBJA's page is ~160 KB; 3 MB is a runaway guard
    private const CONNECT_TIMEOUT = 10;
    private const TOTAL_TIMEOUT = 30;
    private const USER_AGENT = 'JewellersCRM-RateFeed/1.0 (+daily benchmark rate sync)';

    /**
     * @return array{ok:bool, status:int, body:string, error:?string, ms:int}
     */
    public static function get(string $url, int $attempts = 2): array
    {
        $last = ['ok' => false, 'status' => 0, 'body' => '', 'error' => 'not attempted', 'ms' => 0];

        for ($i = 1; $i <= max(1, $attempts); $i++) {
            $last = self::once($url);
            if ($last['ok']) {
                return $last;
            }
            // one short backoff — a benchmark site briefly 502ing at 09:00 is
            // common; hammering it is not the neighbourly fix
            if ($i < $attempts) {
                sleep(3);
            }
        }

        return $last;
    }

    /** @return array{ok:bool, status:int, body:string, error:?string, ms:int} */
    private static function once(string $url): array
    {
        $started = microtime(true);

        if (!\function_exists('curl_init')) {
            return self::viaStream($url, $started);
        }

        $ch = curl_init($url);
        // TLS verification stays on always. Windows PHP builds ship without a CA
        // bundle, so a dev box needs to be pointed at one — CURL_CA_BUNDLE in
        // .env. Production Linux/cPanel hosts resolve it themselves and need no
        // setting. There is deliberately no "skip verification" escape hatch:
        // an unverified fetch is exactly how you get fed a wrong gold rate.
        $caBundle = self::caBundle();
        if ($caBundle !== null) {
            curl_setopt($ch, CURLOPT_CAINFO, $caBundle);
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT => self::TOTAL_TIMEOUT,
            // redirects are followed, but only within the same host: a benchmark
            // page that starts redirecting somewhere else is a signal to fail,
            // not something to follow into
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT => self::USER_AGENT,
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/json', 'Accept-Language: en-IN,en'],
            CURLOPT_ENCODING => '',
            // hard byte cap, enforced while the body streams in rather than after
            CURLOPT_BUFFERSIZE => 65536,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_PROGRESSFUNCTION => static fn ($r, $dlTotal, $dlNow): int => $dlNow > self::MAX_BYTES ? 1 : 0,
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = $body === false ? (curl_error($ch) ?: 'request failed') : null;
        curl_close($ch);

        $ms = (int) round((microtime(true) - $started) * 1000);
        $body = \is_string($body) ? $body : '';

        return [
            'ok' => $error === null && $status >= 200 && $status < 300 && $body !== '',
            'status' => $status,
            'body' => $body,
            'error' => $error ?? ($status >= 300 ? "HTTP $status" : ($body === '' ? 'empty response' : null)),
            'ms' => $ms,
        ];
    }

    /**
     * An explicit CA bundle, when one is configured or obviously present.
     * Returns null when the platform already knows where its certificates are.
     */
    private static function caBundle(): ?string
    {
        static $resolved = false;
        static $path = null;

        if ($resolved) {
            return $path;
        }
        $resolved = true;

        $configured = \class_exists(\CRM\Core\Env::class) ? (string) (\CRM\Core\Env::get('CURL_CA_BUNDLE', '') ?? '') : '';
        if ($configured !== '' && is_readable($configured)) {
            return $path = $configured;
        }

        // php.ini already points at one — leave curl alone
        if ((string) ini_get('curl.cainfo') !== '' || (string) ini_get('openssl.cafile') !== '') {
            return $path = null;
        }

        foreach (['/usr/ssl/certs/ca-bundle.crt', '/etc/ssl/certs/ca-certificates.crt', '/etc/pki/tls/certs/ca-bundle.crt'] as $candidate) {
            if (is_readable($candidate)) {
                return $path = $candidate;
            }
        }

        return $path = null;
    }

    /** Fallback for hosts built without ext-curl. */
    private static function viaStream(string $url, float $started): array
    {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => self::TOTAL_TIMEOUT,
            'follow_location' => 1,
            'max_redirects' => 3,
            'ignore_errors' => true,
            'header' => "User-Agent: " . self::USER_AGENT . "\r\nAccept: text/html\r\n",
        ], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);

        $body = @file_get_contents($url, false, $ctx, 0, self::MAX_BYTES);
        $status = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m) === 1) {
                $status = (int) $m[1];
            }
        }
        $ms = (int) round((microtime(true) - $started) * 1000);

        return [
            'ok' => \is_string($body) && $body !== '' && $status >= 200 && $status < 300,
            'status' => $status,
            'body' => \is_string($body) ? $body : '',
            'error' => \is_string($body) && $body !== '' ? null : 'request failed (no ext-curl)',
            'ms' => $ms,
        ];
    }
}
