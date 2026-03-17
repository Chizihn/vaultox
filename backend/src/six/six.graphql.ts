export const GET_MARKET_STATUS_QUERY = `
query GetMarketStatus($ids: [String!]!) {
  instruments(ids: $ids, scheme: VALOR_BC) {
    id
    shortName
    listings {
      market {
        name
      }
      marketData {
        intradaySnapshot {
          last {
            price
            time
          }
          change {
            absolute
            relative
          }
        }
      }
    }
  }
}
`;

export const SYMBOL_TO_VALOR_BC: Record<string, string> = {
  XAUUSD: "274702_148",
  XAGUSD: "274720_148",
  OILHVY: "11554324_5315",
  NATGAS: "274551_301",
  EURUSD: "946681_148",
  USDCHF: "275164_148",
  GBPUSD: "275017_148",
  USDSGD: "275000_148",
  BLK: "138405792_65",
  FOREX_RANK_1: "10461775_148",
};

export const DEFAULT_MARKET_SYMBOLS = [
  "EURUSD",
  "USDCHF",
  "XAUUSD",
  "XAGUSD",
  "OILHVY",
  "NATGAS",
  "BLK",
  "USDSGD",
];
