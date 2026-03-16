import { Injectable } from '@nestjs/common';

interface QuoteRecord {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
}

@Injectable()
export class MarketDataService {
  async getQuotes(symbols: string[] = []) {
    const normalizedSymbols = symbols.length ? symbols : ['EURUSD', 'USDCHF', 'XAUUSD'];

    const fallbackPrices: Record<string, number> = {
      EURUSD: 1.0894,
      USDCHF: 0.8821,
      XAUUSD: 2984.35,
      XAGUSD: 33.84,
      USDSGD: 1.3312,
    };

    const quotes: QuoteRecord[] = normalizedSymbols.map((symbol, index) => ({
      symbol,
      price: fallbackPrices[symbol] ?? 1,
      change24hPct: Number((((index % 2 === 0 ? 1 : -1) * (index + 1)) / 10).toFixed(2)),
      asOf: new Date().toISOString(),
      source: process.env.SIX_API_KEY ? 'SIX-configured-fallback' : 'VaultOX MarketData Fallback',
    }));

    return {
      provider: process.env.SIX_API_KEY ? 'SIX-ready' : 'fallback',
      quotes,
    };
  }
}
