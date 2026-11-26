<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Jewellery\RateFeed\RateFeedService;
use CRM\Jewellery\RateService;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('rates.read');
    $date = (string) ($_GET['date'] ?? date('Y-m-d'));

    $payload = [
        'date' => $date,
        'purities' => RateService::purities($date),
        'rates_set' => RateService::ratesSetFor($date),
        'history' => RateService::history(30),
    ];

    // The auto-fetched rates awaiting approval are a separate grant: a counter
    // user may read today's rate without being shown the feed to act on.
    //
    // Isolated on purpose. Billing cannot happen without the rates on this page,
    // so an optional add-on must never be able to take it down — which is
    // exactly what happened when this shipped before its migration had been run:
    // the missing rate_feed_quotes table 500'd the whole endpoint and the page
    // rendered "No metals set up yet" over six perfectly good purities. The feed
    // now degrades to absent and the rates still load.
    $payload['feed'] = null;
    if (checkPermission('rates.feed')) {
        try {
            $payload['feed'] = RateFeedService::status($date);
        } catch (\Throwable $e) {
            error_log('[jewellers-crm] rate feed status unavailable: ' . $e->getMessage());
        }
    }

    Response::success($payload);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'set');

switch ($action) {
    case 'set': {
        requirePermission('rates.set');
        $data = Validator::validate($body, [
            'date' => 'nullable|date',
            'rates' => 'required|array|min:1',
        ]);
        $date = $data['date'] ?? date('Y-m-d');

        // rates arrives as { purity_id: rate_per_gram }
        RateService::setRates($data['rates'], $date, $user->id);

        // The feed only pre-fills the boxes — this save is what commits them, so
        // close off the day's quotes here. Isolated: the rates are already
        // written and a bookkeeping failure must not report the save as failed.
        try {
            RateFeedService::settleAfterSave($date, array_map('floatval', $data['rates']), $user->id);
        } catch (\Throwable $e) {
            error_log('[jewellers-crm] could not settle rate feed quotes: ' . $e->getMessage());
        }

        Response::success(['message' => "Today's rates saved."]);
    }

    case 'feed_fetch': {
        // Fetching only stages; it cannot change what anything is billed at, so
        // rates.feed is enough. Applying is what needs rates.set.
        requirePermission('rates.feed');
        $data = Validator::validate($body, ['date' => 'nullable|date']);
        $date = $data['date'] ?? date('Y-m-d');

        try {
            RateFeedService::assertFetchableDate($date);
            $result = RateFeedService::fetch($date, 'manual', $user->id);
        } catch (\RuntimeException $e) {
            Response::error('BAD_REQUEST', $e->getMessage(), 400);
        }

        if ($result['skipped'] !== null) {
            Response::error('FEED_DISABLED', $result['skipped'], 409);
        }

        $staged = (int) $result['staged'];
        if ($staged === 0) {
            // Surface the source's own explanation — "IBJA has not published yet
            // today" and "the page layout changed" need different reactions.
            $why = 'No rates were published for that day.';
            foreach ($result['sources'] as $s) {
                if ($s['source'] !== 'cbic' && ($s['message'] ?? null) !== null) {
                    $why = (string) $s['message'];
                    break;
                }
            }
            Response::success(['staged' => 0, 'message' => $why, 'feed' => RateFeedService::status($date)]);
        }

        Response::success([
            'staged' => $staged,
            'message' => $staged . ' rate' . ($staged === 1 ? '' : 's')
                . ' filled in. Check ' . ($staged === 1 ? 'it' : 'them') . ", then press Save Today's Rates.",
            'feed' => RateFeedService::status($date),
        ]);
    }

    case 'feed_apply': {
        requirePermission('rates.set');
        $data = Validator::validate($body, [
            'date' => 'nullable|date',
            'purity_ids' => 'nullable|array',
        ]);
        $date = $data['date'] ?? date('Y-m-d');
        $purityIds = isset($data['purity_ids']) && \is_array($data['purity_ids']) && $data['purity_ids'] !== []
            ? array_map('intval', $data['purity_ids'])
            : null;

        try {
            $result = RateFeedService::apply($date, $purityIds, $user->id);
        } catch (\RuntimeException $e) {
            Response::error('BAD_REQUEST', $e->getMessage(), 400);
        }

        $n = (int) $result['applied'];
        $message = $n . ' rate' . ($n === 1 ? '' : 's') . ' applied.';
        if ($result['skipped'] !== []) {
            $s = \count($result['skipped']);
            $message .= ' ' . $s . ' left for you to check: ' . reset($result['skipped']);
        }

        Response::success([
            'applied' => $n,
            'skipped' => array_keys($result['skipped']),
            'message' => $message,
            'feed' => RateFeedService::status($date),
        ]);
    }

    case 'feed_dismiss': {
        requirePermission('rates.set');
        $data = Validator::validate($body, ['date' => 'nullable|date']);
        $date = $data['date'] ?? date('Y-m-d');

        $n = RateFeedService::dismiss($date, $user->id);
        Response::success([
            'dismissed' => $n,
            'message' => $n > 0 ? 'Fetched rates dismissed.' : 'There was nothing waiting.',
            'feed' => RateFeedService::status($date),
        ]);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
