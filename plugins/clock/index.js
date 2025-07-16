/**
 * @fileoverview Clock Widget Plugin
 * 
 * A comprehensive clock widget that displays current time with system metrics
 * including CPU usage, memory usage, and battery information.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { BaseWidget } from '../../src/plugins/BaseWidget.js';
import blessed from 'blessed';
import cfonts from 'cfonts';
import os from 'os';
import contrib from 'blessed-contrib';
import batteryLevel from 'battery-level';

/**
 * Clock widget that displays time and system metrics
 */
export default class ClockWidget extends BaseWidget {
  constructor(name, options = {}, context = {}) {
    super(name, options, context);
    
    // Widget-specific properties
    this.clockBox = null;
    this.cpuLine = null;
    this.infoBox = null;
    
    // System metrics state
    this.cpuHistory = Array(60).fill(0);
    this.memHistory = Array(60).fill(0);
    this.batHistory = Array(60).fill(null);
    this.prevCpu = null;
    
    // Timers
    this.timeTimer = null;
    this.metricTimer = null;
    
    // Configuration
    this.use12h = this.options.format === '12h';
    this.timeZone = this.options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Get options schema for validation
   * @returns {Object} JSON schema for options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'Clock'
        },
        font: {
          type: 'string',
          description: 'Font style for time display',
          default: 'block'
        },
        colors: {
          type: 'array',
          description: 'Colors for time display',
          items: { type: 'string' },
          default: ['green', 'cyan', 'red']
        },
        updateInterval: {
          type: 'number',
          description: 'Time update interval in milliseconds',
          minimum: 100,
          default: 1000
        },
        timeZone: {
          type: 'string',
          description: 'Timezone for time display',
          default: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        format: {
          type: 'string',
          enum: ['12h', '24h'],
          description: 'Time format, 12-hour or 24-hour',
          default: '24h'
        },
        showMetrics: {
          type: 'boolean',
          description: 'Whether to show system metrics',
          default: true
        }
      },
      required: []
    };
  }

  /**
   * Get default options
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      title: 'Clock',
      font: 'block',
      colors: ['green', 'cyan', 'red'],
      updateInterval: 1000,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      format: '24h',
      showMetrics: true
    };
  }

  /**
   * Perform widget-specific initialization
   * @returns {Promise<void>}
   */
  async performInitialization() {
    this.logger.debug('Initializing clock widget');
    
    // Initialize CPU tracking
    this.prevCpu = this.getCpuUsage();
    
    // Set up configuration
    this.use12h = this.options.format === '12h';
    this.timeZone = this.options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Create the main UI element
   * @returns {Promise<void>}
   */
  async createElement() {
    // Create main container with enhanced styling
    this.element = blessed.box({
      label: ` ⏰ ${this.options.title || 'Clock'} `,
      tags: true,
      border: { 
        type: 'line',
        ch: '─'
      },
      style: {
        border: { 
          fg: 'cyan',
          bg: 'black'
        },
        fg: 'white',
        bg: 'black',
        label: {
          fg: 'yellow',
          bold: true
        }
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      scrollable: false,
      mouse: true,
      keys: true,
      shadow: true
    });

    // Create clock display area
    this.clockBox = blessed.box({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: {
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      }
    });

    if (this.options.showMetrics) {
      // Create metrics area (split into two columns)
      const metricsHeight = '50%';
      const metricsTop = '50%';

      // CPU/Memory chart (left side)
      this.cpuLine = contrib.line({
        parent: this.element,
        top: metricsTop,
        left: 0,
        width: '50%',
        height: metricsHeight,
        label: 'Resource Usage (%)',
        showLegend: true,
        style: {
          text: 'white',
          baseline: 'black',
          border: { fg: this.theme.border || 'white' }
        },
        minY: 0,
        maxY: 125,
        wholeNumbersOnly: true
      });

      // Info box (right side)
      this.infoBox = blessed.box({
        parent: this.element,
        top: metricsTop,
        left: '50%',
        width: '50%',
        height: metricsHeight,
        label: 'Info',
        tags: true,
        border: { type: 'line' },
        style: {
          fg: this.theme.fg || 'white',
          bg: this.theme.bg || 'black',
          border: { fg: this.theme.border || 'white' }
        },
        padding: { top: 1, left: 2, right: 2, bottom: 1 },
        scrollable: true
      });
    }
  }

  /**
   * Perform widget-specific update
   * @returns {Promise<void>}
   */
  async performUpdate() {
    await this.updateTime();
    
    if (this.options.showMetrics) {
      await this.updateMetrics();
    }
    
    if (this.element && this.element.screen) {
      this.element.screen.render();
    }
  }

  /**
   * Update time display
   * @returns {Promise<void>}
   */
  async updateTime() {
    if (!this.clockBox) return;

    const now = new Date();
    const timeStr = this.use12h
      ? now.toLocaleTimeString('en-US', { timeZone: this.timeZone, hour12: true })
      : now.toLocaleTimeString('en-GB', { timeZone: this.timeZone, hour12: false });

    try {
      const rendered = cfonts.render(timeStr, {
        font: this.options.font,
        colors: this.options.colors,
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        env: 'node'
      });

      this.clockBox.setContent(rendered.string);
    } catch (error) {
      // Fallback to simple text if cfonts fails
      this.clockBox.setContent(`{center}{bold}${timeStr}{/bold}{/center}`);
    }
  }

  /**
   * Update system metrics
   * @returns {Promise<void>}
   */
  async updateMetrics() {
    if (!this.cpuLine || !this.infoBox) return;

    try {
      // Get current metrics
      const cpu = this.getCpuPercent();
      const mem = this.getMemoryUsage();
      const bat = await this.getBatteryPercentage();

      // Update history
      this.cpuHistory.push(cpu);
      this.memHistory.push(mem);
      this.batHistory.push(bat ?? null);

      // Keep only last 60 data points
      if (this.cpuHistory.length > 60) this.cpuHistory.shift();
      if (this.memHistory.length > 60) this.memHistory.shift();
      if (this.batHistory.length > 60) this.batHistory.shift();

      // Update chart
      const labels = Array.from({ length: 60 }, (_, i) => `${i - 59}s`);
      const data = [
        { title: 'CPU', x: labels, y: this.cpuHistory, style: { line: 'green' } },
        { title: 'Memory', x: labels, y: this.memHistory, style: { line: 'yellow' } }
      ];

      if (this.batHistory.some(v => v !== null)) {
        data.push({
          title: 'Battery',
          x: labels,
          y: this.batHistory.map(v => v ?? 0),
          style: { line: 'blue' }
        });
      }

      this.cpuLine.setData(data);

      // Update info box
      await this.updateInfoBox();

    } catch (error) {
      this.logger.error('Failed to update metrics:', error);
    }
  }

  /**
   * Update info box with system information
   * @returns {Promise<void>}
   */
  async updateInfoBox() {
    if (!this.infoBox) return;

    const now = new Date();
    const timeStr = this.use12h
      ? now.toLocaleTimeString('en-US', { timeZone: this.timeZone, hour12: true })
      : now.toLocaleTimeString('en-GB', { timeZone: this.timeZone, hour12: false });
    
    const dateStr = now.toLocaleDateString('en-US', { timeZone: this.timeZone });
    const nowUtc = new Date(now.toISOString());
    const nowIso = now.toISOString();
    const nowUnix = Math.floor(now.getTime() / 1000);
    const offsetMin = now.getTimezoneOffset();
    const offsetHour = -offsetMin / 60;
    const offsetStr = (offsetHour >= 0 ? '+' : '') + offsetHour;

    const infoContent = [
      `{center}{bold}TimeZone:{/bold} ${this.timeZone} (UTC${offsetStr}){/center}`,
      `{center}{bold}Local Time:{/bold} ${timeStr}{/center}`,
      `{center}{bold}UTC:{/bold} ${nowUtc.toTimeString().split(' ')[0]}{/center}`,
      `{center}{bold}ISO:{/bold} ${nowIso}{/center}`,
      `{center}{bold}Unix:{/bold} ${nowUnix}{/center}`,
      `{center}{bold}Date:{/bold} ${dateStr}{/center}`,
      `{center}{bold}Uptime:{/bold} ${this.formatUptime(process.uptime())}{/center}`
    ].join('\n');

    this.infoBox.setContent(infoContent);
  }

  /**
   * Get CPU usage information
   * @returns {Object} CPU usage data
   */
  getCpuUsage() {
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
      total: totalTick / cpus.length
    };
  }

  /**
   * Get CPU usage percentage
   * @returns {number} CPU usage percentage
   */
  getCpuPercent() {
    const currentCpu = this.getCpuUsage();
    const idleDiff = currentCpu.idle - this.prevCpu.idle;
    const totalDiff = currentCpu.total - this.prevCpu.total;
    this.prevCpu = currentCpu;
    
    if (totalDiff === 0) return 0;
    return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
  }

  /**
   * Get memory usage percentage
   * @returns {number} Memory usage percentage
   */
  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return Math.round((used / total) * 100);
  }

  /**
   * Get battery percentage
   * @returns {Promise<number|null>} Battery percentage or null if not available
   */
  async getBatteryPercentage() {
    try {
      const level = await batteryLevel(); // 0-1
      return Math.round(level * 100);
    } catch (e) {
      return null;
    }
  }

  /**
   * Format uptime in HH:MM:SS format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /**
   * Start automatic updates
   * @param {number} [interval] - Update interval in milliseconds
   */
  startUpdates(interval = null) {
    const updateInterval = interval || this.options.updateInterval || 1000;
    
    if (this.updateTimer) {
      this.stopUpdates();
    }
    
    this.updateTimer = setInterval(async () => {
      if (this.isVisible && !this.isDestroyed) {
        await this.update();
      }
    }, updateInterval);
    
    this.logger.debug(`Started updates for ${this.name} (interval: ${updateInterval}ms)`);
  }

  /**
   * Stop automatic updates
   */
  stopUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.logger.debug(`Stopped updates for ${this.name}`);
    }
  }

  /**
   * Perform widget-specific cleanup
   * @returns {Promise<void>}
   */
  async performDestroy() {
    // Stop all timers
    this.stopUpdates();
    
    // Clear references
    this.clockBox = null;
    this.cpuLine = null;
    this.infoBox = null;
    
    // Clear history arrays
    this.cpuHistory = [];
    this.memHistory = [];
    this.batHistory = [];
    
    this.logger.debug('Clock widget cleanup completed');
  }

  /**
   * Set up event handlers for the widget
   * @protected
   */
  setupEventHandlers() {
    super.setupEventHandlers();
    
    if (!this.element) return;
    
    // Add clock-specific key handlers
    this.element.key(['t'], () => {
      // Toggle time format
      this.use12h = !this.use12h;
      this.options.format = this.use12h ? '12h' : '24h';
      this.updateTime();
      if (this.element.screen) this.element.screen.render();
    });
    
    this.element.key(['m'], () => {
      // Toggle metrics display
      this.options.showMetrics = !this.options.showMetrics;
      if (this.cpuLine) this.cpuLine.toggle();
      if (this.infoBox) this.infoBox.toggle();
      if (this.element.screen) this.element.screen.render();
    });
  }
}