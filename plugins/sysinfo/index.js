/**
 * @fileoverview System Information Widget Plugin
 * 
 * A comprehensive system information widget displaying CPU usage, memory usage,
 * disk usage, and top processes using blessed-contrib charts.
 * 
 * @author Orbiton Team
 * @version 1.0
 */

import { DataWidget } from '../../src/plugins/DataWidget.js';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import os from 'os';
import psList from 'ps-list';
import { exec as execSync } from 'child_process';
import util from 'util';

const exec = util.promisify(execSync);

/**
 * System information widget
 */
export default class SystemInfoWidget extends DataWidget {
  constructor(name, options, context) {
    super(name, options, context);

    // Widget-specific properties
    this.donutCpu = null;
    this.donutMemory = null;
    this.donutDisk = null;
    this.infoBox = null;

    // System data cache
    this.systemData = {
      cpu: { usage: 0, cores: 0, loadAvg: 0 },
      memory: { used: 0, total: 0, percent: 0 },
      disk: { percent: null },
      processes: [],
      uptime: 0
    };
  }

  /**
   * Get widget configuration options schema
   * @returns {Object} JSON schema for options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'System Info'
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 1000,
          maximum: 60000,
          default: 5000
        },
        topProcessesCount: {
          type: 'number',
          description: 'Number of top processes to show',
          minimum: 1,
          maximum: 20,
          default: 5
        },
        showDiskUsage: {
          type: 'boolean',
          description: 'Show disk usage information',
          default: true
        },
        showProcesses: {
          type: 'boolean',
          description: 'Show top processes',
          default: true
        }
      },
      required: []
    };
  }

  /**
   * Get default widget options
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      title: 'System Info',
      updateInterval: 5000,
      topProcessesCount: 5,
      showDiskUsage: true,
      showProcesses: true
    };
  }

  /**
   * Perform widget-specific initialization
   * @returns {Promise<void>}
   */
  async performInitialization() {
    this.logger.debug('Initializing system info widget');

    // Initialize system data
    this.systemData.cpu.cores = os.cpus().length;
  }

