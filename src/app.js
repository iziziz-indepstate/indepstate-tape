const INDEX_URL = "./data/index.json";
const DATA_ROOT = "./data/";

const ROLE_COLORS = {
  main_pivot: "--cyan",
  pin: "--cyan",
  inventory_center: "--purple",
  volatility_center: "--purple",
  complex_zone: "--purple",
  tail_zone: "--purple",
  call_supply: "--red",
  potential_cap: "--red",
  put_risk_acceptance: "--red",
  downside_protection: "--green",
  conditional_floor: "--orange",
  reclaim_support: "--green",
  breakdown_trigger: "--orange",
  upside_demand: "--green",
  transition: "--yellow",
  magnet: "--purple",
};

const ZONE_STYLES = {
  vol_realization: {
    border: "rgba(79,209,197,.48)",
    background: "rgba(79,209,197,.045)",
    color: "#7ee1d8",
  },
  upside_monetization: {
    border: "rgba(183,148,244,.45)",
    background: "rgba(183,148,244,.05)",
    color: "#c9b3ee",
  },
  call_supply_monetization: {
    border: "rgba(252,129,129,.45)",
    background: "rgba(252,129,129,.05)",
    color: "#e8a0a0",
  },
  pin_decay: {
    border: "rgba(79,209,197,.45)",
    background: "rgba(79,209,197,.05)",
    color: "#7ee1d8",
  },
  put_protection_activation: {
    border: "rgba(104,211,145,.38)",
    background: "rgba(104,211,145,.04)",
    color: "#83c99a",
  },
  downside_convexity: {
    border: "rgba(104,211,145,.38)",
    background: "rgba(104,211,145,.04)",
    color: "#83c99a",
  },
  complex_inventory_zone: {
    border: "rgba(79,209,197,.4)",
    background: "rgba(79,209,197,.035)",
    color: "#7ee1d8",
  },
};

const appState = {
  index: null,
  data: null,
  selectedCategory: null,
  selectedSnapshot: null,
  selectedLevel: null,
  structuresCollapsed: false,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value ?? "";
}

function setHtml(id, value) {
  const element = byId(id);
  if (element) element.innerHTML = value ?? "";
}

function cssVar(name) {
  return `var(${name})`;
}

function titleCase(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactMoney(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPrice(value) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function flowGross(value) {
  if (!value || typeof value !== "object") return 0;
  if (typeof value.gross === "number") return value.gross;

  return Object.values(value).reduce((total, item) => total + flowGross(item), 0);
}

function levelStrength(level) {
  if (typeof level.strength === "number" && Number.isFinite(level.strength)) return level.strength;
  return flowGross(level.flow);
}

function levelBarWidth(level, maxStrength) {
  const strength = levelStrength(level);
  return Math.max(28, (strength / maxStrength) * 94);
}

function compactZoneLabel(type) {
  const labels = {
    vol_realization: "Vol Realized",
    upside_monetization: "Upside",
    call_supply_monetization: "Call Supply",
    pin_decay: "Pin Zone",
    put_protection_activation: "Put Prot.",
    downside_convexity: "Downside",
    complex_inventory_zone: "Complex Zone",
  };

  return labels[type] ?? titleCase(type);
}

function confidenceLabel(value) {
  return `${String(value).toUpperCase()} CONF`;
}

function chooseRoleColor(level) {
  const role = (level.role ?? []).find((item) => ROLE_COLORS[item]);
  return ROLE_COLORS[role] ?? "--blue";
}

function isMultiExpiry(data) {
  return Array.isArray(data.expiration_slices) && data.expiration_slices.length > 1;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function selectedKey() {
  if (!appState.selectedLevel) return null;
  return `${appState.selectedLevel.sliceId ?? "global"}:${appState.selectedLevel.levelId}`;
}

function levelKey(levelId, sliceId = null) {
  return `${sliceId ?? "global"}:${levelId}`;
}

function getLinkedStructureIds(data, level, context = data) {
  const ids = new Set(level.evidence?.structure_ids ?? []);
  asArray(context.monetization_zones)
    .filter((zone) => (zone.source_level_ids ?? []).includes(level.id))
    .flatMap((zone) => zone.source_structure_ids ?? [])
    .forEach((id) => ids.add(id));
  if (context !== data) {
    asArray(data.monetization_zones)
      .filter((zone) => (zone.source_level_ids ?? []).includes(level.id))
      .flatMap((zone) => zone.source_structure_ids ?? [])
      .forEach((id) => ids.add(id));
  }

  return ids;
}

function findSelectedLevel() {
  if (!appState.data || !appState.selectedLevel) return null;
  const slice = appState.selectedLevel.sliceId
    ? asArray(appState.data.expiration_slices).find((item) => item.id === appState.selectedLevel.sliceId)
    : null;
  const context = slice ?? appState.data;
  const level = asArray(context.levels).find((item) => item.id === appState.selectedLevel.levelId) ?? null;
  return level ? { level, context, sliceId: slice?.id ?? null } : null;
}

function setSelectedLevel(levelId, sliceId = null) {
  const next = { levelId, sliceId };
  appState.selectedLevel = selectedKey() === levelKey(levelId, sliceId) ? null : next;
  if (appState.selectedLevel) appState.structuresCollapsed = false;
  renderLevelMap("levelmap", appState.data);
  if (isMultiExpiry(appState.data)) renderExpirationBlocks(appState.data);
  renderBooks(appState.data);
  syncStructuresPanel();
}

function formatSessionScope(scope) {
  return String(scope).replaceAll("_", " + ").toUpperCase();
}

function filenameLabel(path) {
  return path.replace(/\.json$/i, "").replace(/^[a-z0-9@-]+?-/i, "").replaceAll("_", " ");
}

function snapshotTimeLabel(data) {
  const timeZone = data.session.timezone ?? "America/New_York";
  const snapshotTime = data.session.snapshot_time;
  if (!snapshotTime) return data.session.snapshot_name ?? "snapshot";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  })
    .format(new Date(snapshotTime))
    .toUpperCase();
}

function formatDateLabel(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).toUpperCase();
}

