<?php

declare(strict_types=1);

namespace CRM\Auth;

/** Auth failures. Status: 401 (unauthenticated), 419 (CSRF), 429 (rate limited). */
final class AuthException extends \RuntimeException
{
    public function __construct(string $message, private readonly int $status = 401)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
