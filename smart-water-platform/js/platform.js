import {
  dispatchData,
  energyScenarios,
  governanceData,
  hours,
  layerDefinitions,
  overviewData,
  statusDefinitions,
  waterNetworkNodes,
} from "./platform-data.js";

export function createInitialState() {
  return {
    visibleLayers: Object.fromEntries(layerDefinitions.map((layer) => [layer.id, true])),
    selectedType: "all",
    selectedStatus: "all",
    selectedNodeId: waterNetworkNodes[0].id,
    scenarioId: "dry",
  };
}

export function filterWaterNodes(nodes, state) {
  return nodes.filter((node) => {
    const layerMatches = state.visibleLayers[node.layer] !== false;
    const typeMatches = state.selectedType === "all" || node.type === state.selectedType;
    const statusMatches = state.selectedStatus === "all" || node.status === state.selectedStatus;
    return layerMatches && typeMatches && statusMatches;
  });
}

export function summarizeWaterNodesByStatus(nodes) {
  return nodes.reduce(
    (summary, node) => {
      summary[node.status] = (summary[node.status] ?? 0) + 1;
      return summary;
    },
    { normal: 0, watch: 0, warning: 0, dispatching: 0 }
  );
}

export function getScenario(id) {
  return energyScenarios[id] ?? energyScenarios.dry;
}

const typeOptions = [
  ["all", "全部对象"],
  ["reservoir", "水库"],
  ["pump", "泵站"],
  ["gate", "闸门"],
  ["section", "监测断面"],
  ["energy", "能源站点"],
  ["load", "负荷中心"],
];

const statusOptions = [
  ["all", "全部状态"],
  ...Object.entries(statusDefinitions),
];

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function getNode(id) {
  return waterNetworkNodes.find((node) => node.id === id) ?? waterNetworkNodes[0];
}

function maxOf(...series) {
  return Math.max(...series.flat(), 1);
}

