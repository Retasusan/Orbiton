# Design Document

## Overview

The Orbiton dashboard rewrite will transform the current plugin system into a modern, developer-friendly framework that prioritizes ease of use while maintaining powerful customization capabilities. The new architecture will feature a zero-configuration approach with intelligent defaults, comprehensive plugin management, and AI-friendly development patterns.

The system will be distributed as an npm package with global CLI capabilities, supporting both built-in and external plugins through a standardized API. The design emphasizes progressive disclosure - users can start with zero configuration and gradually customize as needed.

## Architecture

### Core System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orbiton CLI                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Config        │  │   Plugin        │  │   Theme      │ │
│  │   Manager       │  │   Manager       │  │   System     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Dashboard     │  │   Widget        │  │   Event      │ │
│  │   Engine        │  │   Runtime       │  │   System     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 Blessed.js TUI Layer                        │
└─────────────────────────────────────────────────────────────┘
```

### Plugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin Ecosystem                         │
├─────────────────────────────────────────────────────────────┤
│  Built-in Plugins          │  External Plugins              │
│  ┌─────────────────────┐   │  ┌─────────────────────────┐   │
│  │ • System Info       │   │  │ • NPM Packages          │   │
│  │ • Clock/Time        │   │  │ • Local Development     │   │
│  │ • Resource Monitor  │   │  │ • Git Repositories      │   │
│  │ • Process List      │   │  │ • Custom Widgets        │   │
│  └─────────────────────┘   │  └─────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Plugin Base Classes                      │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │   BaseWidget        │   │   DataWidget                │  │
│  │   • Lifecycle       │   │   • Auto-refresh            │  │
│  │   • Theming         │   │   • Error handling          │  │
│  │   • Events          │   │   • Data caching            │  │
│  └─────────────────────┘   └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Configuration System

#### Smart Configuration Manager
```javascript
class ConfigManager {
  constructor() {
    this.userConfig = null;
    this.defaultConfig = null;
    this.environmentConfig = null;
    this.validator = new ConfigValidator();
  }

  // Load configuration with intelligent defaults
  async loadConfig() {
    const userConfig = await this.loadUserConfig();
    const envConfig = await this.detectEnvironment();
    const defaults = await this.generateDefaults(envConfig);
    
    const mergedConfig = this.mergeConfigs(defaults, envConfig, userConfig);
    
    // Validate configuration before returning
    const validationResult = await this.validator.validate(mergedConfig);
    if (!validationResult.isValid) {
      throw new ConfigurationError('Invalid configuration', validationResult.errors);
    }
    
    return mergedConfig;
  }

  // Detect user environment and suggest plugins
  async detectEnvironment() {
    const detectors = [
      new DockerDetector(),
      new GitDetector(),
      new NodeDetector(),
      new SystemDetector()
    ];
    
    const capabilities = await Promise.all(
      detectors.map(d => d.detect())
    );
    
    return this.buildEnvironmentProfile(capabilities);
  }

  // Migration from legacy configurations
  async migrateFromLegacy() {
    const legacyConfigPath = '.orbitonrc.json';
    
    if (await this.fileExists(legacyConfigPath)) {
      const legacyConfig = await this.loadFile(legacyConfigPath);
      const migrator = new ConfigMigrator();
      
      try {
        const migratedConfig = await migrator.migrate(legacyConfig);
        await this.saveConfig(migratedConfig);
        
        // Backup legacy config
        await this.backupFile(legacyConfigPath);
        
        return {
          success: true,
          message: 'Configuration migrated successfully',
          backupPath: `${legacyConfigPath}.backup`
        };
      } catch (error) {
        return {
          success: false,
          message: 'Migration failed',
          error: error.message,
          manualSteps: migrator.getManualMigrationSteps(legacyConfig)
        };
      }
    }
    
    return { success: false, message: 'No legacy configuration found' };
  }
}

// Configuration validation system
class ConfigValidator {
  constructor() {
    this.schema = this.loadConfigSchema();
  }

