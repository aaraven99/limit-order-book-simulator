import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type YahooChart = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      meta: Record<string, number | string>;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "AAPL").trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 422 });
  }
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m&includePrePost=true`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 market-research-dashboard" },
  });
  if (!response.ok) {
    return Response.json({ error: `Market provider returned ${response.status}.` }, { status: 503 });
  }
  const payload = await response.json() as YahooChart;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !result.timestamp?.length) {
    return Response.json(
      { error: payload.chart?.error?.description ?? "No real market bars were returned." },
      { status: 503 },
    );
  }
  const bars = result.timestamp.flatMap((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if ([open, high, low, close].some((value) => value === null || value === undefined)) return [];
    return [{
      time: new Date(timestamp * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    }];
  });
  if (!bars.length) {
    return Response.json({ error: "No complete real market bars were returned." }, { status: 503 });
  }
  return Response.json({
    ticker,
    provider: "Yahoo Finance chart",
    updatedAt: bars.at(-1)?.time,
    meta: result.meta,
    bars: bars.slice(-240),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
