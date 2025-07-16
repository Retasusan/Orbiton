/**
 * Visual Test Runner
 * 
 * An interactive, visual test runner for Orbiton plugins that provides
 * real-time feedback, beautiful visualizations, and comprehensive reporting.
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { EventEmitter } from 'events';
// PluginTestFramework will be imported dynamically when needed

/**
 * Visual Test Runner with interactive dashboard
 */
export class VisualTestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      title: 'Orbiton Plugin Test Runner',
      theme: 'dark',
      autoRun: false,
      showProgress: true,
      showLogs: true,
      ...options
    };
    
    // UI Components
    this.screen = null;
    this.grid = null;
    this.testList = null;
    this.progressBar = null;
    this.logBox = null;
    this.resultsTable = null;
    this.metricsChart = null;
    this.statusBar = null;
    
    // Test Management
    this.framework = null;
    this.testSuites = new Map();
    this.currentTest = null;
    this.testResults = [];
    this.isRunning = false;
    
    // Metrics
    this.metrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      averageDuration: 0,
      memoryUsage: [],
      cpuUsage: []
    };
    
    // Logs
    this.logs = [];
    this.maxLogs = 1000;
  }

  async getFramework() {
    if (!this.framework) {
      const { PluginTestFramework } = await import('./PluginTestFramework.js');
      this.framework = new PluginTestFramework();
    }
    return this.framework;
  }

  /**
   * Initialize the visual test runner
   */
  async initialize() {
    this.createUI();
    this.setupEventHandlers();
    this.startMetricsCollection();
    
    this.log('info', '🚀 Visual Test Runner initialized');
    this.updateStatus('Ready');
  }

  /**
   * Create the user interface
   */
  createUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: this.options.title,
      dockBorders: true,
      fullUnicode: true,
      autoPadding: true
    });

    // Create grid layout
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Test list (left panel)
    this.testList = this.grid.set(0, 0, 6, 4, blessed.list, {
      label: ' 📋 Test Suites ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      border: { type: 'line' },
      style: {
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
        border: { fg: 'cyan' }
      },
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { inverse: true }
      }
    });

    // Progress bar (top center)
    this.progressBar = this.grid.set(0, 4, 1, 8, contrib.gauge, {
      label: ' 🏃 Progress ',
      stroke: 'green',
      fill: 'white'
    });

    // Results table (center)
    this.resultsTable = this.grid.set(1, 4, 5, 8, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: true,
      label: ' 📊 Test Results ',
      width: '100%',
      height: '100%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 2,
      columnWidth: [20, 10, 10, 15, 25]
    });

    // Metrics chart (bottom left)
    this.metricsChart = this.grid.set(6, 0, 6, 6, contrib.line, {
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      xLabelPadding: 3,
      xPadding: 5,
      label: ' 📈 Performance Metrics ',
      showLegend: true,
      wholeNumbersOnly: false
    });

    // Log box (bottom right)
    this.logBox = this.grid.set(6, 6, 5, 6, blessed.log, {
      label: ' 📝 Logs ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollback: this.maxLogs,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' }
      },
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { inverse: true }
      }
    });

    // Status bar (bottom)
    this.statusBar = this.grid.set(11, 0, 1, 12, blessed.box, {
      tags: true,
      content: ' Status: Ready | Press F1 for help | Press q to quit ',
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    // Help overlay (initially hidden)
    this.helpBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      label: ' 🆘 Help ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'yellow' }
      },
      content: this.getHelpContent(),
      hidden: true,
      scrollable: true,
      keys: true,
      vi: true
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Screen events
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });

    this.screen.key(['f1'], () => {
      this.toggleHelp();
    });

    this.screen.key(['f5', 'r'], () => {
      this.runSelectedTest();
    });

    this.screen.key(['f6'], () => {
      this.runAllTests();
    });

    this.screen.key(['f7'], () => {
      this.clearResults();
    });

    this.screen.key(['f8'], () => {
      this.exportResults();
    });

    // Test list events
    this.testList.on('select', (item, index) => {
      this.selectTest(index);
    });

    // Results table events
    this.resultsTable.on('select', (item, index) => {
      this.showTestDetails(index);
    });

    // Help box events
    this.helpBox.key(['escape'], () => {
      this.helpBox.hide();
      this.screen.render();
    });
  }

  /**
   * Add a test suite to the runner
   */
  addTestSuite(name, testSuite) {
    this.testSuites.set(name, testSuite);
    this.updateTestList();
    this.log('info', `📦 Added test suite: ${name}`);
  }

  /**
   * Add a plugin class for testing
   */
  async addPlugin(name, PluginClass, options = {}) {
    const framework = await this.getFramework();
    const suite = framework.createTestSuite(PluginClass, {
      name,
      ...options
    });
    
    // Add comprehensive tests
    suite
      .testLifecycle()
      .testConfiguration()
      .testPerformance()
      .testErrorHandling();
    
    this.addTestSuite(name, suite);
  }

  /**
   * Update the test list display
   */
  updateTestList() {
    const items = Array.from(this.testSuites.keys()).map(name => {
      const suite = this.testSuites.get(name);
      const status = this.getTestSuiteStatus(name);
      const icon = this.getStatusIcon(status);
      return `${icon} ${name}`;
    });
    
    this.testList.setItems(items);
    this.screen.render();
  }

  /**
   * Get status icon for test suite
   */
  getStatusIcon(status) {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🏃';
      case 'skipped': return '⏭️';
      default: return '⚪';
    }
  }

  /**
   * Get test suite status
   */
  getTestSuiteStatus(name) {
    const results = this.testResults.filter(r => r.suite === name);
    if (results.length === 0) return 'pending';
    
    const latest = results[results.length - 1];
    return latest.passed ? 'passed' : 'failed';
  }

  /**
   * Run selected test suite
   */
  async runSelectedTest() {
    const selected = this.testList.selected;
    if (selected < 0 || selected >= this.testSuites.size) return;
    
    const suiteName = Array.from(this.testSuites.keys())[selected];
    await this.runTestSuite(suiteName);
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    if (this.isRunning) {
      this.log('warn', '⚠️  Tests are already running');
      return;
    }
    
    this.isRunning = true;
    this.updateStatus('Running all tests...');
    
    let completed = 0;
    const total = this.testSuites.size;
    
    for (const [name, suite] of this.testSuites) {
      await this.runTestSuite(name);
      completed++;
      
      const progress = (completed / total) * 100;
      this.progressBar.setPercent(progress);
      this.screen.render();
    }
    
    this.isRunning = false;
    this.updateStatus('All tests completed');
    this.updateMetrics();
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(name) {
    const suite = this.testSuites.get(name);
    if (!suite) return;
    
    this.currentTest = name;
    this.log('info', `🏃 Running test suite: ${name}`);
    this.updateStatus(`Running: ${name}`);
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const results = await suite.run();
      const duration = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      const testResult = {
        suite: name,
        passed: results.failed === 0,
        totalTests: results.passed + results.failed,
        passedTests: results.passed,
        failedTests: results.failed,
        duration,
        memoryUsed,
        errors: results.errors || [],
        timestamp: new Date()
      };
      
      this.testResults.push(testResult);
      this.updateResultsTable();
      this.updateTestList();
      
      if (testResult.passed) {
        this.log('success', `✅ ${name}: ${testResult.passedTests} tests passed in ${duration}ms`);
      } else {
        this.log('error', `❌ ${name}: ${testResult.failedTests} tests failed`);
        testResult.errors.forEach(error => {
          this.log('error', `   ${error.test}: ${error.error}`);
        });
      }
      
    } catch (error) {
      this.log('error', `💥 Test suite ${name} crashed: ${error.message}`);
      
      this.testResults.push({
        suite: name,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        errors: [{ test: 'suite-crash', error: error.message }],
        timestamp: new Date()
      });
    }
    
    this.currentTest = null;
    this.screen.render();
  }

  /**
   * Update results table
   */
  updateResultsTable() {
    const headers = ['Suite', 'Status', 'Tests', 'Duration', 'Memory'];
    const data = this.testResults.map(result => [
      result.suite,
      result.passed ? '✅ PASS' : '❌ FAIL',
      `${result.passedTests}/${result.totalTests}`,
      `${result.duration}ms`,
      `${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`
    ]);
    
    this.resultsTable.setData({
      headers,
      data
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    // Calculate metrics
    this.metrics.totalTests = this.testResults.reduce((sum, r) => sum + r.totalTests, 0);
    this.metrics.passedTests = this.testResults.reduce((sum, r) => sum + r.passedTests, 0);
    this.metrics.failedTests = this.testResults.reduce((sum, r) => sum + r.failedTests, 0);
    this.metrics.totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    this.metrics.averageDuration = this.metrics.totalDuration / this.testResults.length || 0;
    
    // Update metrics chart
    const labels = this.testResults.map((_, i) => `Test ${i + 1}`);
    const durations = this.testResults.map(r => r.duration);
    const memoryUsage = this.testResults.map(r => r.memoryUsed / 1024 / 1024);
    
    this.metricsChart.setData([
      {
        title: 'Duration (ms)',
        x: labels,
        y: durations,
        style: { line: 'green' }
      },
      {
        title: 'Memory (MB)',
        x: labels,
        y: memoryUsage,
        style: { line: 'yellow' }
      }
    ]);
  }

  /**
   * Start collecting system metrics
   */
  startMetricsCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push(memUsage.heapUsed / 1024 / 1024);
      
      // Keep only last 60 data points
      if (this.metrics.memoryUsage.length > 60) {
        this.metrics.memoryUsage.shift();
      }
    }, 1000);
  }

  /**
   * Log a message
   */
  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const levelIcon = {
      info: 'ℹ️',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    }[level] || 'ℹ️';
    
    const logMessage = `[${timestamp}] ${levelIcon} ${message}`;
    
    this.logs.push({ level, message: logMessage, timestamp: Date.now() });
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    if (this.logBox) {
      this.logBox.log(logMessage);
      this.screen.render();
    }
  }

  /**
   * Update status bar
   */
  updateStatus(status) {
    if (this.statusBar) {
      const content = ` Status: ${status} | F1: Help | F5: Run Selected | F6: Run All | Q: Quit `;
      this.statusBar.setContent(content);
      this.screen.render();
    }
  }

  /**
   * Toggle help display
   */
  toggleHelp() {
    if (this.helpBox.hidden) {
      this.helpBox.show();
      this.helpBox.focus();
    } else {
      this.helpBox.hide();
      this.testList.focus();
    }
    this.screen.render();
  }

  /**
   * Get help content
   */
  getHelpContent() {
    return `
{center}{bold}🆘 Orbiton Plugin Test Runner Help{/bold}{/center}

{bold}Keyboard Shortcuts:{/bold}
  F1          - Show/hide this help
  F5 / R      - Run selected test suite
  F6          - Run all test suites
  F7          - Clear results
  F8          - Export results
  Q / Ctrl+C  - Quit
  Escape      - Close dialogs

{bold}Navigation:{/bold}
  Arrow Keys  - Navigate lists and tables
  Enter       - Select item
  Tab         - Switch between panels
  Page Up/Dn  - Scroll through logs

{bold}Test Suite Status Icons:{/bold}
  ⚪ Pending   - Not yet run
  🏃 Running   - Currently executing
  ✅ Passed    - All tests passed
  ❌ Failed    - Some tests failed
  ⏭️  Skipped   - Test was skipped

{bold}Features:{/bold}
  • Real-time test execution monitoring
  • Performance metrics and memory usage tracking
  • Comprehensive error reporting
  • Visual snapshots and comparisons
  • Accessibility and responsive design testing
  • Interactive test debugging

{bold}Tips:{/bold}
  • Use the results table to see detailed test information
  • Check the logs panel for detailed error messages
  • Monitor the performance chart for resource usage
  • Export results for further analysis

Press Escape to close this help.
`;
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.testResults = [];
    this.logs = [];
    this.updateResultsTable();
    this.updateTestList();
    this.logBox.setContent('');
    this.log('info', '🧹 Results cleared');
  }

  /**
   * Export results to file
   */
  async exportResults() {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: this.metrics,
      results: this.testResults,
      logs: this.logs
    };
    
    const filename = `test-results-${Date.now()}.json`;
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
      this.log('success', `📄 Results exported to ${filename}`);
    } catch (error) {
      this.log('error', `Failed to export results: ${error.message}`);
    }
  }

  /**
   * Show detailed information about a test result
   */
  showTestDetails(index) {
    if (index < 0 || index >= this.testResults.length) return;
    
    const result = this.testResults[index];
    
    // Create details dialog
    const detailsBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      label: ` 📋 Test Details: ${result.suite} `,
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'cyan' }
      },
      scrollable: true,
      keys: true,
      vi: true
    });
    
    const content = [
      `{bold}Test Suite:{/bold} ${result.suite}`,
      `{bold}Status:{/bold} ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `{bold}Total Tests:{/bold} ${result.totalTests}`,
      `{bold}Passed:{/bold} ${result.passedTests}`,
      `{bold}Failed:{/bold} ${result.failedTests}`,
      `{bold}Duration:{/bold} ${result.duration}ms`,
      `{bold}Memory Used:{/bold} ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`,
      `{bold}Timestamp:{/bold} ${result.timestamp.toLocaleString()}`,
      '',
      `{bold}Errors:{/bold}`
    ];
    
    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        content.push(`  • ${error.test}: ${error.error}`);
      });
    } else {
      content.push('  No errors');
    }
    
    detailsBox.setContent(content.join('\n'));
    
    detailsBox.key(['escape'], () => {
      detailsBox.destroy();
      this.screen.render();
    });
    
    detailsBox.focus();
    this.screen.render();
  }

  /**
   * Start the visual test runner
   */
  async start() {
    await this.initialize();
    this.screen.render();
    
    // Focus on test list
    this.testList.focus();
    
    this.log('info', '🎉 Visual Test Runner started');
    this.log('info', '💡 Press F1 for help, F6 to run all tests');
  }

  /**
   * Shutdown the test runner
   */
  async shutdown() {
    this.log('info', '👋 Shutting down test runner...');
    
    await this.framework.cleanup();
    
    if (this.screen) {
      this.screen.destroy();
    }
    
    process.exit(0);
  }
}

export default VisualTestRunner;