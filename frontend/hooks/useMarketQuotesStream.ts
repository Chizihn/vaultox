"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";

export type MarketQuote = {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
};

type MarketQuotesPayload = {
  provider?: string;
  quotes?: MarketQuote[];
};

export function useMarketQuotesStream(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [provider, setProvider] = useState("unavailable");
  const [transport, setTransport] = useState<"stream" | "polling">("stream");

  const symbolsParam = useMemo(
    () => symbols.map((symbol) => symbol.trim().toUpperCase()).join(","),
    [symbols],
  );

  useEffect(() => {
    let ignore = false;
    let stream: EventSource | null = null;
    let pollTimer: number | null = null;

    const applyPayload = (payload: MarketQuotesPayload) => {
      const rows = payload.quotes ?? [];
      const nextQuotes = rows.reduce<Record<string, MarketQuote>>(
        (acc, quote) => {
          acc[quote.symbol] = quote;
          return acc;
        },
        {},
      );

      if (!ignore) {
        setQuotes(nextQuotes);
        setProvider(payload.provider ?? "unavailable");
      }
    };

    const loadQuotes = async () => {
      try {
        const response = await api.get("/market-data/quotes", {
          params: { symbols: symbolsParam },
        });
        applyPayload(response.data as MarketQuotesPayload);
      } catch (error) {
        console.error("Failed to load market quotes", error);
      }
    };

    const startPollingFallback = () => {
      if (pollTimer) return;
      setTransport("polling");
      void loadQuotes();
      pollTimer = window.setInterval(() => void loadQuotes(), 10_000);
    };

    const startStreaming = () => {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
      const url = `${baseUrl}/market-data/quotes/live?symbols=${encodeURIComponent(symbolsParam)}`;

      stream = new EventSource(url);
      setTransport("stream");

      stream.onmessage = (event) => {
        if (ignore) return;
        try {
          const payload = JSON.parse(event.data) as MarketQuotesPayload;
          applyPayload(payload);
        } catch (error) {
          console.error("Failed to parse market quote stream event", error);
        }
      };

      stream.onerror = () => {
        stream?.close();
        stream = null;
        startPollingFallback();
      };
    };

    startStreaming();

    return () => {
      ignore = true;
      if (stream) {
        stream.close();
      }
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
    };
  }, [symbolsParam]);

  return {
    quotes,
    provider,
    transport,
  };
}
