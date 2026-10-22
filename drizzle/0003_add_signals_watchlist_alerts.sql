ALTER TABLE trades ADD COLUMN setup TEXT NOT NULL DEFAULT 'Unspecified';
--> statement-breakpoint
CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE tracked_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  setup_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  signal_date TEXT NOT NULL,
  return_5d REAL,
  return_14d REAL,
  return_30d REAL,
  hit_5d INTEGER,
  hit_14d INTEGER,
  hit_30d INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX tracked_signals_symbol_date_idx ON tracked_signals(symbol, signal_date);
--> statement-breakpoint
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  source_url TEXT,
  fingerprint TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);