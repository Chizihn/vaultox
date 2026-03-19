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

    this.logger.log(
      `getQuotes: symbols=[${normalizedSymbols.join(",")}], sixReady=${this.sixService.isReady()}`,
    );

    if (this.sixService.isReady()) {
      const now = Date.now();
      if (now < this.sixRetryAfter) {
        this.logger.warn(
          `SIX retry cooldown active, ${Math.ceil((this.sixRetryAfter - now) / 1000)}s remaining`,
        );
        return this.getUnavailableQuotes();
      }

      try {
        const sixQuotes =
          await this.sixService.getInstitutionalQuotes(normalizedSymbols);

        const availableQuotes = sixQuotes.quotes.filter(
          (quote) => quote.price > 0,
        );
        const hasAnyPrice = availableQuotes.length > 0;
        this.logger.log(
          `SIX returned ${sixQuotes.quotes.length} quotes, ${availableQuotes.length} with valid prices (provider=${sixQuotes.provider})`,
        );
        if (hasAnyPrice) {
          this.sixRetryAfter = 0;
          return {
            provider: sixQuotes.provider,
            quotes: availableQuotes,
          };
        }
        this.logger.warn(
          "SIX returned no quotes with valid prices, falling back to unavailable",
        );
      } catch (error) {
        this.sixRetryAfter = Date.now() + this.sixRetryCooldownMs;
        this.logger.warn(
          `SIX quote retrieval failed, returning unavailable market data for ${Math.floor(
            this.sixRetryCooldownMs / 1000,
          )}s: ${String(error)}`,
        );
      }
    }

    return this.getUnavailableQuotes();
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

  getSixDebugSnapshot(symbols: string[] = []) {
    const normalizedSymbols = symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);
    this.logger.log(
      `getSixDebugSnapshot: symbols=[${normalizedSymbols.join(",")}]`,
    );
    return this.sixService.getDebugSnapshot(normalizedSymbols);
  }

  private getUnavailableQuotes(): {
    provider: string;
    quotes: QuoteRecord[];
  } {
    return {
      provider: "unavailable",
      quotes: [],
    };
  }
}
