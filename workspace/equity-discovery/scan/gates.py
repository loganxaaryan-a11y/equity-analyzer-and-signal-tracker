"""
Factor scoring, quality gates, discovery completeness, issuance decision,
and frozen levels — faithful ports of the equity terminal.

Source refs (~/workspace/ts-spaces/equity-analyzer-and-signal-tracker/server/src/actions.ts):
  factor block (analyze)      ~670-700   quality gates + 7 factors
  factorScoreBreakdown        137-150    raw + redundancy adjustment
  signalDecision              366        long >= 20 / short <= -20
  buildFrozenLevels           367-373    entry/stop/targets
  SIGNAL_INVALIDATION_*       196-197    2.00x Wilder ATR-14
  passesDiscoveryCompleteness ~2045     252 sessions / liquidity / $25m / freshness
Source ref (orchestrator vendored block, itself verbatim from actions.ts:402-416):
  signalIssuanceDecision      orchestrator/dist/.../gates/equity-gates.js:57

Frozen strategy parameters (unchanged — SIGNAL_PARAMETER_HASH
"atr2-target1.5R-weights-6-8-8-20-8-20-20"):
  weights 6/8/8/20/8/20/20, invalidation 2.00x ATR-14, targets 1.5R/2.5R.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from indicators import (
    average, atr, completed_daily_points, ema, finite, js_round, pct, rsi, zscore,
)

SIGNAL_INVALIDATION_ATR_MULTIPLE = 2
SIGNAL_INVALIDATION_METHOD = "2.00\u00d7 Wilder ATR-14 from the reference entry"
WEIGHTS = [6, 8, 8, 20, 8, 20, 20]
TREND_FACTOR_NAMES = {
    "Price vs SMA 20", "Price vs SMA 50", "Price vs SMA 200",
    "MACD 12\u201326", "ATR-adjusted 30-session trend",
}


def _parse_bar_time(date_str):
    return datetime.fromisoformat(f"{date_str}T21:00:00+00:00")


def score_symbol(daily, now_utc=None):
    """Full 7-factor scoring over completed daily bars (oldest -> newest).

    Returns dict with factors, score breakdown, direction, levels inputs.
    Mirrors analyze()'s factor block exactly (quality gates included).
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    last = daily[-1]
    previous = daily[-2] if len(daily) >= 2 else None
    closes = [p["close"] for p in daily]
    volumes = [p["volume"] for p in daily if p.get("volume") is not None]

    latest_sma20 = average(closes[-20:]) if len(closes) >= 20 else None
    latest_sma50 = average(closes[-50:]) if len(closes) >= 50 else None
    day200 = average(closes[-200:]) if len(closes) >= 200 else None
    rsi_now = rsi(daily)
    macd_fast = ema(closes, 12)
    macd_slow = ema(closes, 26)
    macd_value = (macd_fast - macd_slow) if (macd_fast is not None and macd_slow is not None) else None
    vol_z = zscore(volumes[-20:]) if len(volumes) >= 20 else zscore(volumes)
    current_atr = atr(daily)
    ret30 = pct(last["close"], closes[-31]) if len(closes) >= 31 else None
    if ret30 is None or current_atr is None or last["close"] <= 0:
        risk_adj = None
    else:
        risk_adj = ret30 / max(0.01, current_atr / last["close"] * 100 * math.sqrt(30))

    last_bar_age_days = max(0.0, (now_utc - _parse_bar_time(last["date"])).total_seconds() / 86400)
    window = daily[-260:]
    has_anomaly = False
    for i in range(1, len(window)):
        prev_c, cur_c = window[i - 1]["close"], window[i]["close"]
        if prev_c <= 0:
            continue
        move = cur_c / prev_c - 1
        if not math.isfinite(move) or move <= -1 or abs(move) > 0.8:
            has_anomaly = True
            break

    def add_factor(factors, name, weight, value, reading):
        if has_anomaly:
            quality, quality_reason = "ANOMALY", "A recent daily move exceeded the 80% anomaly gate; contribution withheld."
        elif last_bar_age_days > 5:
            quality, quality_reason = "STALE", f"Latest source bar is {js_round(last_bar_age_days, 1)} days old; contribution withheld above 5 days."
        elif reading == "Unavailable":
            quality, quality_reason = "NO_DATA", "Minimum source sample was not available; contribution withheld."
        else:
            quality, quality_reason = "GOOD", "Sample, anomaly, and freshness gates passed."
        score = 0 if quality != "GOOD" else value
        factors.append({
            "name": name, "weight": weight, "score": score,
            "contribution": weight * score, "reading": reading,
            "quality": quality, "asOf": last["date"],
            "source": "Yahoo Finance chart", "qualityReason": quality_reason,
        })

    factors = []
    add_factor(factors, "Price vs SMA 20", 6,
               0 if latest_sma20 is None else (1 if last["close"] > latest_sma20 else -1),
               "Unavailable" if latest_sma20 is None else f"{js_round(last['close'])} vs {js_round(latest_sma20)}")
    add_factor(factors, "Price vs SMA 50", 8,
               0 if latest_sma50 is None else (1 if last["close"] > latest_sma50 else -1),
               "Unavailable" if latest_sma50 is None else f"{js_round(last['close'])} vs {js_round(latest_sma50)}")
    add_factor(factors, "Price vs SMA 200", 8,
               0 if day200 is None else (1 if last["close"] > day200 else -1),
               "Unavailable" if day200 is None else f"{js_round(last['close'])} vs {js_round(day200)}")
    rsi_score = 0 if rsi_now is None else (1 if 55 <= rsi_now <= 75 else (-1 if 25 <= rsi_now <= 45 else 0))
    add_factor(factors, "Wilder RSI 14", 20, rsi_score,
               "Unavailable" if rsi_now is None else f"{js_round(rsi_now)}; 55\u201375 bullish, 25\u201345 bearish, extremes/neutral score 0")
    macd_score = 0 if (macd_value is None or abs(macd_value) < 0.000001) else (1 if macd_value > 0 else -1)
    add_factor(factors, "MACD 12\u201326", 8, macd_score,
               "Unavailable" if macd_value is None else str(js_round(macd_value)))
    if vol_z is None or vol_z <= 1:
        vol_score = 0
    else:
        prev_close = previous["close"] if previous else last["close"]
        vol_score = 1 if last["close"] > prev_close else (-1 if last["close"] < prev_close else 0)
    add_factor(factors, "High-volume direction", 20, vol_score,
               "Unavailable" if vol_z is None else f"{js_round(vol_z)}\u03c3; scores only above 1\u03c3")
    rar_score = 0 if (risk_adj is None or abs(risk_adj) < 0.5) else (1 if risk_adj > 0 else -1)
    add_factor(factors, "ATR-adjusted 30-session trend", 20, rar_score,
               "Unavailable" if risk_adj is None else
               f"{js_round(risk_adj)} = 30-session return \u00f7 (ATR% \u00d7 \u221a30); this is the sole 30-session trend factor")

    total_w = sum(f["weight"] for f in factors)
    raw_score = js_round(100 * sum(f["weight"] * f["score"] for f in factors) / total_w, 0) if total_w > 0 else 0
    raw_score = int(raw_score)
    trend = [f["score"] for f in factors if f["name"] in TREND_FACTOR_NAMES]
    if len(trend) == 5 and all(s == 1 for s in trend):
        redundancy = -5
    elif len(trend) == 5 and all(s == -1 for s in trend):
        redundancy = 5
    else:
        redundancy = 0
    score = raw_score + redundancy
    direction = "long" if score >= 20 else ("short" if score <= -20 else "mixed")
    trade_direction = "long" if score >= 0 else "short"

    return {
        "factors": factors,
        "rawScore": raw_score,
        "redundancyAdjustment": redundancy,
        "score": score,
        "direction": direction,
        "tradeDirection": trade_direction,
        "atr14": current_atr,
        "lastBarAgeDays": last_bar_age_days,
        "hasAnomaly": has_anomaly,
        "signalDate": last["date"],
    }