function multiExpiryDateLabel(data) {
  const expirations = asArray(data.expiration_slices)
    .map((slice) => slice.expiration)
    .filter(Boolean);
  if (expirations.length === 0) return formatDateLabel(data.session.snapshot_time?.slice(0, 10)) ?? "MULTI EXPIRY";
  const unique = [...new Set(expirations)];
  if (unique.length <= 3) return unique.map(formatDateLabel).join(" / ");
  return `${formatDateLabel(unique[0])} - ${formatDateLabel(unique[unique.length - 1])} (${unique.length} EXP)`;
}

function renderSnapshotNav() {
  const categories = Object.keys(appState.index ?? {});
  const snapshots = (appState.index?.[appState.selectedCategory] ?? []).slice(-5).reverse();

  setHtml(
    "snapshotNav",
    `
      <div class="snapshot-row">
        <span class="snapshot-label">Category</span>
        ${categories
          .map(
            (category) =>
              `<button type="button" data-category="${escapeHtml(category)}" class="${category === appState.selectedCategory ? "active" : ""}">${escapeHtml(category)}</button>`,
          )
          .join("")}
      </div>
      <div class="snapshot-row">
        <span class="snapshot-label">Snapshot</span>
        ${snapshots
          .map(
            (snapshot) =>
              `<button type="button" data-snapshot="${escapeHtml(snapshot)}" class="${snapshot === appState.selectedSnapshot ? "active" : ""}">${escapeHtml(filenameLabel(snapshot))}</button>`,
          )
          .join("")}
      </div>
    `,
  );
}

function renderHeader(data) {
  const displayDate = isMultiExpiry(data)
    ? multiExpiryDateLabel(data)
    : formatDateLabel(data.session.expiration) ?? formatDateLabel(data.session.snapshot_time?.slice(0, 10)) ?? "SNAPSHOT";

  setText("dashboardEyebrow", `${data.session.category ?? appState.selectedCategory ?? "Option Flow"} / Session Map - v${data.schema_version}`);
  setText("dashboardTitle", `${data.session.underlying} - ${displayDate}`);
  setText(
    "dashboardSubtitle",
    `${snapshotTimeLabel(data)} - visible tape - premium >= $${compactMoney(data.session.premium_filter_usd)} - ${formatSessionScope(data.session.session_scope)}`,
  );
  renderSnapshotNav();
  setText("spotValue", data.market_state.spot.toFixed(1));
  const spotChange = data.market_state.spot_change_from_previous_snapshot;
  setText("spotState", typeof spotChange === "number" ? (spotChange >= 0 ? "up reclaim" : "down loss") : "snapshot");
  setText("statusBadge", `${titleCase(data.market_state.regime)} / ${titleCase(data.market_state.bias)}`.toUpperCase());

  renderSessionSummary(data);
}

