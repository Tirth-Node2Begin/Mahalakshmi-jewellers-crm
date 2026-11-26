-- Case-sensitive usernames.
--
-- `users.username` inherited the table default collation (utf8mb4_unicode_ci),
-- which compares case-insensitively. That made `admin` and `Admin` the same
-- string everywhere it mattered:
--   * the login lookup `WHERE username = :u` matched either casing, so the
--     account you landed in depended on row order, not on what you typed;
--   * UNIQUE KEY uq_users_username rejected `Admin` as a duplicate of `admin`,
--     so the two accounts could not coexist at all.
--
-- utf8mb4_bin compares byte-for-byte, so `=` and the unique index both become
-- case-sensitive. Because the index is defined on this column it is rebuilt
-- with the new collation automatically — no index changes are needed here, and
-- lookups on username stay indexed.
--
-- Only `username` changes. `email` deliberately stays case-insensitive: mail
-- addresses are conventionally matched that way, and the login query accepts an
-- email as an identifier.
--
-- Safe to re-run. No existing rows can violate the new unique index, because
-- the old case-insensitive index already forbade names differing only by case.

ALTER TABLE users
  MODIFY username VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
