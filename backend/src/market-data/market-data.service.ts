import { Injectable, Logger } from "@nestjs/common";
import { SixService } from "../six/six.service";

export interface QuoteRecord {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
}

export interface SettlementCalendarStatus {
  jurisdiction: string;
  date: string;
  isHoliday: boolean;
  reason: string;
  source: string;
}

const HOLIDAY_CALENDAR: Record<string, string[]> = {
  Switzerland: ["2026-01-01", "2026-04-03", "2026-08-01", "2026-12-25"],
  Singapore: ["2026-01-01", "2026-02-17", "2026-05-01", "2026-12-25"],
  Germany: ["2026-01-01", "2026-04-03", "2026-10-03", "2026-12-25"],
  "United States": ["2026-01-01", "2026-07-04", "2026-11-26", "2026-12-25"],
  "United Arab Emirates": ["2026-01-01", "2026-12-02"],
};

const JURISDICTION_ALIASES: Record<string, string> = {
  UAE: "United Arab Emirates",
};

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private sixRetryAfter = 0;
  private readonly sixRetryCooldownMs = 60_000;

  constructor(private readonly sixService: SixService) {}

  async getQuotes(symbols: string[] = []) {
    const normalizedSymbols = symbols.length
      ? symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
      : ["EURUSD", "USDCHF", "XAUUSD"];

    if (this.sixService.isReady()) {
      const now = Date.now();
      if (now < this.sixRetryAfter) {
        return this.getFallbackQuotes(normalizedSymbols);
      }

      try {
        const sixQuotes =
          await this.sixService.getInstitutionalQuotes(normalizedSymbols);

        const mergedQuotes = this.mergeWithFallbacks(
          normalizedSymbols,
          sixQuotes.quotes,
        );
        const hasAnyPrice = mergedQuotes.some((quote) => quote.price > 0);
        if (hasAnyPrice) {
          this.sixRetryAfter = 0;
          return {
            provider: sixQuotes.provider,
            quotes: mergedQuotes,
          };
        }
      } catch (error) {
        this.sixRetryAfter = Date.now() + this.sixRetryCooldownMs;
        this.logger.warn(
          `SIX quote retrieval failed, falling back to mock feed for ${Math.floor(
            this.sixRetryCooldownMs / 1000,
          )}s: ${String(error)}`,
        );
      }
    }

    return this.getFallbackQuotes(normalizedSymbols);
  }

  getSettlementCalendarStatus(
    jurisdiction: string,
    dateInput?: string,
  ): SettlementCalendarStatus {
    const today = new Date();
    const parsedDate = dateInput ? new Date(dateInput) : today;
    const safeDate = Number.isNaN(parsedDate.getTime()) ? today : parsedDate;

    const date = safeDate.toISOString().slice(0, 10);
    const dayOfWeek = safeDate.getUTCDay();

    const normalizedJurisdiction =
      JURISDICTION_ALIASES[jurisdiction] ?? jurisdiction;
    const knownHolidays = HOLIDAY_CALENDAR[normalizedJurisdiction] ?? [];

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        jurisdiction: normalizedJurisdiction,
        date,
        isHoliday: true,
        reason: "Weekend market closure",
        source: "VaultOX market calendar fallback",
      };
    }

    if (knownHolidays.includes(date)) {
      return {
        jurisdiction: normalizedJurisdiction,
        date,
        isHoliday: true,
        reason: "Public holiday",
        source: "VaultOX market calendar fallback",
      };
    }

    return {
      jurisdiction: normalizedJurisdiction,
      date,
      isHoliday: false,
      reason: "Open trading day",
      source: "VaultOX market calendar fallback",
    };
  }

  private getFallbackQuotes(normalizedSymbols: string[]): {
    provider: string;
    quotes: QuoteRecord[];
  } {
    const fallbackPrices: Record<string, number> = {
      EURUSD: 1.0894,
      USDCHF: 0.8821,
      XAUUSD: 2984.35,
      XAGUSD: 33.84,
      OILHVY: 78.42,
      NATGAS: 2.31,
      BLK: 924.5,
      FOREX_RANK_1: 1,
      USDSGD: 1.3312,
      USDAED: 3.6725,
    };

    const quotes: QuoteRecord[] = normalizedSymbols.map((symbol, index) => ({
      symbol,
      price: fallbackPrices[symbol] ?? 1,
      change24hPct: Number(
        (((index % 2 === 0 ? 1 : -1) * (index + 1)) / 10).toFixed(2),
      ),
      asOf: new Date().toISOString(),
      source: "VaultOX MarketData Fallback",
    }));

    return {
      provider: "fallback",
      quotes,
    };
  }

  private mergeWithFallbacks(
    symbols: string[],
    sixQuotes: QuoteRecord[],
  ): QuoteRecord[] {
    const bySymbol = new Map(sixQuotes.map((quote) => [quote.symbol, quote]));
    return symbols.map((symbol, index) => {
      const sixQuote = bySymbol.get(symbol);
      if (sixQuote && sixQuote.price > 0) {
        return sixQuote;
      }

      return this.createFallbackQuote(symbol, index);
    });
  }

  private createFallbackQuote(symbol: string, index: number): QuoteRecord {
    const fallbackPrices: Record<string, number> = {
      EURUSD: 1.0894,
      USDCHF: 0.8821,
      XAUUSD: 2984.35,
      XAGUSD: 33.84,
      OILHVY: 78.42,
      NATGAS: 2.31,
      BLK: 924.5,
      FOREX_RANK_1: 1,
      USDSGD: 1.3312,
      USDAED: 3.6725,
    };

    return {
      symbol,
      price: fallbackPrices[symbol] ?? 1,
      change24hPct: Number(
        (((index % 2 === 0 ? 1 : -1) * (index + 1)) / 10).toFixed(2),
      ),
      asOf: new Date().toISOString(),
      source: "VaultOX MarketData Fallback",
    };
  }
}
