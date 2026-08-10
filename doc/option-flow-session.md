# OptionFlowSession JSON Contract

`OptionFlowSession` is the canonical dashboard payload for a single option-flow analysis snapshot. It is intentionally not a raw tape dump. The analysis engine turns raw prints into a small interpreted JSON document, and the frontend renders that document without embedding trading logic.

## Top-Level Shape

```json
{
  "schema_version": "1.0",
  "session": {},
  "market_state": {},
  "summary": {},
  "flow_aggregate": {},
  "levels": [],
  "flow_timeline": [],
  "structures": [],
  "monetization_zones": [],
  "expiration_slices": [],
  "scenarios": [],
  "data_quality": {},
  "optional_layers": {
    "assumed_dealer_charm": null,
    "greeks_levels": null
  }
}
```

## Canonical Form

Canonical payloads should follow these rules:

- Use `schema_version: "1.0"` until a breaking field change is introduced.
- Store dates and times as ISO 8601 strings with explicit timezone offset where possible.
- Keep money values as numeric USD amounts, not formatted strings.
- Keep prices and strikes as numbers.
- Keep raw trades outside this JSON. Evidence can reference raw trades by `trade_ids`, while a separate endpoint or file can expose the actual tape rows.
- Do not let the frontend infer analytical meaning. The backend/analysis layer should assign level roles, structures, monetization zones, scenarios, `basis`, `confidence`, and evidence links.
- Use stable IDs such as `lvl-7750`, `str-7750-synthetic`, `mz-pin-7750`, and `sc-upside`.
- Use optional `expiration_slices` when one analysis date contains several expirations. Keep the top-level arrays for single-expiry payloads and for global or cross-expiry context.

## Common Audit Fields

These fields should appear on interpreted objects whenever possible.

`basis`:

```json
["observed", "derived", "inferred", "modelled"]
```

- `observed`: directly visible in tape.
- `derived`: arithmetic from tape, such as net premium or concentration.
- `inferred`: analytical hypothesis, such as synthetic-long-like, pin, or monetization zone.
- `modelled`: output from a separate model, such as assumed dealer charm or GEX/Vanna overlays.

`confidence`:

```json
["low", "medium", "high"]
```

Use coarse confidence labels. Avoid false precision such as `67.4%`.

`evidence`:

```json
{
  "trade_ids": ["trade-1001"],
  "structure_ids": ["str-7750-synthetic"],
  "notes": ["Price reclaimed strike after initial rejection"]
}
```

Evidence is what lets the UI later highlight why a level, zone, or scenario exists.

## Required Blocks

### `session`

Snapshot metadata and parsing assumptions.

```json
{
  "underlying": "SPX",
  "expiration": "2026-08-07",
  "dte": 0,
  "snapshot_time": "2026-08-07T12:20:00-04:00",
  "timezone": "America/New_York",
  "session_scope": "rth",
  "premium_filter_usd": 50000,
  "contract_multiplier": 100,
  "source_files": ["spotgamma-tape-profile-1-2026-08-07.csv"]
}
```

### `market_state`

Current market context and top-level interpretation.

```json
{
  "spot": 7751.8,
  "spot_change_from_previous_snapshot": 3.0,
  "regime": "pinning",
  "bias": "mixed",
  "confidence": "medium",
  "main_pivot": 7750,
  "upper_decision_level": 7775,
  "lower_decision_level": 7730
}
```

### `summary`

Human-readable dashboard summary.

```json
{
  "headline": "7750 is the main 0DTE inventory pin",
  "key_points": [
    "7750 has been reclaimed and trades as a balanced inventory center",
    "7730 is the lower reclaim/supportive pivot"
  ],
  "daily_note": null
}
```

### `flow_aggregate`

Session-level premium aggregates. Use separate buckets for all flow, near-spot flow, OTM flow, and leave-one-out checks when available.

```json
{
  "gross_premium": 31410000,
  "calls": { "bought": 15260000, "sold": 12830000, "net": 2430000 },
  "puts": { "bought": 1860000, "sold": 1460000, "net": 400000 },
  "near_spot": {
    "distance_points": 30,
    "calls": { "bought": 1100000, "sold": 544000, "net": 556000 },
    "puts": { "bought": 900000, "sold": 496000, "net": 404000 }
  },
  "leave_one_out": {
    "dominant_trade_id": "trade-7540c-001",
    "dominant_premium": 2000000,
    "dominant_share": 0.064,
    "result": { "net_calls": 430000, "net_puts": 400000 },
    "changes_interpretation": true,
    "comment": "Raw call bias is heavily influenced by a deep ITM complex leg"
  }
}
```

### `expiration_slices`

`expiration_slices` is optional. Omit it, set it to an empty array, or provide only one item when the payload should render as a normal single-expiry report. Provide two or more slices when the dashboard should show vertical per-expiration level blocks in the main row instead of the session timeline.

