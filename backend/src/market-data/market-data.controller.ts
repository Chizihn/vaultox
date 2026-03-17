import { Controller, Get, MessageEvent, Query, Sse } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MarketDataService } from "./market-data.service";
import { interval, from } from "rxjs";
import { switchMap, map, startWith } from "rxjs/operators";

@ApiTags("market-data")
@Controller("market-data")
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Sse("quotes/live")
  streamQuotes(@Query("symbols") symbols?: string) {
    const parsedSymbols = (symbols ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    return interval(10_000).pipe(
      startWith(0),
      switchMap(() => from(this.marketDataService.getQuotes(parsedSymbols))),
      map(
        (payload): MessageEvent => ({
          data: payload,
        }),
      ),
    );
  }

  @Get("quotes")
  getQuotes(@Query("symbols") symbols?: string) {
    const parsedSymbols = (symbols ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    return this.marketDataService.getQuotes(parsedSymbols);
  }

  @Get("settlement-calendar")
  getSettlementCalendar(
    @Query("jurisdiction") jurisdiction?: string,
    @Query("date") date?: string,
  ) {
    if (!jurisdiction) {
      return {
        jurisdiction: "Unknown",
        date: (date ? new Date(date) : new Date()).toISOString().slice(0, 10),
        isHoliday: false,
        reason: "Jurisdiction not provided",
        source: "VaultOX market calendar fallback",
      };
    }

    return this.marketDataService.getSettlementCalendarStatus(
      jurisdiction,
      date,
    );
  }
}