function linePoints(values, width, height, maxValue) {
  if (!values.length) return "";
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function smallLineChart(values, labels, color, title, unit = "") {
  const width = 520;
  const height = 210;
  const pad = 32;
  const maxValue = maxOf(values) * 1.15;
  const points = linePoints(values, width - pad * 2, height - pad * 2, maxValue)
    .split(" ")
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return `${x + pad},${y + pad}`;
    })
    .join(" ");

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
      <text x="${pad}" y="22" class="chart-title">${title}</text>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="axis"></line>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="axis"></line>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${values
        .map((value, index) => {
          const x = pad + ((width - pad * 2) / (values.length - 1)) * index;
          const y = pad + (height - pad * 2) - (value / maxValue) * (height - pad * 2);
          return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${labels[index]} ${value}${unit}</title></circle>`;
        })
        .join("")}
    </svg>
  `;
}

function groupedBars(labels, before, after, title) {
  const width = 520;
  const height = 230;
  const pad = 36;
  const maxValue = maxOf(before, after) * 1.2;
  const slot = (width - pad * 2) / labels.length;
  const barWidth = Math.min(28, slot / 4);

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
      <text x="${pad}" y="22" class="chart-title">${title}</text>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="axis"></line>
      ${labels
        .map((label, index) => {
          const x = pad + slot * index + slot / 2;
          const h1 = (before[index] / maxValue) * (height - pad * 2);
          const h2 = (after[index] / maxValue) * (height - pad * 2);
          return `
            <rect x="${x - barWidth - 3}" y="${height - pad - h1}" width="${barWidth}" height="${h1}" rx="4" class="bar-before"></rect>
            <rect x="${x + 3}" y="${height - pad - h2}" width="${barWidth}" height="${h2}" rx="4" class="bar-after"></rect>
            <text x="${x}" y="${height - 10}" text-anchor="middle" class="axis-label">${label}</text>
          `;
        })
        .join("")}
      <g class="chart-legend" transform="translate(${width - 190},20)">
        <rect width="10" height="10" class="bar-before"></rect><text x="16" y="10">调度前</text>
        <rect x="82" width="10" height="10" class="bar-after"></rect><text x="98" y="10">调度后</text>
      </g>
    </svg>
  `;
}

function dispatchRadarChart() {
  const width = 520;
  const height = 280;
  const centerX = width / 2;
  const centerY = 145;
  const maxR = 96;
  const axes = [
    ["供水保证率(%)", -90, 100],
    ["越限风险点(个)", 30, 20],
    ["缺水量(万m3)", 150, 20],
  ];
  const before = [91, 5, 18];
  const after = [96, 2, 7];
  const point = (value, angle, max) => {
    const rad = (Math.PI / 180) * angle;
    const r = Math.min(maxR, (value / max) * maxR);
    return [centerX + Math.cos(rad) * r, centerY + Math.sin(rad) * r];
  };
  const polygon = (values) =>
    values
      .map((value, index) => point(value, axes[index][1], axes[index][2]).map((n) => n.toFixed(1)).join(","))
      .join(" ");

  return `
    <svg class="chart-svg radar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="多目标联合调度前后综合效益评估">
      <text x="18" y="24" class="chart-title">多目标联合调度前后综合效益评估</text>
      ${[0.25, 0.5, 0.75, 1].map((scale) => {
        const pts = axes.map((axis) => point(axis[2] * scale, axis[1], axis[2]).map((n) => n.toFixed(1)).join(",")).join(" ");
        return `<polygon points="${pts}" fill="none" stroke="rgba(145,170,195,.28)" stroke-width="1"></polygon>`;
      }).join("")}
      ${axes.map(([label, angle, max]) => {
        const [x, y] = point(max, angle, max);
        return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" class="axis"></line><text x="${x}" y="${y - 10}" text-anchor="middle" class="axis-label">${label}</text>`;
      }).join("")}
      <polygon points="${polygon(before)}" fill="rgba(84,112,198,.25)" stroke="#5f7ee3" stroke-width="3"></polygon>
      <polygon points="${polygon(after)}" fill="rgba(145,204,117,.28)" stroke="#91cc75" stroke-width="3"></polygon>
      ${before.map((value, index) => {
        const [x, y] = point(value, axes[index][1], axes[index][2]);
        return `<circle cx="${x}" cy="${y}" r="5" fill="#5f7ee3"></circle>`;
      }).join("")}
      ${after.map((value, index) => {
        const [x, y] = point(value, axes[index][1], axes[index][2]);
        return `<circle cx="${x}" cy="${y}" r="5" fill="#91cc75"></circle>`;
      }).join("")}
      <g class="chart-legend" transform="translate(178,250)">
        <circle r="5" fill="#5f7ee3"></circle><text x="12" y="5">调度前</text>
        <circle cx="90" r="5" fill="#91cc75"></circle><text x="102" y="5">调度后</text>
      </g>
    </svg>
  `;
}

function renderOverview() {
  qs("[data-keywords]").innerHTML = overviewData.keywords.map((keyword) => `<span>${keyword}</span>`).join("");
  qs("[data-metrics]").innerHTML = overviewData.metrics
    .map((metric) => `<article><strong>${metric.value}<small>${metric.unit}</small></strong><span>${metric.label}</span></article>`)
    .join("");
  qs("[data-overview-cards]").innerHTML = overviewData.overviewCards
    .map((card) => `<article class="info-card"><span>${card.tag}</span><h3>${card.title}</h3><p>${card.text}</p></article>`)
    .join("");
  qs("[data-architecture]").innerHTML = overviewData.architecture
    .map(([title, text], index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><h3>${title}</h3><p>${text}</p></article>`)
    .join("");
}

function renderWaterControls(state, rerender) {
  qs("[data-layer-controls]").innerHTML = layerDefinitions
    .map(
      (layer) => `
      <label class="check-row">
        <input type="checkbox" value="${layer.id}" ${state.visibleLayers[layer.id] ? "checked" : ""}>
        <span><b>${layer.name}</b><small>${layer.description}</small></span>
      </label>`
    )
    .join("");
  qsa("[data-layer-controls] input").forEach((input) => {
    input.addEventListener("change", () => {
      state.visibleLayers[input.value] = input.checked;
      rerender();
    });
  });

  qs("[data-type-filter]").innerHTML = typeOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  qs("[data-status-filter]").innerHTML = statusOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  qs("[data-type-filter]").value = state.selectedType;
  qs("[data-status-filter]").value = state.selectedStatus;
  qs("[data-type-filter]").onchange = (event) => {
    state.selectedType = event.target.value;
    rerender();
  };
  qs("[data-status-filter]").onchange = (event) => {
    state.selectedStatus = event.target.value;
    rerender();
  };
}

function renderWaterMap(state, rerender) {
  const visible = new Set(filterWaterNodes(waterNetworkNodes, state).map((node) => node.id));
  qs("[data-map-nodes]").innerHTML = waterNetworkNodes
    .map(
      (node) => `
      <g class="water-node ${visible.has(node.id) ? "" : "is-hidden"} ${state.selectedNodeId === node.id ? "is-selected" : ""}" data-node="${node.id}" tabindex="0">
        <circle cx="${node.x}" cy="${node.y}" r="18" class="node-halo"></circle>
        <circle cx="${node.x}" cy="${node.y}" r="9" class="status-${node.status}"></circle>
        <text x="${node.x + 14}" y="${node.y - 10}">${node.name}</text>
      </g>`
    )
    .join("");
  qsa("[data-node]").forEach((nodeEl) => {
    nodeEl.addEventListener("click", () => {
      state.selectedNodeId = nodeEl.dataset.node;
      rerender();
    });
  });
}

function renderWaterDetail(state, rerender) {
  const node = getNode(state.selectedNodeId);
  qs("[data-water-detail]").innerHTML = `
    <div class="detail-heading">
      <div><span>${node.region}</span><h3>${node.name}</h3></div>
      <b class="pill status-${node.status}">${statusDefinitions[node.status]}</b>
    </div>
    <p>${node.summary}</p>
    <dl class="metric-list">
      ${Object.entries(node.metrics).map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("")}
    </dl>
    <div class="linked-case">关联场景：<strong>${node.scenario}</strong></div>
  `;

  const results = filterWaterNodes(waterNetworkNodes, state);
  qs("[data-water-count]").textContent = `${results.length} 个对象`;
  qs("[data-water-results]").innerHTML = results
    .map((item) => `<button data-locate="${item.id}"><i class="status-dot status-${item.status}"></i><b>${item.name}</b><span>${item.region}</span></button>`)
    .join("");
  qsa("[data-locate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedNodeId = button.dataset.locate;
      rerender();
    });
  });
}

