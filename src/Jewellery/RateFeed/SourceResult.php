<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

/**
 * What one source returned for one run.
 *
 * `failed` and `empty` are kept apart on purpose. "Could not reach IBJA" is an
 * infrastructure problem the shop can ignore for an hour; "reached IBJA and it
 * published nothing" means a holiday, or a parser that no longer matches the
 * page — different message, different urgency.
 */
final class SourceResult
{
    /** @param Quote[] $quotes @param array<string,mixed> $meta */
    private function __construct(
        public readonly string $source,
        public readonly string $status,      // ok | empty | failed
        public readonly array $quotes,
        public readonly ?int $httpStatus,
        public readonly ?string $message,
        public readonly ?string $token,
        public readonly int $ms,
        public readonly array $meta = [],
    ) {
    }

    /** @param Quote[] $quotes @param array<string,mixed> $meta */
    public static function ok(string $source, array $quotes, ?string $token, int $httpStatus, int $ms, array $meta = []): self
    {
        return new self($source, $quotes === [] ? 'empty' : 'ok', $quotes, $httpStatus, null, $token, $ms, $meta);
    }

    public static function empty(string $source, string $message, ?int $httpStatus, int $ms, ?string $token = null): self
    {
        return new self($source, 'empty', [], $httpStatus, $message, $token, $ms);
    }

    public static function failed(string $source, string $message, ?int $httpStatus = null, int $ms = 0): self
    {
        return new self($source, 'failed', [], $httpStatus, $message, null, $ms);
    }

    public function isUsable(): bool
    {
        return $this->status === 'ok' && $this->quotes !== [];
    }
}
