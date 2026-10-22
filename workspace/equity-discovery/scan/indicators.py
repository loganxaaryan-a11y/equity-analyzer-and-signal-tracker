"""
Faithful port of the equity terminal's indicator math.

Source: ~/workspace/ts-spaces/equity-analyzer-and-signal-tracker/server/src/actions.ts
  finite            :103    average        :103    sma      :104-107
  pct               :108    round          :109    rsi      :110-126 (Wilder's)
  ema               :127-133              atr      :198-205 (Wilder's)
  zScore            :206-209              obv      :210
  isCompletedUsDailyBar / completedDailyPoints :380-386

Logic is untouched; only syntax is translated. Any change to the source
functions above requires re-porting and re-verifying (same discipline as
the orchestrator's vendored blocks).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta


def finite(v):
    return v if isinstance(v, (int, float)) and math.isfinite(v) else None


def average(values):
    return sum(values) / len(values) if values else None


def js_round(value, places=2):
    # JS Math.round = half up; Python round() = banker's. Match JS.
    f = 10 ** places
    return math.floor(value * f + 0.5) / f


def sma(closes, period, index):
    if index + 1 < period:
        return None
    return average(closes[index + 1 - period:index + 1])


def pct(current, previous):
    if previous and previous != 0:
        return (current / previous - 1) * 100
    return None


def rsi(points, period=14):
    """Wilder's RSI on point dicts with 'close'. points[0] is oldest."""
    if len(points) <= period:
        return None
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, period + 1):
        prev, cur = points[i - 1], points[i]
        if prev is None or cur is None:
            return None
        delta = cur["close"] - prev["close"]
        avg_gain += max(delta, 0)
        avg_loss += max(-delta, 0)
    avg_gain /= period
    avg_loss /= period
    for i in range(period + 1, len(points)):
        prev, cur = points[i - 1], points[i]
        if prev is None or cur is None:
            continue
        delta = cur["close"] - prev["close"]
        avg_gain = (avg_gain * (period - 1) + max(delta, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-delta, 0)) / period
    if avg_loss == 0:
        return 100.0
    return 100 - (100 / (1 + avg_gain / avg_loss))


def ema(values, period):
    if len(values) < period:
        return None
    seed = average(values[:period])
    if seed is None:
        return None
    k = 2 / (period + 1)
    out = seed
    for v in values[period:]:
        out = v * k + out * (1 - k)
    return out


def atr(points, period=14):
    trs = []
    for i in range(1, len(points)):
        prev, cur = points[i - 1], points[i]
        if prev is None or cur is None or cur.get("high") is None or cur.get("low") is None:
            continue
        trs.append(max(cur["high"] - cur["low"],
                       abs(cur["high"] - prev["close"]),
                       abs(cur["low"] - prev["close"])))
    if len(trs) < period:
        return None
    value = average(trs[:period])
    if value is None:
        return None
    for tr in trs[period:]:
        value = (value * (period - 1) + tr) / period
    return value


def zscore(values):
    if len(values) < 10:
        return None
    mean = average(values)
    if mean is None:
        return None
    sd = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))
    return (values[-1] - mean) / sd if sd else 0.0


def obv(points):
    total = 0.0
    used = False
    for i in range(1, len(points)):
        p, c = points[i - 1], points[i]
        if p is None or c is None or c.get("volume") is None:
            continue
        used = True
        if c["close"] > p["close"]:
            total += c["volume"]
        elif c["close"] < p["close"]:
            total -= c["volume"]
    return total if used else None


# --- session completion (actions.ts:380-386) --------------------------------
# US Eastern in October 2026 is EDT (UTC-4). The source uses a NY clock;
# this port implements the same rule with a fixed -4 offset, valid for the
# scan window (Oct 2026). Not a general calendar.

def _ny_now(now_utc):
    return now_utc - timedelta(hours=4)


def is_completed_us_daily_bar(date_str, now_utc=None):
    now_utc = now_utc or datetime.now(timezone.utc)
    ny = _ny_now(now_utc)
    ny_date = ny.strftime("%Y-%m-%d")
    weekday = ny.strftime("%a")  # Mon..Sun
    if date_str < ny_date:
        return True
    if date_str > ny_date or weekday in ("Sat", "Sun"):
        return False
    return (ny.hour * 60 + ny.minute) >= 16 * 60 + 15


def completed_daily_points(points, now_utc=None):
    return [p for p in points if is_completed_us_daily_bar(p["date"], now_utc)]