def build_frozen_levels(entry_price, atr14, direction):
    if not (entry_price > 0) or not (atr14 and atr14 > 0):
        return None
    stop = entry_price - atr14 * SIGNAL_INVALIDATION_ATR_MULTIPLE if direction == "long" \
        else entry_price + atr14 * SIGNAL_INVALIDATION_ATR_MULTIPLE
    risk = abs(entry_price - stop)
    sgn = 1 if direction == "long" else -1
    return {
        "entryPrice": js_round(entry_price), "stopPrice": js_round(stop),
        "target1": js_round(entry_price + sgn * 1.5 * risk),
        "target2": js_round(entry_price + sgn * 2.5 * risk),
        "riskPerUnit": js_round(risk, 4), "direction": direction,
        "atr14": js_round(atr14, 4),
        "invalidationAtrMultiple": SIGNAL_INVALIDATION_ATR_MULTIPLE,
        "invalidationBasis": SIGNAL_INVALIDATION_METHOD,
    }


def check_completeness(history, scored, now_utc=None):
    """Port of passesDiscoveryCompleteness."""
    now_utc = now_utc or datetime.now(timezone.utc)
    if len(history) < 252:
        return False, "fewer than 252 clean daily sessions"
    recent = history[-20:]
    liquid = [p for p in recent if p.get("volume") is not None and p["volume"] > 0 and p["close"] > 0]
    if len(liquid) < 18:
        return False, "fewer than 18 liquid sessions in the latest 20"
    dollar_vols = sorted(p["close"] * p["volume"] for p in liquid)
    median_dv = dollar_vols[len(dollar_vols) // 2]
    if median_dv < 25_000_000:
        return False, "median 20-session dollar volume below $25m"
    latest = history[-1]
    age_days = (now_utc - _parse_bar_time(latest["date"])).total_seconds() / 86400
    if not math.isfinite(age_days) or age_days > 5:
        return False, "latest bar older than 5 calendar days"
    if any(f["quality"] != "GOOD" for f in scored["factors"]):
        return False, "one or more scoring factors failed sample, anomaly, or freshness gates"
    return True, "252 sessions, 18/20 recent liquid bars, $25m median dollar volume, all factor gates passed"


def recent_lower_highs(points):
    recent = points[-35:]
    if len(recent) < 12:
        return None
    peaks = []
    for i in range(2, len(recent) - 2):
        cur_h = recent[i].get("high")
        if cur_h is None:
            continue
        neighbors = [recent[i - 2].get("high"), recent[i - 1].get("high"),
                     recent[i + 1].get("high"), recent[i + 2].get("high")]
        if all(n is not None for n in neighbors) and all(cur_h >= n for n in neighbors):
            peaks.append(cur_h)
    if len(peaks) >= 2:
        return peaks[-1] < peaks[-2]
    rh = [r.get("high") for r in recent[-5:] if r.get("high") is not None]
    ph = [r.get("high") for r in recent[-10:-5] if r.get("high") is not None]
    return max(rh) < max(ph) if (len(rh) == 5 and len(ph) == 5) else None


def issuance_decision(direction, invalidation, signal_day, history):
    """Port of signalIssuanceDecision (vendored equity-gates.js:57)."""
    if not signal_day or signal_day.get("open") is None or signal_day.get("low") is None or signal_day.get("high") is None:
        return {"allowed": False,
                "reason": f"issuance-check unavailable: exact completed signal-day OHLC was not available for {signal_day.get('date') if signal_day else 'the requested date'}"}
    breached = signal_day["low"] <= invalidation if direction == "long" else signal_day["high"] >= invalidation
    if breached:
        reason = (f"born-dead LONG: signal-day low {js_round(signal_day['low'], 4)} <= invalidation {js_round(invalidation, 4)}"
                  if direction == "long" else
                  f"born-dead SHORT: signal-day high {js_round(signal_day['high'], 4)} >= invalidation {js_round(invalidation, 4)}")
        return {"allowed": False, "reason": reason}
    if direction == "long":
        return {"allowed": True, "reason": None}
    idx = next((i for i, r in enumerate(history) if r["date"] == signal_day["date"]), -1)
    through = history[:idx + 1] if idx >= 0 else [r for r in history if r["date"] <= signal_day["date"]]
    closes50 = [r["close"] for r in through[-50:]]
    mean50 = sum(closes50) / len(closes50) if closes50 else None
    close20_ago = through[-21]["close"] if len(through) >= 21 else None
    below_sma50 = None if mean50 is None else signal_day["close"] < mean50
    lower_highs = recent_lower_highs(through)
    trend20_neg = None if close20_ago is None else signal_day["close"] < close20_ago
    bearish = below_sma50 is True and (lower_highs is True or trend20_neg is True)
    if bearish:
        return {"allowed": True, "reason": None}
    return {"allowed": False, "reason": f"short-regime: bearish daily structure gate not met on {signal_day['date']}"}
