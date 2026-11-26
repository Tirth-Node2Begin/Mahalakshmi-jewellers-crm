<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Core\Env;

/**
 * Minimal SMTP mailer (AUTH LOGIN + STARTTLS) for OTP mails — no dependencies.
 * In development with no SMTP configured, mails are logged instead of sent.
 */
final class Mailer
{
    public static function send(string $to, string $subject, string $textBody): bool
    {
        $host = Env::get('SMTP_HOST', '');
        $user = Env::get('SMTP_USER', '');
        if ($host === '' || $user === '' || $host === null || $user === null) {
            error_log("[leadspark mail-dev] to=$to subject=$subject body=$textBody");
            return true; // dev fallback: treat as delivered
        }

        try {
            $port = Env::int('SMTP_PORT', 587);
            $pass = Env::get('SMTP_PASS', '') ?? '';
            $from = Env::get('MAIL_FROM', $user) ?? $user;

            $socket = @stream_socket_client("tcp://$host:$port", $errno, $errstr, 10);
            if ($socket === false) {
                throw new \RuntimeException("SMTP connect failed: $errstr");
            }
            $expect = static function (string $prefix) use ($socket): void {
                $line = '';
                while (($chunk = fgets($socket, 512)) !== false) {
                    $line = $chunk;
                    if (strlen($line) < 4 || $line[3] !== '-') {
                        break; // last line of a multi-line reply
                    }
                }
                if (!str_starts_with($line, $prefix)) {
                    throw new \RuntimeException('SMTP unexpected reply: ' . trim($line));
                }
            };
            $say = static function (string $cmd) use ($socket): void {
                fwrite($socket, $cmd . "\r\n");
            };

            $expect('220');
            $say('EHLO leadspark-crm');
            $expect('250');
            $say('STARTTLS');
            $expect('220');
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $say('EHLO leadspark-crm');
            $expect('250');
            $say('AUTH LOGIN');
            $expect('334');
            $say(base64_encode($user));
            $expect('334');
            $say(base64_encode($pass));
            $expect('235');
            $say("MAIL FROM:<$from>");
            $expect('250');
            $say("RCPT TO:<$to>");
            $expect('250');
            $say('DATA');
            $expect('354');
            $headers = "From: Mahalakshmi Jewellers CRM <$from>\r\nTo: <$to>\r\nSubject: $subject\r\n"
                . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n";
            $say($headers . "\r\n" . $textBody . "\r\n.");
            $expect('250');
            $say('QUIT');
            fclose($socket);
            return true;
        } catch (\Throwable $e) {
            error_log('[leadspark mail] ' . $e->getMessage());
            return false;
        }
    }
}