  async validate(config) {
    const errors = [];
    
    // Validate against JSON schema
    const schemaErrors = this.validateSchema(config);
    errors.push(...schemaErrors);
    
    // Validate plugin configurations
    const pluginErrors = await this.validatePlugins(config.plugins || []);
    errors.push(...pluginErrors);
    
    // Validate layout configuration
    const layoutErrors = this.validateLayout(config.layout);
    errors.push(...layoutErrors);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.generateWarnings(config)
    };
  }

  async validatePlugins(plugins) {
    const errors = [];
    
    for (const plugin of plugins) {
      try {
        const pluginModule = await import(`./plugins/${plugin.name}/plugin.json`);
        const pluginSchema = pluginModule.optionsSchema;
        
        if (pluginSchema && plugin.options) {
          const pluginErrors = this.validateAgainstSchema(plugin.options, pluginSchema);
          errors.push(...pluginErrors.map(err => ({
            plugin: plugin.name,
            field: err.field,
            message: err.message,
            suggestion: err.suggestion
          })));
        }
      } catch (error) {
        errors.push({
          plugin: plugin.name,
          message: `Plugin not found or invalid: ${error.message}`,
          suggestion: 'Check plugin name or install the plugin'
        });
      }
    }
    
    return errors;
  }

  generateWarnings(config) {
    const warnings = [];
    
    // Check for performance implications
    if (config.plugins && config.plugins.length > 10) {
      warnings.push({
        type: 'performance',
        message: 'Large number of plugins may impact performance',
        suggestion: 'Consider disabling unused plugins'
      });
    }
    
    // Check for conflicting plugins
    const conflicts = this.detectPluginConflicts(config.plugins || []);
    warnings.push(...conflicts);
    
    return warnings;
  }
}

// Configuration migration system
class ConfigMigrator {
  async migrate(legacyConfig) {
    const migrationSteps = [
      this.migratePluginFormat,
      this.migrateLayoutFormat,
      this.migrateThemeFormat,
      this.addNewDefaults
    ];
    
    let config = { ...legacyConfig };
    
    for (const step of migrationSteps) {
      config = await step.call(this, config);
    }
    
    return config;
  }

  migratePluginFormat(config) {
    // Convert old plugin format to new format
    if (config.widgets) {
      config.plugins = config.widgets.map(widget => ({
        name: widget.type,
        enabled: widget.enabled !== false,
        position: [widget.row, widget.col, widget.rowSpan || 1, widget.colSpan || 1],
        options: widget.options || {},
        updateInterval: widget.refreshInterval || 5000
      }));
      delete config.widgets;
    }
    
    return config;
  }

  getManualMigrationSteps(legacyConfig) {
    const steps = [];
    
    if (legacyConfig.customTheme) {
      steps.push({
        description: 'Custom theme migration',
        action: 'Manually convert custom theme to new format',
        oldFormat: legacyConfig.customTheme,
        newFormat: 'See theme documentation for new format'
      });
    }
    
    return steps;
  }
}
```

#### Configuration Schema
```typescript
interface OrbitonConfig {
  // Zero-config mode (default: true)
  autoDetect?: boolean;
  
  // Layout configuration
  layout?: {
    preset?: string;
    custom?: boolean;
    grid?: { rows: number; cols: number };
  };
  
  // Plugin configuration
  plugins?: PluginConfig[];
  
  // Theme configuration
  theme?: string | ThemeConfig;
  
  // Performance settings
  performance?: {
    updateInterval?: number;
    maxConcurrentUpdates?: number;
  };
}

interface PluginConfig {
  name: string;
  enabled?: boolean;
  position?: [number, number, number, number];
  options?: Record<string, any>;
  updateInterval?: number;
}
```

### 2. Plugin System

#### Base Widget Class
```javascript
class BaseWidget {
  constructor(name, options = {}) {
    this.name = name;
    this.options = this.validateOptions(options);
    this.element = null;
    this.updateTimer = null;
    this.isVisible = true;
  }

  // Lifecycle methods (to be implemented by plugins)
  async initialize() { /* Override in plugin */ }
  async render() { /* Override in plugin */ }
  async update() { /* Override in plugin */ }
  async destroy() { /* Override in plugin */ }