Each slice is an interpreted mini-session for one expiration. The analysis layer should group these objects; the frontend should not infer analytical meaning from raw leg dates except as a defensive fallback.

```json
{
  "id": "exp-2026-09-16",
  "label": "SEP 2026",
  "expiration": "2026-09-16",
  "dte": 40,
  "forward": 18.64,
  "reference_price": null,
  "summary": {
    "headline": "September body supply at 18.5-20, stress demand at 22-25"
  },
  "flow_aggregate": {},
  "levels": [],
  "structures": [],
  "monetization_zones": []
}
```

Guidelines:

- Use `forward` for products like VIX where moneyness is better read against an expiry-specific forward.
- Use `reference_price` for another expiry-specific anchor when `forward` is not the right label.
- Keep cross-expiry structures, levels, and monetization zones in the top-level arrays, and reference them from slice evidence by stable ID.
- Slice-level `levels`, `structures`, and `monetization_zones` have the same shape and semantics as the top-level arrays.

VIX monthly example:

```json
{
  "session": { "underlying": "VIX", "expiration": null, "session_scope": "rth_multi_expiry" },
  "levels": [{ "id": "lvl-35-tail-supply", "label": "32-37 EXTREME TAIL SUPPLY" }],
  "structures": [{ "id": "str-sep-oct-35-tail-sale", "ui_title": "Sep/Oct 35C Tail Supply" }],
  "expiration_slices": [
    { "id": "exp-2026-08-19", "label": "AUG 2026", "expiration": "2026-08-19", "forward": 16.92, "levels": [] },
    { "id": "exp-2026-09-16", "label": "SEP 2026", "expiration": "2026-09-16", "forward": 18.64, "levels": [] },
    { "id": "exp-2026-10-21", "label": "OCT 2026", "expiration": "2026-10-21", "levels": [] }
  ]
}
```

SPX weekly example:

```json
{
  "session": { "underlying": "SPX", "expiration": null, "session_scope": "weekly_multi_expiry" },
  "expiration_slices": [
    { "id": "exp-2026-08-10", "label": "MON 0DTE", "expiration": "2026-08-10", "dte": 0, "levels": [] },
    { "id": "exp-2026-08-11", "label": "TUE 1DTE", "expiration": "2026-08-11", "dte": 1, "levels": [] },
    { "id": "exp-2026-08-12", "label": "WED 2DTE", "expiration": "2026-08-12", "dte": 2, "levels": [] },
    { "id": "exp-2026-08-13", "label": "THU 3DTE", "expiration": "2026-08-13", "dte": 3, "levels": [] },
    { "id": "exp-2026-08-14", "label": "FRI 4DTE", "expiration": "2026-08-14", "dte": 4, "levels": [] }
  ]
}
```

## Main Arrays

### `levels`

`levels` is the primary object for the UI. A level may have several roles.

```json
{
  "id": "lvl-7750",
  "price": 7750,
  "range_low": 7745,
  "range_high": 7755,
  "role": ["main_pivot", "pin", "inventory_center"],
  "label": "MAIN 0DTE PIN / INVENTORY",
  "strength": 0.95,
  "basis": "derived",
  "confidence": "medium",
  "state": "reclaimed",
  "distance_from_spot": -1.8,
  "flow": {
    "call_buy": 503000,
    "call_sell": 542000,
    "put_buy": 294000,
    "put_sell": 358000,
    "net_calls": -39000,
    "net_puts": -64000,
    "gross": 1697000
  },
  "interpretation": "Balanced two-sided premium and repeated structures make this the active pin",
  "evidence": {
    "trade_ids": [],
    "structure_ids": ["str-7750-synthetic"],
    "notes": ["Reclaimed after earlier rejection"]
  }
}
```

Recommended `role` values:

```json
[
  "main_pivot",
  "pin",
  "inventory_center",
  "volatility_center",
  "call_supply",
  "potential_cap",
  "put_risk_acceptance",
  "conditional_floor",
  "downside_protection",
  "upside_demand",
  "reclaim_support",
  "breakdown_trigger",
  "transition",
  "magnet",
  "complex_zone",
  "tail_zone"
]
```

Recommended `state` values:

```json
[
  "unconfirmed",
  "active",
  "testing",
  "absorbed",
  "reclaimed",
  "lost",
  "historical"
]
```

### `flow_timeline`

Aggregated timeline buckets. The frontend can render price, call/put bars, regime strips, and event markers from the same array.

```json
{
  "start": "2026-08-07T10:00:00-04:00",
  "end": "2026-08-07T10:05:00-04:00",
  "spot_open": 7730.2,
  "spot_high": 7734.5,
  "spot_low": 7719.3,
  "spot_close": 7726.8,
  "calls": { "bought": 900000, "sold": 397000, "net": 503000 },
  "puts": { "bought": 200000, "sold": 1210000, "net": -1010000 },
  "gross_premium": 2707000,
  "near_spot": {
    "distance_points": 30,
    "net_calls": 503000,
    "net_puts": -1010000
  },
  "regime": "reclaim",
  "events": ["7720 test", "7750 synthetic-long-like flow"]
}
```

