---
id: equity-theory-discovery
title: Equity automatic market scan
enabled: true
owner: space:equity-analyzer-and-signal-tracker
execution:
  kind: space_action
  slug: equity-analyzer-and-signal-tracker
  action: runautomatedscan
  args: {"trigger":"scheduled","universe":"sp100"}
mode: task
schedule:
  kind: interval
  timezone: America/Toronto
  at: 2026-10-02T03:23:59
  every: 12h
metadata:
  originating_chat_context_json: '{"chat_id":"3d07a038-2d69-4423-9812-3ea1cc0f1d86","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"d8c63a1c-801b-497b-a9fe-cd2681d2185d"}'
  presentation_locale: en-US
---
Run the combined S&P 100 chart, unusual-volume, news, sector-impact, and theory-discovery refresh; retain every completed run and its explicit degraded state.
