CREATE UNIQUE INDEX IF NOT EXISTS signal_events_one_issued_per_signal
ON signal_events(signal_id)
WHERE event_type = 'issued';