function renderSessionSummary(data) {
  const summaryHtml = asArray(data.summary?.key_points)
    .map((point) => {
      const match = point.match(/^([^ ]+)/);
      const leading = match ? match[1] : "";
      const rest = leading ? point.slice(leading.length).trim() : point;
      return leading ? `<strong>${escapeHtml(leading)}</strong> - ${escapeHtml(rest)}.` : escapeHtml(point);
    })
    .join("<br>");

  setHtml("sessionSummary", summaryHtml);
}
function renderControls() {
  const legend = [
    ["--cyan", "pin/pivot"],
    ["--red", "supply"],
    ["--green", "demand/support"],
    ["--purple", "vol/complex"],
  ];

  setHtml(
    "levelLegend",
    legend.map(([color, label]) => `<span><i style="background:${cssVar(color)}"></i>${escapeHtml(label)}</span>`).join(""),
  );
}

function createPriceScaler(context) {
  const prices = [
    context.reference_price,
    context.market_state?.spot,
    ...asArray(context.levels).flatMap((level) => [level.price, level.range_low, level.range_high]),
    ...asArray(context.monetization_zones).flatMap((zone) => [zone.low, zone.high]),
  ].filter((value) => typeof value === "number");

  if (prices.length === 0) return () => "50%";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(5, (max - min) * 0.04);
  const low = min - pad;
  const high = max + pad;
  const span = high - low || 1;

  return (price) => `${((high - price) / span) * 100}%`;
}

