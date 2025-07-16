# API Reference

## Core Classes

### BaseWidget

The foundation class for all Orbiton plugins. Provides basic widget lifecycle management, configuration validation, and theming support.

#### Constructor

```javascript
constructor(name, options = {})
```

**Parameters:**
- `name` (string): Unique identifier for the plugin instance
- `options` (object): Configuration options for the plugin

**Example:**
```javascript
const widget = new MyWidget('my-widget', {
  title: 'My Custom Widget',
  updateInterval: 5000
});
```

#### Properties

##### `name`
- **Type:** `string`
- **Description:** The unique name of the plugin instance
- **Read-only:** Yes

##### `options`
- **Type:** `object`
- **Description:** Validated configuration options
- **Read-only:** Yes

##### `element`
- **Type:** `blessed.Element`
- **Description:** The blessed.js UI element for this widget
- **Read-only:** No

##### `isVisible`
- **Type:** `boolean`
- **Description:** Whether the widget is currently visible
- **Default:** `true`

#### Methods

##### `async initialize()`

Called once when the plugin is first loaded. Override this method to set up initial state, validate configuration, and prepare resources.

**Returns:** `Promise<void>`

**Example:**
```javascript
async initialize() {
  if (!this.options.apiKey) {
    throw new Error('API key is required');
  }
  
  this.cache = new Map();
  this.title = this.options.title || 'Default Title';
}
```

##### `async render()`

Called whenever the widget needs to update its display. This method should be fast and efficient.

**Returns:** `Promise<void>`

**Example:**
```javascript
async render() {
  if (!this.element) return;
  
  const content = `{center}{bold}${this.title}{/bold}{/center}
{center}Status: {green-fg}Active{/green-fg}{/center}`;
  
  this.element.setContent(content);
}
```

##### `async update()`

Called when the widget should refresh its data or state. Default implementation calls `render()`.

**Returns:** `Promise<void>`

**Example:**
```javascript
async update() {
  this.lastUpdate = new Date();
  await this.render();
}
```

##### `async destroy()`

Called when the plugin is being removed or the dashboard is shutting down. Use this to clean up resources.

**Returns:** `Promise<void>`

**Example:**
```javascript
async destroy() {
  if (this.timer) {
    clearInterval(this.timer);
  }
  
  if (this.connection) {
    this.connection.close();
  }
}
```

##### `getOptionsSchema()`

Returns the JSON Schema for validating plugin configuration options.

**Returns:** `object` - JSON Schema object

**Example:**
```javascript
getOptionsSchema() {
  return {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service'
      },
      title: {
        type: 'string',
        description: 'Widget title',
        default: 'My Widget'
      }
    }
  };
}
```

##### `validateOptions(options)`

Validates the provided options against the plugin's schema.

**Parameters:**
- `options` (object): Options to validate

**Returns:** `object` - Validated and normalized options

**Throws:** `ValidationError` if options are invalid

##### `setPosition(row, col, rowSpan, colSpan)`

Sets the widget's position in the dashboard grid.

**Parameters:**
- `row` (number): Starting row (0-based)
- `col` (number): Starting column (0-based)
- `rowSpan` (number): Number of rows to span
- `colSpan` (number): Number of columns to span

##### `applyTheme(theme)`

Applies the current theme to the widget.

**Parameters:**
- `theme` (object): Theme configuration object

##### `handleError(error)`

Handles errors gracefully, preventing dashboard crashes.

**Parameters:**
- `error` (Error): The error to handle

**Example:**
```javascript
try {
  await this.riskyOperation();
} catch (error) {
  this.handleError(error);
}
```

##### `getTheme()`

Gets the current theme configuration.

**Returns:** `object` - Current theme object

**Example:**
```javascript
const theme = this.getTheme();
const primaryColor = theme.colors.primary;
```

---

### DataWidget

Extends `BaseWidget` with automatic data fetching, caching, and update management. Use this for widgets that need to display dynamic data from APIs or system sources.

#### Constructor

```javascript
constructor(name, options = {})
```

Inherits all parameters from `BaseWidget`.

#### Additional Properties

##### `data`
- **Type:** `any`
- **Description:** The current data for the widget
- **Default:** `null`

##### `lastUpdate`
- **Type:** `Date`
- **Description:** Timestamp of the last successful data fetch
- **Default:** `null`

##### `updateInterval`
- **Type:** `number`
- **Description:** Update interval in milliseconds
- **Default:** `5000`

