---
id: equity-market-data-refresh
enabled: true
owner: space:equity-analyzer-and-signal-tracker
execution:
  kind: space_action
  slug: equity-analyzer-and-signal-tracker
  action: refreshmarketdata
  args: {"trigger":"scheduled"}
mode: task
schedule:
  kind: interval
  timezone: America/Toronto
  at: 2026-10-20T16:44:32
  every: 15m
metadata:
  originating_chat_context_json: '{"chat_id":"a685c3e7-c8be-4137-8900-4e899008bca7","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"d8c63a1c-801b-497b-a9fe-cd2681d2185d"}'
  presentation_locale: en-US
---
Invoke the web artifact's published scheduled action and retain its run history.
