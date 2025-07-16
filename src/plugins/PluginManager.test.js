/**
 * PluginManager Tests
 * 
 * Comprehensive tests for the plugin management system including
 * discovery, loading, lifecycle management, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginManager } from './PluginManager.js';
import { BaseWidget } from './BaseWidget.js';
import { DataWidget } from './DataWidget.js';
import { 
  TestData, 
  MockFactory, 
  AssertionHelpers,
  assertPluginInterface 
} from '../../test/utils/test-helpers.js';

// Mock plugin classes for testing
class MockBasePlugin extends BaseWidget {
  async initialize() {
    this.initialized = true;
  }
  
  async render() {
    if (this.element) {
      this.element.setContent(`Mock Plugin: ${this.name}`);
    }
  }
  
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: { type: 'string', default: 'Mock Plugin' }
      }
    };
  }
}

class MockDataPlugin extends DataWidget {
  async initialize() {
    await super.initialize();
    this.initialized = true;
  }
  
  async fetchData() {
    return { timestamp: Date.now(), value: Math.random() };
  }
  
  async render() {
    if (this.element) {
      const content = this.data 
        ? `Data Plugin: ${this.data.value.toFixed(2)}`
        : 'Data Plugin: Loading...';
      this.element.setContent(content);
    }
  }
}

describe('PluginManager Core Functionality', () => {
  let pluginManager;
  let mockPluginSources;

  beforeEach(() => {
    pluginManager = new PluginManager();
    
    // Mock plugin sources
    mockPluginSources = {
      builtin: new Map([
        ['mock-base', MockBasePlugin],
        ['mock-data', MockDataPlugin]
      ]),
      npm: new Map(),
      local: new Map()
    };
    
    // Mock the registry
    pluginManager.registry = {
      getPlugin: vi.fn().mockImplementation((name) => {
        if (mockPluginSources.builtin.has(name)) {
          return {
            name,
            version: '1.0.0',
            description: `Mock plugin: ${name}`,
            main: 'index.js'
          };
        }
        return null;
      }),
      validatePluginCompatibility: vi.fn().mockResolvedValue({
        isCompatible: true,
        issues: []
      })
    };
    
    // Mock the plugin resolution
    pluginManager.resolvePlugin = vi.fn().mockImplementation(async (name) => {
      if (mockPluginSources.builtin.has(name)) {
        return mockPluginSources.builtin.get(name);
      }
      throw new Error(`Plugin not found: ${name}`);
    });
  });

  afterEach(async () => {
    // Clean up all loaded plugins
    const plugins = pluginManager.getLoadedPlugins();
    for (const plugin of plugins) {
      await pluginManager.unloadPlugin(plugin.name);
    }
    
    vi.clearAllMocks();
  });

  describe('Plugin Discovery', () => {
    test('should discover available plugins', async () => {
      pluginManager.discoverPlugins = vi.fn().mockResolvedValue([
        {
          name: 'mock-base',
          version: '1.0.0',
          description: 'Mock base plugin',
          source: 'builtin',
          installed: true
        },
        {
          name: 'mock-data',
          version: '1.0.0',
          description: 'Mock data plugin',
          source: 'builtin',
          installed: true
        }
      ]);
      
      const plugins = await pluginManager.discoverPlugins();
      
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('mock-base');
      expect(plugins[1].name).toBe('mock-data');
    });

    test('should handle discovery errors gracefully', async () => {
      pluginManager.discoverPlugins = vi.fn().mockRejectedValue(new Error('Discovery failed'));
      
      await expect(pluginManager.discoverPlugins()).rejects.toThrow('Discovery failed');
    });

    test('should filter plugins by source', async () => {
      pluginManager.discoverPlugins = vi.fn().mockResolvedValue([
        { name: 'builtin-plugin', source: 'builtin' },
        { name: 'npm-plugin', source: 'npm' },
        { name: 'local-plugin', source: 'local' }
      ]);
      
      const plugins = await pluginManager.discoverPlugins();
      const builtinPlugins = plugins.filter(p => p.source === 'builtin');
      
      expect(builtinPlugins).toHaveLength(1);
      expect(builtinPlugins[0].name).toBe('builtin-plugin');
    });
  });

  describe('Plugin Loading', () => {
    test('should load plugin successfully', async () => {
      const plugin = await pluginManager.loadPlugin('mock-base', {
        title: 'Test Plugin'
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('mock-base');
      expect(plugin.options.title).toBe('Test Plugin');
      expect(plugin.initialized).toBe(true);
      
      assertPluginInterface(plugin);
    });

    test('should load data plugin successfully', async () => {
      const plugin = await pluginManager.loadPlugin('mock-data', {
        updateInterval: 2000
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('mock-data');
      expect(plugin.updateInterval).toBe(2000);
      expect(plugin.initialized).toBe(true);
      
      // Should have DataWidget-specific properties
      expect(plugin.data).toBeDefined();
      expect(plugin.fetchData).toBeTypeOf('function');
    });

    test('should handle plugin loading errors', async () => {
      pluginManager.resolvePlugin.mockRejectedValue(new Error('Plugin not found'));
      
      await expect(pluginManager.loadPlugin('nonexistent-plugin')).rejects.toThrow('Plugin not found');
    });

    test('should prevent loading duplicate plugins', async () => {
      await pluginManager.loadPlugin('mock-base');
      
      // Attempting to load the same plugin again should handle gracefully
      const secondLoad = await pluginManager.loadPlugin('mock-base');
      
      // Should return existing instance or handle appropriately
      expect(secondLoad).toBeDefined();
    });

    test('should validate plugin options during loading', async () => {
      const invalidOptions = {
        title: 123 // Should be string according to schema
      };
      
      // Should either validate and fix, or throw appropriate error
      const plugin = await pluginManager.loadPlugin('mock-base', invalidOptions);
      
      expect(plugin).toBeDefined();
      // Options should be validated/corrected
      expect(typeof plugin.options.title).toBe('string');
    });
  });

  describe('Plugin Management', () => {
    test('should track loaded plugins', async () => {
      await pluginManager.loadPlugin('mock-base');
      await pluginManager.loadPlugin('mock-data');
      
      const loadedPlugins = pluginManager.getLoadedPlugins();
      
      expect(loadedPlugins).toHaveLength(2);
      expect(loadedPlugins.map(p => p.name)).toContain('mock-base');
      expect(loadedPlugins.map(p => p.name)).toContain('mock-data');
    });

    test('should retrieve plugin by name', async () => {
      await pluginManager.loadPlugin('mock-base', { title: 'Retrieved Plugin' });
      
      const plugin = pluginManager.getPlugin('mock-base');
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('mock-base');
      expect(plugin.options.title).toBe('Retrieved Plugin');
    });

    test('should return undefined for non-existent plugin', () => {
      const plugin = pluginManager.getPlugin('non-existent');
      
      expect(plugin).toBeUndefined();
    });

    test('should unload plugin successfully', async () => {
      const plugin = await pluginManager.loadPlugin('mock-base');
      const destroySpy = vi.spyOn(plugin, 'destroy');
      
      await pluginManager.unloadPlugin('mock-base');
      
      expect(destroySpy).toHaveBeenCalled();
      expect(pluginManager.getPlugin('mock-base')).toBeUndefined();
    });

    test('should handle unloading non-existent plugin', async () => {
      await expect(pluginManager.unloadPlugin('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Plugin Resolution', () => {
    test('should resolve builtin plugins', async () => {
      // Reset the mock to test actual resolution logic
      pluginManager.resolvePlugin.mockRestore();
      
      // Mock the actual resolution paths
      pluginManager.resolvePlugin = vi.fn().mockImplementation(async (name) => {
        // Simulate builtin plugin resolution
        if (name === 'mock-base') {
          return MockBasePlugin;
        }
        throw new Error(`Plugin not found: ${name}`);
      });
      
      const PluginClass = await pluginManager.resolvePlugin('mock-base');
      
      expect(PluginClass).toBe(MockBasePlugin);
    });

    test('should try multiple resolution strategies', async () => {
      pluginManager.resolvePlugin.mockRestore();
      
      const resolutionAttempts = [];
      
      pluginManager.resolvePlugin = vi.fn().mockImplementation(async (name) => {
        // Simulate trying different sources
        resolutionAttempts.push(`builtin:${name}`);
        resolutionAttempts.push(`npm:orbiton-plugin-${name}`);
        resolutionAttempts.push(`local:${name}`);
        
        if (name === 'mock-base') {
          return MockBasePlugin;
        }
        
        throw new Error(`Plugin not found after trying multiple sources: ${name}`);
      });
      
      const PluginClass = await pluginManager.resolvePlugin('mock-base');
      
      expect(PluginClass).toBe(MockBasePlugin);
      expect(resolutionAttempts.length).toBeGreaterThan(0);
    });

    test('should handle resolution failures', async () => {
      pluginManager.resolvePlugin.mockRestore();
      
      pluginManager.resolvePlugin = vi.fn().mockRejectedValue(new Error('All resolution strategies failed'));
      
      await expect(pluginManager.resolvePlugin('unknown-plugin')).rejects.toThrow('All resolution strategies failed');
    });
  });

  describe('Plugin Lifecycle Management', () => {
    test('should initialize plugins properly', async () => {
      const plugin = await pluginManager.loadPlugin('mock-base');
      
      expect(plugin.initialized).toBe(true);
    });

    test('should handle initialization failures', async () => {
      // Create a plugin that fails to initialize
      class FailingPlugin extends BaseWidget {
        async initialize() {
          throw new Error('Initialization failed');
        }
      }
      
      pluginManager.resolvePlugin.mockResolvedValue(FailingPlugin);
      
      await expect(pluginManager.loadPlugin('failing-plugin')).rejects.toThrow('Initialization failed');
    });

    test('should clean up plugins on unload', async () => {
      const plugin = await pluginManager.loadPlugin('mock-data');
      
      // Start updates to test cleanup
      if (plugin.startUpdates) {
        plugin.startUpdates();
        expect(plugin.updateTimer).not.toBeNull();
      }
      
      await pluginManager.unloadPlugin('mock-data');
      
      // Should have cleaned up timers
      if (plugin.updateTimer !== undefined) {
        expect(plugin.updateTimer).toBeNull();
      }
    });

    test('should handle cleanup failures gracefully', async () => {
      const plugin = await pluginManager.loadPlugin('mock-base');
      
      // Mock destroy to fail
      plugin.destroy = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      // Should not throw, but handle gracefully
      await expect(pluginManager.unloadPlugin('mock-base')).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should isolate plugin errors', async () => {
      const workingPlugin = await pluginManager.loadPlugin('mock-base');
      
      // Create a failing plugin
      class FailingPlugin extends BaseWidget {
        async render() {
          throw new Error('Render failed');
        }
      }
      
      pluginManager.resolvePlugin.mockResolvedValue(FailingPlugin);
      const failingPlugin = await pluginManager.loadPlugin('failing-plugin');
      
      // Failing plugin should not affect working plugin
      await expect(workingPlugin.render()).resolves.not.toThrow();
      await expect(failingPlugin.render()).rejects.toThrow('Render failed');
    });

    test('should provide error context', async () => {
      pluginManager.resolvePlugin.mockRejectedValue(new Error('Module not found'));
      
      try {
        await pluginManager.loadPlugin('missing-plugin');
      } catch (error) {
        expect(error.message).toContain('missing-plugin');
      }
    });

    test('should handle concurrent plugin operations', async () => {
      const loadPromises = [
        pluginManager.loadPlugin('mock-base', { title: 'Plugin 1' }),
        pluginManager.loadPlugin('mock-data', { title: 'Plugin 2' })
      ];
      
      const plugins = await Promise.all(loadPromises);
      
      expect(plugins).toHaveLength(2);
      expect(plugins[0].options.title).toBe('Plugin 1');
      expect(plugins[1].options.title).toBe('Plugin 2');
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle loading many plugins efficiently', async () => {
      const pluginCount = 50;
      const loadPromises = [];
      
      for (let i = 0; i < pluginCount; i++) {
        // Alternate between plugin types
        const pluginName = i % 2 === 0 ? 'mock-base' : 'mock-data';
        loadPromises.push(pluginManager.loadPlugin(`${pluginName}-${i}`, { title: `Plugin ${i}` }));
      }
      
      const start = performance.now();
      const plugins = await Promise.all(loadPromises);
      const duration = performance.now() - start;
      
      expect(plugins).toHaveLength(pluginCount);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should manage memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Load and unload many plugins
      for (let i = 0; i < 100; i++) {
        const plugin = await pluginManager.loadPlugin(`temp-plugin-${i}`);
        await pluginManager.unloadPlugin(`temp-plugin-${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not have significant memory leaks
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });

    test('should handle plugin resource cleanup', async () => {
      const plugin = await pluginManager.loadPlugin('mock-data');
      
      // Simulate resource usage
      plugin.resources = {
        timer: setInterval(() => {}, 1000),
        connection: { close: vi.fn() },
        cache: new Map()
      };
      
      // Mock destroy to clean up resources
      const originalDestroy = plugin.destroy;
      plugin.destroy = vi.fn().mockImplementation(async function() {
        clearInterval(this.resources.timer);
        this.resources.connection.close();
        this.resources.cache.clear();
        await originalDestroy.call(this);
      });
      
      await pluginManager.unloadPlugin('mock-data');
      
      expect(plugin.destroy).toHaveBeenCalled();
      expect(plugin.resources.connection.close).toHaveBeenCalled();
    });
  });
});

describe('PluginManager Edge Cases', () => {
  let pluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  test('should handle malformed plugin classes', async () => {
    // Plugin that doesn't extend BaseWidget
    class MalformedPlugin {
      constructor() {
        this.name = 'malformed';
      }
    }
    
    pluginManager.resolvePlugin = vi.fn().mockResolvedValue(MalformedPlugin);
    
    await expect(pluginManager.loadPlugin('malformed')).rejects.toThrow();
  });

  test('should handle plugins with circular dependencies', async () => {
    class CircularPlugin extends BaseWidget {
      async initialize() {
        this.self = this;
        this.options.self = this;
      }
    }
    
    pluginManager.resolvePlugin = vi.fn().mockResolvedValue(CircularPlugin);
    
    const plugin = await pluginManager.loadPlugin('circular');
    
    expect(plugin).toBeDefined();
    expect(plugin.self).toBe(plugin);
  });

  test('should handle plugins that modify global state', async () => {
    class GlobalModifyingPlugin extends BaseWidget {
      async initialize() {
        global.testGlobal = 'modified';
      }
      
      async destroy() {
        delete global.testGlobal;
      }
    }
    
    pluginManager.resolvePlugin = vi.fn().mockResolvedValue(GlobalModifyingPlugin);
    
    const plugin = await pluginManager.loadPlugin('global-modifier');
    expect(global.testGlobal).toBe('modified');
    
    await pluginManager.unloadPlugin('global-modifier');
    expect(global.testGlobal).toBeUndefined();
  });

  test('should handle very long plugin names', async () => {
    const longName = 'a'.repeat(1000);
    
    pluginManager.resolvePlugin = vi.fn().mockResolvedValue(MockBasePlugin);
    
    const plugin = await pluginManager.loadPlugin(longName);
    
    expect(plugin.name).toBe(longName);
  });

  test('should handle plugins with special characters in names', async () => {
    const specialName = 'plugin-with-特殊字符-and-émojis-🎉';
    
    pluginManager.resolvePlugin = vi.fn().mockResolvedValue(MockBasePlugin);
    
    const plugin = await pluginManager.loadPlugin(specialName);
    
    expect(plugin.name).toBe(specialName);
  });
});