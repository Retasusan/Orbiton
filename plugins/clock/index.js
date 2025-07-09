import blessed from "blessed";
import cfonts from "cfonts";
import os from "os";
import contrib from "blessed-contrib";
import { getTheme } from "../../ui/theme.js";
import batteryLevel from "battery-level";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const theme = getTheme();
  const {
    font = "block",
    colors = ["green", "cyan", "red"],
    updateInterval = 100,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    format = "24h",
  } = options;

  const use12h = format === "12h";
  const clockHeight = Math.floor(rowSpan * 0.5);
  const contentHeight = rowSpan - clockHeight + 0.25;

  const clockBox = grid.set(row, col, clockHeight, colSpan, blessed.box, {
    label: "Clock",
    tags: true,
    border: { type: "line" },
    style: { border: { fg: "white" }, fg: theme.fg || "white" },
    padding: { left: 2, right: 2, bottom: 1 },
    align: "center",
  });

  const leftColSpan = Math.floor(colSpan * 0.5);
  const rightCol = col + leftColSpan;
  const rightColSpan = colSpan - leftColSpan;

  const cpuLine = grid.set(
    row + clockHeight,
    col,
    contentHeight,
    leftColSpan,
    contrib.line,
    {
      label: "Resource Usage (%)",
      showLegend: true,
      style: {
        text: "white",
        baseline: "black",
      },
      minY: 0,
      maxY: 125,
      wholeNumbersOnly: true,
    }
  );

  const infoBox = grid.set(
    row + clockHeight,
    rightCol,
    contentHeight,
    rightColSpan,
    blessed.box,
    {
      label: "Info",
      tags: true,
      border: { type: "line" },
      style: { fg: theme.fg || "white" },
      padding: { top: 1, left: 2, right: 2, bottom: 1 },
      scrollable: true,
    }
  );

  // ========== 状態 ==========

  const cpuHistory = Array(60).fill(0);
  const memHistory = Array(60).fill(0);
  const batHistory = Array(60).fill(null);

  let prevCpu = getCpuUsage();

  // ========== ヘルパー関数 ==========

  function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
    };
  }

  function getCpuPercent() {
    const currentCpu = getCpuUsage();
    const idleDiff = currentCpu.idle - prevCpu.idle;
    const totalDiff = currentCpu.total - prevCpu.total;
    prevCpu = currentCpu;
    if (totalDiff === 0) return 0;
    return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
  }

  function getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return Math.round((used / total) * 100);
  }

  async function getBatteryPercentage() {
    try {
      const level = await batteryLevel(); // 0〜1
      return Math.round(level * 100);
    } catch (e) {
      return null;
    }
  }

  async function updateMetrics() {
    const cpu = getCpuPercent();
    const mem = getMemoryUsage();
    const bat = await getBatteryPercentage();

    cpuHistory.push(cpu);
    memHistory.push(mem);
    batHistory.push(bat ?? null);

    if (cpuHistory.length > 60) cpuHistory.shift();
    if (memHistory.length > 60) memHistory.shift();
    if (batHistory.length > 60) batHistory.shift();

    const labels = Array.from({ length: 60 }, (_, i) => `${i - 59}s`);

    const data = [
      { title: "CPU", x: labels, y: cpuHistory, style: { line: "green" } },
      { title: "Memory", x: labels, y: memHistory, style: { line: "yellow" } },
    ];

    if (batHistory.some((v) => v !== null)) {
      data.push({
        title: "Battery",
        x: labels,
        y: batHistory.map((v) => v ?? 0),
        style: { line: "blue" },
      });
    }

    cpuLine.setData(data);
    cpuLine.screen.render();
  }

  async function updateTime() {
    const now = new Date();
    const timeStr = use12h
      ? now.toLocaleTimeString("en-US", { timeZone, hour12: true })
      : now.toLocaleTimeString("en-GB", { timeZone, hour12: false });

    const rendered = cfonts.render(timeStr, {
      font,
      colors,
      background: "transparent",
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      env: "node",
    });

    clockBox.setContent(rendered.string);

    const dateStr = now.toLocaleDateString("en-US", { timeZone });

    function formatUptime(seconds) {
      const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
      const s = String(Math.floor(seconds % 60)).padStart(2, "0");
      return `${h}:${m}:${s}`;
    }

    const nowUtc = new Date(now.toISOString());
    const nowIso = now.toISOString();
    const nowUnix = Math.floor(now.getTime() / 1000);
    const offsetMin = now.getTimezoneOffset();
    const offsetHour = -offsetMin / 60;
    const offsetStr = (offsetHour >= 0 ? "+" : "") + offsetHour;

    const infoContent = [
      `{center}{bold}TimeZone:{/bold} ${timeZone} (UTC${offsetStr}){/center}`,
      `{center}{bold}Local Time:{/bold} ${timeStr}{/center}`,
      `{center}{bold}UTC:{/bold} ${
        nowUtc.toTimeString().split(" ")[0]
      }{/center}`,
      `{center}{bold}ISO:{/bold} ${nowIso}{/center}`,
      `{center}{bold}Unix:{/bold} ${nowUnix}{/center}`,
      `{center}{bold}Date:{/bold} ${dateStr}{/center}`,
      `{center}{bold}Uptime:{/bold} ${formatUptime(process.uptime())}{/center}`,
    ].join("\n");

    infoBox.setContent(infoContent);

    clockBox.screen.render();
  }

  updateTime();
  updateMetrics();

  const timeTimer = setInterval(updateTime, updateInterval);
  const metricTimer = setInterval(updateMetrics, 1000);

  clockBox.on("destroy", () => {
    clearInterval(timeTimer);
    clearInterval(metricTimer);
  });

  return clockBox;
}