##### `updateTimer`
- **Type:** `NodeJS.Timer`
- **Description:** Timer for automatic updates
- **Default:** `null`

#### Additional Methods

##### `async fetchData()`

Override this method to implement data fetching logic. Should return the data to be stored in `this.data`.

**Returns:** `Promise<any>` - The fetched data

**Example:**
```javascript
async fetchData() {
  const response = await fetch(`${this.apiUrl}/data`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
}
```

##### `startUpdates()`

Starts automatic data updates based on `updateInterval`.

**Example:**
```javascript
async initialize() {
  await super.initialize();
  this.startUpdates();
}
```

##### `stopUpdates()`

Stops automatic data updates.

**Example:**
```javascript
async destroy() {
  this.stopUpdates();
  await super.destroy();
}
```

##### `pauseUpdates()`

Temporarily pauses updates (useful when widget is not visible).

##### `resumeUpdates()`

Resumes paused updates.

---

## Configuration System

### ConfigManager

Manages dashboard configuration with intelligent defaults and validation.

#### Methods

##### `async loadConfig()`

Loads and merges configuration from multiple sources.

**Returns:** `Promise<object>` - Merged configuration

##### `async detectEnvironment()`

Detects the current environment and suggests appropriate plugins.

**Returns:** `Promise<object>` - Environment profile

##### `async migrateFromLegacy()`

Migrates configuration from legacy `.orbitonrc.json` format.

**Returns:** `Promise<object>` - Migration result

### ConfigValidator

Validates configuration against schemas.

#### Methods

##### `async validate(config)`

Validates a configuration object.

**Parameters:**
- `config` (object): Configuration to validate

**Returns:** `Promise<object>` - Validation result with errors and warnings

---

## Plugin Management

### PluginManager

Manages plugin discovery, loading, and lifecycle.

#### Methods

##### `async discoverPlugins()`

Discovers available plugins from all sources.

**Returns:** `Promise<array>` - Array of discovered plugins

##### `async loadPlugin(pluginName, options)`

Loads and initializes a plugin.

**Parameters:**
- `pluginName` (string): Name of the plugin to load
- `options` (object): Plugin configuration options

**Returns:** `Promise<BaseWidget>` - Loaded plugin instance

##### `async resolvePlugin(pluginName)`

Resolves a plugin module from various sources.

**Parameters:**
- `pluginName` (string): Name of the plugin to resolve

**Returns:** `Promise<class>` - Plugin class

---

## Event System

### EventBus

Provides plugin-to-plugin communication.

#### Methods

##### `on(event, handler)`

Registers an event handler.

**Parameters:**
- `event` (string): Event name
- `handler` (function): Event handler function

##### `emit(event, data)`

Emits an event to all registered handlers.

**Parameters:**
- `event` (string): Event name
- `data` (any): Event data

##### `off(event, handler)`

Removes an event handler.

**Parameters:**
- `event` (string): Event name
- `handler` (function): Handler to remove

---

## CLI Interface

### Plugin Commands

#### `orbiton plugin create <name>`

Creates a new plugin from template.

**Options:**
- `--type <type>`: Plugin type (basic, data, advanced)
- `--template <template>`: Custom template to use

#### `orbiton plugin install <name>`

Installs a plugin from npm.

**Options:**
- `--save`: Save to configuration
- `--dev`: Install as development dependency

#### `orbiton plugin uninstall <name>`

Removes an installed plugin.

#### `orbiton plugin list`

Lists all available plugins.

**Options:**
- `--installed`: Show only installed plugins
- `--available`: Show only available plugins

#### `orbiton plugin search <query>`

Searches for plugins in the npm registry.

#### `orbiton plugin test <name>`

Runs tests for a plugin.

**Options:**
- `--watch`: Watch for changes and re-run tests
- `--coverage`: Generate coverage report

### Configuration Commands

#### `orbiton config init`

Initializes a new configuration file.

**Options:**
- `--preset <preset>`: Use a configuration preset
- `--minimal`: Create minimal configuration

#### `orbiton config validate`

Validates the current configuration.

#### `orbiton config migrate`

Migrates from legacy configuration format.

### Development Commands

#### `orbiton dev`

Starts the dashboard in development mode.

**Options:**
- `--plugin <name>`: Focus on specific plugin
- `--watch`: Enable hot reloading
- `--debug`: Enable debug logging

---

## Error Handling

### Error Types

#### `OrbitonError`

Base error class for all Orbiton-specific errors.