  // Framework-provided methods
  setPosition(row, col, rowSpan, colSpan) { /* Framework handles */ }
  applyTheme(theme) { /* Framework handles */ }
  handleError(error) { /* Framework handles */ }
  
  // Configuration validation
  validateOptions(options) {
    const schema = this.getOptionsSchema();
    return validateAgainstSchema(options, schema);
  }
  
  getOptionsSchema() {
    return {}; // Override in plugin
  }
}
```

#### Data Widget Class (for widgets that fetch data)
```javascript
class DataWidget extends BaseWidget {
  constructor(name, options = {}) {
    super(name, options);
    this.data = null;
    this.lastUpdate = null;
    this.updateInterval = options.updateInterval || 5000;
  }

  // Data fetching with built-in error handling and caching
  async fetchData() { /* Override in plugin */ }
  
  // Automatic update management
  startUpdates() {
    this.updateTimer = setInterval(async () => {
      if (this.isVisible) {
        try {
          await this.fetchData();
          await this.render();
        } catch (error) {
          this.handleError(error);
        }
      }
    }, this.updateInterval);
  }
  
  stopUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}
```

### 3. Plugin Manager

#### Plugin Discovery and Loading
```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginPaths = [];
  }

  // Discover plugins from multiple sources
  async discoverPlugins() {
    const sources = [
      new BuiltinPluginSource(),
      new NpmPluginSource(),
      new LocalPluginSource()
    ];
    
    const discovered = await Promise.all(
      sources.map(source => source.discover())
    );
    
    return discovered.flat();
  }

  // Load and validate plugin
  async loadPlugin(pluginName, options = {}) {
    try {
      const pluginModule = await this.resolvePlugin(pluginName);
      const plugin = new pluginModule.default(pluginName, options);
      
      await plugin.initialize();
      this.plugins.set(pluginName, plugin);
      
      return plugin;
    } catch (error) {
      throw new PluginLoadError(`Failed to load plugin ${pluginName}`, error);
    }
  }

  // Resolve plugin from various sources
  async resolvePlugin(pluginName) {
    // Try built-in plugins first
    try {
      return await import(`./plugins/${pluginName}/index.js`);
    } catch {}
    
    // Try npm packages
    try {
      return await import(`orbiton-plugin-${pluginName}`);
    } catch {}
    
    // Try local plugins
    try {
      return await import(path.resolve(process.cwd(), 'plugins', pluginName));
    } catch {}
    
    throw new Error(`Plugin not found: ${pluginName}`);
  }
}
```

### 4. CLI Interface

#### Command Structure
```javascript
// Main CLI commands
const commands = {
  // Start dashboard (default)
  start: {
    description: 'Start the Orbiton dashboard',
    options: {
      '--config': 'Path to configuration file',
      '--preset': 'Use a specific preset',
      '--debug': 'Enable debug mode',
      '--dev': 'Enable development mode with hot reloading'
    }
  },
  
  // Plugin management
  plugin: {
    install: 'Install a plugin from npm',
    uninstall: 'Remove a plugin',
    list: 'List available plugins',
    search: 'Search for plugins',
    create: 'Create a new plugin from template',
    dev: 'Start plugin development mode',
    test: 'Run plugin tests',
    package: 'Package plugin for distribution',
    publish: 'Publish plugin to npm'
  },
  
  // Configuration management
  config: {
    init: 'Initialize configuration',
    edit: 'Open configuration in editor',
    validate: 'Validate configuration',
    reset: 'Reset to defaults',
    migrate: 'Migrate from legacy configuration'
  },
  
  // Development tools
  dev: {
    scaffold: 'Generate plugin scaffolding',
    watch: 'Watch for changes and reload',
    docs: 'Generate plugin documentation'
  }
};
```

#### Plugin Development Tools
```javascript
class PluginDevTools {
  // Plugin scaffolding generator
  async scaffoldPlugin(name, type = 'basic') {
    const templates = {
      basic: './templates/basic-widget.js',
      data: './templates/data-widget.js',
      advanced: './templates/advanced-widget.js'
    };
    
    const pluginDir = `plugins/${name}`;
    await this.createDirectory(pluginDir);
    
    // Generate main plugin file
    const template = await this.loadTemplate(templates[type]);
    const pluginCode = this.processTemplate(template, { name });
    await this.writeFile(`${pluginDir}/index.js`, pluginCode);
    
    // Generate plugin.json metadata
    const metadata = this.generatePluginMetadata(name, type);
    await this.writeFile(`${pluginDir}/plugin.json`, JSON.stringify(metadata, null, 2));
    
    // Generate test file
    const testTemplate = await this.loadTemplate('./templates/plugin-test.js');
    const testCode = this.processTemplate(testTemplate, { name });
    await this.writeFile(`${pluginDir}/test.js`, testCode);
    
    console.log(`Plugin ${name} scaffolded successfully!`);
  }
  