function renderWaterSection(state) {
  const rerender = () => {
    renderWaterControls(state, rerender);
    renderWaterMap(state, rerender);
    renderWaterDetail(state, rerender);
  };
  rerender();
}

function renderGovernance() {
  qs("[data-quality]").innerHTML = governanceData.quality
    .map(([label, value, unit]) => `<article><span>${label}</span><strong>${value}</strong><small>${unit}</small></article>`)
    .join("");
  qs("[data-check-table]").innerHTML = governanceData.checkRows
    .map(([name, type, status, unit]) => `<tr><td>${name}</td><td>${type}</td><td><span class="state-tag">${status}</span></td><td>${unit}</td></tr>`)
    .join("");
  qs("[data-audit-flow]").innerHTML = governanceData.auditFlow.map((item) => `<span>${item}</span>`).join("");
  qs("[data-rectify-flow]").innerHTML = governanceData.rectificationFlow.map((item) => `<span>${item}</span>`).join("");
  qs("[data-todos]").innerHTML = governanceData.todos.map((task) => `<li>${task}</li>`).join("");
}

function renderDispatch() {
  qs("[data-reservoir-chart]").innerHTML = smallLineChart(dispatchData.reservoirStorage, dispatchData.months, "#38d6ff", "重点水库库容变化", "%");
  qs("[data-supply-chart]").innerHTML = groupedBars(dispatchData.months, dispatchData.demand, dispatchData.actual, "供水需求与实际供水对比");
  qs("[data-dispatch-radar-chart]").innerHTML = dispatchRadarChart();
  qs("[data-compare]").innerHTML = dispatchData.compare
    .map(
      ([label, before, after, unit]) => `
      <article>
        <h3>${label}</h3>
        <div class="compare-values"><span>调度前 ${before}${unit}</span><strong>调度后 ${after}${unit}</strong></div>
        <div class="progress"><i style="width:${Math.min(100, after)}%"></i></div>
      </article>`
    )
    .join("");
  qs("[data-advice]").innerHTML = dispatchData.advice.map((item) => `<li>${item}</li>`).join("");
}

