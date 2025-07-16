/**
 * Test Commands
 * 
 * CLI commands for running plugin tests with various options
 * including the visual test runner.
 */

import { VisualTestRunner } from '../plugins/VisualTestRunner.js';
import { PluginTestFramework, PluginTestUtils } from '../plugins/PluginTestFramework.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = new Logger('test-commands');

/**
 * Test command handlers
 */
export class TestCommands {
  constructor() {
    this.framework = new PluginTestFramework();
  }

  /**
   * Launch visual test runner
   */
  async visual(options = {}) {
    console.log('🚀 Launching Visual Test Runner...\n');
    
    const runner = new VisualTestRunner({
      title: 'Orbiton Plugin Test Runner',
      theme: options.theme || 'dark',
      autoRun: options.autoRun || false
    });

    // Auto-discover and add plugins
    await this.discoverAndAddPlugins(runner, options);
    
    // Start the visual runner
    await runner.start();
  }

  /**
   * Run tests in headless mode
   */
  async run(options = {}) {
    console.log('🧪 Running Plugin Tests...\n');
    
    const plugins = await this.discoverPlugins(options);
    const results = new Map();
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    for (const [name, PluginClass] of plugins) {
      console.log(`\n📦 Testing plugin: ${name}`);
      console.log('─'.repeat(50));
      
      const startTime = Date.now();
      
      try {
        const suite = this.framework.createTestSuite(PluginClass, { name });
        
        // Add comprehensive tests
        suite
          .testLifecycle()
          .testConfiguration()
          .testPerformance({ maxInitTime: 200, maxRenderTime: 100 });
        
        if (options.includeAccessibility) {
          suite.test('accessibility checks', async (plugin) => {
            const tests = PluginTestUtils.createAccessibilityTests();
            for (const test of tests) {
              const result = await test.test(plugin);
              console.log(`  ♿ ${test.name}: ${result.passed ? '✅' : '❌'}`);
            }
          });
        }
        
        if (options.includeResponsive) {
          suite.test('responsive design', async (plugin) => {
            const tests = PluginTestUtils.createResponsiveTests();
            for (const test of tests) {
              test.setup(plugin);
              const result = await test.test(plugin);
              console.log(`  📱 ${test.name}: ${result.passed ? '✅' : '❌'}`);
            }
          });
        }
        
        const result = await suite.run();
        const duration = Date.now() - startTime;
        
        results.set(name, { ...result, duration });
        totalPassed += result.passed;
        totalFailed += result.failed;
        totalDuration += duration;
        
        if (result.failed === 0) {
          console.log(`✅ All ${result.passed} tests passed (${duration}ms)`);
        } else {
          console.log(`❌ ${result.failed} tests failed, ${result.passed} passed (${duration}ms)`);
          
          if (options.verbose && result.errors) {
            result.errors.forEach(error => {
              console.log(`   • ${error.test}: ${error.error}`);
            });
          }
        }
        
      } catch (error) {
        console.log(`💥 Test suite crashed: ${error.message}`);
        results.set(name, { passed: 0, failed: 1, errors: [{ test: 'crash', error: error.message }] });
        totalFailed += 1;
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Plugins Tested: ${plugins.size}`);
    console.log(`Total Tests: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed} ✅`);
    console.log(`Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average per Plugin: ${Math.round(totalDuration / plugins.size)}ms`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All tests passed! Your plugins are awesome!');
    } else {
      console.log(`\n⚠️  ${totalFailed} tests failed. Check the output above for details.`);
    }
    
    // Export results if requested
    if (options.export) {
      await this.exportResults(results, options.export);
    }
    
    await this.framework.cleanup();
    
    // Exit with appropriate code
    process.exit(totalFailed > 0 ? 1 : 0);
  }

  /**
   * Generate test template for a plugin
   */
  async generate(pluginName, options = {}) {
    console.log(`🏗️  Generating test template for plugin: ${pluginName}\n`);
    
    const testTemplate = this.createTestTemplate(pluginName, options);
    const filename = `test/${pluginName}.test.js`;
    
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, testTemplate);
      
      console.log(`✅ Test template created: ${filename}`);
      console.log('\n📝 Next steps:');
      console.log(`   1. Edit ${filename} to customize your tests`);
      console.log(`   2. Run: orbiton test run --plugin ${pluginName}`);
      console.log(`   3. Or use: orbiton test visual`);
      
    } catch (error) {
      console.error(`❌ Failed to create test template: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Benchmark plugin performance
   */
  async benchmark(options = {}) {
    console.log('⚡ Running Plugin Performance Benchmarks...\n');
    
    const plugins = await this.discoverPlugins(options);
    const benchmarkResults = [];
    
    for (const [name, PluginClass] of plugins) {
      console.log(`⚡ Benchmarking: ${name}`);
      
      const harness = this.framework.createHarness(PluginClass);
      const plugin = await harness.createPlugin();
      
      // Run performance scenarios
      const scenarios = PluginTestUtils.createPerformanceScenarios();
      const results = { plugin: name, scenarios: {} };
      
      for (const scenario of scenarios) {
        console.log(`  🏃 ${scenario.name}...`);
        
        if (scenario.setup) {
          scenario.setup(plugin);
        }
        
        const result = await scenario.test(plugin);
        results.scenarios[scenario.name] = result;
        
        if (result.duration) {
          console.log(`     Duration: ${result.duration.toFixed(2)}ms`);
        }
        if (result.averagePerUpdate) {
          console.log(`     Avg per update: ${result.averagePerUpdate.toFixed(2)}ms`);
        }
        if (result.memoryIncrease) {
          console.log(`     Memory increase: ${(result.memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        }
      }
      
      benchmarkResults.push(results);
      await harness.cleanup();
    }
    
    // Print benchmark summary
    console.log('\n' + '='.repeat(60));
    console.log('⚡ BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    
    benchmarkResults.forEach(result => {
      console.log(`\n📦 ${result.plugin}:`);
      Object.entries(result.scenarios).forEach(([name, data]) => {
        if (data.duration) {
          console.log(`  ${name}: ${data.duration.toFixed(2)}ms`);
        }
      });
    });
    
    if (options.export) {
      await this.exportBenchmarks(benchmarkResults, options.export);
    }
  }

  /**
   * Discover plugins to test
   */
  async discoverPlugins(options = {}) {
    const plugins = new Map();
    
    // Built-in plugins
    const builtinPath = path.resolve(__dirname, '../../plugins');
    
    try {
      const fs = await import('fs/promises');
      const pluginDirs = await fs.readdir(builtinPath);
      
      for (const dir of pluginDirs) {
        if (options.plugin && dir !== options.plugin) continue;
        
        try {
          const pluginPath = path.join(builtinPath, dir, 'index.js');
          const { default: PluginClass } = await import(pluginPath);
          plugins.set(dir, PluginClass);
        } catch (error) {
          logger.warn(`Failed to load plugin ${dir}:`, error.message);
        }
      }
    } catch (error) {
      logger.warn('Failed to discover built-in plugins:', error.message);
    }
    
    return plugins;
  }

  /**
   * Discover and add plugins to visual runner
   */
  async discoverAndAddPlugins(runner, options = {}) {
    const plugins = await this.discoverPlugins(options);
    
    for (const [name, PluginClass] of plugins) {
      runner.addPlugin(name, PluginClass, {
        pluginOptions: options.pluginOptions || {}
      });
    }
    
    console.log(`📦 Discovered ${plugins.size} plugins for testing`);
  }

  /**
   * Create test template
   */
  createTestTemplate(pluginName, options = {}) {
    const className = pluginName.charAt(0).toUpperCase() + pluginName.slice(1) + 'Widget';
    
    return `/**
 * Test suite for ${pluginName} plugin
 * Generated by Orbiton Test Generator
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PluginTestFramework, PluginTestUtils } from '../src/plugins/PluginTestFramework.js';
import ${className} from '../plugins/${pluginName}/index.js';

describe('${className} Plugin Tests', () => {
  let framework;
  let harness;
  let plugin;

  beforeEach(async () => {
    framework = new PluginTestFramework();
    harness = framework.createHarness(${className});
    plugin = await harness.createPlugin({
      title: 'Test ${className}',
      // Add your plugin options here
    });
  });

  afterEach(async () => {
    await framework.cleanup();
  });

  describe('Basic Plugin Interface', () => {
    test('should follow plugin interface contract', () => {
      PluginTestUtils.assertPluginInterface(plugin, 'base');
    });

    test('should initialize correctly', async () => {
      await plugin.initialize();
      expect(plugin.isInitialized).toBe(true);
    });

    test('should render without errors', async () => {
      await plugin.initialize();
      await plugin.render();
      expect(plugin.isRendered).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should have valid options schema', () => {
      const schema = plugin.getOptionsSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
    });

    test('should validate options correctly', () => {
      const validOptions = { title: 'Test Plugin' };
      const result = plugin.validateOptions(validOptions);
      expect(result.title).toBe('Test Plugin');
    });
  });

  describe('Visual Testing', () => {
    test('should create consistent snapshots', async () => {
      await plugin.initialize();
      await plugin.render();
      
      const snapshot1 = PluginTestUtils.createSnapshot(plugin);
      await plugin.render();
      const snapshot2 = PluginTestUtils.createSnapshot(plugin);
      
      const comparison = PluginTestUtils.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should meet performance requirements', async () => {
      const stats = await harness.testPerformance(plugin, 50);
      
      expect(stats.initialize.average).toBeLessThan(100); // 100ms
      expect(stats.render.average).toBeLessThan(50); // 50ms
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      expect(() => plugin.handleError(error)).not.toThrow();
    });
  });

  // Add your custom tests here
  describe('Custom Tests', () => {
    test('should do something specific to your plugin', async () => {
      // TODO: Add plugin-specific tests
      expect(true).toBe(true);
    });
  });
});
`;
  }

  /**
   * Export test results
   */
  async exportResults(results, filename) {
    const exportData = {
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(results),
      summary: {
        totalPlugins: results.size,
        totalPassed: Array.from(results.values()).reduce((sum, r) => sum + r.passed, 0),
        totalFailed: Array.from(results.values()).reduce((sum, r) => sum + r.failed, 0),
        totalDuration: Array.from(results.values()).reduce((sum, r) => sum + (r.duration || 0), 0)
      }
    };
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
      console.log(`\n📄 Results exported to: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to export results: ${error.message}`);
    }
  }

  /**
   * Export benchmark results
   */
  async exportBenchmarks(results, filename) {
    const exportData = {
      timestamp: new Date().toISOString(),
      benchmarks: results
    };
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
      console.log(`\n📄 Benchmarks exported to: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to export benchmarks: ${error.message}`);
    }
  }
}

export default TestCommands;