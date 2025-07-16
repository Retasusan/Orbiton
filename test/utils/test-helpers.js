/**
 * Test Helper Utilities
 * 
 * Additional utilities for testing Orbiton plugins and components.
 * These helpers provide common testing patterns and assertions.
 */

import { expect } from 'vitest';

/**
 * Assert that a plugin follows the expected interface
 */
export function assertPluginInterface(plugin) {
  // Required properties
  expect(plugin).toHaveProperty('name');
  expect(plugin).toHaveProperty('options');
  
  // Required methods
  expect(plugin.initialize).toBeTypeOf('function');
  expect(plugin.render).toBeTypeOf('function');
  expect(plugin.update).toBeTypeOf('function');
  expect(plugin.destroy).toBeTypeOf('function');
  expect(plugin.getOptionsSchema).toBeTypeOf('function');
  
  // Framework methods
  expect(plugin.validateOptions).toBeTypeOf('function');
  expect(plugin.setPosition).toBeTypeOf('function');
  expect(plugin.applyTheme).toBeTypeOf('function');
  expect(plugin.handleError).toBeTypeOf('function');
  expect(plugin.getTheme).toBeTypeOf('function');
  expect(plugin.getLayoutHints).toBeTypeOf('function');
}

/**
 * Assert that a DataWidget follows the expected interface
 */
export function assertDataWidgetInterface(plugin) {
  assertPluginInterface(plugin);
  
  // DataWidget-specific properties
  expect(plugin).toHaveProperty('data');
  expect(plugin).toHaveProperty('lastUpdate');
  expect(plugin).toHaveProperty('updateInterval');
  
  // DataWidget-specific methods
  expect(plugin.fetchData).toBeTypeOf('function');
  expect(plugin.startUpdates).toBeTypeOf('function');
  expect(plugin.stopUpdates).toBeTypeOf('function');
}

/**
 * Assert that a configuration schema is valid
 */
export function assertValidSchema(schema) {
  expect(schema).toBeTypeOf('object');
  expect(schema.type).toBe('object');
  
  if (schema.properties) {
    expect(schema.properties).toBeTypeOf('object');
    
    // Check each property has required fields
    for (const [key, prop] of Object.entries(schema.properties)) {
      expect(prop).toHaveProperty('type');
      expect(prop).toHaveProperty('description');
    }
  }
  
  if (schema.required) {
    expect(Array.isArray(schema.required)).toBe(true);
  }
}

/**
 * Assert that plugin content contains expected elements
 */
export function assertPluginContent(content, expectations) {
  expect(content).toBeTypeOf('string');
  
  if (expectations.contains) {
    for (const text of expectations.contains) {
      expect(content).toContain(text);
    }
  }
  
  if (expectations.notContains) {
    for (const text of expectations.notContains) {
      expect(content).not.toContain(text);
    }
  }
  
  if (expectations.matches) {
    for (const pattern of expectations.matches) {
      expect(content).toMatch(pattern);
    }
  }
}

/**
 * Assert that performance metrics meet requirements
 */
export function assertPerformanceMetrics(metrics, requirements = {}) {
  const {
    maxInitTime = 50,      // 50ms max initialization
    maxRenderTime = 20,    // 20ms max render time
    maxUpdateTime = 30,    // 30ms max update time
    maxFetchTime = 1000    // 1s max fetch time
  } = requirements;
  
  if (metrics.initialize) {
    expect(metrics.initialize.average).toBeLessThan(maxInitTime);
    expect(metrics.initialize.max).toBeLessThan(maxInitTime * 2);
  }
  
  if (metrics.render) {
    expect(metrics.render.average).toBeLessThan(maxRenderTime);
    expect(metrics.render.max).toBeLessThan(maxRenderTime * 2);
  }
  
  if (metrics.update) {
    expect(metrics.update.average).toBeLessThan(maxUpdateTime);
    expect(metrics.update.max).toBeLessThan(maxUpdateTime * 2);
  }
  
  if (metrics.fetchData) {
    expect(metrics.fetchData.average).toBeLessThan(maxFetchTime);
  }
}

/**
 * Create test data for different scenarios
 */