function renderLevelMap(containerId, context, options = {}) {
  const levelsSource = asArray(context.levels);
  const zonesSource = asArray(context.monetization_zones);
  if (levelsSource.length === 0) {
    setHtml(containerId, `<div class="map-empty">No levels in this scope</div>`);
    return;
  }

  const topForPrice = createPriceScaler(context);
  const maxStrength = Math.max(1, ...levelsSource.map(levelStrength));

  const zones = zonesSource
    .map((zone) => {
      const top = Number.parseFloat(topForPrice(zone.high));
      const bottom = Number.parseFloat(topForPrice(zone.low));
      const style = ZONE_STYLES[zone.type] ?? ZONE_STYLES.pin_decay;
      const label = compactZoneLabel(zone.type);

      return `
        <div class="zone" style="top:${top}%;height:${Math.max(3, bottom - top)}%;border-color:${style.border};background:${style.background};color:${style.color}">
          <span class="zone-label">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  const levels = [...levelsSource]
    .sort((a, b) => b.price - a.price)
    .map((level) => {
      const major = asArray(level.role).some((role) => ["main_pivot", "reclaim_support", "call_supply", "inventory_center"].includes(role));
      const width = `${levelBarWidth(level, maxStrength)}%`;
      const linkedCount = getLinkedStructureIds(appState.data, level, context).size;
      const selected = selectedKey() === levelKey(level.id, options.sliceId ?? null);

      return `
        <div class="lvl clickable ${major ? "major" : ""} ${selected ? "selected" : ""}" data-level-id="${escapeHtml(level.id)}" data-slice-id="${escapeHtml(options.sliceId ?? "")}" style="top:${topForPrice(level.price)}">
          <span class="strike">${escapeHtml(`${level.label} - ${formatPrice(level.price)}`)}<span class="linked-count">${linkedCount} str</span></span>
          <div class="bar" style="width:${width};background:${cssVar(chooseRoleColor(level))}"></div>
        </div>
      `;
    })
    .join("");

  setHtml(
    containerId,
    `
      <div class="axis"></div>
      ${zones}
      ${levels}
      ${typeof context.reference_price === "number" ? `<div class="spotline reference" style="top:${topForPrice(context.reference_price)}"></div><div class="spotlabel reference" style="top:${topForPrice(context.reference_price)}">REF</div>` : ""}
      ${typeof context.market_state?.spot === "number" ? `<div class="spotline" style="top:${topForPrice(context.market_state.spot)}"></div><div class="spotlabel" style="top:${topForPrice(context.market_state.spot)}">SPOT</div>` : ""}
    `,
  );

  byId(containerId).querySelectorAll(".lvl.clickable").forEach((levelEl) => {
    levelEl.addEventListener("click", () => setSelectedLevel(levelEl.dataset.levelId, levelEl.dataset.sliceId || null));
  });
}

function timelineShellHtml() {
  return `
    <div class="chartbox spotbox">
      <div class="chart-title"><span id="spotChartTitle"></span><span id="spotChartRange"></span></div>
      <svg id="spotChart" viewBox="0 0 900 180" preserveAspectRatio="none"></svg>
    </div>

    <div class="chartbox flowbox">
      <div class="chart-title"><span id="flowChartTitle"></span><span id="flowChartLegend"></span></div>
      <svg id="flowChart" viewBox="0 0 900 135" preserveAspectRatio="none"></svg>
    </div>

    <div class="chartbox sessionbox summary">
      <div class="eyebrow">Session state</div>
      <div class="summary-lines" id="sessionSummary"></div>
    </div>
  `;
}

function formatSliceSubtitle(slice) {
  const pieces = [
    formatDateLabel(slice.expiration),
    typeof slice.dte === "number" ? `${slice.dte} DTE` : null,
    typeof slice.forward === "number" ? `FWD ${formatPrice(slice.forward)}` : null,
    typeof slice.reference_price === "number" ? `REF ${formatPrice(slice.reference_price)}` : null,
  ].filter(Boolean);
  return pieces.join(" / ");
}

function renderExpirationBlocks(data) {
  setText("timelineTitle", "EXPIRATION LEVELS");
  setText("timelineSubtitle", `${data.expiration_slices.length} expiry slices`);
  setHtml(
    "timelinePanel",
    data.expiration_slices
      .map((slice, index) => {
        const mapId = `expiryMap-${index}`;
        const subtitle = formatSliceSubtitle(slice);
        const summary = slice.summary?.headline ?? slice.summary?.key_points?.[0] ?? "";
        return `
          <div class="expiry-block">
            <div class="expiry-head">
              <div>
                <div class="expiry-name">${escapeHtml(slice.label ?? slice.id ?? `Expiry ${index + 1}`)}</div>
                <div class="expiry-meta">${escapeHtml(subtitle)}</div>
              </div>
              <div class="expiry-count">${escapeHtml(asArray(slice.levels).length)} lvls</div>
            </div>
            <div class="levelmap expiry-vertical" id="${mapId}"></div>
            ${summary ? `<div class="expiry-summary">${escapeHtml(summary)}</div>` : ""}
          </div>
        `;
      })
      .join(""),
  );

  data.expiration_slices.forEach((slice, index) => {
    const reference_price = slice.reference_price ?? slice.forward;
    renderLevelMap(`expiryMap-${index}`, { ...slice, market_state: data.market_state, reference_price }, { sliceId: slice.id });
  });
}

function renderTimelineMode(data) {
  byId("mainGrid")?.classList.toggle("multi-expiry", isMultiExpiry(data));
  byId("timelineSection")?.classList.toggle("expiry-strip", isMultiExpiry(data));

  if (isMultiExpiry(data)) {
    renderExpirationBlocks(data);
    return;
  }

  setText("timelineTitle", "FLOW TIMELINE");
  setHtml("timelinePanel", timelineShellHtml());
  renderSessionSummary(data);
  renderTimeline(data);
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function netFlowValue(bucket, side) {
  const value = bucket?.[side]?.net;
  return isFiniteNumber(value) ? value : 0;
}

function renderSpotChart(data) {
  const timeline = asArray(data.flow_timeline).filter(
    (bucket) => isFiniteNumber(bucket.spot_close) && isFiniteNumber(bucket.spot_low) && isFiniteNumber(bucket.spot_high),
  );
  if (timeline.length === 0) {
    const spot = isFiniteNumber(data.market_state?.spot) ? data.market_state.spot : null;
    const pivot = isFiniteNumber(data.market_state?.main_pivot) ? data.market_state.main_pivot : null;
    const range = [spot, pivot].filter(isFiniteNumber);
    const min = range.length ? Math.min(...range) : 0;
    const max = range.length ? Math.max(...range) : 1;
    const span = max - min || 1;
    const y = spot === null ? 90 : Math.round(180 - ((spot - min) / span) * 150 - 15);
    const pivotY = pivot === null ? null : Math.round(180 - ((pivot - min) / span) * 150 - 15);

    setText("timelineSubtitle", "price + classified option flow");
    setText("spotChartTitle", `${data.session.underlying} spot`);
    setText("spotChartRange", spot === null ? "no timeline" : `${spot.toFixed(0)} current`);
    setHtml(
      "spotChart",
      `
        <g stroke="#1c2c39" stroke-width="1">
          <line x1="0" y1="30" x2="900" y2="30"/><line x1="0" y1="75" x2="900" y2="75"/>
          <line x1="0" y1="120" x2="900" y2="120"/><line x1="0" y1="165" x2="900" y2="165"/>
        </g>
        ${pivotY === null ? "" : `<line x1="0" y1="${pivotY}" x2="900" y2="${pivotY}" stroke="#63b3ed" stroke-dasharray="5 5" opacity=".65"/>`}
        ${spot === null ? "" : `<line x1="0" y1="${y}" x2="900" y2="${y}" stroke="#4fd1c5" stroke-width="3" opacity=".8"/>`}
        <text x="450" y="92" text-anchor="middle" fill="#71869a" font-size="11">No intraday timeline in this snapshot</text>
      `,
    );
    return;
  }

  const closes = timeline.map((bucket) => bucket.spot_close);
  const lows = timeline.map((bucket) => bucket.spot_low);
  const highs = timeline.map((bucket) => bucket.spot_high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || 1;
  const width = 900;
  const height = 180;
  const xStep = width / (timeline.length - 1 || 1);
  const points = closes.map((close, index) => ({
    x: Math.round(index * xStep),
    y: Math.round(height - ((close - min) / span) * 150 - 15),
  }));
  const linePath = buildLinePath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const eventIndex = timeline.findIndex((bucket) => bucket.events.length > 0 && bucket.events[0].includes("rejection"));
  const eventPoint = points[eventIndex >= 0 ? eventIndex : Math.floor(points.length / 2)];

  setText("timelineSubtitle", "price + classified option flow");
  setText("spotChartTitle", `${data.session.underlying} spot`);
  setText("spotChartRange", `${Math.round(min)} → ${Math.round(max)} → ${data.market_state.spot.toFixed(0)}`);
  setHtml(
    "spotChart",
    `
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4fd1c5" stop-opacity=".22"/>
          <stop offset="100%" stop-color="#4fd1c5" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g stroke="#1c2c39" stroke-width="1">
        <line x1="0" y1="30" x2="900" y2="30"/><line x1="0" y1="75" x2="900" y2="75"/>
        <line x1="0" y1="120" x2="900" y2="120"/><line x1="0" y1="165" x2="900" y2="165"/>
      </g>
      <path d="${areaPath}" fill="url(#area)"/>
      <path d="${linePath}" fill="none" stroke="#4fd1c5" stroke-width="3"/>
      <line x1="0" y1="${height - ((data.market_state.main_pivot - min) / span) * 150 - 15}" x2="900" y2="${height - ((data.market_state.main_pivot - min) / span) * 150 - 15}" stroke="#63b3ed" stroke-dasharray="5 5" opacity=".65"/>
      <text x="8" y="${height - ((data.market_state.main_pivot - min) / span) * 150 - 20}" fill="#63b3ed" font-size="10">${data.market_state.main_pivot} pin</text>
      <circle cx="${eventPoint.x}" cy="${eventPoint.y}" r="5" fill="#fc8181"/>
      <text x="${eventPoint.x + 10}" y="${eventPoint.y - 2}" fill="#d8a0a0" font-size="10">rejection / reclaim</text>
    `,
  );
}

function renderFlowChart(data) {
  const timeline = asArray(data.flow_timeline);
  if (timeline.length === 0) {
    setText("flowChartTitle", "Net premium by interval");
    setText("flowChartLegend", "no timeline");
    setHtml(
      "flowChart",
      `
        <line x1="0" y1="68" x2="900" y2="68" stroke="#34495c"/>
        <text x="450" y="73" text-anchor="middle" fill="#71869a" font-size="11">No flow intervals in this snapshot</text>
      `,
    );
    return;
  }

  const maxAbs = Math.max(1, ...timeline.flatMap((bucket) => [Math.abs(netFlowValue(bucket, "calls")), Math.abs(netFlowValue(bucket, "puts"))]));
  const zeroY = 68;
  const groupWidth = 900 / timeline.length;
  const gap = Math.min(8, groupWidth * 0.12);
  const barWidth = Math.max(6, Math.min(46, (groupWidth - gap * 3) / 2));
  const bars = timeline
    .flatMap((bucket, index) => {
      const baseX = index * groupWidth + gap;
      const callNet = netFlowValue(bucket, "calls");
      const putNet = netFlowValue(bucket, "puts");
      const values = [
        { value: callNet, fill: callNet >= 0 ? "#68d391" : "#fc8181", offset: 0 },
        { value: putNet, fill: putNet >= 0 ? "#b794f4" : "#fc8181", offset: barWidth + gap },
      ];

      return values.map((bar) => {
        const height = Math.max(7, (Math.abs(bar.value) / maxAbs) * 55);
        const y = bar.value >= 0 ? zeroY - height : zeroY;
        return `<rect x="${Math.round(baseX + bar.offset)}" y="${Math.round(y)}" width="${Math.round(barWidth)}" height="${Math.round(height)}" fill="${bar.fill}"/>`;
      });
    })
    .join("");

  const labels = timeline
    .map((bucket, index) => {
      const label = index === 0 ? "open" : index === timeline.length - 1 ? "now" : new Date(bucket.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      return `<text x="${Math.round(index * groupWidth + gap)}" y="122" fill="#71869a" font-size="9">${escapeHtml(label)}</text>`;
    })
    .join("");

  setText("flowChartTitle", "Net premium by interval");
  setText("flowChartLegend", "calls / puts");
  setHtml(
    "flowChart",
    `
      <line x1="0" y1="${zeroY}" x2="900" y2="${zeroY}" stroke="#34495c"/>
      <g opacity=".92">${bars}</g>
      ${labels}
    `,
  );
}

function renderTimeline(data) {
  renderSpotChart(data);
  renderFlowChart(data);
}

function formatLeg(leg) {
  if (!leg || typeof leg !== "object") return "LEG";
  const side = leg.side ? String(leg.side).toUpperCase() : "LEG";
  const type = leg.option_type === "call" ? "C" : leg.option_type === "put" ? "P" : "";
  const contracts = typeof leg.contracts === "number" ? `${leg.contracts}x ` : "";
  const strike = leg.strike ?? "";
  return `${side} ${contracts}${strike}${type}`.trim();
}

function renderBooks(data) {
  const selected = findSelectedLevel();
  const allStructures = [
    ...asArray(data.structures),
    ...asArray(data.expiration_slices).flatMap((slice) => asArray(slice.structures).map((structure) => ({ ...structure, expiry_label: slice.label }))),
  ];
  const linkedIds = selected ? getLinkedStructureIds(data, selected.level, selected.context) : null;
  const contextStructures = selected
    ? [...asArray(selected.context.structures), ...asArray(data.structures)]
    : allStructures;
  const structures = selected ? contextStructures.filter((structure) => linkedIds.has(structure.id)) : allStructures;

  setText("structuresLabel", selected ? `${structures.length} linked` : "interpreted");
  if (selected && structures.length === 0) {
    setHtml(
      "books",
      `
        <div class="structure-empty">
          <strong>No linked structures for selected level</strong>
          <span>${escapeHtml(selected.level.label)} - ${escapeHtml(formatPrice(selected.level.price))}</span>
        </div>
      `,
    );
    return;
  }

  setHtml(
    "books",
    structures
      .map(
        (book) => `
          <div class="book">
            <div class="bookhead"><div class="bookname">${escapeHtml(book.ui_title)}</div><div class="conf">${escapeHtml(confidenceLabel(book.confidence))}</div></div>
            <div class="legs">${asArray(book.legs).map(formatLeg).map(escapeHtml).join("<br>") || "No leg detail"}</div>
            <div class="meta">
              ${book.expiry_label ? `<span class="pill">${escapeHtml(book.expiry_label)}</span>` : ""}
              <span class="pill">${escapeHtml(titleCase(book.bias))}</span>
              <span class="pill">${escapeHtml(titleCase(book.type))}</span>
              <span class="pill">$${escapeHtml(compactMoney(book.gross_premium))}</span>
            </div>
            <div class="impact">${escapeHtml(book.interpretation)}</div>
          </div>
        `,
      )
      .join(""),
  );
  syncStructuresPanel();
}

function syncStructuresPanel() {
  const panel = byId("structuresPanel");
  const toggle = byId("structuresToggle");
  if (!panel) return;

  const drawerMode = isMultiExpiry(appState.data);
  const hiddenUntilSelection = drawerMode && !appState.selectedLevel;
  panel.classList.toggle("drawer-mode", drawerMode);
  panel.classList.toggle("awaiting-selection", hiddenUntilSelection);
  panel.classList.toggle("collapsed", drawerMode && appState.structuresCollapsed && !!appState.selectedLevel);
  if (toggle) {
    toggle.hidden = !drawerMode || hiddenUntilSelection;
    toggle.textContent = appState.structuresCollapsed ? "‹" : "›";
    toggle.setAttribute("aria-expanded", String(!appState.structuresCollapsed && !hiddenUntilSelection));
  }
}

function bindStructuresToggle() {
  const toggle = byId("structuresToggle");
  if (!toggle) return;
  toggle.onclick = () => {
    appState.structuresCollapsed = !appState.structuresCollapsed;
    syncStructuresPanel();
  };
}

function renderMonetization(data) {
  setText("monetizationLabel", "who benefits where?");
  setText("monetizationNote", data.summary.daily_note);
  const zones = asArray(data.monetization_zones).length
    ? asArray(data.monetization_zones)
    : asArray(data.expiration_slices).flatMap((slice) =>
        asArray(slice.monetization_zones).map((zone) => ({ ...zone, expiry_label: slice.label })),
      );
  setHtml(
    "monetization",
    zones
      .map(
        (zone) => `
          <div class="mz">
            <div class="range">${escapeHtml(`${zone.low}-${zone.high}`)}</div>
            <div class="desc">${zone.expiry_label ? `<strong>${escapeHtml(zone.expiry_label)}</strong> - ` : ""}${escapeHtml(zone.description)}</div>
            <div class="who">${escapeHtml(zone.beneficiaries.join(" / "))}</div>
          </div>
        `,
      )
      .join(""),
  );
}

function renderScenarios(data) {
  const colors = {
    bullish: "--green",
    mixed: "--cyan",
    bearish: "--red",
  };

  setText("scenariosLabel", "conditional");
  setText("scenariosNote", "A production version would make every strike clickable and let the time scrubber rebuild the map as-of any snapshot.");
  setHtml(
    "scenarios",
    data.scenarios
      .map(
        (scenario) => `
          <div class="scenario">
            <div class="label" style="color:${cssVar(colors[scenario.bias] ?? "--blue")}">${escapeHtml(scenario.name.toUpperCase())}</div>
            <div class="txt"><b>${escapeHtml(scenario.triggers[0]?.description ?? scenario.name)}</b> → ${escapeHtml(scenario.interpretation)}</div>
          </div>
        `,
      )
      .join(""),
  );
}

function bindSnapshotNav() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.category === appState.selectedCategory) return;
      selectCategory(button.dataset.category);
    });
  });

  document.querySelectorAll("[data-snapshot]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.snapshot === appState.selectedSnapshot) return;
      loadSnapshot(button.dataset.snapshot);
    });
  });
}

function render(data) {
  appState.data = data;
  renderHeader(data);
  renderControls();
  renderLevelMap("levelmap", data);
  renderTimelineMode(data);
  renderBooks(data);
  renderMonetization(data);
  renderScenarios(data);
  bindSnapshotNav();
  bindStructuresToggle();
  syncStructuresPanel();
}

async function loadSnapshot(snapshotPath) {
  const response = await fetch(`${DATA_ROOT}${snapshotPath}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${snapshotPath}: ${response.status}`);
  }
  appState.selectedSnapshot = snapshotPath;
  appState.selectedLevel = null;
  appState.structuresCollapsed = false;
  render(await response.json());
}

function selectCategory(category) {
  const snapshots = appState.index[category] ?? [];
  appState.selectedCategory = category;
  loadSnapshot(snapshots[snapshots.length - 1]);
}

async function main() {
  const response = await fetch(INDEX_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${INDEX_URL}: ${response.status}`);
  }

  appState.index = await response.json();
  const categories = Object.keys(appState.index);
  selectCategory(categories[0]);
}

main().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="load-error">Could not load dashboard data from ${escapeHtml(INDEX_URL)}.</div>`,
  );
});
