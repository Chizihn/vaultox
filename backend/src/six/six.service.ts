import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as https from "node:https";
import * as fs from "node:fs";
import { DEFAULT_MARKET_SYMBOLS, SYMBOL_TO_VALOR_BC } from "./six.graphql";

type SixRestSnapshotResponse = Record<string, unknown> | unknown[];

type SnapshotQuote = {
  price?: number;
  asOf?: string;
  relativeChange?: number;
  source?: string;
};

type QuoteRecord = {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
};

type SixDebugSampleNode = {
  path: string;
  keys: string[];
  idHints: string[];
  symbolHints: string[];
  priceHints: number[];
};

@Injectable()
export class SixService implements OnModuleInit {
  private readonly logger = new Logger(SixService.name);
  private readonly graphqlUrl: string;
  private readonly intradaySnapshotUrls: string[];
  private noParseWarnAfter = 0;
  private readonly noParseWarnCooldownMs = 120_000;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>(
      "SIX_API_BASE_URL",
      "https://api.six-group.com",
    );

    this.graphqlUrl = `${baseUrl}/web/v2/graphql`;
    this.intradaySnapshotUrls = [
      `${baseUrl}/web/v2/listings/marketData/intradaySnapshot`,
    ];
  }

  onModuleInit() {
    const readiness = this.getReadinessStatus();
    if (readiness.ready) {
      this.logger.log(`SIX ready (${readiness.reason}) via ${this.graphqlUrl}`);
    } else {
      this.logger.warn(`SIX not ready: ${readiness.reason}`);
    }
  }

  isReady(): boolean {
    return this.getReadinessStatus().ready;
  }

  getReadinessStatus(): { ready: boolean; reason: string } {
    const sixEnabled =
      this.configService.get<string>("SIX_ENABLED", "true") === "true";
    if (!sixEnabled) {
      return { ready: false, reason: "SIX_ENABLED=false" };
    }

    const certPem = this.getCertificatePem();
    const keyPem = this.getPrivateKeyPem();
    if (!certPem || !keyPem) {
      return {
        ready: false,
        reason:
          "Missing SIX_CERT_PEM/SIX_KEY_PEM or SIX_CERT_PEM_PATH/SIX_KEY_PEM_PATH (use signed-certificate.pem + private-key.pem)",
      };
    }

    if (!certPem.includes("BEGIN CERTIFICATE")) {
      return {
        ready: false,
        reason: "SIX_CERT_PEM invalid: missing BEGIN CERTIFICATE",
      };
    }

    if (
      !keyPem.includes("BEGIN PRIVATE KEY") &&
      !keyPem.includes("BEGIN RSA PRIVATE KEY")
    ) {
      return {
        ready: false,
        reason:
          "SIX_KEY_PEM invalid: missing BEGIN PRIVATE KEY/BEGIN RSA PRIVATE KEY",
      };
    }

    return { ready: true, reason: "PEM certificate + key configured" };
  }

  async getInstitutionalQuotes(symbols: string[] = []): Promise<{
    provider: string;
    quotes: QuoteRecord[];
  }> {
    const normalizedSymbols = symbols.length ? symbols : DEFAULT_MARKET_SYMBOLS;
    const ids = normalizedSymbols
      .map((symbol) => SYMBOL_TO_VALOR_BC[symbol])
      .filter(Boolean);

    // this.logger.log(
    //   `getInstitutionalQuotes: symbols=[${normalizedSymbols.join(",")}], valorIds=[${ids.join(",")}]`,
    // );

    if (!ids.length) {
      // this.logger.warn("getInstitutionalQuotes: no VALOR IDs mapped, returning empty");
      // return { provider: "SIX-empty", quotes: [] };
    }

    const response = await this.callIntradaySnapshot(ids);
    const byId = this.extractQuotesByValorId(response);
    if (!byId.size) {
      this.warnNoParseableSnapshot(response, ids);
      return { provider: "SIX-empty", quotes: [] };
    }

    const quotes: QuoteRecord[] = normalizedSymbols.map((symbol) => {
      const valorId = SYMBOL_TO_VALOR_BC[symbol];
      const snapshot = valorId
        ? this.getSnapshotByIdentifier(byId, valorId)
        : undefined;
      const lastPrice = snapshot?.price;
      const asOf = snapshot?.asOf ?? new Date().toISOString();

      return {
        symbol,
        price: typeof lastPrice === "number" ? lastPrice : 0,
        change24hPct: this.normalizeChange(snapshot?.relativeChange),
        asOf,
        source: snapshot?.source ? `SIX ${snapshot.source}` : "SIX Verified",
      };
    });

    return {
      provider: "SIX-live",
      quotes,
    };
  }

  async getDebugSnapshot(symbols: string[] = []) {
    const normalizedSymbols = symbols.length ? symbols : DEFAULT_MARKET_SYMBOLS;
    const ids = normalizedSymbols
      .map((symbol) => SYMBOL_TO_VALOR_BC[symbol])
      .filter(Boolean);

    const readiness = this.getReadinessStatus();
    if (!readiness.ready) {
      return {
        ready: false,
        reason: readiness.reason,
        request: {
          symbols: normalizedSymbols,
          valorIds: ids,
        },
      };
    }

    if (!ids.length) {
      return {
        ready: true,
        request: {
          symbols: normalizedSymbols,
          valorIds: ids,
        },
        error: "No SIX VALOR identifiers mapped for requested symbols.",
      };
    }

    try {
      const payload = await this.callIntradaySnapshot(ids);
      const extracted = this.extractQuotesByValorId(payload);

      const matchedIds = ids.filter((id) =>
        Boolean(this.getSnapshotByIdentifier(extracted, id)),
      );

      return {
        ready: true,
        request: {
          symbols: normalizedSymbols,
          valorIds: ids,
        },
        payload: this.summarizePayloadShape(payload),
        extraction: {
          parsedQuoteCount: extracted.size,
          matchedValorIds: matchedIds,
          unmatchedValorIds: ids.filter((id) => !matchedIds.includes(id)),
          sampleParsedEntries: Array.from(extracted.entries())
            .slice(0, 10)
            .map(([id, quote]) => ({
              id,
              price: quote.price ?? null,
              asOf: quote.asOf ?? null,
              relativeChange: quote.relativeChange ?? null,
              source: quote.source ?? null,
            })),
        },
      };
    } catch (error) {
      return {
        ready: true,
        request: {
          symbols: normalizedSymbols,
          valorIds: ids,
        },
        error: String(error),
      };
    }
  }

  private warnNoParseableSnapshot(payload: unknown, requestedIds: string[]) {
    const now = Date.now();
    if (now < this.noParseWarnAfter) {
      return;
    }

    this.noParseWarnAfter = now + this.noParseWarnCooldownMs;

    const payloadKind = Array.isArray(payload)
      ? "array"
      : payload && typeof payload === "object"
        ? "object"
        : typeof payload;

    const topLevelKeys =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload as Record<string, unknown>).slice(0, 12)
        : [];

    let rawDump = "";
    try {
      rawDump = JSON.stringify(payload, null, 2).slice(0, 2000);
    } catch {
      rawDump = "[unserializable]";
    }

    // this.logger.warn(
    //   `SIX returned no parseable intraday instruments from REST endpoint (kind=${payloadKind}, requestedIds=${requestedIds.join(",")}, keys=${topLevelKeys.join("|") || "n/a"})`,
    // );
    // this.logger.warn(`SIX raw payload dump (truncated to 2000 chars):\n${rawDump}`);
  }

  private normalizeChange(relative?: number): number {
    if (typeof relative !== "number" || Number.isNaN(relative)) {
      return 0;
    }

    if (Math.abs(relative) <= 1) {
      return Number((relative * 100).toFixed(2));
    }

    return Number(relative.toFixed(2));
  }

  private getPrivateKeyPassphrase(): string {
    return this.configService.get<string>("SIX_KEY_PASSPHRASE", "").trim();
  }

  private getCertificatePemPath(): string {
    return this.configService.get<string>("SIX_CERT_PEM_PATH", "").trim();
  }

  private getPrivateKeyPemPath(): string {
    return this.configService.get<string>("SIX_KEY_PEM_PATH", "").trim();
  }

  private normalizeMultiline(value: string): string {
    return value.replace(/\\n/g, "\n").trim();
  }

  private getCertificatePem(): string {
    const raw = this.configService.get<string>("SIX_CERT_PEM", "").trim();
    if (raw) {
      return this.normalizeMultiline(raw);
    }

    const filePath = this.getCertificatePemPath();
    if (!filePath) {
      return "";
    }

    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch {
      return "";
    }
  }

  private getPrivateKeyPem(): string {
    const raw = this.configService.get<string>("SIX_KEY_PEM", "").trim();
    if (raw) {
      return this.normalizeMultiline(raw);
    }

    const filePath = this.getPrivateKeyPemPath();
    if (!filePath) {
      return "";
    }

    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch {
      return "";
    }
  }

  private callIntradaySnapshot(
    ids: string[],
  ): Promise<SixRestSnapshotResponse> {
    const certPem = this.getCertificatePem();
    const keyPem = this.getPrivateKeyPem();
    const keyPassphrase = this.getPrivateKeyPassphrase();

    if (!certPem || !keyPem) {
      throw new Error(
        "SIX mTLS is not configured. Set SIX_CERT_PEM + SIX_KEY_PEM (or SIX_CERT_PEM_PATH + SIX_KEY_PEM_PATH).",
      );
    }

    if (!certPem.includes("BEGIN CERTIFICATE")) {
      throw new Error(
        "SIX_CERT_PEM is invalid: expected PEM certificate block.",
      );
    }

    if (
      !keyPem.includes("BEGIN PRIVATE KEY") &&
      !keyPem.includes("BEGIN RSA PRIVATE KEY")
    ) {
      throw new Error(
        "SIX_KEY_PEM is invalid: expected PEM private key block from private-key.pem.",
      );
    }

    const requestSingleEndpoint = (
      baseEndpoint: string,
    ): Promise<SixRestSnapshotResponse> => {
      const url = new URL(baseEndpoint);
      url.searchParams.set("scheme", "VALOR_BC");
      url.searchParams.set("ids", ids.join(","));
      url.searchParams.set("preferredLanguage", "EN");

      // this.logger.log(
      //   `SIX REST request: GET ${url.pathname}?${url.searchParams.toString()} (${ids.length} IDs)`,
      // );

      return new Promise((resolve, reject) => {
        const req = https.request(
          {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port ? Number(url.port) : 443,
            path: `${url.pathname}${url.search}`,
            method: "GET",
            cert: certPem,
            key: keyPem,
            passphrase: keyPassphrase || undefined,
            headers: {
              accept: "application/json",
            },
            timeout: 10_000,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              // this.logger.log(
              //   `SIX REST response: ${res.statusCode} from ${url.pathname} (${body.length} bytes)`,
              // );
              if (res.statusCode && res.statusCode >= 400) {
                this.logger.warn(
                  `SIX REST endpoint error: ${res.statusCode} at ${url.pathname} — body: ${body.slice(0, 500)}`,
                );
                return reject(
                  new Error(
                    `SIX intraday snapshot failed (${res.statusCode}) at ${url.pathname}: ${body.slice(0, 300)}`,
                  ),
                );
              }

              try {
                const parsed = JSON.parse(body) as SixRestSnapshotResponse;
                // this.logger.log(
                //   `SIX REST parsed successfully from ${url.pathname}: type=${Array.isArray(parsed) ? "array" : typeof parsed}`,
                // );
                resolve(parsed);
              } catch (error) {
                this.logger.error(
                  `SIX REST JSON parse failed from ${url.pathname}: ${String(error)}`,
                );
                reject(
                  new Error(`Invalid SIX REST response: ${String(error)}`),
                );
              }
            });
          },
        );

        req.on("timeout", () => {
          this.logger.error(`SIX REST timeout at ${url.pathname}`);
          req.destroy(new Error("SIX intraday snapshot timeout"));
        });
        req.on("error", (error) => {
          this.logger.error(
            `SIX REST connection error at ${url.pathname}: ${String(error)}`,
          );
          reject(error);
        });
        req.end();
      });
    };

    return (async () => {
      let lastError: unknown;
      for (const endpoint of this.intradaySnapshotUrls) {
        try {
          // this.logger.log(`Trying SIX endpoint: ${endpoint}`);
          const result = await requestSingleEndpoint(endpoint);
          // this.logger.log(`SIX endpoint succeeded: ${endpoint}`);
          return result;
        } catch (error) {
          this.logger.warn(
            `SIX endpoint failed: ${endpoint} — ${String(error)}`,
          );
          lastError = error;
        }
      }

      this.logger.error(
        `All SIX intraday snapshot endpoints failed. Last error: ${String(lastError)}`,
      );
      throw lastError instanceof Error
        ? lastError
        : new Error(
            "SIX intraday snapshot failed for all configured endpoints",
          );
    })();
  }

  private extractQuotesByValorId(
    payload: SixRestSnapshotResponse,
  ): Map<string, SnapshotQuote> {
    const quotes = new Map<string, SnapshotQuote>();
    const visit = (node: unknown) => {
      if (!node) {
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      if (typeof node !== "object") {
        return;
      }

      const record = node as Record<string, unknown>;
      const children = Object.values(record);

      const instrument =
        (record.instrument as Record<string, unknown> | undefined) ?? {};
      const lookup =
        (record.lookup as Record<string, unknown> | undefined) ?? {};
      const symbolCandidates = [
        record.symbol,
        record.ticker,
        record.instrumentSymbol,
        instrument.symbol,
        instrument.ticker,
        instrument.instrumentSymbol,
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);

      const mappedIdsFromSymbol = symbolCandidates
        .map((symbol) => SYMBOL_TO_VALOR_BC[symbol])
        .filter((value): value is string => typeof value === "string");

      const idCandidates = [
        record.requestedId,
        record.id,
        record.valorBc,
        record.valorBC,
        record.valor,
        record.valorId,
        record.valorNumber,
        instrument.id,
        instrument.valorBc,
        instrument.valorBC,
        instrument.valor,
        instrument.valorId,
        instrument.valorNumber,
        ...mappedIdsFromSymbol,
      ];

      const resolvedId = idCandidates
        .map((value) => this.normalizeIdentifier(value))
        .find((value): value is string => Boolean(value));

      const snapshot =
        (record.intradaySnapshot as Record<string, unknown> | undefined) ??
        ((record.marketData as Record<string, unknown> | undefined)
          ?.intradaySnapshot as Record<string, unknown> | undefined);

      const fallbackPrice =
        this.toNumber(record.lastPrice) ??
        this.toNumber(record.price) ??
        this.toNumber(record.close) ??
        this.toNumber(
          (record.marketData as Record<string, unknown> | undefined)?.lastPrice,
        );

      if (resolvedId && snapshot) {
        const last = snapshot.last as Record<string, unknown> | undefined;
        const open = snapshot.open as Record<string, unknown> | undefined;
        const change = snapshot.change as Record<string, unknown> | undefined;

        // SIX REST uses "value" not "price" for quote fields
        const price =
          this.toNumber(last?.value) ??
          this.toNumber(last?.price) ??
          this.toNumber(snapshot.lastPrice) ??
          this.toNumber(snapshot.price) ??
          fallbackPrice;

        if (price !== undefined) {
          const normalizedId = this.normalizeIdentifier(resolvedId);
          if (!normalizedId) {
            children.forEach(visit);
            return;
          }

          // Compute relative change from open if not explicitly provided
          const openPrice =
            this.toNumber(open?.value) ?? this.toNumber(open?.price);
          const computedRelativeChange =
            openPrice && openPrice > 0
              ? (price - openPrice) / openPrice
              : undefined;

          const entry: SnapshotQuote = {
            price,
            asOf:
              (last?.timestamp as string | undefined) ??
              (last?.time as string | undefined) ??
              (snapshot.timestamp as string | undefined) ??
              (snapshot.time as string | undefined) ??
              (record.time as string | undefined) ??
              (record.asOf as string | undefined),
            relativeChange:
              this.toNumber(change?.relative) ??
              this.toNumber(snapshot.relativeChange) ??
              this.toNumber(snapshot.changePercent) ??
              this.toNumber(record.changePercent) ??
              this.toNumber(record.relativeChange) ??
              computedRelativeChange,
            source:
              (lookup.listingShortName as string | undefined) ??
              (record.shortName as string | undefined) ??
              (record.name as string | undefined),
          };

          quotes.set(normalizedId, entry);
          const canonical = this.canonicalIdentifier(normalizedId);
          if (canonical && canonical !== normalizedId) {
            quotes.set(canonical, entry);
          }
        }
      }

      children.forEach(visit);
    };

    visit(payload);

    // this.logger.log(
    //   `extractQuotesByValorId: extracted ${quotes.size} quotes, IDs: [${Array.from(quotes.keys()).join(", ")}]`,
    // );

    return quotes;
  }

  private getSnapshotByIdentifier(
    quotes: Map<string, SnapshotQuote>,
    requestedId: string,
  ): SnapshotQuote | undefined {
    const normalized = this.normalizeIdentifier(requestedId);
    if (!normalized) {
      return undefined;
    }

    const direct = quotes.get(normalized);
    if (direct) {
      return direct;
    }

    const canonical = this.canonicalIdentifier(normalized);
    if (canonical) {
      const fromCanonical = quotes.get(canonical);
      if (fromCanonical) {
        return fromCanonical;
      }
    }

    return undefined;
  }

  private normalizeIdentifier(value: unknown): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length ? normalized : undefined;
  }

  private canonicalIdentifier(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private summarizePayloadShape(payload: unknown) {
    const isArrayPayload = Array.isArray(payload);
    const rootType = isArrayPayload
      ? "array"
      : payload && typeof payload === "object"
        ? "object"
        : typeof payload;

    const rootKeys =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload as Record<string, unknown>).slice(0, 30)
        : [];

    const sampleNodes = this.collectSampleNodes(payload, 12);

    return {
      rootType,
      rootKeys,
      sampleNodes,
    };
  }

  private collectSampleNodes(
    payload: unknown,
    maxSamples: number,
  ): SixDebugSampleNode[] {
    const samples: SixDebugSampleNode[] = [];

    const walk = (node: unknown, path: string) => {
      if (samples.length >= maxSamples) return;
      if (!node || typeof node !== "object") return;

      if (Array.isArray(node)) {
        node.slice(0, 4).forEach((child, index) => {
          walk(child, `${path}[${index}]`);
        });
        return;
      }

      const record = node as Record<string, unknown>;
      const keys = Object.keys(record);

      const idHints = [
        record.requestedId,
        record.id,
        record.valor,
        record.valorBc,
        record.valorBC,
        record.valorId,
        (record.instrument as Record<string, unknown> | undefined)?.id,
      ]
        .filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        )
        .map((value) => String(value));

      const symbolHints = [
        record.symbol,
        record.ticker,
        (record.lookup as Record<string, unknown> | undefined)
          ?.listingShortName,
        (record.instrument as Record<string, unknown> | undefined)?.symbol,
        (record.instrument as Record<string, unknown> | undefined)?.ticker,
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);

      const priceCandidates = [
        record.price,
        record.lastPrice,
        (record.last as Record<string, unknown> | undefined)?.value,
        (record.last as Record<string, unknown> | undefined)?.price,
        (
          (record.intradaySnapshot as Record<string, unknown> | undefined)
            ?.last as Record<string, unknown> | undefined
        )?.value,
        (
          (record.intradaySnapshot as Record<string, unknown> | undefined)
            ?.last as Record<string, unknown> | undefined
        )?.price,
        (record.intradaySnapshot as Record<string, unknown> | undefined)
          ?.lastPrice,
        (
          (record.marketData as Record<string, unknown> | undefined)
            ?.intradaySnapshot as Record<string, unknown> | undefined
        )?.last
          ? ((
              (
                (record.marketData as Record<string, unknown> | undefined)
                  ?.intradaySnapshot as Record<string, unknown> | undefined
              )?.last as Record<string, unknown> | undefined
            )?.value as unknown)
          : undefined,
      ]
        .map((value) => this.toNumber(value))
        .filter((value): value is number => typeof value === "number");

      if (idHints.length || symbolHints.length || priceCandidates.length) {
        samples.push({
          path,
          keys: keys.slice(0, 20),
          idHints: idHints.slice(0, 10),
          symbolHints: symbolHints.slice(0, 10),
          priceHints: priceCandidates.slice(0, 10),
        });
      }

      keys.slice(0, 12).forEach((key) => {
        walk(record[key], `${path}.${key}`);
      });
    };

    walk(payload, "$root");
    return samples;
  }
}