  // Development mode with hot reloading
  async startDevMode(pluginName) {
    const watcher = new PluginWatcher(pluginName);
    const dashboard = new Dashboard({ devMode: true });
    
    watcher.on('change', async () => {
      try {
        await dashboard.reloadPlugin(pluginName);
        console.log(`Plugin ${pluginName} reloaded`);
      } catch (error) {
        console.error(`Failed to reload plugin: ${error.message}`);
      }
    });
    
    await dashboard.start();
  }
  
  // Plugin testing utilities
  async runPluginTests(pluginName) {
    const testRunner = new PluginTestRunner(pluginName);
    return await testRunner.run();
  }
}
```

## Data Models

### Plugin Metadata
```typescript
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  
  // Plugin-specific metadata
  category: 'system' | 'development' | 'monitoring' | 'utility' | 'custom';
  size: 'small' | 'medium' | 'large';
  updateInterval: number;
  
  // Dependencies and requirements
  dependencies?: string[];
  peerDependencies?: string[];
  systemRequirements?: {
    platform?: string[];
    commands?: string[];
  };
  
  // Configuration schema
  optionsSchema: JSONSchema;
  
  // AI-friendly metadata
  examples?: PluginExample[];
  templates?: PluginTemplate[];
}

interface PluginExample {
  name: string;
  description: string;
  config: Record<string, any>;
  screenshot?: string;
}
```

### Environment Profile
```typescript
interface EnvironmentProfile {
  platform: 'development' | 'server' | 'desktop' | 'minimal';
  capabilities: {
    docker: boolean;
    git: boolean;
    node: boolean;
    python: boolean;
    system: SystemCapabilities;
  };
  suggestedPlugins: string[];
  suggestedLayout: string;
}

interface SystemCapabilities {
  hasGpu: boolean;
  hasBattery: boolean;
  networkInterfaces: string[];
  availableCommands: string[];
}
```

### 5. Performance and Resource Management

#### Performance Monitor
```javascript
class PerformanceManager {
  constructor() {
    this.metrics = new Map();
    this.resourceLimits = {
      maxConcurrentUpdates: 5,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxUpdateInterval: 1000 // 1 second minimum
    };
  }

  // Monitor plugin performance
  trackPluginPerformance(pluginName, operation, duration) {
    if (!this.metrics.has(pluginName)) {
      this.metrics.set(pluginName, {
        updateTimes: [],
        renderTimes: [],
        memoryUsage: [],
        errorCount: 0
      });
    }
    
    const metrics = this.metrics.get(pluginName);
    metrics[`${operation}Times`].push(duration);
    
    // Keep only last 100 measurements
    if (metrics[`${operation}Times`].length > 100) {
      metrics[`${operation}Times`].shift();
    }
  }

  // Optimize update intervals based on performance
  optimizeUpdateIntervals() {
    for (const [pluginName, metrics] of this.metrics) {
      const avgUpdateTime = this.calculateAverage(metrics.updateTimes);
      
      if (avgUpdateTime > 1000) { // If updates take more than 1 second
        this.suggestSlowerInterval(pluginName, avgUpdateTime);
      }
    }
  }

