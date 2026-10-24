DELETE FROM market_scan_signals
WHERE id NOT IN (
  SELECT MAX(id) FROM market_scan_signals GROUP BY symbol
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS market_scan_signals_symbol_unique ON market_scan_signals(symbol);
--> statement-breakpoint
CREATE TABLE shared_news_cache (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  cache_key text NOT NULL,
  view text NOT NULL,
  symbol text,
  payload_json text NOT NULL,
  retrieved_at integer NOT NULL,
  expires_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX shared_news_cache_cache_key_unique ON shared_news_cache(cache_key);
