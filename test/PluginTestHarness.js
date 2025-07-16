/**
 * Plugin Test Harness
 * 
 * Comprehensive testing utilities for Orbiton plugins.
 * Provides isolated testing environment with mocks and utilities.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import { createMockEventBus, createMockLogger } from './setup.js';

/**
 * Plugin Test Harness for isolated plugin testing
 */
export class PluginTestHarness {
  constructor(PluginClass) {
    this.PluginClass = PluginClass;
    this.mockGrid = new MockGrid();
    this.mockTheme = new MockTheme();
    this.mockEventBus = createMockEventBus();
    this.mockLogger = createMockLogger();
    this.plugins = new Map();
  }

  /**
   * Create a plugin instance for testing
   */
  async createPlugin(options = {}) {
    const pluginName = `test-plugin-${Date.now()}`;
    const plugin = new this.PluginClass(pluginName, options);
    
    // Inject test dependencies
    plugin.eventBus = this.mockEventBus;
    plugin.logger = this.mockLogger;
    plugin.element = this.createMockElement();
    
    // Mock framework methods
    plugin.getTheme = vi.fn(() => this.mockTheme.getTheme());
    plugin.setPosition = vi.fn();
    plugin.applyTheme = vi.fn();
    plugin.handleError = vi.fn();
    
    // Initialize the plugin
    await plugin.initialize();
    
    this.plugins.set(pluginName, plugin);
    return plugin;
  }

  /**
   * Render a plugin and return the content
   */
  async renderPlugin(plugin, position = [0, 0, 4, 4]) {
    // Set position
    plugin.setPosition(...position);
    
    // Render the plugin
    await plugin.render();
    
    // Return the rendered content
    return this.mockGrid.getRenderedContent(plugin.element);
  }

  /**
   * Simulate a data update for testing
   */
  async simulateUpdate(plugin, data) {
    if (plugin.data !== undefined) {
      plugin.data = data;
      plugin.lastUpdate = new Date();
    }
    
    await plugin.update();
  }

  /**
   * Simulate keyboard input
   */
  async simulateKeyPress(plugin, ch, key) {
    if (plugin.element && plugin.element.emit) {
      plugin.element.emit('keypress', ch, key);
    }
    
    // Also trigger plugin's keypress handler if it exists
    if (plugin.onKeyPress) {
      await plugin.onKeyPress(ch, key);
    }
  }

  /**
   * Simulate mouse input
   */
  async simulateClick(plugin, x, y, button = 'left') {
    const mouseEvent = {
      type: 'click',
      x,
      y,
      button,
      ctrl: false,
      meta: false,
      shift: false,
      alt: false
    };
    
    if (plugin.element && plugin.element.emit) {
      plugin.element.emit('click', mouseEvent);
    }
    
    if (plugin.onMouse) {
      await plugin.onMouse(mouseEvent);
    }
  }