export const TestData = {
  /**
   * Valid plugin configurations
   */
  validConfigs: [
    {
      name: 'basic-config',
      options: { title: 'Test Widget' }
    },
    {
      name: 'full-config',
      options: {
        title: 'Full Test Widget',
        enabled: true,
        updateInterval: 5000,
        theme: 'dark'
      }
    }
  ],
  
  /**
   * Invalid plugin configurations
   */
  invalidConfigs: [
    {
      name: 'missing-required',
      options: {},
      expectedError: 'Missing required field'
    },
    {
      name: 'invalid-type',
      options: { title: 123 },
      expectedError: 'Invalid type'
    }
  ],
  
  /**
   * Mock API responses
   */
  apiResponses: {
    success: {
      status: 200,
      data: { message: 'Success', timestamp: Date.now() }
    },
    error: {
      status: 500,
      data: { error: 'Internal Server Error' }
    },
    timeout: {
      delay: 10000 // Simulate timeout
    }
  },
  
  /**
   * Theme configurations
   */
  themes: {
    light: {
      name: 'light',
      colors: {
        primary: 'blue',
        secondary: 'gray',
        background: 'white',
        foreground: 'black'
      }
    },
    dark: {
      name: 'dark',
      colors: {
        primary: 'cyan',
        secondary: 'gray',
        background: 'black',
        foreground: 'white'
      }
    }
  }
};

/**
 * Mock factory functions
 */
export const MockFactory = {
  /**
   * Create a mock fetch response
   */
  createFetchResponse(data, options = {}) {
    const { status = 200, statusText = 'OK', delay = 0 } = options;
    
    const response = {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers: new Map(),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    };
    
    if (delay > 0) {
      return new Promise(resolve => setTimeout(() => resolve(response), delay));
    }
    
    return Promise.resolve(response);
  },
  
  /**
   * Create a mock plugin configuration
   */
  createPluginConfig(overrides = {}) {
    return {
      name: 'test-plugin',
      position: [0, 0, 2, 2],
      enabled: true,
      options: {
        title: 'Test Plugin',
        updateInterval: 5000
      },
      ...overrides
    };
  },
  
  /**
   * Create a mock dashboard configuration
   */
  createDashboardConfig(overrides = {}) {
    return {
      autoDetect: false,
      layout: {
        preset: 'custom',
        grid: { rows: 4, cols: 4 }
      },
      plugins: [
        MockFactory.createPluginConfig()
      ],
      theme: 'default',
      performance: {
        updateInterval: 5000,
        maxConcurrentUpdates: 3
      },
      ...overrides
    };
  }
};

/**
 * Test scenario generators
 */
export const ScenarioGenerator = {
  /**
   * Generate error scenarios for testing
   */
  generateErrorScenarios(plugin) {
    return [
      {
        name: 'network-error',
        setup: () => {
          if (global.fetch) {
            global.fetch.mockRejectedValue(new Error('Network error'));
          }
        },
        operation: (p) => p.fetchData ? p.fetchData() : Promise.resolve(),
        expectError: true
      },
      {
        name: 'render-error',
        setup: (p) => {
          if (p.element && p.element.setContent) {
            p.element.setContent.mockImplementation(() => {
              throw new Error('Render error');
            });
          }
        },
        operation: (p) => p.render(),
        expectError: true
      },
      {
        name: 'initialization-error',
        setup: () => {},
        operation: () => {
          const TestPlugin = class extends plugin.constructor {
            async initialize() {
              throw new Error('Initialization error');
            }
          };
          const testPlugin = new TestPlugin('error-test', {});
          return testPlugin.initialize();
        },
        expectError: true
      }
    ];
  },
  
  /**
   * Generate performance test scenarios
   */
  generatePerformanceScenarios() {
    return [
      {
        name: 'high-frequency-updates',
        iterations: 1000,
        operation: (plugin) => plugin.update()
      },
      {
        name: 'large-data-rendering',
        setup: (plugin) => {
          plugin.data = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: Math.random(),
            timestamp: Date.now()
          }));
        },
        operation: (plugin) => plugin.render()
      },
      {
        name: 'concurrent-operations',
        operation: (plugin) => Promise.all([
          plugin.render(),
          plugin.update(),
          plugin.fetchData ? plugin.fetchData() : Promise.resolve()
        ])
      }
    ];
  }
};

/**
 * Assertion helpers for common test patterns
 */
export const AssertionHelpers = {
  /**
   * Assert that an async operation completes within timeout
   */
  async assertCompletesWithin(operation, timeout = 5000) {
    const start = Date.now();
    await operation();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(timeout);
  },
  
  /**
   * Assert that an operation throws a specific error
   */
  async assertThrowsError(operation, expectedError) {
    try {
      await operation();
      throw new Error('Expected operation to throw');
    } catch (error) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else if (expectedError instanceof RegExp) {
        expect(error.message).toMatch(expectedError);
      } else {
        expect(error).toBeInstanceOf(expectedError);
      }
    }
  },
  
  /**
   * Assert that a value is within a range
   */
  assertWithinRange(value, min, max) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  },
  
  /**
   * Assert that an array contains specific items
   */
  assertArrayContains(array, items) {
    expect(Array.isArray(array)).toBe(true);
    for (const item of items) {
      expect(array).toContain(item);
    }
  }
};