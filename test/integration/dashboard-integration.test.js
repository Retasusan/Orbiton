/**
 * Dashboard Integration Tests
 * 
 * Comprehensive integration tests that validate the entire Orbiton system
 * works correctly with all components integrated together.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DashboardEngine } from '../../src/dashboard/DashboardEngine.js';
import { ConfigManager } from '../../src/config/ConfigManager.js';
import { PluginManager } from '../../src/plugins/PluginManager.js';
import { PerformanceMonitor } from '../../src/dashboard/PerformanceMonitor.js';
import { RenderScheduler } from '../../src/dashboard/RenderScheduler.js';
import { ErrorRecoveryManager } from '../../src/plugins/ErrorRecoveryManager.js';

// Mock OS module
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    homedir: vi.fn(() => '/mock/home'),
    platform: vi.fn(() => 'linux'),
    type: vi.fn(() => 'Linux'),
    release: vi.fn(() => '5.4.0'),
    arch: vi.fn(() => 'x64'),
    cpus: vi.fn(() => [{ model: 'Mock CPU', speed: 2400 }]),
    totalmem: vi.fn(() => 8589934592),
    freemem: vi.fn(() => 4294967296)
  };
});

// Mock fs/promises module
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
    access: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))
  };
});

describe('Dashboard Integration Tests', () => {
  let dashboard;
  let configManager;
  let pluginManager;
  let performanceMonitor;
  let renderScheduler;
  let errorRecoveryManager;

  beforeEach(async () => {
    // Create integrated system components
    configManager = new ConfigManager({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    performanceMonitor = new PerformanceMonitor({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    renderScheduler = new RenderScheduler({
      performanceMonitor,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    errorRecoveryManager = new ErrorRecoveryManager({
      performanceMonitor,
      renderScheduler,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    pluginManager = new PluginManager({
      performanceMonitor,
      renderScheduler,
      errorRecoveryManager,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    dashboard = new DashboardEngine({
      configManager,
      pluginManager,
      performanceMonitor,
      renderScheduler,
      errorRecoveryManager,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });
  });

  afterEach(async () => {
    if (dashboard) {
      await dashboard.destroy();
    }
  });

  describe('System Initialization', () => {
    test('should initialize all components successfully', async () => {
      await dashboard.initialize();
      
      expect(dashboard.isInitialized).toBe(true);
      expect(configManager.isLoaded).toBe(true);
      expect(pluginManager.isReady).toBe(true);
      expect(renderScheduler.schedulerRunning).toBe(true);
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock a component failure
      vi.spyOn(configManager, 'loadConfig').mockRejectedValue(new Error('Config load failed'));
      
      await expect(dashboard.initialize()).rejects.toThrow('Config load failed');
      
      // System should still be in a recoverable state
      expect(dashboard.isInitialized).toBe(false);
    });

    test('should load default configuration when no config exists', async () => {
      vi.spyOn(configManager, 'loadConfig').mockResolvedValue({
        autoDetect: true,
        plugins: [],
        theme: 'default'
      });

      await dashboard.initialize();
      
      const config = dashboard.getConfiguration();
      expect(config.autoDetect).toBe(true);
      expect(config.theme).toBe('default');
    });
  });

  describe('Plugin System Integration', () => {
    test('should load and initialize plugins correctly', async () => {
      const testConfig = {
        autoDetect: false,
        plugins: [
          {
            name: 'test-plugin',
            position: [0, 0, 2, 2],
            options: { title: 'Test Plugin' }
          }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      // Mock plugin loading
      const mockPlugin = {
        name: 'test-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        destroy: vi.fn().mockResolvedValue(),
        getOptionsSchema: vi.fn().mockReturnValue({ type: 'object' })
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);

      await dashboard.initialize();
      await dashboard.start();

      expect(pluginManager.loadPlugin).toHaveBeenCalledWith('test-plugin', {
        title: 'Test Plugin'
      });
      expect(mockPlugin.initialize).toHaveBeenCalled();
    });

    test('should handle plugin loading failures', async () => {
      const testConfig = {
        plugins: [
          { name: 'failing-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      vi.spyOn(pluginManager, 'loadPlugin').mockRejectedValue(new Error('Plugin not found'));

      await dashboard.initialize();
      await dashboard.start();

      // Dashboard should continue running despite plugin failure
      expect(dashboard.isRunning).toBe(true);
      
      // Error should be tracked
      const errorStats = errorRecoveryManager.getSystemErrorStats();
      expect(errorStats.totalPluginsWithErrors).toBeGreaterThan(0);
    });

    test('should register plugins with render scheduler', async () => {
      const testConfig = {
        plugins: [
          {
            name: 'scheduled-plugin',
            position: [0, 0, 1, 1],
            updateInterval: 2000
          }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const mockPlugin = {
        name: 'scheduled-plugin',
        updateInterval: 2000,
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        destroy: vi.fn().mockResolvedValue()
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);
      vi.spyOn(renderScheduler, 'registerPlugin');

      await dashboard.initialize();
      await dashboard.start();

      expect(renderScheduler.registerPlugin).toHaveBeenCalledWith(
        mockPlugin,
        expect.objectContaining({ updateInterval: 2000 })
      );
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should track plugin performance metrics', async () => {
      const testConfig = {
        plugins: [
          { name: 'monitored-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const mockPlugin = {
        name: 'monitored-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockImplementation(() => {
          // Simulate some work
          return new Promise(resolve => setTimeout(resolve, 50));
        }),
        destroy: vi.fn().mockResolvedValue()
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);
      vi.spyOn(performanceMonitor, 'trackPluginPerformance');

      await dashboard.initialize();
      await dashboard.start();

      // Trigger a render
      await renderScheduler.queuePluginRender('monitored-plugin', true);
      
      // Wait for render to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(performanceMonitor.trackPluginPerformance).toHaveBeenCalledWith(
        'monitored-plugin',
        'render',
        expect.any(Number)
      );
    });

    test('should generate performance recommendations', async () => {
      // Add slow plugin
      performanceMonitor.trackPluginPerformance('slow-plugin', 'render', 200);
      performanceMonitor.trackPluginPerformance('slow-plugin', 'render', 250);
      performanceMonitor.trackPluginPerformance('slow-plugin', 'render', 300);

      const recommendations = performanceMonitor.getRecommendations();
      
      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            category: 'performance'
          })
        ])
      );
    });
  });

  describe('Error Recovery Integration', () => {
    test('should isolate failing plugins', async () => {
      const testConfig = {
        plugins: [
          { name: 'failing-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const mockPlugin = {
        name: 'failing-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockRejectedValue(new Error('Render failed')),
        destroy: vi.fn().mockResolvedValue()
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);
      vi.spyOn(errorRecoveryManager, 'handlePluginError');

      await dashboard.initialize();
      await dashboard.start();

      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        await errorRecoveryManager.handlePluginError(mockPlugin, new Error('Test error'));
      }

      expect(errorRecoveryManager.handlePluginError).toHaveBeenCalled();
      
      const errorStats = errorRecoveryManager.getPluginErrorStats('failing-plugin');
      expect(errorStats.isIsolated).toBe(true);
    });

    test('should attempt plugin recovery', async () => {
      const mockPlugin = {
        name: 'recoverable-plugin',
        reset: vi.fn().mockResolvedValue(),
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue()
      };

      // Simulate error and recovery
      await errorRecoveryManager.handlePluginError(mockPlugin, new Error('Network error'));
      
      // Wait for recovery attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      const errorStats = errorRecoveryManager.getPluginErrorStats('recoverable-plugin');
      expect(errorStats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management Integration', () => {
    test('should validate configuration on load', async () => {
      const invalidConfig = {
        plugins: [
          {
            // Missing required name field
            position: [0, 0, 1, 1]
          }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(invalidConfig);
      vi.spyOn(configManager, 'validateConfig').mockResolvedValue({
        isValid: false,
        errors: [{ message: 'Plugin name is required' }]
      });

      await expect(dashboard.initialize()).rejects.toThrow();
    });

    test('should support configuration hot-reloading', async () => {
      await dashboard.initialize();
      await dashboard.start();

      const newConfig = {
        plugins: [
          { name: 'new-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue({
        name: 'new-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        destroy: vi.fn().mockResolvedValue()
      });

      await dashboard.reloadConfiguration(newConfig);

      expect(pluginManager.loadPlugin).toHaveBeenCalledWith('new-plugin', {});
    });
  });

  describe('Theme System Integration', () => {
    test('should apply themes to all plugins', async () => {
      const testConfig = {
        theme: 'dark',
        plugins: [
          { name: 'themed-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const mockPlugin = {
        name: 'themed-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        applyTheme: vi.fn(),
        destroy: vi.fn().mockResolvedValue()
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);

      await dashboard.initialize();
      await dashboard.start();

      expect(mockPlugin.applyTheme).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'dark'
        })
      );
    });

    test('should handle custom theme configurations', async () => {
      const testConfig = {
        theme: {
          name: 'custom',
          colors: {
            primary: '#00ff00',
            secondary: '#0080ff'
          }
        },
        plugins: [
          { name: 'custom-themed-plugin', position: [0, 0, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const mockPlugin = {
        name: 'custom-themed-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        applyTheme: vi.fn(),
        destroy: vi.fn().mockResolvedValue()
      };

      vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin);

      await dashboard.initialize();
      await dashboard.start();

      expect(mockPlugin.applyTheme).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'custom',
          colors: expect.objectContaining({
            primary: '#00ff00',
            secondary: '#0080ff'
          })
        })
      );
    });
  });

  describe('Event System Integration', () => {
    test('should handle plugin-to-plugin communication', async () => {
      const testConfig = {
        plugins: [
          { name: 'sender-plugin', position: [0, 0, 1, 1] },
          { name: 'receiver-plugin', position: [0, 1, 1, 1] }
        ]
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(testConfig);
      
      const eventBus = dashboard.getEventBus();
      const receiverHandler = vi.fn();

      const senderPlugin = {
        name: 'sender-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockResolvedValue(),
        destroy: vi.fn().mockResolvedValue(),
        eventBus
      };

      const receiverPlugin = {
        name: 'receiver-plugin',
        initialize: vi.fn().mockImplementation(() => {
          eventBus.on('test-event', receiverHandler);
        }),
        render: vi.fn().mockResolvedValue(),
        destroy: vi.fn().mockResolvedValue(),
        eventBus
      };

      vi.spyOn(pluginManager, 'loadPlugin')
        .mockResolvedValueOnce(senderPlugin)
        .mockResolvedValueOnce(receiverPlugin);

      await dashboard.initialize();
      await dashboard.start();

      // Simulate event emission
      eventBus.emit('test-event', { data: 'test' });

      expect(receiverHandler).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('System Shutdown', () => {
    test('should shutdown all components gracefully', async () => {
      await dashboard.initialize();
      await dashboard.start();

      const mockPlugin = {
        name: 'test-plugin',
        destroy: vi.fn().mockResolvedValue()
      };

      pluginManager.plugins.set('test-plugin', mockPlugin);

      await dashboard.stop();

      expect(mockPlugin.destroy).toHaveBeenCalled();
      expect(renderScheduler.schedulerRunning).toBe(false);
      expect(dashboard.isRunning).toBe(false);
    });

    test('should handle shutdown errors gracefully', async () => {
      await dashboard.initialize();
      await dashboard.start();

      const mockPlugin = {
        name: 'problematic-plugin',
        destroy: vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      };

      pluginManager.plugins.set('problematic-plugin', mockPlugin);

      // Should not throw despite plugin cleanup failure
      await expect(dashboard.stop()).resolves.not.toThrow();
      
      expect(dashboard.isRunning).toBe(false);
    });
  });

  describe('Resource Management', () => {
    test('should manage memory usage effectively', async () => {
      await dashboard.initialize();
      await dashboard.start();

      // Simulate memory pressure
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Add multiple plugins
      for (let i = 0; i < 10; i++) {
        const plugin = {
          name: `memory-plugin-${i}`,
          initialize: vi.fn().mockResolvedValue(),
          render: vi.fn().mockResolvedValue(),
          destroy: vi.fn().mockResolvedValue()
        };
        
        pluginManager.plugins.set(`memory-plugin-${i}`, plugin);
        performanceMonitor.trackMemoryUsage(`memory-plugin-${i}`, 1024 * 1024); // 1MB each
      }

      const systemMetrics = performanceMonitor.getSystemMetrics();
      expect(systemMetrics.totalMemoryUsage).toBeGreaterThan(0);
      
      // Cleanup should reduce memory usage
      await dashboard.stop();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    test('should handle high CPU usage scenarios', async () => {
      await dashboard.initialize();
      await dashboard.start();

      // Simulate CPU-intensive plugin
      const cpuIntensivePlugin = {
        name: 'cpu-intensive-plugin',
        initialize: vi.fn().mockResolvedValue(),
        render: vi.fn().mockImplementation(() => {
          // Simulate CPU work
          const start = Date.now();
          while (Date.now() - start < 100) {
            // Busy wait
          }
          return Promise.resolve();
        }),
        destroy: vi.fn().mockResolvedValue()
      };

      pluginManager.plugins.set('cpu-intensive-plugin', cpuIntensivePlugin);
      renderScheduler.registerPlugin(cpuIntensivePlugin);

      // Trigger multiple renders
      for (let i = 0; i < 5; i++) {
        await renderScheduler.queuePluginRender('cpu-intensive-plugin', true);
      }

      const pluginMetrics = performanceMonitor.getPluginMetrics('cpu-intensive-plugin');
      expect(pluginMetrics.averageRenderTime).toBeGreaterThan(50);
    });
  });

  describe('Stress Testing', () => {
    test('should handle many plugins simultaneously', async () => {
      const manyPluginsConfig = {
        plugins: Array.from({ length: 50 }, (_, i) => ({
          name: `stress-plugin-${i}`,
          position: [i % 10, Math.floor(i / 10), 1, 1],
          updateInterval: 1000 + (i * 100)
        }))
      };

      vi.spyOn(configManager, 'loadConfig').mockResolvedValue(manyPluginsConfig);
      
      // Mock plugin creation
      vi.spyOn(pluginManager, 'loadPlugin').mockImplementation((name) => {
        return Promise.resolve({
          name,
          initialize: vi.fn().mockResolvedValue(),
          render: vi.fn().mockResolvedValue(),
          destroy: vi.fn().mockResolvedValue()
        });
      });

      await dashboard.initialize();
      await dashboard.start();

      expect(pluginManager.loadPlugin).toHaveBeenCalledTimes(50);
      
      const systemMetrics = performanceMonitor.getSystemMetrics();
      expect(systemMetrics.totalPlugins).toBe(50);
    });

    test('should maintain performance under load', async () => {
      await dashboard.initialize();
      await dashboard.start();

      // Create plugins with different update intervals
      const plugins = [];
      for (let i = 0; i < 20; i++) {
        const plugin = {
          name: `load-plugin-${i}`,
          updateInterval: 500 + (i * 50),
          initialize: vi.fn().mockResolvedValue(),
          render: vi.fn().mockResolvedValue(),
          update: vi.fn().mockResolvedValue(),
          destroy: vi.fn().mockResolvedValue()
        };
        
        plugins.push(plugin);
        pluginManager.plugins.set(plugin.name, plugin);
        renderScheduler.registerPlugin(plugin, { updateInterval: plugin.updateInterval });
      }

      // Let the system run for a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      const schedulerStats = renderScheduler.getStatistics();
      expect(schedulerStats.totalPlugins).toBe(20);
      expect(schedulerStats.activePlugins).toBeLessThanOrEqual(20);
      
      // System should still be responsive
      expect(dashboard.isRunning).toBe(true);
    });
  });
});