  /**
   * Create the main UI element
   * @returns {Promise<void>}
   */
  async createElement() {
    // Create main container
    this.logger.debug('Creating main blessed box for SystemInfoWidget');
    this.element = blessed.box({
      parent: this.parent,
      top: this.position.top,
      left: this.position.left,
      width: this.position.width,
      height: this.position.height,
      label: this.options.title,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'white' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      scrollable: false,
      mouse: true,
      keys: true
    });
    this.logger.debug('Main blessed box created.');

    // Calculate layout dimensions
    const donutWidth = '33%';
    const donutHeight = Math.floor(this.position.height * 0.6);
    const infoHeight = this.position.height - donutHeight - 2;

    // Create CPU donut chart
    this.logger.debug('Creating CPU donut chart.');
    this.donutCpu = contrib.donut({
      parent: this.element,
      top: 0,
      left: 0,
      width: donutWidth,
      height: donutHeight,
      label: 'CPU Usage',
      radius: 8,
      arcWidth: 3,
      yPadding: 2,
      data: []
    });
    this.element.screen.render();
    this.logger.debug('CPU donut chart created.');

    // Create Memory donut chart
    this.logger.debug('Creating Memory donut chart.');
    this.donutMemory = contrib.donut({
      parent: this.element,
      top: 0,
      left: '33%',
      width: donutWidth,
      height: donutHeight,
      label: 'Memory Usage',
      radius: 8,
      arcWidth: 3,
      yPadding: 2,
      data: []
    });
    this.element.screen.render();
    this.logger.debug('Memory donut chart created.');

    // Create Disk donut chart (if enabled)
    if (this.options.showDiskUsage) {
      this.logger.debug('Creating Disk donut chart.');
      this.donutDisk = contrib.donut({
        parent: this.element,
        top: 0,
        left: '66%',
        width: donutWidth,
        height: donutHeight,
        label: 'Disk Usage',
        radius: 8,
        arcWidth: 3,
        yPadding: 2,
        data: []
      });
      this.element.screen.render();
      this.logger.debug('Disk donut chart created.');
    }

    // Create system information box
    this.logger.debug('Creating info box.');
    this.infoBox = blessed.box({
      parent: this.element,
      top: donutHeight,
      left: 0,
      width: '100%',
      height: infoHeight,
      label: 'System Details',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'white' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { bg: 'yellow' }
      },
      padding: { left: 2, right: 2, top: 1, bottom: 1 }
    });
    this.element.screen.render();
    this.logger.debug('Info box created.');
  }

  /**
   * Fetch system data
   * @returns {Promise<Object>} System data
   */
  async fetchData() {
    try {
      const data = {
        cpu: await this.getCpuData(),
        memory: this.getMemoryData(),
        disk: this.options.showDiskUsage ? await this.getDiskData() : { percent: null },
        processes: this.options.showProcesses ? await this.getProcessData() : [],
        uptime: os.uptime()
      };

      this.systemData = data;
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch system data:', error);
      throw error;
    }
  }

  /**
   * Get CPU usage data
   * @returns {Promise<Object>} CPU data
   */
  async getCpuData() {
    const loadAvg = os.loadavg()[0];
    const cores = os.cpus().length;
    const usage = Math.min(100, (loadAvg / cores) * 100);

    return {
      usage: Math.round(usage),
      cores,
      loadAvg: Math.round(loadAvg * 100) / 100
    };
  }

  /**
   * Get memory usage data
   * @returns {Object} Memory data
   */
  getMemoryData() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percent = Math.min(100, (used / total) * 100);

    return {
      used,
      total,
      free,
      percent: Math.round(percent)
    };
  }

  /**
   * Get disk usage data
   * @returns {Promise<Object>} Disk data
   */
  async getDiskData() {
    if (!this.options.showDiskUsage) {
      return { percent: null };
    }

    try {
      // Use df command to get disk usage for root filesystem
      const { stdout } = await exec('df -h /');
      const lines = stdout.trim().split('\n');

      if (lines.length < 2) {
        return { percent: null };
      }

      // Parse the output (e.g., "Filesystem Size Used Avail Use% Mounted on")
      const parts = lines[1].split(/\s+/);
      const usedPercentStr = parts[4]; // "23%"
      const usedPercent = parseInt(usedPercentStr.replace('%', ''), 10);

      return { percent: usedPercent };
    } catch (error) {
      this.logger.warn('Failed to get disk usage:', error);
      return { percent: null };
    }
  }

  /**
   * Get top processes data
   * @returns {Promise<Array>} Process data
   */
  async getProcessData() {
    try {
      const allProcesses = await psList();
      const processes = allProcesses
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, this.options.topProcessesCount);

      return processes;
    } catch (error) {
      this.logger.warn('Failed to get process data:', error);
      return [];
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Format uptime to human readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Update info box with detailed system information
   */
  updateInfoBox() {
    if (!this.infoBox) {
      return;
    }

    let content = '';

    // Add system details
    content += `{bold}CPU Details:{/bold}\n`;
    content += `{yellow-fg}  Cores: ${this.systemData.cpu.cores}{/yellow-fg}\n`;
    content += `{yellow-fg}  Load Average (1m): ${this.systemData.cpu.loadAvg}{/yellow-fg}\n\n`;

    content += `{bold}System Uptime:{/bold} {magenta-fg}${this.formatUptime(this.systemData.uptime)}{/magenta-fg}\n\n`;

    content += `{bold}Memory Usage:{/bold} {cyan-fg}${this.formatBytes(this.systemData.memory.used)}{/cyan-fg} / {cyan-fg}${this.formatBytes(this.systemData.memory.total)}{/cyan-fg}\n`;

    if (this.systemData.disk.percent !== null) {
      content += `{bold}Disk Usage:{/bold} {magenta-fg}${this.systemData.disk.percent}%{/magenta-fg}\n`;
    } else {
      content += `{bold}Disk Usage:{/bold} {red-fg}Unavailable{/red-fg}\n`;
    }

    // Add process information
    if (this.options.showProcesses && this.systemData.processes.length > 0) {
      content += `\n{bold}Top ${this.options.topProcessesCount} Processes by CPU Usage:{/bold}\n`;
      content += `{yellow-fg}PID\tCPU%\tMemory%\tName{/yellow-fg}\n`;

      content += this.systemData.processes
        .map(p =>
          `{green-fg}${p.pid}{/green-fg}\t` +
          `{red-fg}${p.cpu.toFixed(1)}{/red-fg}\t` +
          `{cyan-fg}${(p.memory * 100).toFixed(1)}{/cyan-fg}\t` +
          `${p.name}`
        )
        .join('\n') + '\n';
    }

    this.infoBox.setContent(content);
  }

  /**
   * Update donut charts with current data
   */
  updateDonutCharts() {
    // Update CPU donut
    if (this.donutCpu) {
      this.donutCpu.setData([{
        percent: this.systemData.cpu.usage,
        label: 'CPU',
        color: 'green'
      }]);
    }

    // Update Memory donut
    if (this.donutMemory) {
      this.donutMemory.setData([{
        percent: this.systemData.memory.percent,
        label: 'Memory',
        color: 'cyan'
      }]);
    }

    // Update Disk donut (if available)
    if (this.donutDisk && this.systemData.disk.percent !== null) {
      this.donutDisk.setData([{
        percent: this.systemData.disk.percent,
        label: 'Disk',
        color: 'magenta'
      }]);
    }
  }

  /**
   * Update widget content with current data
   * @returns {Promise<void>}
   */
  async updateContent(data) {
    if (!this.element) {
      return;
    }

    try {
      // Update donut charts
      this.updateDonutCharts();

      // Update info box
      this.updateInfoBox();

      this.logger.debug('System info widget updated');
    } catch (error) {
      this.logger.error('Failed to update content:', error);
    }
  }

  /**
   * Set up widget-specific event handlers
   */
  setupEventHandlers() {
    super.setupEventHandlers();

    // Add system info widget-specific key handlers
    this.element.key(['p'], () => {
      // Toggle process display
      this.options.showProcesses = !this.options.showProcesses;
      this.logger.debug(`Process display ${this.options.showProcesses ? 'enabled' : 'disabled'}`);
    });

    this.element.key(['d'], () => {
      // Toggle disk usage display
      this.options.showDiskUsage = !this.options.showDiskUsage;
      this.logger.debug(`Disk usage display ${this.options.showDiskUsage ? 'enabled' : 'disabled'}`);
    });
  }

  /**
   * Perform widget-specific cleanup
   * @returns {Promise<void>}
   */
  async performDestroy() {
    this.logger.debug('System info widget cleanup completed');

    // Clear data cache
    this.systemData = null;

    // Clear references
    this.donutCpu = null;
    this.donutMemory = null;
    this.donutDisk = null;
    this.infoBox = null;
  }
}