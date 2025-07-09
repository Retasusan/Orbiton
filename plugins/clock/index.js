import blessed from "blessed";
import cfonts from "cfonts";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const {
    font = "block",
    colors = ["green", "cyan", "red"],
    updateInterval = 100,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    format = "24h",
  } = options;

  const use12h = format === "12h";

  const clockHeight = Math.floor(rowSpan * 0.5); // 上半分に時計
  const contentHeight = rowSpan - clockHeight + 0.25; // 下半分

  // 時計（上半分）
  const clockBox = grid.set(row, col, clockHeight, colSpan, blessed.box, {
    label: "Clock",
    tags: true,
    border: { type: "line" },
    style: { border: { fg: "white" }, fg: "white" },
    padding: { top: 1, left: 2, right: 2, bottom: 2 },
    align: "center",
  });

  // 下半分を左右2分割
  const leftColSpan = Math.floor(colSpan * 0.5);
  const rightCol = col + leftColSpan;
  const rightColSpan = colSpan - leftColSpan;

  // 左下：Progress Bars
  const barsBox = grid.set(
    row + clockHeight,
    col,
    contentHeight,
    leftColSpan,
    blessed.box,
    {
      label: "Progress",
      tags: true,
      border: { type: "line" },
      style: { fg: "white" },
      padding: { top: 1, left: 2, right: 2, bottom: 1 },
    }
  );

  // 右下：Info Box（タイムゾーンなど）
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
      style: { fg: "white" },
      padding: { top: 1, left: 2, right: 2, bottom: 1 },
      scrollable: true,
    }
  );

  const barWidth = Math.max(27, leftColSpan * 4);

  function createAsciiProgressBar(progress, width) {
    const filledLength = Math.floor(progress * width);
    const emptyLength = width - filledLength;
    const fullBlock = "█";
    const lightShade = "░";
    const barStr =
      fullBlock.repeat(filledLength) + lightShade.repeat(emptyLength);
    return `{green-fg}${barStr}{/}`;
  }

  function updateTime() {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const sec = now.getSeconds();
    const ms = now.getMilliseconds();

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

    // Progress Bars
    const secProgress = (sec + ms / 1000) / 60;
    const minProgress = (min + sec / 60) / 60;

    barsBox.setContent(
      `{bold}{red-fg}Second: {/}{/bold}${createAsciiProgressBar(
        secProgress,
        barWidth
      )}\n\n` +
        `{bold}{red-fg}Minute: {/}{/bold}${createAsciiProgressBar(
          minProgress,
          barWidth
        )}`
    );

    // Info Box
    const dateStr = now.toLocaleDateString("en-US", { timeZone });
    function formatUptime(seconds) {
      const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
      const s = String(Math.floor(seconds % 60)).padStart(2, "0");
      return `${h}:${m}:${s}`;
    }

    const nowUtc = new Date(now.toISOString()); // UTC基準
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
  const timer = setInterval(updateTime, updateInterval);
  clockBox.on("destroy", () => clearInterval(timer));

  return clockBox;
}
