# 🧪 Orbiton Plugin Testing Framework

Welcome to the most comprehensive and developer-friendly plugin testing framework! This framework makes testing Orbiton plugins not just easy, but actually fun and engaging.

## 🚀 Features

### 🎨 Visual Test Runner
- **Interactive Dashboard**: Beautiful TUI interface for running and monitoring tests
- **Real-time Feedback**: Watch tests execute with live progress updates
- **Performance Metrics**: Monitor CPU, memory, and execution time
- **Visual Snapshots**: Compare widget renderings across test runs
- **Comprehensive Reporting**: Detailed test results with error analysis

### 🔧 Comprehensive Testing Tools
- **Plugin Interface Validation**: Ensure plugins follow the correct interface
- **Configuration Testing**: Validate plugin options and schemas
- **Performance Benchmarking**: Measure initialization, rendering, and update times
- **Error Handling**: Test graceful degradation and recovery
- **Accessibility Testing**: Ensure plugins are accessible to all users
- **Responsive Design**: Test plugins across different screen sizes

### 🎭 Mock Data Generation
- **Smart Data Generation**: Create realistic test data for any plugin type
- **Scenario Testing**: Test with normal, error, loading, and extreme conditions
- **Time Series Data**: Generate realistic time-based data for charts
- **System Metrics**: Mock CPU, memory, network, and other system data

### 🎮 Interactive Testing
- **Keyboard Simulation**: Test keyboard shortcuts and navigation
- **Mouse Interaction**: Simulate clicks, scrolls, and hover events
- **Focus Management**: Test focus handling and accessibility
- **State Management**: Test plugin lifecycle and state transitions

## 🏃 Quick Start

### 1. Launch Visual Test Runner

```bash
# Start the interactive test runner
orbiton test visual

# Or with specific options
orbiton test visual --theme dark --auto-run
```

### 2. Run Tests in Headless Mode

```bash
# Run all plugin tests
orbiton test run

# Run tests for specific plugin
orbiton test run --plugin clock

# Include accessibility and responsive tests
orbiton test run --include-accessibility --include-responsive --verbose
```

### 3. Generate Test Template

```bash
# Generate test template for your plugin
orbiton test generate my-plugin

# This creates test/my-plugin.test.js with comprehensive test structure
```

### 4. Run Performance Benchmarks

```bash
# Benchmark all plugins
orbiton test benchmark

# Benchmark specific plugin and export results
orbiton test benchmark --plugin clock --export benchmark-results.json
```

## 📝 Writing Tests

### Basic Plugin Test

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PluginTestFramework, PluginTestUtils } from '../src/plugins/PluginTestFramework.js';
import MyWidget from '../plugins/my-widget/index.js';

describe('MyWidget Tests', () => {
  let framework;
  let harness;
  let plugin;

  beforeEach(async () => {
    framework = new PluginTestFramework();
    harness = framework.createHarness(MyWidget);
    plugin = await harness.createPlugin({
      title: 'Test Widget',
      updateInterval: 1000
    });
  });

  afterEach(async () => {
    await framework.cleanup();
  });

  test('should follow plugin interface', () => {
    PluginTestUtils.assertPluginInterface(plugin, 'base');
  });

  test('should render correctly', async () => {
    await plugin.initialize();
    await plugin.render();
    
    const snapshot = PluginTestUtils.createSnapshot(plugin);
    expect(snapshot.content).toContain('Test Widget');
  });
});
```

### Advanced Testing with Test Suite Builder

```javascript
import { PluginTestFramework } from '../src/plugins/PluginTestFramework.js';
import MyWidget from '../plugins/my-widget/index.js';

const framework = new PluginTestFramework();

const suite = framework.createTestSuite(MyWidget, {
  name: 'my-widget-comprehensive',
  pluginOptions: { title: 'Comprehensive Test' }
});

// Add comprehensive test types
suite
  .testLifecycle()
  .testConfiguration([
    {
      name: 'valid title',
      input: { title: 'My Widget' },
      expected: { title: 'My Widget', updateInterval: 5000 }
    }
  ])
  .testPerformance({
    maxInitTime: 100,
    maxRenderTime: 50
  })
  .testErrorHandling([
    {
      name: 'render-failure',
      setup: (plugin) => { plugin.element = null; },
      operation: (plugin) => plugin.render(),
      expectError: true
    }
  ]);

