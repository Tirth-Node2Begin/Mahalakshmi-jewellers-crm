<?php

declare(strict_types=1);

namespace CRM\Auth;

/** Immutable authenticated-user value object hydrated from a verified access token. */
final class AuthUser
{
    /** @param string[] $roles role slugs */
    public function __construct(
        public readonly int $id,
        public readonly string $username,
        public readonly string $fullName,
        public readonly ?string $email,
        public readonly int $sessionId,
        public readonly array $roles,
        public readonly bool $mustChangePassword,
        public readonly ?string $avatarColor = null,
    ) {
    }

    public function primaryRole(): string
    {
        return $this->roles[0] ?? 'employee';
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles, true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'full_name' => $this->fullName,
            'email' => $this->email,
            'roles' => $this->roles,
            'primary_role' => $this->primaryRole(),
            'must_change_password' => $this->mustChangePassword,
            'avatar_color' => $this->avatarColor,
        ];
    }
}
