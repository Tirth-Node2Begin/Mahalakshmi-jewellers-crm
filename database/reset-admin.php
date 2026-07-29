<?php

declare(strict_types=1);

/**
 * Maintenance helper — reset the super-admin login to a known-good state.
 *
 * Fixes the "Invalid username or password" lockout that happens when the
 * seeded `must_change_password=1` forces a change on first login and the new
 * password is then forgotten. Re-run any time you need admin access back.
 *
 *   php database/reset-admin.php [password]
 *
 * Defaults to admin123. Sets is_active=1 and must_change_password=0 so the
 * credential is stable and login works immediately (no forced-change screen).
 */

require __DIR__ . '/../src/bootstrap.php';

use CRM\Database\Database;

$username = 'admin';
$password = $argv[1] ?? 'admin123';

$pdo  = Database::pdo();
$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare(
    'UPDATE users
        SET password_hash = :hash,
            is_active = 1,
            must_change_password = 0,
            password_changed_at = NOW(),
            updated_at = NOW()
      WHERE username = :username'
);
$stmt->execute(['hash' => $hash, 'username' => $username]);

if ($stmt->rowCount() === 0) {
    fwrite(STDERR, "ERROR: no user named '{$username}' found — run database/seed.php first.\n");
    exit(1);
}

// Robust self-check: re-read the row and verify the password round-trips.
$row = $pdo->prepare('SELECT is_active, must_change_password, password_hash FROM users WHERE username = :u');
$row->execute(['u' => $username]);
$row = $row->fetch(PDO::FETCH_ASSOC);

$ok = $row
    && (int) $row['is_active'] === 1
    && (int) $row['must_change_password'] === 0
    && password_verify($password, $row['password_hash']);

if (!$ok) {
    fwrite(STDERR, "ERROR: post-reset verification FAILED.\n");
    exit(1);
}

echo "OK: admin reset — username='{$username}' password='{$password}' active=1 must_change=0, password_verify=MATCH\n";
