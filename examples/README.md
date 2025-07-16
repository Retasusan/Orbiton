# Orbiton Plugin Examples

This directory contains example plugins that demonstrate different patterns and best practices for Orbiton plugin development. Each example is fully functional and can be used as a starting point for your own plugins.

## Available Examples

### 1. Simple Counter (`simple-counter/`)

**Type:** BaseWidget  
**Complexity:** Beginner  
**Features:** Interactive, State Management, Keyboard Handling

A basic interactive widget that demonstrates:
- Simple state management
- Keyboard event handling
- Configuration validation
- Theme integration
- Layout hints

**Key Learning Points:**
- How to create interactive widgets
- Managing internal state
- Responding to user input
- Basic configuration schemas

**Usage:**
```json
{
  "plugins": [
    {
      "name": "simple-counter",
      "position": [0, 0, 2, 2],
      "options": {
        "startValue": 0,
        "step": 1,
        "maxValue": 100
      }
    }
  ]
}
```

### 2. System Monitor (`system-monitor/`)

**Type:** DataWidget  
**Complexity:** Intermediate  
**Features:** Data Fetching, Auto-Updates, Error Handling, Performance Monitoring

An advanced monitoring widget that demonstrates:
- Automatic data fetching and updates
- System API integration
- Error handling and recovery
- Data caching and history
- Performance optimization
- Alert thresholds
- Trend analysis

**Key Learning Points:**
- Working with DataWidget base class
- Fetching data from system APIs
- Implementing robust error handling
- Managing data history and trends
- Performance considerations
- Alert systems

**Usage:**
```json
{
  "plugins": [
    {
      "name": "system-monitor",
      "position": [0, 0, 4, 3],
      "options": {
        "updateInterval": 2000,
        "showDetails": true,
        "cpuAlert": 80,
        "memoryAlert": 85
      }
    }
  ]
}
```

## Plugin Development Patterns

### BaseWidget Pattern (Simple Counter)

Use BaseWidget when you need:
- Static or user-driven updates
- Simple interactive elements
- Widgets that don't fetch external data
- Quick prototypes

```javascript
import { BaseWidget } from '../../src/plugins/BaseWidget.js';

export default class MyPlugin extends BaseWidget {
  async initialize() {
    // Setup initial state
  }

  async render() {
    // Update display
  }

  // Handle user interaction
  setupEventHandlers() {
    this.on('keypress', (ch, key) => {
      // Handle input
    });
  }
}
```

### DataWidget Pattern (System Monitor)

Use DataWidget when you need:
- Regular data updates
- External API integration
- Automatic error handling
- Data caching and history

```javascript
import { DataWidget } from '../../src/plugins/DataWidget.js';

export default class MyPlugin extends DataWidget {
  async initialize() {
    await super.initialize();
    this.updateInterval = 5000;
    this.startUpdates();
  }

  async fetchData() {
    // Fetch from API or system
    return data;
  }

  async render() {
    // Display this.data
  }
}
```

## Common Patterns and Best Practices

### 1. Configuration Management

Always provide a comprehensive schema:

```javascript
getOptionsSchema() {
  return {
    type: 'object',
    required: ['apiKey'], // Mark required fields
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for service',
        minLength: 10
      },
      updateInterval: {
        type: 'number',
        description: 'Update frequency in milliseconds',
        minimum: 1000,
        default: 5000
      }
    }
  };
}
```

### 2. Error Handling

Implement graceful error handling:

```javascript
async fetchData() {
  try {
    const response = await fetch(this.apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    return this.getCachedData() || null;
  }
}

async render() {
  if (this.hasError) {
    this.element.setContent(`{red-fg}Error: ${this.errorMessage}{/red-fg}`);
    return;
  }
  
  if (!this.data) {
    this.element.setContent('{yellow-fg}Loading...{/yellow-fg}');
    return;
  }
  
  // Normal rendering
}
```

### 3. Performance Optimization

Optimize for performance:

```javascript
// Cache expensive calculations
async update() {
  if (this.dataChanged()) {
    this.cachedResult = this.expensiveCalculation();
    await this.render();
  }
}

// Limit history size
addToHistory(data) {
  this.history.push(data);
  if (this.history.length > this.maxHistoryLength) {
    this.history.shift();
  }
}

// Clean up resources
async destroy() {
  this.clearCache();
  await super.destroy();
}
```

### 4. Theme Integration

Support theming properly:

```javascript
async render() {
  const theme = this.getTheme();
  
  const content = `{${theme.primary}-fg}Primary Text{/${theme.primary}-fg}
{${theme.accent}-fg}Accent Text{/${theme.accent}-fg}
{dim}Secondary Text{/dim}`;
  
  this.element.setContent(content);
}
```

### 5. Layout Hints

Provide helpful layout information:

```javascript
getLayoutHints() {
  return {
    minWidth: 20,
    minHeight: 8,
    preferredWidth: 30,
    preferredHeight: 12,
    canResize: true,
    aspectRatio: 2.5, // width:height preference
    interactive: true // If widget handles input
  };
}
```

## Testing Your Examples

Each example includes comprehensive tests. Run them with:

```bash
# Test a specific example
orbiton plugin test simple-counter

# Test all examples
npm test examples/

# Run with coverage
npm test -- --coverage examples/
```

## Creating Your Own Plugin

1. **Choose a base class:**
   - `BaseWidget` for simple, interactive widgets
   - `DataWidget` for data-driven widgets

2. **Use the scaffolding tool:**
   ```bash
   orbiton plugin create my-awesome-plugin --type=data
   ```

3. **Study the examples:**
   - Start with `simple-counter` for basics
   - Move to `system-monitor` for advanced patterns

4. **Follow the patterns:**
   - Implement proper error handling
   - Add comprehensive configuration schemas
   - Include layout hints
   - Write tests

5. **Test thoroughly:**
   ```bash
   orbiton plugin test my-awesome-plugin
   orbiton dev --plugin my-awesome-plugin
   ```

## Contributing Examples

We welcome new examples! When contributing:

1. **Follow the established patterns**
2. **Include comprehensive documentation**
3. **Add thorough tests**
4. **Provide multiple configuration examples**
5. **Update this README**

### Example Contribution Checklist

- [ ] Plugin follows BaseWidget or DataWidget patterns
- [ ] Comprehensive `plugin.json` with examples
- [ ] Full test suite with good coverage
- [ ] Clear documentation and comments
- [ ] Multiple configuration examples
- [ ] Performance considerations addressed
- [ ] Error handling implemented
- [ ] Theme integration working
- [ ] Layout hints provided

## Advanced Examples Coming Soon

We're working on additional examples to demonstrate:

- **Chart Widget**: Data visualization with multiple chart types
- **API Dashboard**: Complex API integration with authentication
- **Interactive Form**: User input and validation
- **Multi-Panel Widget**: Complex layouts and sub-components
- **Real-time Data**: WebSocket integration and live updates
- **Plugin Communication**: Inter-plugin messaging and data sharing

## Getting Help

If you have questions about these examples:

1. **Check the documentation**: `docs/plugin-development.md`
2. **Look at the source code**: Each example is heavily commented
3. **Run the examples**: See them in action with `orbiton dev`
4. **Ask the community**: GitHub Discussions or Discord

Happy plugin development! 🚀