  /**
   * Test plugin configuration validation
   */
  testConfigValidation(plugin, testCases) {
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const result = plugin.validateOptions(testCase.input);
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: result,
          passed: JSON.stringify(result) === JSON.stringify(testCase.expected)
        });
      } catch (error) {
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: error,
          passed: testCase.shouldThrow === true
        });
      }
    }
    
    return results;
  }

  /**
   * Test plugin performance
   */
  async testPerformance(plugin, iterations = 100) {
    const metrics = {
      initialize: [],
      render: [],
      update: [],
      fetchData: []
    };

    // Test initialization performance
    for (let i = 0; i < iterations; i++) {
      const testPlugin = new this.PluginClass(`perf-test-${i}`, {});
      testPlugin.element = this.createMockElement();
      
      const start = performance.now();
      await testPlugin.initialize();
      const end = performance.now();
      
      metrics.initialize.push(end - start);
    }

    // Test render performance
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await plugin.render();
      const end = performance.now();
      
      metrics.render.push(end - start);
    }

    // Test update performance
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await plugin.update();
      const end = performance.now();
      
      metrics.update.push(end - start);
    }

    // Test fetchData performance (if applicable)
    if (plugin.fetchData) {
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        try {
          await plugin.fetchData();
        } catch (error) {
          // Ignore errors for performance testing
        }
        const end = performance.now();
        
        metrics.fetchData.push(end - start);
      }
    }

    // Calculate statistics
    const stats = {};
    for (const [method, times] of Object.entries(metrics)) {
      if (times.length > 0) {
        stats[method] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          samples: times.length
        };
      }
    }

    return stats;
  }

  /**
   * Test error handling
   */
  async testErrorHandling(plugin, errorScenarios) {
    const results = [];
    
    for (const scenario of errorScenarios) {
      try {
        // Set up error condition
        if (scenario.setup) {
          await scenario.setup(plugin);
        }
        
        // Execute the operation that should handle the error
        const result = await scenario.operation(plugin);
        
        results.push({
          scenario: scenario.name,
          passed: scenario.expectError ? false : true,
          result,
          error: null
        });
      } catch (error) {
        results.push({
          scenario: scenario.name,
          passed: scenario.expectError ? true : false,
          result: null,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Create a mock blessed.js element
   */
  createMockElement() {
    const element = new EventEmitter();
    
    Object.assign(element, {
      setContent: vi.fn(),
      render: vi.fn(),
      destroy: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      width: 40,
      height: 20,
      style: {},
      border: {},
      label: '',
      content: '',
      visible: true,
      
      // Position properties
      left: 0,
      top: 0,
      right: 40,
      bottom: 20
    });
    
    return element;
  }

  /**
   * Clean up test resources
   */
  async cleanup() {
    // Destroy all test plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        await plugin.destroy();
      }
    }
    
    this.plugins.clear();
    this.mockEventBus.clearHistory();
    this.mockLogger.clearHistory();
  }

  /**
   * Get mock objects for manual testing
   */
  getMocks() {
    return {
      grid: this.mockGrid,
      theme: this.mockTheme,
      eventBus: this.mockEventBus,
      logger: this.mockLogger
    };
  }
}

/**
 * Mock grid for testing widget positioning and rendering
 */
export class MockGrid {
  constructor() {
    this.elements = new Map();
    this.width = 80;
    this.height = 24;
  }

  /**
   * Get rendered content from an element
   */
  getRenderedContent(element) {
    if (!element) return '';
    
    // Return the content that was set on the element
    if (element.setContent.mock && element.setContent.mock.calls.length > 0) {
      const lastCall = element.setContent.mock.calls[element.setContent.mock.calls.length - 1];
      return lastCall[0] || '';
    }
    
    return element.content || '';
  }

  /**
   * Set grid size
   */
  setSize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Clear grid
   */
  clear() {
    this.elements.clear();
  }

  /**
   * Add element to grid
   */
  addElement(element, position) {
    this.elements.set(element, position);
  }

  /**
   * Remove element from grid
   */
  removeElement(element) {
    this.elements.delete(element);
  }
}

/**
 * Mock theme for testing styling
 */
export class MockTheme {
  constructor() {
    this.currentTheme = {
      name: 'test-theme',
      colors: {
        primary: 'blue',
        secondary: 'green',
        accent: 'yellow',
        background: 'black',
        foreground: 'white',
        border: 'gray',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        info: 'cyan',
        muted: 'gray'
      },
      styles: {
        title: { fg: 'primary', bold: true },
        border: { fg: 'border', type: 'line' },
        focus: { fg: 'accent' },
        error: { fg: 'error' },
        success: { fg: 'success' },
        warning: { fg: 'warning' },
        info: { fg: 'info' }
      }
    };
  }

  /**
   * Get current theme
   */
  getTheme() {
    return { ...this.currentTheme };
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    this.currentTheme = { ...this.currentTheme, ...theme };
  }

  /**
   * Apply theme to element
   */
  apply(element) {
    if (element && element.style) {
      Object.assign(element.style, this.currentTheme.styles);
    }
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Start timing an operation
   */
  start(name) {
    this.metrics.set(name, { start: performance.now() });
  }

  /**
   * End timing an operation
   */
  end(name) {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.end = performance.now();
      metric.duration = metric.end - metric.start;
    }
    return metric;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
  }
}

/**
 * Integration test utilities
 */
export class IntegrationTester {
  constructor() {
    this.dashboard = null;
    this.plugins = [];
  }

  /**
   * Set up integration test environment
   */
  async setup(config) {
    // Mock dashboard setup would go here
    // This is a placeholder for future dashboard integration
    this.dashboard = {
      config,
      plugins: new Map(),
      eventBus: createMockEventBus(),
      logger: createMockLogger()
    };
  }

  /**
   * Test plugin integration
   */
  async testPluginIntegration(pluginClass, config) {
    const plugin = new pluginClass(config.name, config.options);
    
    // Inject dashboard dependencies
    plugin.eventBus = this.dashboard.eventBus;
    plugin.logger = this.dashboard.logger;
    
    // Initialize and test
    await plugin.initialize();
    this.plugins.push(plugin);
    
    return plugin;
  }

  /**
   * Clean up integration test
   */
  async cleanup() {
    for (const plugin of this.plugins) {
      if (plugin.destroy) {
        await plugin.destroy();
      }
    }
    this.plugins = [];
    this.dashboard = null;
  }
}

export default PluginTestHarness;