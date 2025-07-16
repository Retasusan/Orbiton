/**
 * Test suite for {{name}} plugin
 * 
 * This template provides comprehensive testing patterns for Orbiton plugins,
 * including unit tests, integration tests, and performance tests.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {{className}} from './index.js';

// Mock dependencies
vi.mock('../src/plugins/BaseWidget.js', () => ({
  BaseWidget: class MockBaseWidget {
    constructor(name, options) {
      this.name = name;
      this.options = options;
      this.element = null;
      this.isVisible = true;
    }
    
    async initialize() {}
    async render() {}
    async update() {}
    async destroy() {}
    validateOptions(options) { return options; }
    getOptionsSchema() { return {}; }
    setPosition() {}
    applyTheme() {}
    handleError() {}
    getTheme() { 
      return { 
        primary: 'blue', 
        secondary: 'green', 
        accent: 'yellow',
        border: 'white'
      }; 
    }
  }
}));

vi.mock('../src/plugins/DataWidget.js', () => ({
  DataWidget: class MockDataWidget {
    constructor(name, options) {
      this.name = name;
      this.options = options;
      this.element = null;
      this.isVisible = true;
      this.data = null;
      this.lastUpdate = null;
      this.updateInterval = 5000;
      this.updateTimer = null;
    }
    
    async initialize() {}
    async render() {}
    async update() {}
    async destroy() {}
    async fetchData() { return null; }
    startUpdates() {}
    stopUpdates() {}
    pauseUpdates() {}
    resumeUpdates() {}
    validateOptions(options) { return options; }
    getOptionsSchema() { return {}; }
    setPosition() {}
    applyTheme() {}
    handleError() {}
    getTheme() { 
      return { 
        primary: 'blue', 
        secondary: 'green', 
        accent: 'yellow',
        border: 'white'
      }; 
    }
  }
}));

describe('{{className}}', () => {
  let plugin;
  let mockElement;

  beforeEach(() => {
    // Create mock element
    mockElement = {
      setContent: vi.fn(),
      width: 40,
      height: 20,
      style: {}
    };

    // Create plugin instance with test options
    plugin = new {{className}}('test-{{name}}', {
      title: 'Test Widget',
      // Add other test options here
    });

    // Assign mock element
    plugin.element = mockElement;
  });

  afterEach(() => {
    // Clean up after each test
    if (plugin) {
      plugin.destroy();
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default options', async () => {
      await plugin.initialize();
      
      expect(plugin.name).toBe('test-{{name}}');
      expect(plugin.options).toBeDefined();
    });

    test('should initialize with custom options', async () => {
      const customPlugin = new {{className}}('custom-{{name}}', {
        title: 'Custom Title',
        customOption: 'test-value'
      });

      await customPlugin.initialize();
      
      expect(customPlugin.options.title).toBe('Custom Title');
      expect(customPlugin.options.customOption).toBe('test-value');
    });

    test('should validate required options', async () => {
      const invalidPlugin = new {{className}}('invalid-{{name}}', {
        // Missing required options
      });

      // If your plugin has required options, test validation
      // await expect(invalidPlugin.initialize()).rejects.toThrow();
    });
  });

  describe('Rendering', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should render without errors', async () => {
      await plugin.render();
      
      expect(mockElement.setContent).toHaveBeenCalled();
    });

    test('should handle missing element gracefully', async () => {
      plugin.element = null;
      
      await expect(plugin.render()).resolves.not.toThrow();
    });

    test('should render loading state when no data', async () => {
      plugin.data = null;
      
      await plugin.render();
      
      const content = mockElement.setContent.mock.calls[0][0];
      expect(content).toContain('Loading');
    });

    test('should render data when available', async () => {
      plugin.data = {
        value: 42,
        status: 'ok'
      };
      
      await plugin.render();
      
      const content = mockElement.setContent.mock.calls[0][0];
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
    });
  });

  describe('Data Handling', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should fetch data successfully', async () => {
      // Mock successful data fetch
      const mockData = { value: 123, status: 'healthy' };
      
      if (plugin.fetchData) {
        // Mock the fetch method if it exists
        plugin.fetchData = vi.fn().mockResolvedValue(mockData);
        
        const result = await plugin.fetchData();
        expect(result).toEqual(mockData);
      }
    });

    test('should handle fetch errors gracefully', async () => {
      if (plugin.fetchData) {
        // Mock fetch error
        plugin.fetchData = vi.fn().mockRejectedValue(new Error('Network error'));
        
        await expect(plugin.fetchData()).rejects.toThrow('Network error');
      }
    });

    test('should update data and re-render', async () => {
      const spy = vi.spyOn(plugin, 'render');
      
      await plugin.update();
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Configuration Schema', () => {
    test('should return valid schema', () => {
      const schema = plugin.getOptionsSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });

    test('should validate options against schema', () => {
      const schema = plugin.getOptionsSchema();
      const validOptions = { title: 'Test Title' };
      
      // Test that valid options pass validation
      expect(() => plugin.validateOptions(validOptions)).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    test('should clean up resources on destroy', async () => {
      await plugin.initialize();
      
      // Set up some resources to clean up
      plugin.timer = setInterval(() => {}, 1000);
      
      await plugin.destroy();
      
      // Verify cleanup occurred
      expect(plugin.timer).toBeNull();
    });

    test('should handle multiple destroy calls', async () => {
      await plugin.initialize();
      
      await plugin.destroy();
      await expect(plugin.destroy()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should handle render errors gracefully', async () => {
      // Force a render error
      mockElement.setContent.mockImplementation(() => {
        throw new Error('Render error');
      });
      
      await expect(plugin.render()).resolves.not.toThrow();
    });

    test('should display error state when appropriate', async () => {
      plugin.hasError = true;
      plugin.errorMessage = 'Test error';
      
      await plugin.render();
      
      const content = mockElement.setContent.mock.calls[0][0];
      expect(content).toContain('error');
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should render within reasonable time', async () => {
      const startTime = Date.now();
      
      await plugin.render();
      
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should render in less than 100ms
    });

    test('should handle large datasets efficiently', async () => {
      // Test with large dataset if applicable
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 100
      }));
      
      plugin.data = largeData;
      
      const startTime = Date.now();
      await plugin.render();
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeLessThan(500); // Should handle large data reasonably
    });
  });

  describe('Integration', () => {
    test('should work with theme system', async () => {
      await plugin.initialize();
      
      const theme = plugin.getTheme();
      expect(theme).toBeDefined();
      expect(theme.primary).toBeDefined();
    });

    test('should respect layout hints', () => {
      const hints = plugin.getLayoutHints();
      
      expect(hints).toBeDefined();
      expect(typeof hints.minWidth).toBe('number');
      expect(typeof hints.minHeight).toBe('number');
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should provide meaningful content for screen readers', async () => {
      await plugin.render();
      
      const content = mockElement.setContent.mock.calls[0][0];
      
      // Check that content is descriptive
      expect(content.length).toBeGreaterThan(0);
      expect(content).not.toMatch(/^[\s\n]*$/); // Not just whitespace
    });

    test('should handle keyboard navigation if interactive', async () => {
      if (plugin.handleKeyPress) {
        const mockKey = { name: 'enter' };
        
        await expect(plugin.handleKeyPress('', mockKey)).resolves.not.toThrow();
      }
    });
  });
});

// Integration tests
describe('{{className}} Integration', () => {
  test('should work in dashboard environment', async () => {
    // Mock dashboard environment
    const mockDashboard = {
      plugins: new Map(),
      eventBus: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
      }
    };

    const plugin = new {{className}}('integration-test', {
      title: 'Integration Test'
    });

    // Simulate dashboard integration
    plugin.eventBus = mockDashboard.eventBus;
    
    await plugin.initialize();
    await plugin.render();
    
    expect(plugin).toBeDefined();
  });
});

// Performance benchmarks
describe('{{className}} Performance', () => {
  test('should meet performance benchmarks', async () => {
    const plugin = new {{className}}('perf-test', {});
    plugin.element = {
      setContent: vi.fn(),
      width: 40,
      height: 20
    };

    await plugin.initialize();

    // Benchmark render performance
    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await plugin.render();
    }

    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / iterations;

    console.log(`Average render time: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(10); // Should average less than 10ms per render
  });
});