/**
 * Plugin Testing Framework Example
 * 
 * This example demonstrates how to use the Plugin Testing Framework
 * to create comprehensive tests for Orbiton plugins.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { 
  PluginTestFramework, 
  PluginTestSuite, 
  PluginTestUtils,
  PluginTestReporter 
} from '../../src/plugins/PluginTestFramework.js';
import { BaseWidget } from '../../src/plugins/BaseWidget.js';
import { DataWidget } from '../../src/plugins/DataWidget.js';

// Example plugin for testing
class ExamplePlugin extends BaseWidget {
  async initialize() {
    this.initialized = true;
    this.title = this.options.title || 'Example Plugin';
    this.counter = 0;
  }

  async render() {
    if (!this.element) return;
    
    const content = `{center}{bold}${this.title}{/bold}{/center}
{center}Counter: ${this.counter}{/center}
{center}Status: ${this.initialized ? 'Ready' : 'Loading'}{/center}`;
    
    this.element.setContent(content);
  }

  async update() {
    this.counter++;
    await this.render();
  }

  increment() {
    this.counter++;
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Plugin title',
          default: 'Example Plugin'
        },
        startValue: {
          type: 'number',
          description: 'Starting counter value',
          default: 0
        }
      }
    };
  }
}

// Example data plugin for testing
class ExampleDataPlugin extends DataWidget {
  async initialize() {
    await super.initialize();
    this.initialized = true;
    this.apiUrl = this.options.apiUrl || 'https://api.example.com/data';
  }

  async fetchData() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      timestamp: Date.now(),
      value: Math.random() * 100,
      status: 'ok'
    };
  }

  async render() {
    if (!this.element) return;
    
    if (!this.data) {
      this.element.setContent('{center}Loading data...{/center}');
      return;
    }

    const content = `{center}{bold}Data Plugin{/bold}{/center}
{center}Value: ${this.data.value.toFixed(2)}{/center}
{center}Status: {green-fg}${this.data.status}{/green-fg}{/center}
{center}{dim}Updated: ${new Date(this.data.timestamp).toLocaleTimeString()}{/dim}{/center}`;
    
    this.element.setContent(content);
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        apiUrl: {
          type: 'string',
          description: 'API endpoint URL',
          default: 'https://api.example.com/data'
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          default: 5000
        }
      }
    };
  }
}

describe('Plugin Testing Framework Usage Examples', () => {
  let framework;

  beforeEach(() => {
    framework = new PluginTestFramework();
  });

  afterEach(async () => {
    await framework.cleanup();
  });

  describe('Basic Testing with Harness', () => {
    test('should create and use test harness', async () => {
      const harness = framework.createHarness(ExamplePlugin);
      
      // Create plugin instance
      const plugin = await harness.createPlugin({
        title: 'Test Plugin',
        startValue: 5
      });
      
      // Test plugin functionality
      expect(plugin.name).toMatch(/test-plugin-\d+/);
      expect(plugin.options.title).toBe('Test Plugin');
      expect(plugin.initialized).toBe(true);
      
      // Test rendering
      const content = await harness.renderPlugin(plugin);
      expect(content).toContain('Test Plugin');
      expect(content).toContain('Counter: 0');
      
      // Test updates
      await harness.simulateUpdate(plugin);
      const updatedContent = await harness.renderPlugin(plugin);
      expect(updatedContent).toContain('Counter: 1');
    });

    test('should test plugin performance', async () => {
      const harness = framework.createHarness(ExamplePlugin);
      const plugin = await harness.createPlugin();
      
      const stats = await harness.testPerformance(plugin, 50);
      
      expect(stats.initialize).toBeDefined();
      expect(stats.render).toBeDefined();
      expect(stats.initialize.average).toBeLessThan(10);
      expect(stats.render.average).toBeLessThan(5);
    });

    test('should test error handling', async () => {
      const harness = framework.createHarness(ExamplePlugin);
      const plugin = await harness.createPlugin();
      
      const errorScenarios = PluginTestUtils.createErrorScenarios();
      const results = await harness.testErrorHandling(plugin, errorScenarios);
      
      expect(results).toHaveLength(errorScenarios.length);
      results.forEach(result => {
        expect(result).toHaveProperty('scenario');
        expect(result).toHaveProperty('passed');
      });
    });
  });

  describe('Comprehensive Testing with Test Suite', () => {
    test('should create and run test suite', async () => {
      const suite = framework.createTestSuite(ExamplePlugin, {
        name: 'example-plugin-suite',
        pluginOptions: { title: 'Suite Test Plugin' }
      });

      // Add lifecycle tests
      suite.testLifecycle();

      // Add configuration tests
      suite.testConfiguration([
        {
          name: 'valid title',
          input: { title: 'Valid Title' },
          expected: { title: 'Valid Title' }
        },
        {
          name: 'invalid title type',
          input: { title: 123 },
          shouldThrow: false // Should handle gracefully
        }
      ]);

      // Add performance tests
      suite.testPerformance({
        maxInitTime: 10,
        maxRenderTime: 5
      });

      // Add custom test
      suite.test('should increment counter', async (plugin) => {
        await plugin.initialize();
        const initialCounter = plugin.counter;
        plugin.increment();
        expect(plugin.counter).toBe(initialCounter + 1);
      });

      // Run the suite
      const results = await suite.run();
      
      expect(results.passed).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
      expect(results.duration).toBeGreaterThan(0);
    });

    test('should handle test failures gracefully', async () => {
      const suite = framework.createTestSuite(ExamplePlugin);

      // Add a test that will fail
      suite.test('should fail intentionally', async (plugin) => {
        expect(true).toBe(false); // This will fail
      });

      const results = await suite.run();
      
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].test).toBe('should fail intentionally');
    });
  });

  describe('Data Plugin Testing', () => {
    test('should test data plugin functionality', async () => {
      const harness = framework.createHarness(ExampleDataPlugin);
      const plugin = await harness.createPlugin({
        apiUrl: 'https://test-api.example.com',
        updateInterval: 1000
      });

      // Test data fetching
      const data = await plugin.fetchData();
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.value).toBeTypeOf('number');
      expect(data.status).toBe('ok');

      // Test rendering with data
      await harness.simulateUpdate(plugin, data);
      const content = await harness.renderPlugin(plugin);
      expect(content).toContain('Data Plugin');
      expect(content).toContain(data.value.toFixed(2));
    });

    test('should test data plugin error scenarios', async () => {
      const harness = framework.createHarness(ExampleDataPlugin);
      const plugin = await harness.createPlugin();

      // Mock fetchData to fail
      plugin.fetchData = async () => {
        throw new Error('API Error');
      };

      // Should handle error gracefully
      await expect(plugin.fetchData()).rejects.toThrow('API Error');
      
      // Plugin should still be functional
      expect(plugin.initialized).toBe(true);
    });
  });

  describe('Test Utilities', () => {
    test('should create mock data', () => {
      const apiResponse = PluginTestUtils.createMockData('api-response', {
        status: 200,
        data: { message: 'test' }
      });
      
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.data.message).toBe('test');
      expect(apiResponse.timestamp).toBeDefined();

      const systemInfo = PluginTestUtils.createMockData('system-info', {
        cpuUsage: 75,
        memoryUsage: 60
      });
      
      expect(systemInfo.cpu.usage).toBe(75);
      expect(systemInfo.memory.usage).toBe(60);
    });

    test('should create mock configuration', () => {
      const config = PluginTestUtils.createMockConfig({
        name: 'custom-plugin',
        options: { customOption: 'value' }
      });
      
      expect(config.name).toBe('custom-plugin');
      expect(config.options.customOption).toBe('value');
      expect(config.position).toEqual([0, 0, 2, 2]);
    });

    test('should measure execution time', async () => {
      const { result, duration } = await PluginTestUtils.measureTime(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'completed';
      });
      
      expect(result).toBe('completed');
      expect(duration).toBeGreaterThan(8); // Should be around 10ms
    });

    test('should wait for conditions', async () => {
      let counter = 0;
      
      // Start incrementing counter after delay
      setTimeout(() => {
        const interval = setInterval(() => {
          counter++;
          if (counter >= 5) clearInterval(interval);
        }, 10);
      }, 50);
      
      await PluginTestUtils.waitForCondition(
        () => counter >= 5,
        1000,
        20
      );
      
      expect(counter).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Test Reporting', () => {
    test('should generate test reports', async () => {
      const suite1 = framework.createTestSuite(ExamplePlugin, { name: 'suite1' });
      suite1.test('passing test', async () => {
        expect(true).toBe(true);
      });

      const suite2 = framework.createTestSuite(ExampleDataPlugin, { name: 'suite2' });
      suite2.test('another passing test', async () => {
        expect(1 + 1).toBe(2);
      });
      suite2.test('failing test', async () => {
        expect(true).toBe(false);
      });

      const results = new Map();
      results.set('suite1', await suite1.run());
      results.set('suite2', await suite2.run());

      const reporter = new PluginTestReporter({
        verbose: false,
        showPassed: true,
        showFailed: true
      });

      const report = reporter.report(results);
      
      expect(report.summary.totalTests).toBe(3);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.success).toBe(false);
      
      expect(report.details).toHaveLength(2);
      expect(report.details[0].suite).toBe('suite1');
      expect(report.details[1].suite).toBe('suite2');
    });
  });

  describe('Framework Integration', () => {
    test('should run all registered test suites', async () => {
      // Register multiple test suites
      const suite1 = framework.createTestSuite(ExamplePlugin, { name: 'integration-suite-1' });
      suite1.testLifecycle();

      const suite2 = framework.createTestSuite(ExampleDataPlugin, { name: 'integration-suite-2' });
      suite2.testLifecycle();

      // Run all tests
      const results = await framework.runAllTests();
      
      expect(results.size).toBe(2);
      expect(results.has('integration-suite-1')).toBe(true);
      expect(results.has('integration-suite-2')).toBe(true);
      
      // Both suites should have passing tests
      for (const result of results.values()) {
        expect(result.passed).toBeGreaterThan(0);
      }
    });

    test('should handle global mocks', () => {
      const mockApi = {
        get: () => Promise.resolve({ data: 'mocked' }),
        post: () => Promise.resolve({ success: true })
      };

      framework.registerGlobalMock('api', mockApi);
      
      const retrievedMock = framework.getGlobalMock('api');
      expect(retrievedMock).toBe(mockApi);
      expect(retrievedMock.get).toBeTypeOf('function');
    });
  });
});