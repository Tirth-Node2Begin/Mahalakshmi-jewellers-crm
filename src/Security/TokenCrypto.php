<?php

declare(strict_types=1);

namespace CRM\Security;

use CRM\Core\Env;

/** AES-256-GCM encryption-at-rest for third-party integration tokens. */
final class TokenCrypto
{
    public static function encrypt(string $plaintext): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($ciphertext === false) {
            throw new \RuntimeException('Token encryption failed.');
        }
        return base64_encode($iv . $tag . $ciphertext);
    }

    public static function decrypt(string $encoded): string
    {
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < 29) {
            throw new \RuntimeException('Token payload corrupt.');
        }
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ciphertext = substr($raw, 28);
        $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($plaintext === false) {
            throw new \RuntimeException('Token decryption failed.');
        }
        return $plaintext;
    }

    private static function key(): string
    {
        $b64 = Env::get('APP_ENC_KEY');
        if ($b64 === null || $b64 === '' || $b64 === 'CHANGE_ME_BASE64_32_BYTES') {
            throw new \RuntimeException('APP_ENC_KEY is not configured.');
        }
        $key = base64_decode($b64, true);
        if ($key === false || strlen($key) !== 32) {
            throw new \RuntimeException('APP_ENC_KEY must be 32 bytes base64.');
        }
        return $key;
    }
}
