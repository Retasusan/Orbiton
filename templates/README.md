# Orbiton Plugin Templates

This directory contains comprehensive templates for creating Orbiton plugins. These templates are designed to be AI-friendly and provide complete, working examples that follow best practices.

## Available Templates

### 1. Basic Widget Template (`basic-widget.js`)

**Use Case:** Simple widgets that don't require regular data updates
- Static displays
- User interaction widgets
- Simple calculators or counters
- Widgets that update only on user input

**Key Features:**
- Complete lifecycle implementation
- Configuration validation
- Event handling
- Theme integration
- Error handling
- Comprehensive JSDoc comments

**AI Usage:**
```javascript
// Template variables that AI should replace:
// {{name}} - Plugin name (kebab-case)
// {{className}} - Class name (PascalCase)
```

### 2. Data Widget Template (`data-widget.js`)

**Use Case:** Widgets that fetch and display dynamic data
- API integrations
- System monitoring
- Real-time data displays
- Periodic updates

**Key Features:**
- Automatic data fetching
- Error handling and recovery
- Caching mechanisms
- Performance optimization
- Network timeout handling
- Retry logic with exponential backoff

**AI Usage:**
```javascript
// Template demonstrates:
// - Proper async/await patterns
// - Error handling strategies
// - Caching implementation
// - Performance monitoring
```

### 3. Advanced Widget Template (`advanced-widget.js`)

**Use Case:** Complex interactive widgets
- Multi-view displays
- Interactive dashboards
- Complex data visualizations
- Plugin-to-plugin communication

**Key Features:**
- Multiple view modes
- Keyboard/mouse interaction
- Performance monitoring
- Plugin communication
- Advanced state management
- Custom event handling

### 4. Plugin Metadata Template (`plugin.json`)

**Use Case:** Plugin configuration and metadata
- Plugin discovery
- Configuration validation
- Documentation generation
- AI assistance

**Key Features:**
- Complete metadata schema
- Configuration examples
- AI-friendly annotations
- Validation rules

### 5. Test Template (`plugin-test.js`)

**Use Case:** Comprehensive plugin testing
- Unit tests
- Integration tests
- Performance tests
- Error condition testing

**Key Features:**
- Complete test coverage
- Mock objects
- Performance benchmarks
- Error simulation

## Template Usage Patterns

### For AI Code Generation

1. **Choose Appropriate Template:**
   - Simple display → `basic-widget.js`
   - Data fetching → `data-widget.js`
   - Complex interaction → `advanced-widget.js`

2. **Replace Template Variables:**
   ```javascript
   // Replace these in templates:
   {{name}}        // Plugin name (kebab-case)
   {{className}}   // Class name (PascalCase)
   {{description}} // Plugin description
   {{author}}      // Author name
   {{category}}    // Plugin category
   ```

3. **Follow Established Patterns:**
   - Use the same error handling approach
   - Follow the same async/await patterns
   - Maintain consistent code structure

### Template Structure

Each template follows this structure:

```javascript
/**
 * Plugin header with description and examples
 */

import { BaseWidget } from '../src/plugins/BaseWidget.js';

export default class PluginName extends BaseWidget {
  // 1. Constructor (if needed)
  
  // 2. Lifecycle methods
  async initialize() { /* Setup */ }
  async render() { /* Display */ }
  async update() { /* Refresh */ }
  async destroy() { /* Cleanup */ }
  
  // 3. Plugin-specific methods
  
  // 4. Configuration
  getOptionsSchema() { /* Schema */ }
  getLayoutHints() { /* Layout */ }
}
```

## AI Development Guidelines

### Code Generation Best Practices

1. **Start with Templates:**
   - Always begin with the appropriate template
   - Don't create plugins from scratch
   - Templates include all necessary boilerplate

2. **Follow Patterns:**
   - Use established error handling patterns
   - Follow async/await conventions
   - Maintain consistent code structure

3. **Include Documentation:**
   - Add JSDoc comments for all methods
   - Include usage examples
   - Document configuration options

4. **Implement Testing:**
   - Use the test template as a starting point
   - Cover all public methods
   - Include error condition tests

### Template Customization

When customizing templates for specific use cases:

1. **Preserve Core Structure:**
   - Keep lifecycle methods intact
   - Maintain error handling patterns
   - Don't remove essential boilerplate

2. **Add Functionality Incrementally:**
   - Start with basic functionality
   - Add features one at a time
   - Test each addition thoroughly

3. **Follow Naming Conventions:**
   - Use kebab-case for plugin names
   - Use PascalCase for class names
   - Use camelCase for method names

## Common Template Modifications

### Adding API Integration

```javascript
// In DataWidget template, modify fetchData():
async fetchData() {
  try {
    const response = await fetch(this.apiUrl, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    this.handleFetchError(error);
    return this.getCachedData() || null;
  }
}
```

### Adding User Interaction

```javascript
// In BaseWidget template, add to initialize():
setupEventListeners() {
  this.on('keypress', (ch, key) => {
    switch (key.name) {
      case 'enter':
        this.handleActivate();
        break;
      case 'space':
        this.handleToggle();
        break;
    }
  });
}
```

### Adding Configuration Options

```javascript
// Extend getOptionsSchema():
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
      refreshRate: {
        type: 'number',
        description: 'Update frequency in seconds',
        minimum: 5,
        default: 30
      },
      theme: {
        type: 'string',
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      }
    }
  };
}
```

## Template Validation

All templates include:

✅ **Complete lifecycle implementation**
✅ **Proper error handling**
✅ **Configuration validation**
✅ **Theme integration**
✅ **Performance considerations**
✅ **Comprehensive documentation**
✅ **Test coverage**
✅ **AI-friendly structure**

## Getting Started

1. **Choose a template** based on your plugin's needs
2. **Copy the template** to your plugin directory
3. **Replace template variables** with your plugin details
4. **Customize functionality** while preserving core structure
5. **Test thoroughly** using the test template
6. **Document your changes** in comments and README

## Support

For questions about templates:
- Check the Plugin Development Guide
- Review example plugins in `../examples/`
- See API documentation in `../docs/`
- Use `orbiton plugin create` for guided scaffolding