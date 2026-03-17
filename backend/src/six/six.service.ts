import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import {
  DEFAULT_MARKET_SYMBOLS,
  GET_MARKET_STATUS_QUERY,
  SYMBOL_TO_VALOR_BC,
} from "./six.graphql";

type SixInstrument = {
  id?: string;
  shortName?: string;
  listings?: Array<{
    market?: { name?: string };
    marketData?: {
      intradaySnapshot?: {
        last?: { price?: number; time?: string };
        change?: { absolute?: number; relative?: number };
      };
    };
  }>;
};

type SixGraphQlResponse = {
  data?: { instruments?: SixInstrument[] };
  errors?: Array<{ message?: string }>;
};

type QuoteRecord = {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
};

@Injectable()
export class SixService {
  private readonly logger = new Logger(SixService.name);
  private readonly graphqlUrl: string;
  private readonly p12Path: string;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>(
      "SIX_API_BASE_URL",
      "https://api.six-group.com",
    );

    this.graphqlUrl = `${baseUrl}/web/v2/graphql`;
    this.p12Path = path.resolve(process.cwd(), "certs/certificate.p12");
  }

  isReady(): boolean {
    const sixEnabled =
      this.configService.get<string>("SIX_ENABLED", "true") === "true";
    if (!sixEnabled) {
      return false;
    }

    const p12Exists = fs.existsSync(this.p12Path);
    const password = this.getCertificatePassword();
    return p12Exists && Boolean(password);
  }

  async getInstitutionalQuotes(symbols: string[] = []): Promise<{
    provider: string;
    quotes: QuoteRecord[];
  }> {
    const normalizedSymbols = symbols.length ? symbols : DEFAULT_MARKET_SYMBOLS;
    const ids = normalizedSymbols
      .map((symbol) => SYMBOL_TO_VALOR_BC[symbol])
      .filter(Boolean);

    if (!ids.length) {
      return { provider: "SIX-empty", quotes: [] };
    }

    const payload = {
      query: GET_MARKET_STATUS_QUERY,
      variables: { ids },
    };

    const response = await this.callGraphQl(payload);
    if (!response.data?.instruments?.length) {
      const errorMessage = response.errors
        ?.map((err) => err.message)
        .join("; ");
      if (errorMessage) {
        this.logger.warn(`SIX returned no instruments: ${errorMessage}`);
      }
      return { provider: "SIX-empty", quotes: [] };
    }

    const byId = new Map<string, SixInstrument>();
    for (const instrument of response.data.instruments) {
      if (instrument.id) {
        byId.set(instrument.id, instrument);
      }
    }

    const quotes: QuoteRecord[] = normalizedSymbols.map((symbol) => {
      const valorId = SYMBOL_TO_VALOR_BC[symbol];
      const instrument = valorId ? byId.get(valorId) : undefined;
      const snapshot = instrument?.listings?.[0]?.marketData?.intradaySnapshot;
      const lastPrice = snapshot?.last?.price;
      const asOf = snapshot?.last?.time ?? new Date().toISOString();

      return {
        symbol,
        price: typeof lastPrice === "number" ? lastPrice : 0,
        change24hPct: this.normalizeChange(snapshot?.change?.relative),
        asOf,
        source: instrument?.shortName
          ? `SIX ${instrument.shortName}`
          : "SIX Verified",
      };
    });

    return {
      provider: "SIX-live",
      quotes,
    };
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

  private getCertificatePassword(): string {
    const configured = this.configService
      .get<string>("SIX_CERT_PASSWORD", "")
      .trim();
    if (configured) {
      return configured;
    }

    const passwordFilePath = path.resolve(process.cwd(), "certs/password.txt");
    if (!fs.existsSync(passwordFilePath)) {
      return "";
    }

    return fs.readFileSync(passwordFilePath, "utf8").trim();
  }

  private callGraphQl(payload: {
    query: string;
    variables: { ids: string[] };
  }): Promise<SixGraphQlResponse> {
    const certPassword = this.getCertificatePassword();
    const pfx = fs.readFileSync(this.p12Path);
    const url = new URL(this.graphqlUrl);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : 443,
          path: url.pathname,
          method: "POST",
          pfx,
          passphrase: certPassword,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          timeout: 10_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode && res.statusCode >= 400) {
              return reject(
                new Error(
                  `SIX GraphQL failed (${res.statusCode}): ${body.slice(0, 300)}`,
                ),
              );
            }

            try {
              resolve(JSON.parse(body) as SixGraphQlResponse);
            } catch (error) {
              reject(
                new Error(`Invalid SIX GraphQL response: ${String(error)}`),
              );
            }
          });
        },
      );

      req.on("timeout", () => req.destroy(new Error("SIX GraphQL timeout")));
      req.on("error", (error) => reject(error));
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}
