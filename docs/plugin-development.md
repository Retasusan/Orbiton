# Plugin Development Guide

## Overview

Orbiton provides a powerful yet simple plugin system that allows you to create custom widgets for your dashboard. This guide will walk you through everything you need to know to create, test, and distribute your own plugins.

## Quick Start

### 1. Generate a New Plugin

```bash
orbiton plugin create my-awesome-plugin
```

This creates a new plugin directory with all the necessary files:

```
plugins/my-awesome-plugin/
├── index.js          # Main plugin code
├── plugin.json       # Plugin metadata and configuration schema
├── default.json      # Default configuration values
└── test.js          # Plugin tests
```

### 2. Basic Plugin Structure

```javascript
import { BaseWidget } from '../../../src/plugins/BaseWidget.js';

export default class MyAwesomePlugin extends BaseWidget {
  async initialize() {
    // Setup code - runs once when plugin loads
    this.title = this.options.title || 'My Awesome Plugin';
  }

  async render() {
    // Rendering logic - called whenever the widget needs to update
    this.element.setContent(`{center}${this.title}{/center}`);
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'My Awesome Plugin'
        }
      }
    };
  }
}
```

### 3. Test Your Plugin

```bash
orbiton plugin test my-awesome-plugin
```

## Plugin Types

### BaseWidget

Use `BaseWidget` for simple, static widgets that don't need regular data updates.

**Best for:**
- Static information displays
- Simple interactive widgets
- Widgets that update only on user interaction

**Example:**
```javascript
import { BaseWidget } from '../../../src/plugins/BaseWidget.js';

export default class ClockPlugin extends BaseWidget {
  async initialize() {
    this.format = this.options.format || '24h';
  }

  async render() {
    const now = new Date();
    const timeString = this.formatTime(now);
    
    this.element.setContent(`{center}${timeString}{/center}`);
  }

  formatTime(date) {
    if (this.format === '12h') {
      return date.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
```

### DataWidget

Use `DataWidget` for widgets that need to fetch and display dynamic data.

**Best for:**
- API data displays
- System monitoring widgets
- Real-time information displays

**Example:**
```javascript
import { DataWidget } from '../../../src/plugins/DataWidget.js';

export default class WeatherPlugin extends DataWidget {
  async initialize() {
    this.apiKey = this.options.apiKey;
    this.city = this.options.city || 'London';
    
    if (!this.apiKey) {
      throw new Error('API key is required for weather plugin');
    }
  }

  async fetchData() {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${this.city}&appid=${this.apiKey}&units=metric`
    );
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    return await response.json();
  }

  async render() {
    if (!this.data) {
      this.element.setContent('{center}Loading weather...{/center}');
      return;
    }

    const temp = Math.round(this.data.main.temp);
    const description = this.data.weather[0].description;
    
    const content = `{center}${this.city}{/center}
{center}${temp}°C{/center}
{center}${description}{/center}`;
    
    this.element.setContent(content);
  }

  getOptionsSchema() {
    return {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: {
          type: 'string',
          description: 'OpenWeatherMap API key'
        },
        city: {
          type: 'string',
          description: 'City name',
          default: 'London'
        }
      }
    };
  }
}
```

## Plugin Lifecycle

### 1. Initialization (`initialize()`)

Called once when the plugin is first loaded. Use this for:
- Setting up initial state
- Validating configuration
- Preparing resources

```javascript
async initialize() {
  // Validate required options
  if (!this.options.apiKey) {
    throw new Error('API key is required');
  }
  
  // Set up initial state
  this.cache = new Map();
  this.lastUpdate = null;
}
```

### 2. Rendering (`render()`)

Called whenever the widget needs to update its display. Keep this method fast and efficient.

```javascript
async render() {
  // Always check if element exists
  if (!this.element) return;
  
  // Use blessed.js formatting for styling
  const content = `{bold}Title{/bold}
{green-fg}Status: OK{/green-fg}`;
  
  this.element.setContent(content);
}
```

### 3. Data Fetching (`fetchData()` - DataWidget only)

Called automatically at regular intervals for DataWidget plugins.

```javascript
async fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    // Log error but don't throw - framework will handle gracefully
    console.error('Failed to fetch data:', error);
    return null;
  }
}
```

### 4. Updates (`update()`)

Called after data is fetched (DataWidget) or when manual updates are triggered.

```javascript
async update() {
  // Custom update logic
  await this.render();
}
```

### 5. Cleanup (`destroy()`)

Called when the plugin is being removed or the dashboard is shutting down.

```javascript
async destroy() {
  // Clean up resources
  if (this.timer) {
    clearInterval(this.timer);
  }
  
  // Close connections
  if (this.connection) {
    this.connection.close();
  }
}
```

## Configuration and Validation

### Plugin Metadata (plugin.json)

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "An awesome plugin for Orbiton",
  "author": "Your Name",
  "license": "MIT",
  "keywords": ["dashboard", "widget", "awesome"],
  "category": "utility",
  "size": "medium",
  "updateInterval": 5000,
  "optionsSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Widget title",
        "default": "My Plugin"
      },
      "color": {
        "type": "string",
        "enum": ["red", "green", "blue", "yellow"],
        "description": "Widget color theme",
        "default": "blue"
      }
    }
  }
}
```

