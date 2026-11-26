<?php

declare(strict_types=1);

namespace CRM\Support;

/** Indian fiscal year: April 1 – March 31. */
final class FiscalYear
{
    /** @return array{start:string,end:string} Y-m-d bounds of the FY containing $date */
    public static function range(?string $date = null): array
    {
        $ts = $date !== null ? strtotime($date) : time();
        $year = (int) date('Y', $ts);
        $month = (int) date('n', $ts);
        $startYear = $month >= 4 ? $year : $year - 1;
        return [
            'start' => sprintf('%04d-04-01', $startYear),
            'end' => sprintf('%04d-03-31', $startYear + 1),
        ];
    }

    /** Fiscal code like '2627' for FY 2026-27. */
    public static function code(?string $date = null): string
    {
        $range = self::range($date);
        $startYear = (int) substr($range['start'], 0, 4);
        return substr((string) $startYear, 2) . substr((string) ($startYear + 1), 2);
    }

    /** FY quarter 1-4 (Q1 = Apr-Jun … Q4 = Jan-Mar). */
    public static function quarter(?string $date = null): int
    {
        $month = (int) date('n', $date !== null ? strtotime($date) : time());
        return $month >= 4 ? intdiv($month - 4, 3) + 1 : 4;
    }

    /** @return array{start:string,end:string} bounds of the given FY quarter */
    public static function quarterRange(int $quarter, ?string $date = null): array
    {
        $fy = self::range($date);
        $startYear = (int) substr($fy['start'], 0, 4);
        $startMonth = 4 + ($quarter - 1) * 3; // Q1→4, Q2→7, Q3→10, Q4→13 (Jan next year)
        $year = $startYear;
        if ($startMonth > 12) {
            $startMonth -= 12;
            $year++;
        }
        $start = sprintf('%04d-%02d-01', $year, $startMonth);
        // day 0 of (startMonth + 3) = last day of the quarter's third month; mktime normalizes overflow
        $end = date('Y-m-d', mktime(0, 0, 0, $startMonth + 3, 0, $year));
        return ['start' => $start, 'end' => $end];
    }
}
