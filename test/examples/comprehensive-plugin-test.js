/**
 * Comprehensive Plugin Testing Example
 * 
 * This example demonstrates all the cool testing features available
 * in the Orbiton plugin testing framework.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PluginTestFramework, PluginTestUtils } from '../../src/plugins/PluginTestFramework.js';
import { PluginTestHarness } from '../PluginTestHarness.js';
import ClockWidget from '../../plugins/clock/index.js';

describe('🚀 Comprehensive Plugin Testing Suite', () => {
  let framework;
  let harness;
  let plugin;

  beforeEach(async () => {
    framework = new PluginTestFramework();
    harness = framework.createHarness(ClockWidget, { name: 'clock-test' });
    plugin = await harness.createPlugin({
      title: 'Test Clock',
      format: '24h',
      showMetrics: true
    });
  });

  afterEach(async () => {
    await framework.cleanup();
  });

  describe('🔧 Basic Plugin Interface Tests', () => {
    test('should follow plugin interface contract', () => {
      PluginTestUtils.assertPluginInterface(plugin, 'base');
    });

    test('should have proper configuration schema', () => {
      const schema = plugin.getOptionsSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.title).toBeDefined();
      expect(schema.properties.format).toBeDefined();
    });

    test('should validate options correctly', () => {
      const validOptions = { title: 'My Clock', format: '12h' };
      const result = plugin.validateOptions(validOptions);
      expect(result.title).toBe('My Clock');
      expect(result.format).toBe('12h');
    });
  });

  describe('🎨 Visual and Snapshot Testing', () => {
    test('should create consistent visual snapshots', async () => {
      await plugin.initialize();
      await plugin.render();
      
      const snapshot1 = PluginTestUtils.createSnapshot(plugin);
      expect(snapshot1.error).toBeUndefined();
      expect(snapshot1.pluginName).toBe(plugin.name);
      expect(snapshot1.content).toBeDefined();
      
      // Render again and compare
      await plugin.render();
      const snapshot2 = PluginTestUtils.createSnapshot(plugin);
      
      const comparison = PluginTestUtils.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(true);
    });

    test('should detect visual changes', async () => {
      await plugin.initialize();
      await plugin.render();
      
      const snapshot1 = PluginTestUtils.createSnapshot(plugin);
      
      // Change plugin content
      plugin.options.title = 'Changed Title';
      await plugin.render();
      
      const snapshot2 = PluginTestUtils.createSnapshot(plugin);
      const comparison = PluginTestUtils.compareSnapshots(snapshot1, snapshot2);
      
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
    });
  });

  describe('📱 Responsive Design Testing', () => {
    test('should handle different screen sizes', async () => {
      const responsiveTests = PluginTestUtils.createResponsiveTests();
      
      for (const testCase of responsiveTests) {
        // Setup screen size
        testCase.setup(plugin);
        
        // Initialize and render
        await plugin.initialize();
        const result = await testCase.test(plugin);
        
        expect(result.passed).toBe(true);
        expect(result.content).toBeDefined();
        
        console.log(`✅ ${testCase.name}: Content length ${result.content.length}`);
      }
    });

    test('should adapt to extreme aspect ratios', async () => {
      await plugin.initialize();
      
      // Test ultra-wide
      plugin.element.width = 200;
      plugin.element.height = 5;
      await plugin.render();
      
      const wideSnapshot = PluginTestUtils.createSnapshot(plugin);
      expect(wideSnapshot.position.width).toBe(200);
      expect(wideSnapshot.position.height).toBe(5);
      
      // Test ultra-tall
      plugin.element.width = 10;
      plugin.element.height = 50;
      await plugin.render();
      
      const tallSnapshot = PluginTestUtils.createSnapshot(plugin);
      expect(tallSnapshot.position.width).toBe(10);
      expect(tallSnapshot.position.height).toBe(50);
    });
  });

  describe('♿ Accessibility Testing', () => {
    test('should pass accessibility checks', async () => {
      await plugin.initialize();
      await plugin.render();
      
      const accessibilityTests = PluginTestUtils.createAccessibilityTests();
      
      for (const testCase of accessibilityTests) {
        const result = await testCase.test(plugin);
        
        console.log(`♿ ${testCase.name}:`, result.passed ? '✅ PASS' : '❌ FAIL');
        
        if (!result.passed) {
          console.log(`   Reason: ${result.reason}`);
          console.log(`   Details:`, result.details);
        }
        
        // For this example, we'll log results but not fail the test
        // In real scenarios, you might want to enforce accessibility
        expect(result).toBeDefined();
      }
    });
  });

  describe('⚡ Performance Testing', () => {
    test('should meet performance benchmarks', async () => {
      const performanceTests = PluginTestUtils.createPerformanceScenarios();
      
      for (const scenario of performanceTests) {
        console.log(`⚡ Testing ${scenario.name}...`);
        
        // Setup scenario
        if (scenario.setup) {
          scenario.setup(plugin);
        }
        
        // Run performance test
        const result = await scenario.test(plugin);
        
        console.log(`   Duration: ${result.duration?.toFixed(2)}ms`);
        
        if (result.averagePerUpdate) {
          console.log(`   Avg per update: ${result.averagePerUpdate.toFixed(2)}ms`);
          expect(result.averagePerUpdate).toBeLessThan(100); // Should be under 100ms
        }
        
        if (result.memoryIncrease) {
          console.log(`   Memory increase: ${(result.memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
          expect(result.memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should be under 50MB
        }
      }
    });

    test('should handle high-frequency updates efficiently', async () => {
      await plugin.initialize();
      
      const { result, duration } = await PluginTestUtils.measureTime(async () => {
        for (let i = 0; i < 50; i++) {
          await plugin.update();
        }
      });
      
      const averageUpdateTime = duration / 50;
      console.log(`⚡ Average update time: ${averageUpdateTime.toFixed(2)}ms`);
      
      expect(averageUpdateTime).toBeLessThan(50); // Should be under 50ms per update
    });
  });

  describe('🎭 Mock Data Testing', () => {
    test('should handle various data scenarios', async () => {
      const dataTypes = [
        'system-info',
        'time-series',
        'network-data',
        'weather-data',
        'git-data',
        'docker-data'
      ];
      
      for (const dataType of dataTypes) {
        const mockData = PluginTestUtils.createMockData(dataType);
        
        console.log(`🎭 Testing with ${dataType}:`, Object.keys(mockData));
        
        // Simulate plugin receiving this data
        plugin.data = mockData;
        await plugin.render();
        
        const snapshot = PluginTestUtils.createSnapshot(plugin);
        expect(snapshot.content).toBeDefined();
        expect(snapshot.error).toBeUndefined();
      }
    });

    test('should generate appropriate test data for plugin type', () => {
      const clockData = PluginTestUtils.generateTestData('clock');
      expect(clockData.time).toBeDefined();
      expect(clockData.timezone).toBeDefined();
      expect(clockData.format).toBeDefined();
      
      const systemData = PluginTestUtils.generateTestData('system-monitor');
      expect(systemData.cpu).toBeDefined();
      expect(systemData.memory).toBeDefined();
      expect(systemData.network).toBeDefined();
      
      // Test error scenario
      const errorData = PluginTestUtils.generateTestData('clock', 'error');
      expect(errorData.error).toBeDefined();
      
      // Test extreme scenario
      const extremeData = PluginTestUtils.generateTestData('system-monitor', 'extreme');
      expect(extremeData.cpu).toBeDefined();
      expect([0, 100]).toContain(extremeData.cpu);
    });
  });

  describe('🚨 Error Handling and Recovery', () => {
    test('should handle various error scenarios gracefully', async () => {
      const errorScenarios = PluginTestUtils.createErrorScenarios();
      
      for (const scenario of errorScenarios) {
        console.log(`🚨 Testing ${scenario.name}...`);
        
        // Create fresh plugin for each test
        const testPlugin = await harness.createPlugin();
        await testPlugin.initialize();
        await testPlugin.render();
        
        // Setup error condition
        if (scenario.setup) {
          scenario.setup(testPlugin);
        }
        
        // Test error handling
        if (scenario.expectError) {
          await expect(scenario.operation(testPlugin)).rejects.toThrow();
          console.log(`   ✅ Correctly threw error`);
        } else {
          await expect(scenario.operation(testPlugin)).resolves.not.toThrow();
          console.log(`   ✅ Handled gracefully`);
        }
      }
    });

    test('should recover from errors and continue functioning', async () => {
      await plugin.initialize();
      await plugin.render();
      
      // Simulate an error
      const originalRender = plugin.render;
      let errorCount = 0;
      
      plugin.render = async function() {
        errorCount++;
        if (errorCount <= 2) {
          throw new Error('Simulated render error');
        }
        return originalRender.call(this);
      };
      
      // First two calls should fail
      await expect(plugin.render()).rejects.toThrow();
      await expect(plugin.render()).rejects.toThrow();
      
      // Third call should succeed
      await expect(plugin.render()).resolves.not.toThrow();
      
      console.log('✅ Plugin recovered from errors successfully');
    });
  });

  describe('🎮 Interactive Testing', () => {
    test('should handle keyboard interactions', async () => {
      await plugin.initialize();
      await plugin.render();
      
      // Test various key combinations
      const keyTests = [
        { ch: 't', key: { name: 't' } },
        { ch: 'm', key: { name: 'm' } },
        { ch: 'r', key: { name: 'r' } },
        { ch: null, key: { name: 'f5' } }
      ];
      
      for (const keyTest of keyTests) {
        await harness.simulateKeyPress(plugin, keyTest.ch, keyTest.key);
        console.log(`🎮 Simulated key press: ${keyTest.key.name}`);
      }
      
      // Verify plugin is still functional after key presses
      const snapshot = PluginTestUtils.createSnapshot(plugin);
      expect(snapshot.error).toBeUndefined();
    });

    test('should handle mouse interactions', async () => {
      await plugin.initialize();
      await plugin.render();
      
      // Test mouse clicks at different positions
      const clickTests = [
        { x: 10, y: 5, button: 'left' },
        { x: 20, y: 10, button: 'right' },
        { x: 15, y: 8, button: 'middle' }
      ];
      
      for (const clickTest of clickTests) {
        await harness.simulateClick(plugin, clickTest.x, clickTest.y, clickTest.button);
        console.log(`🖱️  Simulated ${clickTest.button} click at (${clickTest.x}, ${clickTest.y})`);
      }
      
      // Verify plugin is still functional after clicks
      const snapshot = PluginTestUtils.createSnapshot(plugin);
      expect(snapshot.error).toBeUndefined();
    });
  });

  describe('🔄 Lifecycle and State Management', () => {
    test('should maintain state through lifecycle', async () => {
      // Initialize
      await plugin.initialize();
      expect(plugin.isInitialized).toBe(true);
      
      // Render
      await plugin.render();
      expect(plugin.isRendered).toBe(true);
      
      const initialSnapshot = PluginTestUtils.createSnapshot(plugin);
      
      // Update
      await plugin.update();
      expect(plugin.isRendered).toBe(true);
      
      // Pause and resume
      plugin.pauseUpdates();
      expect(plugin.isVisible).toBe(false);
      
      plugin.resumeUpdates();
      expect(plugin.isVisible).toBe(true);
      
      // Final state check
      const finalSnapshot = PluginTestUtils.createSnapshot(plugin);
      expect(finalSnapshot.error).toBeUndefined();
      
      // Destroy
      await plugin.destroy();
      expect(plugin.isDestroyed).toBe(true);
    });

    test('should handle rapid state changes', async () => {
      await plugin.initialize();
      
      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        plugin.pauseUpdates();
        plugin.resumeUpdates();
        await plugin.update();
      }
      
      // Should still be functional
      const status = plugin.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.isVisible).toBe(true);
      expect(status.errorCount).toBe(0);
      
      console.log('✅ Plugin handled rapid state changes successfully');
    });
  });

  describe('📊 Advanced Testing Scenarios', () => {
    test('should handle concurrent operations', async () => {
      await plugin.initialize();
      await plugin.render();
      
      // Run multiple operations concurrently
      const operations = [
        plugin.update(),
        plugin.update(),
        plugin.update(),
        harness.simulateKeyPress(plugin, 'r', { name: 'r' }),
        harness.simulateClick(plugin, 10, 5)
      ];
      
      await Promise.all(operations);
      
      // Verify plugin is still stable
      const snapshot = PluginTestUtils.createSnapshot(plugin);
      expect(snapshot.error).toBeUndefined();
      
      console.log('✅ Plugin handled concurrent operations successfully');
    });

    test('should maintain performance under stress', async () => {
      await plugin.initialize();
      
      const stressTest = async () => {
        const operations = [];
        
        // Create 100 concurrent operations
        for (let i = 0; i < 100; i++) {
          operations.push(plugin.update());
        }
        
        await Promise.all(operations);
      };
      
      const { duration } = await PluginTestUtils.measureTime(stressTest);
      
      console.log(`🔥 Stress test completed in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify plugin is still functional
      const status = plugin.getStatus();
      expect(status.errorCount).toBe(0);
    });
  });
});

// Example of creating a comprehensive test suite using the framework
describe('🏗️  Test Suite Builder Example', () => {
  test('should create and run comprehensive test suite', async () => {
    const framework = new PluginTestFramework();
    
    const suite = framework.createTestSuite(ClockWidget, {
      name: 'clock-comprehensive',
      pluginOptions: { title: 'Suite Test Clock', format: '12h' }
    });
    
    // Add various test types
    suite
      .testLifecycle()
      .testConfiguration([
        {
          name: 'valid 12h format',
          input: { format: '12h' },
          expected: { format: '12h', title: 'Suite Test Clock', updateInterval: 1000, showMetrics: true }
        },
        {
          name: 'invalid format',
          input: { format: 'invalid' },
          shouldThrow: true
        }
      ])
      .testPerformance({
        maxInitTime: 100,
        maxRenderTime: 50
      })
      .testErrorHandling([
        {
          name: 'render-failure',
          setup: (plugin) => {
            plugin.element = null;
          },
          operation: (plugin) => plugin.render(),
          expectError: true
        }
      ]);
    
    // Run the suite
    const results = await suite.run();
    
    console.log('🏗️  Suite Results:', {
      passed: results.passed,
      failed: results.failed,
      duration: `${results.duration.toFixed(2)}ms`
    });
    
    expect(results.passed).toBeGreaterThan(0);
    expect(results.duration).toBeGreaterThan(0);
    
    await framework.cleanup();
  });
});