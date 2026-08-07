const DATA_URL = "./data/spx-flow-dashboard-v2.json";

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

function renderHeader(data) {
  setText("dashboardEyebrow", data.header.eyebrow);
  setText("dashboardTitle", data.header.title);
  setText("dashboardSubtitle", data.header.subtitle);
  setText("spotValue", data.header.spot.value);
  setText("spotState", data.header.spot.state);
  setText("statusBadge", data.header.status_badge);

  setHtml(
    "sessionSummary",
    data.header.summary
      .map((line) => `<strong>${escapeHtml(line.level)}</strong> — ${escapeHtml(line.text)}.`)
      .join("<br>"),
  );
}

function renderControls(data) {
  setHtml(
    "levelControls",
    data.level_map.controls
      .map((control, index) => `<button class="${index === 0 ? "active" : ""}">${escapeHtml(control)}</button>`)
      .join(""),
  );

  setHtml(
    "levelLegend",
    data.level_map.legend
      .map((item) => `<span><i style="background:var(${escapeHtml(item.color_var)})"></i>${escapeHtml(item.label)}</span>`)
      .join(""),
  );
}

function renderLevelMap(data) {
  const zones = data.level_map.zones
    .map(
      (zone) =>
        `<div class="zone" style="top:${zone.top};height:${zone.height};border-color:${zone.border_color};background:${zone.background};color:${zone.color}">${escapeHtml(zone.label)}</div>`,
    )
    .join("");

  const levels = data.level_map.levels
    .map(
      (level) => `
        <div class="lvl ${level.major ? "major" : ""}" style="top:${level.top}">
          <span class="strike">${escapeHtml(level.strike)}</span><div class="bar" style="width:${level.width};background:var(${escapeHtml(level.color_var)})"></div><span class="tag">${escapeHtml(level.tag)}</span>
        </div>
      `,
    )
    .join("");

  setHtml(
    "levelmap",
    `
      <div class="axis"></div>
      ${zones}
      ${levels}
      <div class="spotline" style="top:${data.level_map.spot.top}"></div>
      <div class="spotlabel" style="top:${data.level_map.spot.top}">${escapeHtml(data.level_map.spot.label)}</div>
    `,
  );
}

function renderSpotChart(chart) {
  setText("spotChartTitle", chart.title);
  setText("spotChartRange", chart.range_label);

  setHtml(
    "spotChart",
    `
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${chart.gradient.start_color}" stop-opacity="${chart.gradient.start_opacity}"/>
          <stop offset="100%" stop-color="${chart.gradient.end_color}" stop-opacity="${chart.gradient.end_opacity}"/>
        </linearGradient>
      </defs>
      <g stroke="#1c2c39" stroke-width="1">
        ${chart.grid_y.map((y) => `<line x1="0" y1="${y}" x2="900" y2="${y}"/>`).join("")}
      </g>
      <path d="${chart.area_path}" fill="url(#area)"/>
      <path d="${chart.line_path}" fill="none" stroke="${chart.line_color}" stroke-width="3"/>
      <line x1="0" y1="${chart.reference_line.y}" x2="900" y2="${chart.reference_line.y}" stroke="${chart.reference_line.color}" stroke-dasharray="5 5" opacity=".65"/>
      <text x="8" y="${chart.reference_line.label_y}" fill="${chart.reference_line.color}" font-size="10">${escapeHtml(chart.reference_line.label)}</text>
      <circle cx="${chart.event.x}" cy="${chart.event.y}" r="5" fill="${chart.event.color}"/>
      <text x="${chart.event.label_x}" y="${chart.event.label_y}" fill="${chart.event.label_color}" font-size="10">${escapeHtml(chart.event.label)}</text>
    `,
  );
}

function renderFlowChart(chart) {
  setText("flowChartTitle", chart.title);
  setText("flowChartLegend", chart.legend);

  setHtml(
    "flowChart",
    `
      <line x1="0" y1="${chart.zero_line_y}" x2="900" y2="${chart.zero_line_y}" stroke="#34495c"/>
      <g opacity=".92">
        ${chart.bars
          .map((bar) => `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${bar.fill}"/>`)
          .join("")}
      </g>
      ${chart.labels
        .map((label) => `<text x="${label.x}" y="${label.y}" fill="#71869a" font-size="9">${escapeHtml(label.text)}</text>`)
        .join("")}
    `,
  );
}

function renderRegimes(data) {
  setText("regimeTitle", data.regimes.title);
  setText("regimeSubtitle", data.regimes.subtitle);
  setHtml(
    "regimes",
    data.regimes.items
      .map((item) => `<div class="regime" style="background:${item.background};color:${item.color}">${escapeHtml(item.label)}</div>`)
      .join(""),
  );
}

function renderTimeline(data) {
  setText("timelineSubtitle", data.timeline.subtitle);
  renderSpotChart(data.timeline.spot_chart);
  renderFlowChart(data.timeline.flow_chart);
  renderRegimes(data.timeline);
}

function renderBooks(data) {
  setText("structuresLabel", data.structures.label);
  setHtml(
    "books",
    data.structures.items
      .map(
        (book) => `
          <div class="book">
            <div class="bookhead"><div class="bookname">${escapeHtml(book.name)}</div><div class="conf">${escapeHtml(book.confidence)}</div></div>
            <div class="legs">${book.legs.map(escapeHtml).join("<br>")}</div>
            <div class="meta">${book.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
            <div class="impact">${escapeHtml(book.impact)}</div>
          </div>
        `,
      )
      .join(""),
  );
}

function renderMonetization(data) {
  setText("monetizationLabel", data.monetization.label);
  setText("monetizationNote", data.monetization.note);
  setHtml(
    "monetization",
    data.monetization.items
      .map(
        (item) => `
          <div class="mz">
            <div class="range">${escapeHtml(item.range)}</div>
            <div class="desc">${escapeHtml(item.description)}</div>
            <div class="who">${escapeHtml(item.beneficiary)}</div>
          </div>
        `,
      )
      .join(""),
  );
}

function renderScenarios(data) {
  setText("scenariosLabel", data.scenarios.label);
  setText("scenariosNote", data.scenarios.note);
  setHtml(
    "scenarios",
    data.scenarios.items
      .map(
        (scenario) => `
          <div class="scenario">
            <div class="label" style="color:var(${escapeHtml(scenario.color_var)})">${escapeHtml(scenario.label)}</div>
            <div class="txt"><b>${escapeHtml(scenario.trigger)}</b> ${escapeHtml(scenario.text)}</div>
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
    });
  });
}

function render(data) {
  renderHeader(data);
  renderControls(data);
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
