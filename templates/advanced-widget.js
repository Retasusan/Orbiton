/**
 * {{name}} - An advanced interactive Orbiton widget
 * 
 * This template demonstrates advanced widget features including:
 * - Interactive elements and keyboard handling
 * - Complex data visualization
 * - Plugin-to-plugin communication
 * - Custom themes and styling
 * - Performance optimization
 * 
 * @example
 * // Configuration in orbiton.json:
 * {
 *   "plugins": [
 *     {
 *       "name": "{{name}}",
 *       "position": [0, 0, 4, 3],
 *       "options": {
 *         "title": "Advanced Widget",
 *         "interactive": true,
 *         "chartType": "line",
 *         "maxDataPoints": 50,
 *         "refreshRate": 2000
 *       }
 *     }
 *   ]
 * }
 */

import { DataWidget } from '../src/plugins/DataWidget.js';

export default class {{className}} extends DataWidget {
  /**
   * Initialize the advanced widget
   */
  async initialize() {
    await super.initialize();
    
    // Advanced configuration
    this.title = this.options.title || '{{name}}';
    this.interactive = this.options.interactive !== false;
    this.chartType = this.options.chartType || 'line';
    this.maxDataPoints = this.options.maxDataPoints || 50;
    this.refreshRate = this.options.refreshRate || 2000;
    
    // Advanced state management
    this.dataHistory = [];
    this.selectedIndex = 0;
    this.viewMode = 'chart'; // 'chart', 'table', 'raw'
    this.isHighlighted = false;
    
    // Performance tracking
    this.renderTimes = [];
    this.lastRenderTime = 0;
    
    // Set up advanced features
    this.setupInteractivity();
    this.setupPluginCommunication();
    this.setupPerformanceMonitoring();
    
    // Start updates with custom interval
    this.updateInterval = this.refreshRate;
    this.startUpdates();
  }

  /**
   * Fetch data with advanced error handling and caching
   */
  async fetchData() {
    try {
      // Simulate complex data fetching
      const data = await this.generateSampleData();
      
      // Add to history for trending
      this.addToHistory(data);
      
      return data;
    } catch (error) {
      console.error(`{{name}}: Data fetch failed:`, error);
      return this.getLastKnownGoodData();
    }
  }

