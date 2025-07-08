import blessed from "blessed";
import os from "os";
import psList from "ps-list";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  // optionsから設定を取り出す。デフォルト値も設定可能に
  const { updateInterval = 5000, topProcessesCount = 5 } = options;

  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: "{bold}{yellow-fg}System Info{/yellow-fg}{/bold}",
    border: { type: "line" },
    style: {
      border: { fg: "yellow" },
      label: { fg: "yellow", bold: true },
      fg: "white",
      bg: "black",
    },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    padding: { left: 2, right: 2, top: 1, bottom: 1 },
  });

  function formatBytes(bytes) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  async function updateInfo() {
    const memUsed = os.totalmem() - os.freemem();
    const memTotal = os.totalmem();
    const load = os.loadavg();
    const uptimeSec = os.uptime();

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown";
    const cpuCount = cpus.length;
    const cpuSpeed = cpus[0]?.speed || 0;

    // プロセスリスト取得 (top N CPU使用率順)
    let processes = [];
    try {
      const allProcesses = await psList();
      processes = allProcesses
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, topProcessesCount);
    } catch {
      processes = [];
    }

    let procStr = "";
    if (processes.length > 0) {
      procStr = `{bold}Top ${topProcessesCount} Processes by CPU Usage:{/bold}\n`;
      procStr +=
        "{yellow-fg}PID\tCPU%\tMemory%\tName{/yellow-fg}\n" +
        processes
          .map(
            (p) =>
              `{green-fg}${p.pid}{/green-fg}\t` +
              `{red-fg}${p.cpu.toFixed(1)}{/red-fg}\t` +
              `{cyan-fg}${(p.memory * 100).toFixed(1)}{/cyan-fg}\t` +
              `${p.name}`
          )
          .join("\n") +
        "\n\n";
    }

    const content =
      procStr +
      `{bold}CPU Load Average (1m, 5m, 15m):{/bold} {green-fg}${load
        .map((l) => l.toFixed(2))
        .join(", ")}{/green-fg}\n` +
      `{bold}Memory Usage:{/bold} {cyan-fg}${formatBytes(
        memUsed
      )}{/cyan-fg} / {cyan-fg}${formatBytes(memTotal)}{/cyan-fg}\n` +
      `{bold}System Uptime:{/bold} {magenta-fg}${formatUptime(
        uptimeSec
      )}{/magenta-fg}\n\n` +
      `{bold}CPU Details:{/bold}\n` +
      `  Model: {yellow-fg}${cpuModel}{/yellow-fg}\n` +
      `  Cores: {yellow-fg}${cpuCount}{/yellow-fg}\n` +
      `  Speed: {yellow-fg}${cpuSpeed} MHz{/yellow-fg}\n\n` +
      `{bold}OS Info:{/bold}\n` +
      `  Platform: {blue-fg}${os.platform()}{/blue-fg}\n` +
      `  Release: {blue-fg}${os.release()}{/blue-fg}\n` +
      `  Arch: {blue-fg}${os.arch()}{/blue-fg}`;

    box.setContent(content);
    box.screen.render();
  }

  updateInfo();
  const timer = setInterval(updateInfo, updateInterval);

  box.on("destroy", () => clearInterval(timer));

  return box;
}
