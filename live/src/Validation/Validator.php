<?php

declare(strict_types=1);

namespace CRM\Validation;

/**
 * Laravel-style rule strings: 'required|string|max:120', 'numeric|min:0.01',
 * 'in:a,b,c', 'date', 'email', 'int', 'array', 'boolean'.
 * Returns only the validated keys. Throws ValidationException (→ 422).
 */
final class Validator
{
    /**
     * @param array<string,mixed> $data
     * @param array<string,string> $rules field => rule string
     * @return array<string,mixed>
     */
    public static function validate(array $data, array $rules): array
    {
        $errors = [];
        $clean = [];

        foreach ($rules as $field => $ruleString) {
            $ruleList = array_filter(explode('|', $ruleString));
            $value = $data[$field] ?? null;
            $isEmpty = $value === null || $value === '' || $value === [];
            $required = in_array('required', $ruleList, true);
            $nullable = in_array('nullable', $ruleList, true);

            if ($isEmpty) {
                if ($required) {
                    $errors[$field] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
                } elseif ($nullable || !$required) {
                    $clean[$field] = null;
                }
                continue;
            }

            // min/max compare numeric VALUE only for int/numeric fields; length otherwise
            $numericField = in_array('int', $ruleList, true) || in_array('numeric', $ruleList, true);

            $error = null;
            foreach ($ruleList as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $error = self::check($name, $arg, $value, $field, $numericField);
                if ($error !== null) {
                    break;
                }
                // normalize as we pass typed rules
                if ($name === 'int') {
                    $value = (int) $value;
                } elseif ($name === 'numeric') {
                    $value = (float) $value;
                } elseif ($name === 'boolean') {
                    $value = in_array($value, [true, 1, '1', 'true'], true);
                } elseif ($name === 'string') {
                    $value = trim((string) $value);
                }
            }

            if ($error !== null) {
                $errors[$field] = $error;
            } else {
                $clean[$field] = $value;
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }
        return $clean;
    }

    private static function check(string $rule, ?string $arg, mixed $value, string $field, bool $numericField = false): ?string
    {
        $label = ucfirst(str_replace('_', ' ', $field));
        return match ($rule) {
            'required', 'nullable' => null,
            'string' => is_scalar($value) ? null : "$label must be text.",
            'int' => (is_int($value) || (is_string($value) && preg_match('/^-?\d+$/', $value)))
                ? null : "$label must be an integer.",
            'numeric' => is_numeric($value) ? null : "$label must be a number.",
            'boolean' => in_array($value, [true, false, 0, 1, '0', '1', 'true', 'false'], true)
                ? null : "$label must be true or false.",
            'array' => is_array($value) ? null : "$label must be a list.",
            'email' => (is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false)
                ? null : "$label must be a valid email.",
            'date' => (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) && strtotime($value) !== false)
                ? null : "$label must be a date (YYYY-MM-DD).",
            'time' => (is_string($value) && preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $value))
                ? null : "$label must be a time (HH:MM).",
            'min' => self::size($value, $numericField) >= (float) $arg ? null : "$label must be at least $arg.",
            'max' => self::size($value, $numericField) <= (float) $arg ? null : "$label must be at most $arg.",
            'in' => in_array((string) $value, explode(',', (string) $arg), true)
                ? null : "$label has an invalid value.",
            default => null,
        };
    }

    private static function size(mixed $value, bool $numericField): float
    {
        if ($numericField && is_numeric($value)) {
            return (float) $value;
        }
        if (is_array($value)) {
            return (float) count($value);
        }
        return (float) mb_strlen((string) $value);
    }
}