### Configuration Schema

Define your plugin's configuration options using JSON Schema:

```javascript
getOptionsSchema() {
  return {
    type: 'object',
    required: ['apiKey'], // Required fields
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service',
        minLength: 10
      },
      refreshInterval: {
        type: 'number',
        description: 'Update interval in milliseconds',
        minimum: 1000,
        default: 5000
      },
      showDetails: {
        type: 'boolean',
        description: 'Show detailed information',
        default: true
      },
      theme: {
        type: 'string',
        enum: ['light', 'dark', 'auto'],
        description: 'Color theme',
        default: 'auto'
      }
    }
  };
}
```

## Styling and Theming

### Blessed.js Formatting

Orbiton uses blessed.js for terminal UI. You can use these formatting tags:

```javascript
// Colors
'{red-fg}Red text{/red-fg}'
'{green-bg}Green background{/green-bg}'

// Styles
'{bold}Bold text{/bold}'
'{underline}Underlined{/underline}'
'{italic}Italic text{/italic}'

// Alignment
'{center}Centered text{/center}'
'{right}Right aligned{/right}'

// Combined
'{center}{bold}{blue-fg}Blue Bold Centered{/blue-fg}{/bold}{/center}'
```

### Theme Integration

Access theme colors through the theme system:

```javascript
async render() {
  const theme = this.getTheme();
  
  const content = `{${theme.primary}-fg}Primary Color{/${theme.primary}-fg}
{${theme.secondary}-fg}Secondary Color{/${theme.secondary}-fg}`;
  
  this.element.setContent(content);
}
```

## Error Handling

### Graceful Error Handling

Always handle errors gracefully to prevent dashboard crashes:

```javascript
async fetchData() {
  try {
    const response = await fetch(this.apiUrl);
    return await response.json();
  } catch (error) {
    // Log error for debugging
    this.logger.error('Failed to fetch data:', error);
    
    // Return null or fallback data
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
  this.renderData();
}
```

### Error Recovery

Implement retry logic for transient errors:

```javascript
async fetchDataWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.fetchData();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await this.sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
}

sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Testing Your Plugin

### Unit Testing

```javascript
// test.js
import { describe, test, expect, beforeEach } from 'vitest';
import MyPlugin from './index.js';

describe('MyPlugin', () => {
  let plugin;
  
  beforeEach(() => {
    plugin = new MyPlugin('test-plugin', {
      title: 'Test Title'
    });
  });
  
  test('initializes with correct title', async () => {
    await plugin.initialize();
    expect(plugin.title).toBe('Test Title');
  });
  
  test('renders without errors', async () => {
    await plugin.initialize();
    
    // Mock the element
    plugin.element = {
      setContent: vi.fn()
    };
    
    await plugin.render();
    expect(plugin.element.setContent).toHaveBeenCalled();
  });
});
```

### Integration Testing

Test your plugin in the actual dashboard:

```bash
# Start dashboard in development mode
orbiton dev --plugin my-awesome-plugin

