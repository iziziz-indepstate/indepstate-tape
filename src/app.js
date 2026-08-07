const DATA_URL = "./data/spx-flow-dashboard-v2.json";

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
};

const REGIME_STYLES = [
  { background: "rgba(246,200,95,.12)", color: "#e5cc83" },
  { background: "rgba(252,129,129,.10)", color: "#e3a0a0" },
  { background: "rgba(104,211,145,.11)", color: "#a1ddb2" },
  { background: "rgba(79,209,197,.11)", color: "#8edfd7" },
  { background: "rgba(183,148,244,.11)", color: "#c9b3ee" },
];

const appState = {
  data: null,
  selectedLevelId: null,
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
  byId(id).textContent = value ?? "";
}

function setHtml(id, value) {
  byId(id).innerHTML = value ?? "";
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

function levelBarWidth(level, maxStrength) {
  return Math.max(28, (level.strength / maxStrength) * 94);
}

function compactZoneLabel(type) {
  const labels = {
    upside_monetization: "Upside",
    call_supply_monetization: "Call Supply",
    pin_decay: "Pin Zone",
    put_protection_activation: "Put Protection",
    downside_convexity: "Downside",
    complex_inventory_zone: "Complex Zone",
  };

  return labels[type] ?? titleCase(type);
}

function confidenceLabel(value) {
  return `${String(value).toUpperCase()} CONF`;
}

function chooseRoleColor(level) {
  const role = level.role.find((item) => ROLE_COLORS[item]);
  return ROLE_COLORS[role] ?? "--blue";
}

function getLinkedStructureIds(data, level) {
  const ids = new Set(level.evidence?.structure_ids ?? []);
  data.monetization_zones
    .filter((zone) => (zone.source_level_ids ?? []).includes(level.id))
    .flatMap((zone) => zone.source_structure_ids ?? [])
    .forEach((id) => ids.add(id));

  return ids;
}

function findSelectedLevel() {
  return appState.data?.levels.find((level) => level.id === appState.selectedLevelId) ?? null;
}

function syncControls() {
  document.querySelectorAll("[data-control]").forEach((button) => {
    button.classList.toggle("active", button.dataset.control === "all" && !appState.selectedLevelId);
  });
}

function setSelectedLevel(levelId) {
  appState.selectedLevelId = appState.selectedLevelId === levelId ? null : levelId;
  syncControls();
  renderLevelMap(appState.data);
  renderBooks(appState.data);
}

function formatSessionScope(scope) {
  return String(scope).replaceAll("_", " + ").toUpperCase();
}

function renderHeader(data) {
  const date = new Date(`${data.session.expiration}T00:00:00Z`);
  const displayDate = date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).toUpperCase();

  setText("dashboardEyebrow", `0DTE Option Flow / Session Map · v${data.schema_version}`);
  setText("dashboardTitle", `${data.session.underlying} · ${displayDate}`);
  setText(
    "dashboardSubtitle",
    `Visible tape · premium ≥ $${compactMoney(data.session.premium_filter_usd)} · ${formatSessionScope(data.session.session_scope)}`,
  );
  setText("spotValue", data.market_state.spot.toFixed(1));
  const spotChange = data.market_state.spot_change_from_previous_snapshot;
  setText("spotState", typeof spotChange === "number" ? (spotChange >= 0 ? "▲ reclaim" : "▼ loss") : "snapshot");
  setText("statusBadge", `${titleCase(data.market_state.regime)} / ${titleCase(data.market_state.bias)}`.toUpperCase());

  const summaryHtml = data.summary.key_points
    .map((point) => {
      const match = point.match(/^([^ ]+)/);
      const leading = match ? match[1] : "";
      const rest = leading ? point.slice(leading.length).trim() : point;
      return leading ? `<strong>${escapeHtml(leading)}</strong> — ${escapeHtml(rest)}.` : escapeHtml(point);
    })
    .join("<br>");

  setHtml("sessionSummary", summaryHtml);
}