  /**
   * Generate sample data (replace with real data source)
   */
  async generateSampleData() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      timestamp: new Date(),
      value: Math.random() * 100,
      status: Math.random() > 0.1 ? 'healthy' : 'warning',
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 1000
      },
      events: this.generateEvents()
    };
  }

  /**
   * Generate sample events
   */
  generateEvents() {
    const events = ['startup', 'connection', 'error', 'warning', 'info'];
    return Array.from({ length: Math.floor(Math.random() * 3) }, () => ({
      type: events[Math.floor(Math.random() * events.length)],
      message: `Sample event at ${new Date().toLocaleTimeString()}`,
      timestamp: new Date()
    }));
  }

  /**
   * Add data to history with size management
   */
  addToHistory(data) {
    this.dataHistory.push(data);
    
    // Keep only the last N data points for performance
    if (this.dataHistory.length > this.maxDataPoints) {
      this.dataHistory.shift();
    }
  }

  /**
   * Advanced rendering with multiple view modes
   */
  async render() {
    if (!this.element) return;
    
    const startTime = Date.now();
    
    try {
      // Handle different states
      if (!this.data) {
        this.renderLoading();
        return;
      }

      // Render based on current view mode
      switch (this.viewMode) {
        case 'chart':
          this.renderChart();
          break;
        case 'table':
          this.renderTable();
          break;
        case 'raw':
          this.renderRaw();
          break;
        default:
          this.renderChart();
      }

      // Add interactive hints if enabled
      if (this.interactive) {
        this.addInteractiveHints();
      }

    } finally {
      // Track render performance
      this.trackRenderPerformance(Date.now() - startTime);
    }
  }

  /**
   * Render chart view
   */
  renderChart() {
    const theme = this.getTheme();
    let content = `{center}{bold}${this.title}{/bold}{/center}\n`;
    
    // Add status indicator
    const statusColor = this.data.status === 'healthy' ? 'green' : 'yellow';
    content += `Status: {${statusColor}-fg}●{/${statusColor}-fg} ${this.data.status}\n`;
    
    // Simple ASCII chart
    content += this.renderAsciiChart();
    
    // Current metrics
    content += `\nMetrics:\n`;
    content += `CPU: ${this.renderBar(this.data.metrics.cpu, 20)} ${this.data.metrics.cpu.toFixed(1)}%\n`;
    content += `MEM: ${this.renderBar(this.data.metrics.memory, 20)} ${this.data.metrics.memory.toFixed(1)}%\n`;
    content += `NET: {${theme.accent}-fg}${this.data.metrics.network.toFixed(0)}{/${theme.accent}-fg} KB/s\n`;
    
    this.element.setContent(content);
  }

  /**
   * Render simple ASCII chart
   */
  renderAsciiChart() {
    if (this.dataHistory.length < 2) return '\n{dim}Collecting data...{/dim}\n';
    
    const height = 5;
    const width = Math.min(this.dataHistory.length, 30);
    const values = this.dataHistory.slice(-width).map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    
    let chart = '\n';
    for (let row = height - 1; row >= 0; row--) {
      const threshold = min + (range * row / (height - 1));
      let line = '';
      
      for (let col = 0; col < values.length; col++) {
        const value = values[col];
        if (value >= threshold) {
          line += col === this.selectedIndex ? '{inverse}█{/inverse}' : '█';
        } else {
          line += ' ';
        }
      }
      chart += line + '\n';
    }
    
    return chart;
  }

  /**
   * Render progress bar
   */
  renderBar(value, width) {
    const filled = Math.round((value / 100) * width);
    const empty = width - filled;
    const theme = this.getTheme();
    
    let color = 'green';
    if (value > 80) color = 'red';
    else if (value > 60) color = 'yellow';
    
    return `{${color}-fg}${'█'.repeat(filled)}{/${color}-fg}{dim}${'░'.repeat(empty)}{/dim}`;
  }

  /**
   * Render table view
   */
  renderTable() {
    let content = `{center}{bold}${this.title} - Table View{/bold}{/center}\n`;
    content += `{dim}${'─'.repeat(this.element.width - 2)}{/dim}\n`;
    
    // Table headers
    content += `{bold}Time      Value    Status   CPU   MEM{/bold}\n`;
    content += `{dim}${'─'.repeat(this.element.width - 2)}{/dim}\n`;
    
    // Recent data rows
    const recentData = this.dataHistory.slice(-8);
    recentData.forEach((item, index) => {
      const time = item.timestamp.toLocaleTimeString().slice(0, 8);
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? '{inverse}' : '';
      const suffix = isSelected ? '{/inverse}' : '';
      
      content += `${prefix}${time} ${item.value.toFixed(1).padStart(7)} `;
      content += `${item.status.padEnd(8)} `;
      content += `${item.metrics.cpu.toFixed(0).padStart(3)}% `;
      content += `${item.metrics.memory.toFixed(0).padStart(3)}%${suffix}\n`;
    });
    
    this.element.setContent(content);
  }

  /**
   * Render raw data view
   */
  renderRaw() {
    let content = `{center}{bold}${this.title} - Raw Data{/bold}{/center}\n`;
    content += `{dim}${'─'.repeat(this.element.width - 2)}{/dim}\n`;
    
    // Pretty print the current data
    content += `{dim}${JSON.stringify(this.data, null, 2)}{/dim}`;
    
    this.element.setContent(content);
  }

  /**
   * Add interactive hints to the display
   */
  addInteractiveHints() {
    // This would typically modify the content or add overlay elements
    // For simplicity, we'll just track that hints should be shown
  }

  /**
   * Set up keyboard and mouse interactivity
   */
  setupInteractivity() {
    if (!this.interactive) return;
    
    // Handle key presses
    this.on('keypress', (ch, key) => {
      this.handleKeyPress(ch, key);
    });
    
    // Handle mouse events (if supported)
    this.on('click', (data) => {
      this.handleClick(data);
    });
  }

  /**
   * Handle keyboard input
   */
  async handleKeyPress(ch, key) {
    if (!key) return;
    
    switch (key.name) {
      case 'left':
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        await this.render();
        break;
        
      case 'right':
        this.selectedIndex = Math.min(this.dataHistory.length - 1, this.selectedIndex + 1);
        await this.render();
        break;
        
      case 'tab':
        // Cycle through view modes
        const modes = ['chart', 'table', 'raw'];
        const currentIndex = modes.indexOf(this.viewMode);
        this.viewMode = modes[(currentIndex + 1) % modes.length];
        await this.render();
        break;
        
      case 'r':
        // Force refresh
        await this.update();
        break;
        
      case 'c':
        // Clear history
        this.dataHistory = [];
        await this.render();
        break;
    }
  }

  /**
   * Handle mouse clicks
   */
  async handleClick(data) {
    // Toggle highlight state
    this.isHighlighted = !this.isHighlighted;
    await this.render();
  }

  /**
   * Set up plugin-to-plugin communication
   */
  setupPluginCommunication() {
    // Listen for events from other plugins
    this.eventBus.on('theme-changed', this.handleThemeChange.bind(this));
    this.eventBus.on('data-request', this.handleDataRequest.bind(this));
    
    // Emit our own events
    this.eventBus.emit('plugin-ready', {
      name: this.name,
      capabilities: ['data-provider', 'interactive']
    });
  }

  /**
   * Handle theme changes from other plugins
   */
  async handleThemeChange(newTheme) {
    // Respond to theme changes
    await this.render();
  }

  /**
   * Handle data requests from other plugins
   */
  handleDataRequest(request) {
    if (request.source === this.name) return;
    
    // Share our data with other plugins
    this.eventBus.emit('data-response', {
      source: this.name,
      data: this.data,
      history: this.dataHistory.slice(-10) // Share last 10 points
    });
  }

  /**
   * Set up performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor render performance
    setInterval(() => {
      if (this.renderTimes.length > 0) {
        const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
        
        if (avgRenderTime > 100) { // If renders take more than 100ms
          console.warn(`{{name}}: Slow rendering detected (${avgRenderTime.toFixed(1)}ms avg)`);
        }
        
        // Clear old measurements
        this.renderTimes = [];
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Track render performance
   */
  trackRenderPerformance(duration) {
    this.renderTimes.push(duration);
    this.lastRenderTime = duration;
    
    // Keep only recent measurements
    if (this.renderTimes.length > 20) {
      this.renderTimes.shift();
    }
  }

  /**
   * Get last known good data for fallback
   */
  getLastKnownGoodData() {
    return this.dataHistory.length > 0 
      ? this.dataHistory[this.dataHistory.length - 1]
      : null;
  }

  /**
   * Clean up advanced widget resources
   */
  async destroy() {
    // Remove event listeners
    this.eventBus.off('theme-changed', this.handleThemeChange);
    this.eventBus.off('data-request', this.handleDataRequest);
    
    // Clear data history
    this.dataHistory = [];
    this.renderTimes = [];
    
    // Call parent cleanup
    await super.destroy();
  }

  /**
   * Configuration schema for advanced widget
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: '{{name}}'
        },
        interactive: {
          type: 'boolean',
          description: 'Enable keyboard and mouse interaction',
          default: true
        },
        chartType: {
          type: 'string',
          enum: ['line', 'bar', 'area'],
          description: 'Chart visualization type',
          default: 'line'
        },
        maxDataPoints: {
          type: 'number',
          description: 'Maximum number of data points to keep in history',
          minimum: 10,
          maximum: 1000,
          default: 50
        },
        refreshRate: {
          type: 'number',
          description: 'Data refresh rate in milliseconds',
          minimum: 1000,
          default: 2000
        }
      }
    };
  }

  /**
   * Advanced layout hints
   */
  getLayoutHints() {
    return {
      minWidth: 40,
      minHeight: 15,
      preferredWidth: 50,
      preferredHeight: 20,
      canResize: true,
      aspectRatio: 2.5, // width:height preference
      interactive: this.interactive
    };
  }
}