function renderPowerChart(scenario) {
  const power = scenario.power;
  const supply = hours.map((_, index) => power.hydro[index] + power.thermal[index] + power.wind[index] + power.solar[index] + Math.max(power.storage[index], 0));
  const maxValue = maxOf(supply, power.load);
  const width = 760;
  const height = 300;
  const pad = 34;
  const draw = (values, color, widthValue = 3) => {
    const points = linePoints(values, width - pad * 2, height - pad * 2, maxValue)
      .split(" ")
      .map((point) => {
        const [x, y] = point.split(",").map(Number);
        return `${x + pad},${y + pad}`;
      })
      .join(" ");
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${widthValue}" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  };
  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="多能源出力与负荷匹配">
      <text x="${pad}" y="24" class="chart-title">多能源总出力与负荷匹配</text>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="axis"></line>
      ${draw(supply, "#6ee7b7", 4)}
      ${draw(power.load, "#ffce67", 3)}
      ${draw(power.hydro, "#38d6ff", 2)}
      ${draw(power.thermal, "#ff7a7a", 2)}
      <g class="chart-legend" transform="translate(${width - 330},22)">
        <circle r="5" fill="#6ee7b7"></circle><text x="10" y="5">总出力</text>
        <circle cx="80" r="5" fill="#ffce67"></circle><text x="90" y="5">负荷</text>
        <circle cx="150" r="5" fill="#38d6ff"></circle><text x="160" y="5">水电</text>
        <circle cx="220" r="5" fill="#ff7a7a"></circle><text x="230" y="5">火电</text>
      </g>
    </svg>`;
}

function renderPie(pie) {
  let start = 0;
  const colors = ["#38d6ff", "#ff7a7a", "#6ee7b7", "#ffce67", "#9b8cff"];
  const stops = pie
    .map(([, value], index) => {
      const end = start + value;
      const segment = `${colors[index]} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(", ");
  return `
    <div class="pie-wrap">
      <div class="pie" style="background: conic-gradient(${stops})"></div>
      <div class="pie-legend">${pie.map(([label, value], index) => `<span><i style="background:${colors[index]}"></i>${label} ${value}%</span>`).join("")}</div>
    </div>`;
}

function renderStorage(storage) {
  const width = 520;
  const height = 220;
  const pad = 30;
  const maxAbs = Math.max(...storage.map((value) => Math.abs(value)));
  const zeroY = height / 2;
  const barWidth = (width - pad * 2) / storage.length - 4;
  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="储能充放电">
      <text x="${pad}" y="22" class="chart-title">储能充放电状态</text>
      <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" class="axis"></line>
      ${storage
        .map((value, index) => {
          const x = pad + index * (barWidth + 4);
          const h = (Math.abs(value) / maxAbs) * 70;
          const y = value >= 0 ? zeroY - h : zeroY;
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="${value >= 0 ? "bar-after" : "bar-before"}"><title>${hours[index]} ${value}MW</title></rect>`;
        })
        .join("")}
    </svg>`;
}

function renderScheme(scenario) {
  const labels = ["供能稳定", "新能源消纳", "运行成本", "碳排放", "供水安全"];
  return groupedBars(labels, scenario.scheme.conventional, scenario.scheme.multiEnergy, "常规调度与多能协同方案对比");
}

const energyCharts = {};

function ensureEnergyCharts() {
  if (!window.echarts) return false;
  const ids = {
    power: "powerStackChart",
    pie: "energyPieChart",
    storage: "storageChart",
    scheme: "schemeCompareChart",
    radar: "radarChart",
  };

  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (!energyCharts[key]) energyCharts[key] = window.echarts.init(el);
  }
  return true;
}

function initEnergyCharts(scenario) {
  if (!ensureEnergyCharts()) return;

  const p = scenario.power;
  const totalSupply = hours.map((_, i) => p.hydro[i] + p.thermal[i] + p.wind[i] + p.solar[i] + Math.max(p.storage[i], 0));
  const textColor = "#c9def2";
  const gridLine = "rgba(255,255,255,0.08)";
  const labels = ["供能稳定", "新能源消纳", "运行成本", "碳排放", "供水安全"];

  energyCharts.power.setOption({
    tooltip: { trigger: "axis" },
    legend: {
      top: 4,
      textStyle: { color: textColor },
      data: ["水电", "火电", "风电", "光伏", "储能放电", "负荷需求", "总出力"],
    },
    grid: { left: 42, right: 28, top: 62, bottom: 36 },
    xAxis: { type: "category", data: hours, axisLabel: { color: "#9db8d4" } },
    yAxis: { type: "value", axisLabel: { color: "#9db8d4" }, splitLine: { lineStyle: { color: gridLine } } },
    series: [
      { name: "水电", type: "line", stack: "power", areaStyle: {}, smooth: true, data: p.hydro },
      { name: "火电", type: "line", stack: "power", areaStyle: {}, smooth: true, data: p.thermal },
      { name: "风电", type: "line", stack: "power", areaStyle: {}, smooth: true, data: p.wind },
      { name: "光伏", type: "line", stack: "power", areaStyle: {}, smooth: true, data: p.solar },
      { name: "储能放电", type: "line", stack: "power", areaStyle: {}, smooth: true, data: p.storage.map((v) => Math.max(v, 0)) },
      { name: "负荷需求", type: "line", smooth: true, symbol: "none", lineStyle: { width: 3 }, data: p.load },
      { name: "总出力", type: "line", smooth: true, symbol: "none", lineStyle: { type: "dashed", width: 2 }, data: totalSupply },
    ],
  });

  energyCharts.pie.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {d}%" },
    legend: { bottom: 0, textStyle: { color: textColor } },
    series: [{
      name: "能源结构",
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "44%"],
      label: { color: textColor, formatter: "{b}\\n{d}%" },
      data: scenario.pie.map(([name, value]) => ({ name, value })),
    }],
  });

  energyCharts.storage.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 38, right: 20, top: 30, bottom: 35 },
    xAxis: { type: "category", data: hours, axisLabel: { color: "#9db8d4" } },
    yAxis: { type: "value", axisLabel: { color: "#9db8d4" }, splitLine: { lineStyle: { color: gridLine } } },
    series: [{
      name: "储能功率",
      type: "bar",
      data: p.storage,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      markLine: { symbol: "none", lineStyle: { color: "rgba(255,255,255,0.32)" }, data: [{ yAxis: 0 }] },
    }],
  });

  energyCharts.scheme.setOption({
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: textColor } },
    grid: { left: 36, right: 16, top: 50, bottom: 40 },
    xAxis: { type: "category", data: labels, axisLabel: { color: "#9db8d4", interval: 0 } },
    yAxis: { type: "value", max: 100, axisLabel: { color: "#9db8d4" }, splitLine: { lineStyle: { color: gridLine } } },
    series: [
      { name: "常规调度", type: "bar", data: scenario.scheme.conventional },
      { name: "水网优先", type: "bar", data: scenario.scheme.waterFirst },
      { name: "多能协同", type: "bar", data: scenario.scheme.multiEnergy },
    ],
  });

  energyCharts.radar.setOption({
    tooltip: {},
    legend: { bottom: 0, textStyle: { color: textColor } },
    radar: {
      radius: "62%",
      indicator: labels.map((name) => ({ name, max: 100 })),
      axisName: { color: textColor },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      splitArea: { areaStyle: { color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"] } },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
    },
    series: [{
      type: "radar",
      data: [
        { name: "常规调度", value: scenario.scheme.conventional },
        { name: "多能协同", value: scenario.scheme.multiEnergy },
      ],
    }],
  });
}

function renderScenarioVisual(scenario) {
  const width = 760;
  const height = 300;
  const pad = 42;
  const timelineLabels = ["预报", "预警", "预演", "预案"];
  const maxRisk = 100;
  const line = linePoints(scenario.timeline, width * 0.52 - pad * 2, height - pad * 2, maxRisk)
    .split(" ")
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return `${x + pad},${y + pad}`;
    })
    .join(" ");
  const barAreaX = width * 0.58;
  const barAreaW = width * 0.37;
  const slot = barAreaW / scenario.outcomes.length;

  return `
    <div class="scenario-chart-heading">
      <div>
        <span>Scenario Visualization</span>
        <h3>四预过程风险演进与方案收益</h3>
      </div>
      <b>${scenario.name}</b>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${scenario.name} 四预图形推演">
      <text x="${pad}" y="24" class="chart-title">风险指数演进</text>
      <line x1="${pad}" y1="${height - pad}" x2="${width * 0.52 - pad}" y2="${height - pad}" class="axis"></line>
      <polyline points="${line}" fill="none" stroke="#ffce67" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${scenario.timeline
        .map((value, index) => {
          const x = pad + ((width * 0.52 - pad * 2) / (scenario.timeline.length - 1)) * index;
          const y = pad + (height - pad * 2) - (value / maxRisk) * (height - pad * 2);
          return `
            <circle cx="${x}" cy="${y}" r="6" fill="#ffce67"></circle>
            <text x="${x}" y="${height - 14}" text-anchor="middle" class="axis-label">${timelineLabels[index]}</text>
            <text x="${x}" y="${y - 12}" text-anchor="middle" class="axis-label">${value}</text>
          `;
        })
        .join("")}

      <text x="${barAreaX}" y="24" class="chart-title">推荐预案收益评分</text>
      <line x1="${barAreaX}" y1="${height - pad}" x2="${barAreaX + barAreaW}" y2="${height - pad}" class="axis"></line>
      ${scenario.outcomes
        .map(([label, value], index) => {
          const x = barAreaX + slot * index + slot * 0.22;
          const barW = slot * 0.52;
          const h = (value / 100) * (height - pad * 2);
          return `
            <rect x="${x}" y="${height - pad - h}" width="${barW}" height="${h}" rx="6" class="bar-after"></rect>
            <text x="${x + barW / 2}" y="${height - pad - h - 8}" text-anchor="middle" class="axis-label">${value}</text>
            <text x="${x + barW / 2}" y="${height - 14}" text-anchor="middle" class="axis-label">${label}</text>
          `;
        })
        .join("")}
    </svg>
  `;
}

