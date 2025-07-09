import blessed from "blessed";
import contrib from "blessed-contrib";
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
  const contentHeight = rowSpan - clockHeight; // 下半分にその他

  // 時計（上半分）
  const clockBox = grid.set(row, col, clockHeight, colSpan, blessed.box, {
    label: "Clock",
    tags: true,
    border: { type: "line" },
    style: { border: { fg: "white" }, fg: "white" },
    padding: { top: 1, left: 2, right: 2, bottom: 1 },
    align: "center",
  });

  // 下半分を左右2分割
  const leftColSpan = Math.floor(colSpan * 0.5);

  // 左：ドーナツ
  const donut = grid.set(
    row + clockHeight,
    col,
    contentHeight + 0.25, // 0.25は下のborderのため
    leftColSpan,
    contrib.donut,
    {
      label: "Minute Progress",
      radius: 10,
      arcWidth: 4,
      yPadding: 2,
      data: [],
    }
  );

  // 右：進捗バー + タイムゾーン
  const rightCol = col + leftColSpan;
  const rightColSpan = colSpan - leftColSpan;
  const barsBoxHeight = Math.floor(contentHeight * 0.7);
  const barsBox = grid.set(
    row + clockHeight,
    rightCol,
    barsBoxHeight + 0.25, // 0.25は下のborderのため
    rightColSpan,
    blessed.box,
    {
      label: "Progress Bars",
      tags: true,
      border: { type: "line" },
      style: { fg: "white" },
      padding: { top: 1, left: 2, right: 2, bottom: 1 },
      scrollable: false,
    }
  );

  const timezoneBox = grid.set(
    row + clockHeight + barsBoxHeight,
    rightCol,
    contentHeight - barsBoxHeight + 0.25, // 0.25は下のborderのため
    rightColSpan,
    blessed.box,
    {
      label: "Timezone",
      tags: true,
      style: { fg: "white" },
      content: `{center}{bold}${timeZone}{/bold}{/center}`,
      align: "center",
    }
  );

  const barWidth = Math.max(27, rightColSpan * 4);

  function getTimeColor(second) {
    if (second >= 0 && second < 20) return "blue";
    if (second >= 20 && second < 40) return "green";
    return "magenta";
  }

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

    // ドーナツの進捗（1分で一周）
    const minutePercent = Math.round(((sec + ms / 1000) / 60) * 100);
    donut.setData([
      { label: "min", percent: minutePercent, color: getTimeColor(hour) },
    ]);
    donut.setLabel(`Minute Progress (${min}m)`);

    // 進捗バー計算
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
        )}\n\n`
    );

    clockBox.screen.render();
  }

  updateTime();
  const timer = setInterval(updateTime, updateInterval);

  clockBox.on("destroy", () => clearInterval(timer));

  return clockBox;
}