**Properties:**
- `code` (string): Error code
- `context` (object): Additional error context
- `timestamp` (Date): When the error occurred

#### `PluginError`

Error specific to plugin operations.

**Properties:**
- `pluginName` (string): Name of the plugin that caused the error

#### `ConfigurationError`

Error in configuration validation or loading.

**Properties:**
- `errors` (array): Array of validation errors

#### `ValidationError`

Error in option or data validation.

**Properties:**
- `field` (string): Field that failed validation
- `value` (any): Invalid value
- `expected` (string): Expected format or type

---

## Testing Utilities

### PluginTestHarness

Provides utilities for testing plugins in isolation.

#### Constructor

```javascript
constructor(PluginClass)
```

**Parameters:**
- `PluginClass` (class): The plugin class to test

#### Methods

##### `async createPlugin(options)`

Creates a plugin instance for testing.

**Parameters:**
- `options` (object): Plugin options

**Returns:** `Promise<BaseWidget>` - Plugin instance

##### `async renderPlugin(plugin, position)`

Renders a plugin and returns the content.

**Parameters:**
- `plugin` (BaseWidget): Plugin to render
- `position` (array): Position array [row, col, rowSpan, colSpan]

**Returns:** `Promise<string>` - Rendered content

##### `simulateUpdate(plugin, data)`

Simulates a data update for testing.

**Parameters:**
- `plugin` (DataWidget): Plugin to update
- `data` (any): New data

**Returns:** `Promise<void>`

### Mock Objects

#### MockGrid

Simulates the dashboard grid for testing.

#### MockTheme

Provides a mock theme for testing styling.

#### MockEventBus

Simulates the event system for testing plugin communication.

---

## Performance Monitoring

### PerformanceManager

Monitors and optimizes plugin performance.

#### Methods

##### `trackPluginPerformance(pluginName, operation, duration)`

Records performance metrics for a plugin operation.

##### `optimizeUpdateIntervals()`

Automatically adjusts update intervals based on performance.

##### `manageVisibilityUpdates(plugins)`

Pauses updates for invisible widgets.

---

## Type Definitions

### Plugin Configuration

```typescript
interface PluginConfig {
  name: string;
  enabled?: boolean;
  position?: [number, number, number, number];
  options?: Record<string, any>;
  updateInterval?: number;
}
```

### Dashboard Configuration

```typescript
interface OrbitonConfig {
  autoDetect?: boolean;
  layout?: {
    preset?: string;
    custom?: boolean;
    grid?: { rows: number; cols: number };
  };
  plugins?: PluginConfig[];
  theme?: string | ThemeConfig;
  performance?: {
    updateInterval?: number;
    maxConcurrentUpdates?: number;
  };
}
```

### Plugin Metadata

```typescript
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  category: 'system' | 'development' | 'monitoring' | 'utility' | 'custom';
  size: 'small' | 'medium' | 'large';
  updateInterval: number;
  dependencies?: string[];
  systemRequirements?: {
    platform?: string[];
    commands?: string[];
  };
  optionsSchema: object;
}
```

---

## Examples

### Basic Widget Example

```javascript
import { BaseWidget } from 'orbiton';

export default class HelloWorldWidget extends BaseWidget {
  async initialize() {
    this.message = this.options.message || 'Hello, World!';
  }

  async render() {
    this.element.setContent(`{center}${this.message}{/center}`);
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to display',
          default: 'Hello, World!'
        }
      }
    };
  }
}
```

### Data Widget Example

```javascript
import { DataWidget } from 'orbiton';

export default class SystemStatsWidget extends DataWidget {
  async initialize() {
    this.updateInterval = this.options.updateInterval || 2000;
  }

  async fetchData() {
    const os = await import('os');
    
    return {
      loadAvg: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      uptime: os.uptime()
    };
  }

  async render() {
    if (!this.data) {
      this.element.setContent('{center}Loading...{/center}');
      return;
    }

    const memUsage = ((this.data.totalMemory - this.data.freeMemory) / this.data.totalMemory * 100).toFixed(1);
    
    const content = `{center}{bold}System Stats{/bold}{/center}
Load Average: ${this.data.loadAvg[0].toFixed(2)}
Memory Usage: ${memUsage}%
Uptime: ${Math.floor(this.data.uptime / 3600)}h`;

    this.element.setContent(content);
  }
}
```

This API reference covers all the essential classes and methods for developing Orbiton plugins. For more examples and advanced usage patterns, see the Plugin Development Guide.