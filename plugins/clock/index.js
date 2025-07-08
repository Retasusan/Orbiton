import blessed from "blessed";
import cfonts from "cfonts";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const {
    font = "simple",
    colors = ["green", "cyan"],
    updateInterval = 1000,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    format = "24h",
    show = {
      weekday: true,
      date: true,
      time12h: true,
      timezone: true,
      unixEpoch: true,
      dayOfYear: true,
      iso8601: true,
      weekNumber: true,
      timezoneOffset: true,
      ampm: true,
      isoWeekday: true,
    },
  } = options;

  const use12h = format === "12h";

  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: "Clock",
    tags: true,
    border: { type: "line" },
    style: {
      border: { fg: "white" },
      fg: "white",
      bg: "black",
    },
    scrollable: true,
    alwaysScroll: true,
    padding: { top: 1, left: 2, right: 2, bottom: 1 },
  });

  // ISO週番号を計算するヘルパー
  function getISOWeekNumber(date) {
    const tmpDate = new Date(date.getTime());
    tmpDate.setHours(0, 0, 0, 0);
    // 木曜日に合わせる（ISO週は木曜日の週番号を採用）
    tmpDate.setDate(tmpDate.getDate() + 3 - ((tmpDate.getDay() + 6) % 7));
    const week1 = new Date(tmpDate.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((tmpDate.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }

  function formatDetailedTime(now) {
    const lines = [];
    const dayOfYear = Math.floor(
      (now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24
    );

    if (show.weekday) {
      const weekday = now.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone,
      });
      lines.push(`{bold}{yellow-fg}${weekday}{/bold}`);
    }
    if (show.date) {
      const date = now.toLocaleDateString("en-GB", { timeZone });
      lines.push(`{bold}{yellow-fg}${date}{/bold}`);
    }
    if (show.time12h && use12h) {
      const time = now
        .toLocaleTimeString("en-US", {
          hour12: true,
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(/AM|PM/i, "")
        .trim();
      lines.push(`{bold}{cyan-fg}${time}{/}`);
    }
    if (show.ampm && use12h) {
      const ampm = now
        .toLocaleTimeString("en-US", {
          hour12: true,
          timeZone,
          hour: "2-digit",
        })
        .match(/AM|PM/i)[0];
      lines.push(`{bold}{magenta-fg}AM/PM: ${ampm}{/}`);
    }
    if (show.timezone) {
      lines.push(`{bold}{green-fg}Timezone: ${timeZone}{/}`);
    }
    if (show.timezoneOffset) {
      const offset = -now.getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
      lines.push(`{bold}{green-fg}UTC Offset: ${sign}${hours}:${minutes}{/}`);
    }
    if (show.unixEpoch) {
      const epoch = Math.floor(now.getTime() / 1000);
      lines.push(`{bold}{magenta-fg}Unix Epoch: ${epoch}{/}`);
    }
    if (show.dayOfYear) {
      lines.push(`{bold}{white-fg}Day of Year: ${dayOfYear}{/}`);
    }
    if (show.weekNumber) {
      const weekNum = getISOWeekNumber(now);
      lines.push(`{bold}{cyan-fg}ISO Week Number: ${weekNum}{/}`);
    }
    if (show.isoWeekday) {
      const isoWeekday = ((now.getDay() + 6) % 7) + 1; // ISOは月曜=1, 日曜=7
      lines.push(`{bold}{yellow-fg}ISO Weekday: ${isoWeekday}{/}`);
    }
    if (show.iso8601) {
      const iso = now.toISOString();
      lines.push(`{bold}{red-fg}ISO 8601: ${iso}{/}`);
    }

    return lines.join("\n");
  }

  function updateTime() {
    const now = new Date();
    let timeStr;
    if (use12h) {
      const parts =
        now
          .toLocaleTimeString("en-US", {
            hour12: true,
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          .match(/(AM|PM)?\s*(.*)/i) || [];
      const ampm = parts[1] || "";
      const time = parts[2] || "";
      timeStr = `${ampm} ${time}`.trim();
    } else {
      timeStr = now.toLocaleTimeString("en-GB", {
        hour12: false,
        timeZone,
      });
    }

    const rendered = cfonts.render(timeStr, {
      font,
      colors,
      background: "transparent",
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: "0",
      gradient: false,
      env: "node",
    });

    box.setContent(rendered.string + "\n" + formatDetailedTime(now));
    box.screen.render();
  }

  updateTime();
  const timer = setInterval(updateTime, updateInterval);

  box.on("destroy", () => clearInterval(timer));

  return box;
}