// Run the suite
const results = await suite.run();
console.log('Results:', results);
```

## 🎨 Visual Testing

### Snapshot Testing

```javascript
test('should maintain visual consistency', async () => {
  await plugin.initialize();
  await plugin.render();
  
  const snapshot1 = PluginTestUtils.createSnapshot(plugin);
  
  // Make some changes
  plugin.options.title = 'Updated Title';
  await plugin.render();
  
  const snapshot2 = PluginTestUtils.createSnapshot(plugin);
  const comparison = PluginTestUtils.compareSnapshots(snapshot1, snapshot2);
  
  expect(comparison.identical).toBe(false);
  expect(comparison.differences).toHaveLength(1);
});
```

### Responsive Design Testing

```javascript
test('should adapt to different screen sizes', async () => {
  const responsiveTests = PluginTestUtils.createResponsiveTests();
  
  for (const testCase of responsiveTests) {
    testCase.setup(plugin);
    await plugin.initialize();
    const result = await testCase.test(plugin);
    
    expect(result.passed).toBe(true);
    console.log(`✅ ${testCase.name}: ${result.content.length} chars`);
  }
});
```

## ♿ Accessibility Testing

```javascript
test('should be accessible', async () => {
  await plugin.initialize();
  await plugin.render();
  
  const accessibilityTests = PluginTestUtils.createAccessibilityTests();
  
  for (const testCase of accessibilityTests) {
    const result = await testCase.test(plugin);
    
    if (!result.passed) {
      console.warn(`♿ ${testCase.name} failed:`, result.reason);
    }
    
    // Log results but don't fail test (configurable)
    expect(result).toBeDefined();
  }
});
```

## ⚡ Performance Testing

### Basic Performance Testing

```javascript
test('should meet performance requirements', async () => {
  const stats = await harness.testPerformance(plugin, 100);
  
  expect(stats.initialize.average).toBeLessThan(100); // 100ms
  expect(stats.render.average).toBeLessThan(50);      // 50ms
  expect(stats.update.average).toBeLessThan(25);      // 25ms
});
```

### Advanced Performance Scenarios

```javascript
test('should handle performance scenarios', async () => {
  const scenarios = PluginTestUtils.createPerformanceScenarios();
  
  for (const scenario of scenarios) {
    if (scenario.setup) {
      scenario.setup(plugin);
    }
    
    const result = await scenario.test(plugin);
    
    if (result.duration) {
      expect(result.duration).toBeLessThan(1000); // 1 second
    }
    
    if (result.memoryIncrease) {
      expect(result.memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    }
  }
});
```

## 🎭 Mock Data Testing

### Generate Test Data

```javascript
test('should handle various data types', () => {
  // Generate different types of mock data
  const systemData = PluginTestUtils.createMockData('system-info');
  const timeSeriesData = PluginTestUtils.createMockData('time-series', { points: 100 });
  const weatherData = PluginTestUtils.createMockData('weather-data');
  
  // Test plugin with different data
  plugin.data = systemData;
  expect(plugin.data.cpu).toBeDefined();
  
  plugin.data = timeSeriesData;
  expect(plugin.data).toHaveLength(100);
  
  plugin.data = weatherData;
  expect(plugin.data.temperature).toBeDefined();
});
```

### Scenario-Based Testing

```javascript
test('should handle different scenarios', () => {
  const scenarios = ['normal', 'error', 'loading', 'empty', 'extreme'];
  
  scenarios.forEach(scenario => {
    const data = PluginTestUtils.generateTestData('system-monitor', scenario);
    
    plugin.data = data;
    
    if (scenario === 'error') {
      expect(data.error).toBeDefined();
    } else if (scenario === 'extreme') {
      // Values should be at extremes (0 or 100)
      expect([0, 100]).toContain(data.cpu);
    }
  });
});
```

## 🎮 Interactive Testing

### Keyboard Testing

```javascript
test('should handle keyboard interactions', async () => {
  await plugin.initialize();
  await plugin.render();
  
  // Test various key combinations
  await harness.simulateKeyPress(plugin, 'r', { name: 'r' });
  await harness.simulateKeyPress(plugin, null, { name: 'f5' });
  await harness.simulateKeyPress(plugin, 't', { name: 't' });
  
  // Verify plugin is still functional
  const snapshot = PluginTestUtils.createSnapshot(plugin);
  expect(snapshot.error).toBeUndefined();
});
```

### Mouse Testing

```javascript
test('should handle mouse interactions', async () => {
  await plugin.initialize();
  await plugin.render();
  
  // Test different mouse interactions
  await harness.simulateClick(plugin, 10, 5, 'left');
  await harness.simulateClick(plugin, 20, 10, 'right');
  
  // Verify plugin responds correctly
  const snapshot = PluginTestUtils.createSnapshot(plugin);
  expect(snapshot.error).toBeUndefined();
});
```

## 🚨 Error Handling Testing

```javascript
test('should handle errors gracefully', async () => {
  const errorScenarios = PluginTestUtils.createErrorScenarios();
  
  for (const scenario of errorScenarios) {
    const testPlugin = await harness.createPlugin();
    await testPlugin.initialize();
    
    if (scenario.setup) {
      scenario.setup(testPlugin);
    }
    
    if (scenario.expectError) {
      await expect(scenario.operation(testPlugin)).rejects.toThrow();
    } else {
      await expect(scenario.operation(testPlugin)).resolves.not.toThrow();
    }
  }
});
```

## 📊 Test Reporting

### Export Results

```bash
# Export test results to JSON
orbiton test run --export test-results.json

# Export benchmark results
orbiton test benchmark --export benchmark-results.json
```

### Visual Test Runner Reports

The visual test runner automatically generates comprehensive reports including:

- **Test Summary**: Pass/fail counts, duration, memory usage
- **Performance Metrics**: Charts showing execution times and resource usage
- **Error Details**: Detailed error messages and stack traces
- **Visual Snapshots**: Before/after comparisons of widget rendering

## 🎯 Best Practices

### 1. Test Structure
- Use descriptive test names
- Group related tests with `describe` blocks
- Set up and tear down properly with `beforeEach`/`afterEach`

### 2. Performance Testing
- Set realistic performance expectations
- Test with various data sizes
- Monitor memory usage for data widgets

### 3. Visual Testing
- Create snapshots for critical UI states
- Test responsive behavior across screen sizes
- Verify accessibility compliance

### 4. Error Handling
- Test both expected and unexpected errors
- Verify graceful degradation
- Test recovery mechanisms

### 5. Mock Data
- Use realistic test data
- Test edge cases and extreme values
- Simulate network failures and delays

## 🔧 Configuration

### Test Configuration File

Create a `test.config.js` file to customize testing behavior:

```javascript
export default {
  // Test framework options
  framework: {
    timeout: 10000,
    retries: 3,
    parallel: true
  },
  
  // Performance thresholds
  performance: {
    maxInitTime: 100,
    maxRenderTime: 50,
    maxUpdateTime: 25,
    maxMemoryIncrease: 50 * 1024 * 1024 // 50MB
  },
  
  // Visual testing options
  visual: {
    threshold: 0.1, // 10% difference threshold
    saveSnapshots: true,
    snapshotDir: './test/snapshots'
  },
  
  // Accessibility options
  accessibility: {
    enforceStandards: true,
    checkColorContrast: true,
    requireKeyboardNavigation: true
  }
};
```

## 🎉 Examples

Check out these comprehensive examples:

- [`test/examples/comprehensive-plugin-test.js`](./examples/comprehensive-plugin-test.js) - Complete testing example
- [`test/examples/plugin-testing-example.test.js`](./examples/plugin-testing-example.test.js) - Basic testing patterns
- [`test/examples/BaseWidget.test.js`](./examples/BaseWidget.test.js) - Framework testing

## 🆘 Troubleshooting

### Common Issues

1. **Tests timeout**: Increase timeout in test configuration
2. **Memory leaks**: Ensure proper cleanup in `afterEach`
3. **Visual differences**: Check for timing issues in rendering
4. **Performance failures**: Verify system resources and test environment

### Debug Mode

Run tests with debug output:

```bash
orbiton test run --verbose
```

### Visual Debugging

Use the visual test runner for interactive debugging:

```bash
orbiton test visual
```

Press F1 in the visual runner for help and keyboard shortcuts.

## 🚀 What Makes This Framework Cool?

1. **🎨 Beautiful Visual Interface**: Interactive TUI that makes testing enjoyable
2. **📊 Real-time Metrics**: Watch performance metrics update live
3. **🎭 Smart Mock Data**: Realistic test data generation for any scenario
4. **♿ Accessibility First**: Built-in accessibility testing
5. **📱 Responsive Testing**: Automatic testing across screen sizes
6. **🔄 Snapshot Testing**: Visual regression testing made easy
7. **⚡ Performance Focus**: Comprehensive performance benchmarking
8. **🎮 Interactive Testing**: Simulate user interactions
9. **🚨 Error Resilience**: Test error handling and recovery
10. **📈 Comprehensive Reporting**: Beautiful reports and exports

This testing framework doesn't just test your plugins—it makes the entire development process more enjoyable and productive! 🎉