function renderScenario(state) {
  const scenario = getScenario(state.scenarioId);
  qs("[data-energy-metrics]").innerHTML = scenario.metrics
    .map(([label, value, delta]) => `<article><span>${label}</span><strong>${value}</strong><small>${delta}</small></article>`)
    .join("");
  initEnergyCharts(scenario);
  qs("[data-scenario-tabs]").innerHTML = Object.entries(energyScenarios)
    .map(([id, item]) => `<button class="${id === state.scenarioId ? "active" : ""}" data-scenario="${id}">${item.name}</button>`)
    .join("");
  qs("[data-four-pre]").innerHTML = [
    ["01", "预报", scenario.fourPre.forecast],
    ["02", "预警", scenario.fourPre.warning],
    ["03", "预演", scenario.fourPre.rehearsal],
    ["04", "预案", scenario.fourPre.plan],
  ]
    .map(([num, title, text]) => `<article class="four-card"><span>${num}</span><h3>${title}</h3><p>${text}</p></article>`)
    .join("");
  qs("[data-scenario-chart]").innerHTML = renderScenarioVisual(scenario);
  qs("[data-recommend]").innerHTML = `<h3>${scenario.recommend[0]}</h3><p>${scenario.recommend[1]}</p><div>${scenario.recommend[2].map((item) => `<strong>${item}</strong>`).join("")}</div>`;
  qsa("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scenarioId = button.dataset.scenario;
      renderScenario(state);
    });
  });
  qs("[data-play]").onclick = () => {
    qsa(".four-card").forEach((card, index) => {
      card.classList.remove("active");
      setTimeout(() => card.classList.add("active"), index * 450);
      setTimeout(() => card.classList.remove("active"), index * 450 + 900);
    });
  };
}

function initNavigation() {
  const navToggle = qs("[data-nav-toggle]");
  const navMenu = qs("[data-nav-menu]");
  navToggle?.addEventListener("click", () => navMenu.classList.toggle("open"));
  qsa("[data-nav-menu] a").forEach((link) => {
    link.addEventListener("click", () => navMenu.classList.remove("open"));
  });
}

export function initPlatform(root = document) {
  const state = createInitialState();
  renderOverview();
  renderWaterSection(state);
  renderGovernance();
  renderDispatch();
  renderScenario(state);
  initNavigation();
}

if (typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => initPlatform(document));
}