function renderControls() {
  const controls = ["All", "Near spot", "Ex-complex"];
  const legend = [
    ["--cyan", "pin/pivot"],
    ["--red", "supply"],
    ["--green", "demand/support"],
    ["--purple", "vol/complex"],
  ];

  setHtml(
    "levelControls",
    controls
      .map(
        (control, index) =>
          `<button type="button" data-control="${escapeHtml(control.toLowerCase().replaceAll(" ", "-"))}" class="${index === 0 && !appState.selectedLevelId ? "active" : ""}">${escapeHtml(control)}</button>`,
      )
      .join(""),
  );
  setHtml(
    "levelLegend",
    legend.map(([color, label]) => `<span><i style="background:${cssVar(color)}"></i>${escapeHtml(label)}</span>`).join(""),
  );
}

function createPriceScaler(data) {
  const prices = [
    data.market_state.spot,
    ...data.levels.flatMap((level) => [level.price, level.range_low, level.range_high]),
    ...data.monetization_zones.flatMap((zone) => [zone.low, zone.high]),
  ].filter((value) => typeof value === "number");

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(5, (max - min) * 0.04);
  const low = min - pad;
  const high = max + pad;
  const span = high - low || 1;

  return (price) => `${((high - price) / span) * 100}%`;
}

function renderLevelMap(data) {
  const topForPrice = createPriceScaler(data);
  const maxStrength = Math.max(...data.levels.map((level) => level.strength));

  const zones = data.monetization_zones
    .map((zone) => {
      const top = Number.parseFloat(topForPrice(zone.high));
      const bottom = Number.parseFloat(topForPrice(zone.low));
      const style = ZONE_STYLES[zone.type] ?? ZONE_STYLES.pin_decay;
      const levelsInsideZone = data.levels.filter(
        (level) => (level.range_high ?? level.price) >= zone.low && (level.range_low ?? level.price) <= zone.high,
      );
      const maxBarWidth = levelsInsideZone.length
        ? Math.max(...levelsInsideZone.map((level) => levelBarWidth(level, maxStrength)))
        : 0;
      const freeSpace = 100 - maxBarWidth;
      const labelLeft = freeSpace >= 34 ? maxBarWidth + 3 : 62;
      const label = freeSpace >= 34 ? titleCase(zone.type) : compactZoneLabel(zone.type);
      const fontSize = freeSpace >= 34 ? 9 : 7.5;
      const labelClass = freeSpace >= 34 ? "zone-label" : "zone-label compact";

      return `
        <div class="zone" style="top:${top}%;height:${Math.max(3, bottom - top)}%;border-color:${style.border};background:${style.background};color:${style.color}">
          <span class="${labelClass}" style="left:${labelLeft}%;font-size:${fontSize}px">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  const levels = [...data.levels]
    .sort((a, b) => b.price - a.price)
    .map((level) => {
      const major = level.role.some((role) => ["main_pivot", "reclaim_support", "call_supply", "inventory_center"].includes(role));
      const width = `${levelBarWidth(level, maxStrength)}%`;
      const linkedCount = getLinkedStructureIds(data, level).size;
      const selected = appState.selectedLevelId === level.id;

      return `
        <div class="lvl clickable ${major ? "major" : ""} ${selected ? "selected" : ""}" data-level-id="${escapeHtml(level.id)}" style="top:${topForPrice(level.price)}">
          <span class="strike">${escapeHtml(`${level.label} - ${formatPrice(level.price)}`)}<span class="linked-count">${linkedCount} str</span></span>
          <div class="bar" style="width:${width};background:${cssVar(chooseRoleColor(level))}"></div>
        </div>
      `;
    })
    .join("");

  setHtml(
    "levelmap",
    `
      <div class="axis"></div>
      ${zones}
      ${levels}
      <div class="spotline" style="top:${topForPrice(data.market_state.spot)}"></div>
      <div class="spotlabel" style="top:${topForPrice(data.market_state.spot)}">SPOT</div>
    `,
  );

  byId("levelmap").querySelectorAll(".lvl.clickable").forEach((levelEl) => {
    levelEl.addEventListener("click", () => setSelectedLevel(levelEl.dataset.levelId));
  });
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function renderSpotChart(data) {
  const timeline = data.flow_timeline;
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
  const timeline = data.flow_timeline;
  const maxAbs = Math.max(...timeline.flatMap((bucket) => [Math.abs(bucket.calls.net), Math.abs(bucket.puts.net)]));
  const zeroY = 68;
  const groupWidth = 900 / timeline.length;
  const gap = Math.min(8, groupWidth * 0.12);
  const barWidth = Math.max(6, Math.min(46, (groupWidth - gap * 3) / 2));
  const bars = timeline
    .flatMap((bucket, index) => {
      const baseX = index * groupWidth + gap;
      const values = [
        { value: bucket.calls.net, fill: bucket.calls.net >= 0 ? "#68d391" : "#fc8181", offset: 0 },
        { value: bucket.puts.net, fill: bucket.puts.net >= 0 ? "#b794f4" : "#fc8181", offset: barWidth + gap },
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

function renderRegimes(data) {
  setText("regimeTitle", "Regime strip");
  setText("regimeSubtitle", "interpretation, not prediction");
  setHtml(
    "regimes",
    data.flow_timeline
      .map((bucket, index) => {
        const style = REGIME_STYLES[index % REGIME_STYLES.length];
        return `<div class="regime" style="background:${style.background};color:${style.color}">${escapeHtml(bucket.regime)}</div>`;
      })
      .join(""),
  );
}

function renderTimeline(data) {
  renderSpotChart(data);
  renderFlowChart(data);
  renderRegimes(data);
}

function formatLeg(leg) {
  const side = leg.side.toUpperCase();
  const type = leg.option_type === "call" ? "C" : "P";
  return `${side} ${leg.contracts}x ${leg.strike}${type}`;
}

function renderBooks(data) {
  const selectedLevel = findSelectedLevel();
  const linkedIds = selectedLevel ? getLinkedStructureIds(data, selectedLevel) : null;
  const structures = selectedLevel ? data.structures.filter((structure) => linkedIds.has(structure.id)) : data.structures;

  setText("structuresLabel", selectedLevel ? `${structures.length} linked` : "interpreted");
  if (selectedLevel && structures.length === 0) {
    setHtml(
      "books",
      `
        <div class="structure-empty">
          <strong>No linked structures for selected level</strong>
          <span>${escapeHtml(selectedLevel.label)} - ${escapeHtml(formatPrice(selectedLevel.price))}</span>
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
            <div class="legs">${book.legs.map(formatLeg).map(escapeHtml).join("<br>")}</div>
            <div class="meta">
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
}

function renderMonetization(data) {
  setText("monetizationLabel", "who benefits where?");
  setText("monetizationNote", data.summary.daily_note);
  setHtml(
    "monetization",
    data.monetization_zones
      .map(
        (zone) => `
          <div class="mz">
            <div class="range">${escapeHtml(`${zone.low}-${zone.high}`)}</div>
            <div class="desc">${escapeHtml(zone.description)}</div>
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

function bindControls() {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      if (button.dataset.control === "all") {
        appState.selectedLevelId = null;
        syncControls();
        renderLevelMap(appState.data);
        renderBooks(appState.data);
      }
    });
  });
}

function render(data) {
  appState.data = data;
  renderHeader(data);
  renderControls();
  renderLevelMap(data);
  renderTimeline(data);
  renderBooks(data);
  renderMonetization(data);
  renderScenarios(data);
  bindControls();
}

async function main() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
  }
  render(await response.json());
}

main().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="load-error">Could not load dashboard data from ${escapeHtml(DATA_URL)}.</div>`,
  );
});