# Run plugin tests
orbiton plugin test my-awesome-plugin

# Test with specific configuration
orbiton dev --config test-config.json
```

## Performance Best Practices

### 1. Efficient Updates

```javascript
// Good: Only update when data changes
async update() {
  if (this.dataChanged()) {
    await this.render();
  }
}

// Bad: Always re-render
async update() {
  await this.render(); // Wasteful if data hasn't changed
}
```

### 2. Resource Management

```javascript
// Clean up resources
async destroy() {
  // Clear timers
  if (this.updateTimer) {
    clearInterval(this.updateTimer);
  }
  
  // Close connections
  if (this.websocket) {
    this.websocket.close();
  }
  
  // Clear caches
  this.cache.clear();
}
```

### 3. Caching

```javascript
async fetchData() {
  // Check cache first
  const cached = this.getFromCache();
  if (cached && !this.isCacheExpired()) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await this.fetchFromAPI();
  this.saveToCache(data);
  
  return data;
}
```

## Distribution

### Publishing to npm

1. **Prepare your plugin:**
   ```bash
   # Test thoroughly
   orbiton plugin test my-plugin
   
   # Update version
   npm version patch
   ```

2. **Publish:**
   ```bash
   npm publish
   ```

3. **Users can install:**
   ```bash
   orbiton plugin install my-plugin
   ```

### Plugin Naming Convention

- Use `orbiton-plugin-` prefix for npm packages
- Use kebab-case for plugin names
- Examples: `orbiton-plugin-weather`, `orbiton-plugin-docker-stats`

## Troubleshooting

### Common Issues

#### Plugin Not Loading

**Problem:** Plugin doesn't appear in dashboard

**Solutions:**
1. Check plugin.json syntax
2. Verify plugin name matches directory
3. Ensure main class is exported as default
4. Check for initialization errors in logs

#### Configuration Errors

**Problem:** Invalid configuration warnings

**Solutions:**
1. Validate your options schema
2. Check required fields are provided
3. Ensure default values are set
4. Test with minimal configuration

#### Performance Issues

**Problem:** Dashboard becomes slow or unresponsive

**Solutions:**
1. Reduce update frequency
2. Optimize render() method
3. Implement proper caching
4. Check for memory leaks

#### Styling Problems

**Problem:** Widget doesn't display correctly

**Solutions:**
1. Check blessed.js formatting syntax
2. Verify theme color names
3. Test with different terminal sizes
4. Use proper alignment tags

### Debug Mode

Enable debug mode for detailed logging:

```bash
orbiton start --debug
```

This will show:
- Plugin loading details
- Configuration validation results
- Error stack traces
- Performance metrics

### Getting Help

1. **Documentation:** Check the full API reference
2. **Examples:** Look at built-in plugins for patterns
3. **Community:** Join the Orbiton Discord/GitHub discussions
4. **Issues:** Report bugs on GitHub

## Advanced Topics

### Custom Event Handling

```javascript
async initialize() {
  // Listen for custom events
  this.eventBus.on('data-updated', this.handleDataUpdate.bind(this));
}

handleDataUpdate(data) {
  this.data = data;
  this.render();
}

// Emit events to other plugins
notifyOtherPlugins() {
  this.eventBus.emit('my-plugin-event', { data: this.data });
}
```

### Plugin Communication

```javascript
// Get data from another plugin
async initialize() {
  const weatherPlugin = this.pluginManager.getPlugin('weather');
  if (weatherPlugin) {
    this.weatherData = weatherPlugin.data;
  }
}
```

### Custom Layouts

```javascript
// Override default positioning
getLayoutHints() {
  return {
    minWidth: 20,
    minHeight: 5,
    preferredRatio: 2, // width:height ratio
    canResize: true
  };
}
```

This guide covers the essentials of plugin development for Orbiton. For more advanced topics and complete API reference, see the API documentation.