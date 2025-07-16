/**
 * @fileoverview Docker Monitor Widget Plugin
 * 
 * A comprehensive Docker container monitoring widget that displays container status
 * and detailed information using the new DataWidget system.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { DataWidget } from '../../src/plugins/DataWidget.js';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * Docker monitor widget that displays container status and details
 */
export default class DockerMonitorWidget extends DataWidget {
  constructor(name, options = {}, context = {}) {
    super(name, options, context);
    
    // Widget-specific properties
    this.donut = null;
    this.listBox = null;
    
    // Docker data cache
    this.dockerData = {
      containers: [],
      statusCounts: { Up: 0, Exited: 0, Other: 0 },
      total: 0
    };
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
          default: 'Docker Monitor'
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 1000,
          default: 5000
        },
        showPorts: {
          type: 'boolean',
          description: 'Whether to show container ports',
          default: true
        },
        showCreatedAt: {
          type: 'boolean',
          description: 'Whether to show container creation time',
          default: true
        },
        maxContainers: {
          type: 'number',
          description: 'Maximum number of containers to display',
          minimum: 1,
          maximum: 50,
          default: 20
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
      title: 'Docker Monitor',
      updateInterval: 5000,
      showPorts: true,
      showCreatedAt: true,
      maxContainers: 20
    };
  }

  /**
   * Perform widget-specific initialization
   * @returns {Promise<void>}
   */
  async performInitialization() {
    this.logger.debug('Initializing Docker monitor widget');
    
    // Check if Docker is available
    try {
      await execAsync('docker --version');
      this.logger.debug('Docker is available');
    } catch (error) {
      this.logger.warn('Docker is not available or not installed');
    }
  }

  /**
   * Create the main UI element
   * @returns {Promise<void>}
   */
  async createElement() {
    // Create main container
    this.element = blessed.box({
      label: this.options.title || 'Docker Monitor',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'cyan' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      scrollable: false,
      mouse: true,
      keys: true
    });

    // Calculate layout dimensions
    const donutHeight = '55%';
    const listHeight = '45%';

    // Create donut chart for container status
    this.donut = contrib.donut({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: donutHeight,
      label: 'Container Status',
      radius: 12,
      arcWidth: 4,
      yPadding: 2,
      data: []
    });

    // Create container details list
    this.listBox = blessed.box({
      parent: this.element,
      top: donutHeight,
      left: 0,
      width: '100%',
      height: listHeight,
      label: 'Container Details',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'cyan' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { bg: 'cyan' }
      },
      padding: { left: 1, right: 1, top: 1, bottom: 1 }
    });
  }

  /**
   * Fetch Docker container data
   * @returns {Promise<Object>} Docker data
   */
  async fetchData() {
    try {
      const { stdout } = await execAsync(
        'docker ps -a --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}\\t{{.CreatedAt}}"'
      );
      
      const lines = stdout
        .trim()
        .split('\n')
        .filter(line => line.length > 0);

      const statusCounts = { Up: 0, Exited: 0, Other: 0 };
      const containers = [];

      for (const line of lines) {
        const [id, name, image, status, ports, createdAt] = line.split('\t');

        let state = 'Other';
        if (/Up/i.test(status)) state = 'Up';
        else if (/Exited/i.test(status)) state = 'Exited';

        statusCounts[state]++;

        containers.push({
          id: id || 'unknown',
          name: name || 'unnamed',
          image: image || 'unknown',
          status: status || 'unknown',
          ports: ports || '',
          createdAt: createdAt || 'unknown',
          state
        });
      }

      const total = statusCounts.Up + statusCounts.Exited + statusCounts.Other || 1;

      const data = {
        containers: containers.slice(0, this.options.maxContainers),
        statusCounts,
        total
      };

      this.dockerData = data;
      return data;

    } catch (error) {
      this.logger.error('Failed to fetch Docker data:', error);
      throw new Error(`Docker command failed: ${error.message}`);
    }
  }

  /**
   * Update widget content with fetched data
   * @returns {Promise<void>}
   */
  async updateContent() {
    if (!this.data) return;

    try {
      // Update donut chart
      this.updateDonutChart();
      
      // Update container list
      this.updateContainerList();
      
    } catch (error) {
      this.logger.error('Failed to update content:', error);
      this.showErrorState(error);
    }
  }

  /**
   * Update donut chart with container status data
   */
  updateDonutChart() {
    if (!this.donut) return;

    const { statusCounts, total } = this.data;

    const donutData = [
      {
        label: 'Up',
        percent: Math.round((statusCounts.Up / total) * 100),
        color: 'green'
      },
      {
        label: 'Exited',
        percent: Math.round((statusCounts.Exited / total) * 100),
        color: 'red'
      },
      {
        label: 'Other',
        percent: Math.round((statusCounts.Other / total) * 100),
        color: 'yellow'
      }
    ];

    this.donut.setData(donutData);
  }

  /**
   * Update container list with detailed information
   */
  updateContainerList() {
    if (!this.listBox) return;

    const { containers } = this.data;

    if (containers.length === 0) {
      this.listBox.setContent('{yellow-fg}No containers found{/yellow-fg}');
      return;
    }

    const containerDetails = containers.map(container => {
      let color = 'yellow';
      if (container.state === 'Up') color = 'green';
      else if (container.state === 'Exited') color = 'red';

      let details = `{${color}-fg}${container.name}{/} (${container.id.slice(0, 12)})\n`;
      details += `  Image   : ${container.image}\n`;
      details += `  Status  : ${container.status}\n`;
      
      if (this.options.showPorts) {
        details += `  Ports   : ${container.ports || '-'}\n`;
      }
      
      if (this.options.showCreatedAt) {
        details += `  Created : ${container.createdAt}\n`;
      }

      return details;
    });

    this.listBox.setContent(containerDetails.join('\n'));
  }

  /**
   * Show error state in the widget
   * @param {Error} error - The error to display
   */
  showErrorState(error) {
    if (this.listBox) {
      this.listBox.setContent(
        `{red-fg}Failed to fetch Docker containers: ${error.message}{/red-fg}\n\n` +
        `{gray-fg}Make sure Docker is installed and running{/gray-fg}\n` +
        `{gray-fg}Press 'r' to retry{/gray-fg}`
      );
    }

    if (this.donut) {
      this.donut.setData([
        { label: 'Error', percent: 100, color: 'red' }
      ]);
    }
  }

  /**
   * Perform widget-specific cleanup
   * @returns {Promise<void>}
   */
  async performDestroy() {
    // Clear references
    this.donut = null;
    this.listBox = null;
    
    // Clear data cache
    this.dockerData = null;
    
    this.logger.debug('Docker monitor widget cleanup completed');
  }

  /**
   * Set up event handlers for the widget
   * @protected
   */
  setupEventHandlers() {
    super.setupEventHandlers();
    
    if (!this.element) return;
    
    // Add Docker-specific key handlers
    this.element.key(['d'], () => {
      // Toggle detailed view
      this.options.showPorts = !this.options.showPorts;
      this.options.showCreatedAt = !this.options.showCreatedAt;
      this.updateContainerList();
      if (this.element.screen) this.element.screen.render();
    });
    
    this.element.key(['s'], () => {
      // Force refresh Docker status
      this.fetchData().then(() => {
        this.updateContent();
        if (this.element.screen) this.element.screen.render();
      }).catch(error => {
        this.handleError(error);
      });
    });
  }
}