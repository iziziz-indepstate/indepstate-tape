# Tape Dashboard App Idea

The app is a simple single-page dashboard for option tape analysis. It receives an `OptionFlowSession` JSON document and renders the session as a compact trading-terminal-style view.

## Responsibility Split

```text
raw tape
  -> analysis engine
  -> OptionFlowSession JSON
  -> dashboard
```

- The analysis engine owns interpretation: level roles, significant structures, monetization zones, scenarios, confidence, and evidence.
- The JSON contract owns transport and auditability.
- The frontend owns visualization only. It should not infer trading meaning from raw trades.

## First Screen

The first screen should be the working dashboard, not a landing page.

Core regions:

- `Level Map`: the main object. Shows spot, relevant strikes/ranges, role labels, state, strength, and gross premium.
- `Flow Timeline`: aggregated time buckets with price, call/put net premium, regime, and event markers.
- `Significant Structures`: interpreted multileg or important single-leg books linked to levels.
- `Monetization Landscape`: zones where structures start to make economic sense.
- `Conditional Scenarios`: base, bullish, and bearish routes with triggers and invalidations.

## UX Direction

The visual language should stay restrained and terminal-like:

- compact spacing;
- thin borders;
- low border radius;
- no decorative cards or heavy shadows;
- color used for function, not ornament;
- the level map remains the dominant visual object.

## Data Loading

Current prototype behavior:

- `src/index.html` is the original v2 prototype shell with CSS, JS, and data separated.
- `src/styles.css` contains the visual system and dashboard layout.
- `src/app.js` loads `src/data/spx-flow-dashboard-v2.json` with `fetch` and renders the dashboard.
- `src/data/spx-flow-dashboard-v2.json` uses the canonical `OptionFlowSession` shape: session metadata, market state, summary, aggregate flow, levels, timeline buckets, structures, monetization zones, scenarios, data quality, and optional layers.

Next natural step:

- replace the prototype JSON file with a generated analysis file or API endpoint;
- add click interactions that connect levels to `structures`, `monetization_zones`, and evidence;
- add a replay mode by swapping `OptionFlowSession` snapshots through time.