  // Pause updates for invisible widgets
  manageVisibilityUpdates(plugins) {
    plugins.forEach(plugin => {
      if (!plugin.isVisible && plugin.updateTimer) {
        plugin.pauseUpdates();
      } else if (plugin.isVisible && !plugin.updateTimer) {
        plugin.resumeUpdates();
      }
    });
  }

  // Resource isolation for problematic plugins
  isolatePlugin(pluginName, reason) {
    console.warn(`Isolating plugin ${pluginName}: ${reason}`);
    
    // Move plugin to separate process or limit resources
    this.createPluginSandbox(pluginName);
  }
}

// Update queue management for better performance
class UpdateQueue {
  constructor(maxConcurrent = 5) {
    this.queue = [];
    this.running = new Set();
    this.maxConcurrent = maxConcurrent;
  }

  async addUpdate(plugin, updateFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        plugin,
        updateFn,
        resolve,
        reject,
        priority: plugin.priority || 0
      });
      
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Sort by priority
    this.queue.sort((a, b) => b.priority - a.priority);
    
    const update = this.queue.shift();
    this.running.add(update.plugin.name);

    try {
      const result = await update.updateFn();
      update.resolve(result);
    } catch (error) {
      update.reject(error);
    } finally {
      this.running.delete(update.plugin.name);
      this.processQueue(); // Process next item
    }
  }
}
```

### 6. Documentation Generation System

#### Auto-Documentation Generator
```javascript
class DocumentationGenerator {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  // Generate comprehensive plugin documentation
  async generatePluginDocs(pluginPath) {
    const pluginMetadata = await this.loadPluginMetadata(pluginPath);
    const pluginCode = await this.analyzePluginCode(pluginPath);
    
    const docs = {
      readme: this.generateReadme(pluginMetadata, pluginCode),
      api: this.generateAPIReference(pluginCode),
      examples: this.generateExamples(pluginMetadata),
      troubleshooting: this.generateTroubleshooting(pluginMetadata)
    };
    
    await this.writeDocs(pluginPath, docs);
    return docs;
  }

  generateReadme(metadata, code) {
    return `# ${metadata.name}

${metadata.description}

## Installation

\`\`\`bash
orbiton plugin install ${metadata.name}
\`\`\`

## Configuration

${this.generateConfigurationDocs(metadata.optionsSchema)}

## Examples

${this.generateExampleConfigs(metadata.examples)}

## API Reference

${this.generateMethodDocs(code.methods)}
`;
  }

  generateConfigurationDocs(schema) {
    if (!schema || !schema.properties) return 'No configuration options available.';
    
    let docs = '| Option | Type | Default | Description |\n|--------|------|---------|-------------|\n';
    
    for (const [key, prop] of Object.entries(schema.properties)) {
      docs += `| ${key} | ${prop.type} | ${prop.default || 'N/A'} | ${prop.description || ''} |\n`;
    }
    
    return docs;
  }

  // Generate development guide
  generateDevelopmentGuide() {
    return `# Plugin Development Guide

## Quick Start

1. Generate a new plugin:
   \`\`\`bash
   orbiton plugin create my-plugin
   \`\`\`

2. Implement your plugin:
   \`\`\`javascript
   import { BaseWidget } from 'orbiton';
   
   export default class MyPlugin extends BaseWidget {
     async initialize() {
       // Setup code
     }
     
     async render() {
       // Rendering logic
     }
   }
   \`\`\`

3. Test your plugin:
   \`\`\`bash
   orbiton plugin test my-plugin
   \`\`\`

## Plugin Types

### Basic Widget
For simple, static widgets that don't need data updates.

### Data Widget
For widgets that fetch and display dynamic data.

## Best Practices

1. **Error Handling**: Always wrap async operations in try-catch
2. **Performance**: Use appropriate update intervals
3. **Theming**: Support theme customization
4. **Testing**: Write comprehensive tests

## Troubleshooting

### Common Issues

1. **Plugin not loading**: Check plugin.json format
2. **Configuration errors**: Validate against schema
3. **Performance issues**: Check update intervals
`;
  }
}
```

## Error Handling

### Error Types and Recovery
```javascript
class OrbitonError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
  }
}