### `structures`

Significant interpreted books. Store the legs, not just the label.

```json
{
  "id": "str-7750-synthetic",
  "timestamp": "2026-08-07T10:03:14-04:00",
  "type": "synthetic_long",
  "legs": [
    {
      "option_type": "call",
      "side": "buy",
      "strike": 7750,
      "contracts": 550,
      "premium": 820000,
      "trade_ids": ["abc", "def"]
    }
  ],
  "gross_premium": 1580000,
  "net_premium": null,
  "bias": "bullish",
  "basis": "inferred",
  "confidence": "medium",
  "opening_status": "unknown",
  "complex_order_confirmed": false,
  "key_levels": [7750],
  "interpretation": "Likely bullish delta package; supports 7750 as active inventory but does not prove breakout demand",
  "ui_title": "7750 Synthetic Long-like"
}
```

Recommended `type` values:

```json
[
  "single_leg",
  "long_straddle",
  "short_straddle",
  "long_strangle",
  "short_strangle",
  "call_debit_spread",
  "call_credit_spread",
  "put_debit_spread",
  "put_credit_spread",
  "ratio_call_spread",
  "ratio_put_spread",
  "butterfly",
  "broken_wing_butterfly",
  "synthetic_long",
  "synthetic_short",
  "box",
  "conversion",
  "reversal",
  "roll",
  "unknown_complex"
]
```

### `monetization_zones`

Do not compute these in the frontend. They are already analytical interpretation.

```json
{
  "id": "mz-pin-7750",
  "low": 7745,
  "high": 7755,
  "type": "pin_decay",
  "beneficiaries": ["short-vol inventory", "balanced 0DTE books"],
  "source_structure_ids": ["str-7750-synthetic"],
  "source_level_ids": ["lvl-7750"],
  "basis": "inferred",
  "confidence": "medium",
  "description": "High churn and balanced premium favor pinning around 7750",
  "caveat": "Not payoff-precise without confirmed opening/closing and complex linkage"
}
```

Recommended `type` values:

```json
[
  "pin_decay",
  "upside_monetization",
  "downside_convexity",
  "call_supply_monetization",
  "put_protection_activation",
  "vol_realization",
  "spread_max_value_zone",
  "complex_inventory_zone",
  "exhaustion_zone"
]
```

### `scenarios`

Scenarios are conditional routes, not predictions.

```json
{
  "id": "sc-upside",
  "name": "Upside realization",
  "bias": "bullish",
  "priority": 0.3,
  "triggers": [
    {
      "type": "accept_above",
      "level": 7775,
      "description": "Absorb local call supply"
    }
  ],
  "route": [7775, 7800, 7805],
  "invalidations": ["Failed acceptance back below 7770"],
  "interpretation": "Acceptance above upper friction activates the 7800-7805 zone"
}
```

Recommended trigger `type` values:

```json
[
  "accept_above",
  "accept_below",
  "reclaim",
  "failed_reclaim",
  "hold_above",
  "hold_below",
  "new_call_buying",
  "new_call_selling",
  "new_put_buying",
  "new_put_selling",
  "iv_expand",
  "iv_compress"
]
```

### `data_quality`

Always include this block. The UI may display it as a small confidence marker, but the payload should keep the full audit trail.

```json
{
  "raw_rows": 262,
  "deduplicated_rows": 257,
  "duplicates_removed": 5,
  "iv_coverage": 0.82,
  "side_quality": "good",
  "multileg_quality": "mixed",
  "opening_closing_known": false,
  "confidence": "medium",
  "caveats": [
    "BUY/SELL does not prove opening/closing",
    "Several large ITM prints are probable complex legs",
    "Visible tape is not the full market position"
  ]
}
```

## Optional Layers

Optional model overlays belong under `optional_layers` and should be explicitly marked as assumptions where relevant.

```json
{
  "optional_layers": {
    "assumed_dealer_charm": {
      "label": "Assumed Dealer Charm from Visible Tape",
      "assumed": true,
      "confidence": "medium",
      "horizons": [
        { "minutes": 15, "hedge_flow_usd": 120000000 },
        { "minutes": 30, "hedge_flow_usd": 210000000 }
      ],
      "by_strike": [],
      "spot_scenarios": []
    },
    "greeks_levels": {
      "vanna": {
        "positive": { "onset": 7760, "endpoint": 7820 },
        "negative": { "onset": 7700, "endpoint": 7620 }
      },
      "gex": {
        "positive": { "activation": 7765, "exhaustion": 7810 },
        "negative": { "activation": 7710, "exhaustion": 7640 }
      }
    }
  }
}
```
