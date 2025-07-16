/**
 * System Monitor Plugin - DataWidget Example
 * 
 * This example demonstrates a data-driven widget that fetches system
 * information and displays it with automatic updates. Shows best practices
 * for error handling, caching, and performance optimization.
 */

import { DataWidget } from '../../src/plugins/DataWidget.js';
import os from 'os';

export default class SystemMonitorPlugin extends DataWidget {
  async initialize() {
    await super.initialize();
    
    // Configuration
    this.showDetails = this.options.showDetails !== false;
    this.updateInterval = this.options.updateInterval || 2000;
    this.alertThresholds = {
      cpu: this.options.cpuAlert || 80,
      memory: this.options.memoryAlert || 85,
      load: this.options.loadAlert || 2.0
    };
    
    // State management
    this.history = {
      cpu: [],
      memory: [],
      load: []
    };
    this.maxHistoryLength = 20;
    
    // Start monitoring
    this.startUpdates();
  }

  async fetchData() {
    try {
      // Get system information
      const data = {
        timestamp: new Date(),
        cpu: await this.getCpuUsage(),
        memory: this.getMemoryInfo(),
        load: os.loadavg(),
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        networkInterfaces: this.getNetworkInfo()
      };

      // Add to history for trending
      this.addToHistory(data);
      
      return data;
    } catch (error) {
      console.error('System Monitor: Failed to fetch system data:', error);
      throw error;
    }
  }

  async getCpuUsage() {
    // Simple CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage: Math.max(0, Math.min(100, usage)),
      cores: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed
    };
  }

  getMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    return {
      total: total,
      free: free,
      used: used,
      usage: usage,
      totalGB: (total / (1024 ** 3)).toFixed(2),
      usedGB: (used / (1024 ** 3)).toFixed(2),
      freeGB: (free / (1024 ** 3)).toFixed(2)
    };
  }

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const activeInterfaces = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      const ipv4 = addresses.find(addr => addr.family === 'IPv4' && !addr.internal);
      if (ipv4) {
        activeInterfaces.push({
          name,
          address: ipv4.address,
          netmask: ipv4.netmask,
          mac: ipv4.mac
        });
      }
    }

    return activeInterfaces;
  }

  addToHistory(data) {
    // Add current values to history
    this.history.cpu.push(data.cpu.usage);
    this.history.memory.push(data.memory.usage);
    this.history.load.push(data.load[0]);

    // Trim history to max length
    Object.keys(this.history).forEach(key => {
      if (this.history[key].length > this.maxHistoryLength) {
        this.history[key].shift();
      }
    });
  }

  async render() {
    if (!this.element) return;

    if (!this.data) {
      this.renderLoading();
      return;
    }

    if (this.hasError) {
      this.renderError();
      return;
    }

    this.renderSystemInfo();
  }

  renderLoading() {
    const content = `{center}{bold}System Monitor{/bold}{/center}
{center}{yellow-fg}Gathering system information...{/yellow-fg}{/center}`;
    
    this.element.setContent(content);
  }

  renderError() {
    const content = `{center}{bold}System Monitor{/bold}{/center}
{center}{red-fg}Error: ${this.errorMessage}{/red-fg}{/center}
{center}{dim}Retrying...{/dim}{/center}`;
    
    this.element.setContent(content);
  }

  renderSystemInfo() {
    const theme = this.getTheme();
    let content = `{center}{bold}System Monitor{/bold}{/center}\n`;

    // System overview
    content += `{bold}${this.data.hostname}{/bold} (${this.data.platform}/${this.data.arch})\n`;
    content += `Uptime: ${this.formatUptime(this.data.uptime)}\n\n`;

    // CPU information
    const cpuColor = this.getAlertColor(this.data.cpu.usage, this.alertThresholds.cpu);
    content += `{bold}CPU:{/bold} {${cpuColor}-fg}${this.data.cpu.usage.toFixed(1)}%{/${cpuColor}-fg}\n`;
    content += `${this.renderProgressBar(this.data.cpu.usage, 20)}\n`;
    
    if (this.showDetails) {
      content += `{dim}${this.data.cpu.cores} cores @ ${(this.data.cpu.speed / 1000).toFixed(1)}GHz{/dim}\n`;
    }

    // Memory information
    const memColor = this.getAlertColor(this.data.memory.usage, this.alertThresholds.memory);
    content += `\n{bold}Memory:{/bold} {${memColor}-fg}${this.data.memory.usage.toFixed(1)}%{/${memColor}-fg}\n`;
    content += `${this.renderProgressBar(this.data.memory.usage, 20)}\n`;
    
    if (this.showDetails) {
      content += `{dim}${this.data.memory.usedGB}GB / ${this.data.memory.totalGB}GB{/dim}\n`;
    }

    // Load average
    const loadColor = this.getAlertColor(this.data.load[0], this.alertThresholds.load);
    content += `\n{bold}Load:{/bold} {${loadColor}-fg}${this.data.load[0].toFixed(2)}{/${loadColor}-fg}`;
    content += ` ${this.data.load[1].toFixed(2)} ${this.data.load[2].toFixed(2)}\n`;

    // Network interfaces (if showing details)
    if (this.showDetails && this.data.networkInterfaces.length > 0) {
      content += `\n{bold}Network:{/bold}\n`;
      this.data.networkInterfaces.slice(0, 2).forEach(iface => {
        content += `{dim}${iface.name}: ${iface.address}{/dim}\n`;
      });
    }

    // Trending indicators
    if (this.history.cpu.length > 1) {
      content += `\n{dim}Trends: `;
      content += `CPU ${this.getTrendIndicator(this.history.cpu)} `;
      content += `MEM ${this.getTrendIndicator(this.history.memory)} `;
      content += `LOAD ${this.getTrendIndicator(this.history.load)}{/dim}`;
    }

    this.element.setContent(content);
  }

  renderProgressBar(value, width) {
    const filled = Math.round((value / 100) * width);
    const empty = width - filled;
    
    let color = 'green';
    if (value > 80) color = 'red';
    else if (value > 60) color = 'yellow';
    
    return `{${color}-fg}${'█'.repeat(filled)}{/${color}-fg}{dim}${'░'.repeat(empty)}{/dim}`;
  }

  getAlertColor(value, threshold) {
    if (value >= threshold) return 'red';
    if (value >= threshold * 0.8) return 'yellow';
    return 'green';
  }

  getTrendIndicator(history) {
    if (history.length < 3) return '─';
    
    const recent = history.slice(-3);
    const trend = recent[2] - recent[0];
    
    if (Math.abs(trend) < 1) return '─';
    return trend > 0 ? '↗' : '↘';
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async destroy() {
    // Clear history
    this.history = { cpu: [], memory: [], load: [] };
    
    await super.destroy();
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 1000,
          default: 2000
        },
        showDetails: {
          type: 'boolean',
          description: 'Show detailed system information',
          default: true
        },
        cpuAlert: {
          type: 'number',
          description: 'CPU usage alert threshold (%)',
          minimum: 50,
          maximum: 100,
          default: 80
        },
        memoryAlert: {
          type: 'number',
          description: 'Memory usage alert threshold (%)',
          minimum: 50,
          maximum: 100,
          default: 85
        },
        loadAlert: {
          type: 'number',
          description: 'Load average alert threshold',
          minimum: 1.0,
          default: 2.0
        }
      }
    };
  }

  getLayoutHints() {
    return {
      minWidth: 30,
      minHeight: 12,
      preferredWidth: 35,
      preferredHeight: 16,
      canResize: true
    };
  }
}