class PluginError extends OrbitonError {
  constructor(pluginName, message, originalError) {
    super(`Plugin ${pluginName}: ${message}`, 'PLUGIN_ERROR', {
      pluginName,
      originalError
    });
  }
}

class ConfigurationError extends OrbitonError {
  constructor(message, errors) {
    super(message, 'CONFIG_ERROR', { errors });
  }
}

// Enhanced error recovery strategies
class ErrorRecoveryManager {
  constructor() {
    this.recoveryStrategies = new Map();
    this.errorHistory = new Map();
  }

  handlePluginError(plugin, error) {
    // Log error with context
    this.logger.error(`Plugin ${plugin.name} failed:`, {
      error: error.message,
      stack: error.stack,
      context: error.context
    });
    
    // Track error frequency
    this.trackError(plugin.name, error);
    
    // Show error widget instead of crashing
    this.showErrorWidget(plugin, error);
    
    // Attempt recovery based on error type
    this.attemptRecovery(plugin, error);
  }
  
  trackError(pluginName, error) {
    if (!this.errorHistory.has(pluginName)) {
      this.errorHistory.set(pluginName, []);
    }
    
    const history = this.errorHistory.get(pluginName);
    history.push({
      timestamp: new Date(),
      error: error.message,
      type: error.constructor.name
    });
    
    // Keep only last 50 errors
    if (history.length > 50) {
      history.shift();
    }
    
    // If too many errors, disable plugin temporarily
    const recentErrors = history.filter(
      e => Date.now() - e.timestamp.getTime() < 60000 // Last minute
    );
    
    if (recentErrors.length > 5) {
      this.temporarilyDisablePlugin(pluginName);
    }
  }

  attemptRecovery(plugin, error) {
    const strategy = this.recoveryStrategies.get(error.constructor.name);
    
    if (strategy) {
      setTimeout(() => strategy(plugin, error), 5000); // Retry after 5 seconds
    }
  }
  
  showErrorWidget(plugin, error) {
    const errorWidget = new ErrorWidget(plugin.name, {
      message: error.message,
      suggestion: this.getErrorSuggestion(error),
      canRetry: this.canRetry(plugin.name)
    });
    
    this.replaceWidget(plugin, errorWidget);
  }

  getErrorSuggestion(error) {
    const suggestions = {
      'ENOTFOUND': 'Check your internet connection',
      'EACCES': 'Check file permissions',
      'MODULE_NOT_FOUND': 'Install missing dependencies',
      'PLUGIN_ERROR': 'Check plugin configuration'
    };
    
    return suggestions[error.code] || 'Try restarting the plugin';
  }
}
```

## Testing Strategy

### Plugin Testing Framework
```javascript
// Test utilities for plugin developers
class PluginTestHarness {
  constructor(PluginClass) {
    this.PluginClass = PluginClass;
    this.mockGrid = new MockGrid();
    this.mockTheme = new MockTheme();
  }

  async createPlugin(options = {}) {
    const plugin = new this.PluginClass('test-plugin', options);
    await plugin.initialize();
    return plugin;
  }

  async renderPlugin(plugin, position = [0, 0, 4, 4]) {
    plugin.setPosition(...position);
    await plugin.render();
    return this.mockGrid.getRenderedContent();
  }

  simulateUpdate(plugin, data) {
    plugin.data = data;
    return plugin.update();
  }
}

// Example plugin test
describe('ClockPlugin', () => {
  let harness;
  
  beforeEach(() => {
    harness = new PluginTestHarness(ClockPlugin);
  });
  
  test('renders current time', async () => {
    const plugin = await harness.createPlugin();
    const content = await harness.renderPlugin(plugin);
    
    expect(content).toContain(new Date().getHours().toString());
  });
});
```

### Integration Testing
```javascript
// Full dashboard testing
class DashboardTestSuite {
  async testConfiguration(config) {
    const dashboard = new Dashboard(config);
    await dashboard.initialize();
    
    // Verify all plugins loaded
    expect(dashboard.plugins.size).toBe(config.plugins.length);
    
    // Verify layout
    expect(dashboard.layout.isValid()).toBe(true);
    
    // Test rendering
    await dashboard.render();
    expect(dashboard.screen.rendered).toBe(true);
  }
}
```

## AI-Friendly Configuration Files

### TypeScript Definitions
```typescript
// types/orbiton.d.ts - Comprehensive type definitions for AI assistance
declare module 'orbiton' {
  export class BaseWidget {
    constructor(name: string, options?: Record<string, any>);
    initialize(): Promise<void>;
    render(): Promise<void>;
    update(): Promise<void>;
    destroy(): Promise<void>;
  }
  
  export class DataWidget extends BaseWidget {
    fetchData(): Promise<any>;
    startUpdates(): void;
    stopUpdates(): void;
  }
  
  export interface PluginConfig {
    name: string;
    enabled?: boolean;
    position?: [number, number, number, number];
    options?: Record<string, any>;
  }
}
```

### AI Development Configuration
```json
// .ai-config.json - Configuration for AI coding assistants
{
  "project": {
    "name": "orbiton-dashboard",
    "type": "tui-dashboard",
    "framework": "blessed.js",
    "language": "javascript",
    "moduleSystem": "esm"
  },
  "patterns": {
    "pluginStructure": {
      "baseClass": "BaseWidget or DataWidget",
      "requiredMethods": ["initialize", "render"],
      "optionalMethods": ["update", "destroy", "fetchData"],
      "configFile": "plugin.json with metadata and schema"
    },
    "fileNaming": {
      "plugins": "plugins/{name}/index.js",
      "config": "plugins/{name}/plugin.json",
      "defaults": "plugins/{name}/default.json",
      "tests": "plugins/{name}/test.js"
    }
  },
  "conventions": {
    "errorHandling": "Use try-catch with graceful degradation",
    "async": "Prefer async/await over promises",
    "imports": "Use ES6 imports",
    "exports": "Export default class for plugins"
  },
  "templates": {
    "basicWidget": "./templates/basic-widget.js",
    "dataWidget": "./templates/data-widget.js",
    "pluginJson": "./templates/plugin.json"
  }
}
```

### JSDoc Configuration
```javascript
/**
 * @fileoverview Orbiton Plugin Development Guide
 * 
 * This file provides comprehensive documentation for AI assistants
 * to understand the plugin development patterns and conventions.
 * 
 * @example Basic Widget
 * ```javascript
 * import { BaseWidget } from 'orbiton';
 * 
 * export default class MyWidget extends BaseWidget {
 *   async initialize() {
 *     // Setup code here
 *   }
 * 
 *   async render() {
 *     // Rendering logic here
 *   }
 * }
 * ```
 * 
 * @example Data Widget
 * ```javascript
 * import { DataWidget } from 'orbiton';
 * 
 * export default class MyDataWidget extends DataWidget {
 *   async fetchData() {
 *     // Data fetching logic
 *     return await fetch('/api/data');
 *   }
 * 
 *   async render() {
 *     // Render this.data
 *   }
 * }
 * ```
 */
```

### Package.json AI Metadata
```json
{
  "name": "orbiton-dashboard",
  "version": "2.0.0",
  "description": "A beautiful, extensible TUI dashboard with zero-config setup",
  "keywords": ["tui", "dashboard", "terminal", "widgets", "plugins", "monitoring"],
  "ai": {
    "framework": "blessed.js",
    "pluginSystem": "class-based",
    "configFormat": "json-schema",
    "testFramework": "vitest",
    "patterns": {
      "plugins": "Class extending BaseWidget or DataWidget",
      "configuration": "JSON with schema validation",
      "theming": "CSS-like object notation"
    }
  },
  "exports": {
    ".": "./src/index.js",
    "./plugin": "./src/plugin/index.js",
    "./types": "./types/index.d.ts"
  }
}
```

This design provides a comprehensive foundation for the Orbiton rewrite, focusing on developer experience, zero-configuration setup, and AI-friendly development patterns while maintaining the flexibility and power of the original system.