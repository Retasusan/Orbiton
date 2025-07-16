# Orbiton Dashboard

A beautiful, extensible TUI (Terminal User Interface) dashboard with zero-config setup and AI-friendly plugin development. Monitor your system, track development metrics, and customize your terminal experience with ease.

![Orbiton Dashboard](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Orbiton+Dashboard)

## ✨ Features

- **Zero Configuration**: Works perfectly out of the box with intelligent defaults
- **Smart Environment Detection**: Automatically suggests relevant plugins based on your system
- **Easy Plugin Development**: Simple API with comprehensive templates and examples
- **AI-Friendly**: Optimized for AI coding assistants (Cursor, Kiro, Claude, etc.)
- **NPM Distribution**: Install globally or locally with standard package management
- **Hot Reloading**: Development mode with instant plugin updates
- **Comprehensive Testing**: Built-in testing framework for plugin development
- **Beautiful Themes**: Customizable themes with CSS-like styling

## 🚀 Quick Start

### Installation

#### Global Installation (Recommended)
```bash
npm install -g orbiton-dashboard
```

#### Local Development
```bash
git clone https://github.com/Retasusan/orbiton.git
cd orbiton
npm install
npm start
```

### First Run

Simply run Orbiton and it will automatically detect your environment and create a sensible default dashboard:

```bash
orbiton
```

That's it! No configuration files needed. Orbiton will:
- Detect your system capabilities (Docker, Git, Node.js, etc.)
- Suggest and load appropriate plugins
- Create an optimal layout for your screen
- Start monitoring your system

### Basic Usage

```bash
# Start dashboard (default command)
orbiton

# Start with specific preset
orbiton --preset developer

# Enable debug mode
orbiton --debug

# Development mode with hot reloading
orbiton --dev
```

## 📦 Plugin Management

### Installing Plugins

```bash
# Install from npm registry
orbiton plugin install weather

# List available plugins
orbiton plugin list

# Search for plugins
orbiton plugin search monitoring
```

### Creating Plugins

```bash
# Create a new plugin
orbiton plugin create my-awesome-plugin

# Create with specific type
orbiton plugin create my-data-widget --type data

# Test your plugin
orbiton plugin test my-awesome-plugin
```

## 🔧 Configuration

While Orbiton works without configuration, you can customize everything:

### Automatic Configuration
When you first run Orbiton, it creates a smart configuration based on your environment. No manual setup required!

### Manual Configuration
Create `.orbitonrc.json` in your home directory or project root:

```json
{
  "autoDetect": true,
  "layout": {
    "preset": "developer",
    "custom": false
  },
  "plugins": [
    {
      "name": "system-info",
      "position": [0, 0, 6, 6],
      "options": {
        "updateInterval": 5000
      }
    },
    {
      "name": "clock",
      "position": [0, 6, 6, 6],
      "options": {
        "format": "24h",
        "timezone": "UTC"
      }
    }
  ],
  "theme": "default"
}
```

### Configuration Commands

```bash
# Initialize configuration
orbiton config init

# Validate configuration
orbiton config validate

# Reset to defaults
orbiton config reset
```

## 🧩 Plugin Development

### Quick Start

1. **Generate Plugin Scaffold**
   ```bash
   orbiton plugin create my-plugin --type basic
   ```

2. **Implement Your Plugin**
   ```javascript
   import { BaseWidget } from 'orbiton';
   
   export default class MyPlugin extends BaseWidget {
     async initialize() {
       this.title = this.options.title || 'My Plugin';
     }
   
     async render() {
       this.element = blessed.box({
         label: this.title,
         content: 'Hello, World!',
         border: { type: 'line' }
       });
     }
   }
   ```

3. **Test Your Plugin**
   ```bash
   orbiton plugin test my-plugin
   ```

### Plugin Types

#### Basic Widget
For simple, static content:

```javascript
import { BaseWidget } from 'orbiton';

export default class HelloWorld extends BaseWidget {
  async initialize() {
    this.message = this.options.message || 'Hello, World!';
  }

  async render() {
    this.element = blessed.box({
      label: 'Hello World',
      content: this.message,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });
  }
}
```

#### Data Widget
For dynamic content with auto-refresh:

```javascript
import { DataWidget } from 'orbiton';

export default class WeatherWidget extends DataWidget {
  async fetchData() {
    const response = await fetch(`https://api.weather.com/current`);
    return await response.json();
  }

  async render() {
    const weather = this.data;
    this.element = blessed.box({
      label: 'Weather',
      content: `Temperature: ${weather.temp}°C\nCondition: ${weather.condition}`,
      border: { type: 'line' }
    });
  }
}
```

### Plugin Configuration

Create `plugin.json` to define your plugin metadata:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "license": "MIT",
  "category": "utility",
  "optionsSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Widget title",
        "default": "My Plugin"
      },
      "updateInterval": {
        "type": "number",
        "description": "Update interval in milliseconds",
        "default": 5000
      }
    }
  }
}
```

### Testing Plugins

Orbiton provides comprehensive testing utilities:

```javascript
import { PluginTestHarness } from 'orbiton';
import MyPlugin from './index.js';

describe('MyPlugin', () => {
  let harness;
  
  beforeEach(() => {
    harness = new PluginTestHarness(MyPlugin);
  });
  
  test('renders correctly', async () => {
    const plugin = await harness.createPlugin({ title: 'Test' });
    const content = await harness.renderPlugin(plugin);
    
    expect(content).toContain('Test');
  });
});
```

### Development Mode

Enable hot reloading for rapid development:

```bash
orbiton --dev
```

This will:
- Watch for file changes
- Automatically reload plugins
- Show detailed error messages
- Enable debug logging

## 🎨 Themes

### Built-in Themes
- `default` - Clean and modern
- `dark` - Dark theme for low-light environments
- `minimal` - Minimal design with subtle borders
- `colorful` - Vibrant colors and gradients

### Custom Themes

```json
{
  "theme": {
    "name": "my-theme",
    "colors": {
      "primary": "#00ff00",
      "secondary": "#0080ff",
      "background": "#1a1a1a",
      "text": "#ffffff"
    },
    "styles": {
      "border": { "fg": "primary" },
      "focus": { "fg": "secondary" }
    }
  }
}
```

## 🤖 AI-Friendly Development

Orbiton is optimized for AI coding assistants:

### TypeScript Definitions
Complete type definitions for all APIs:

```typescript
import { BaseWidget, PluginConfig } from 'orbiton';

class MyWidget extends BaseWidget {
  // Full IntelliSense support
}
```

### AI Configuration
The `.ai-config.json` file provides context for AI assistants:

```json
{
  "patterns": {
    "pluginStructure": {
      "baseClass": "BaseWidget or DataWidget",
      "requiredMethods": ["initialize", "render"]
    }
  },
  "examples": {
    "basicWidget": "Simple widget example",
    "dataWidget": "Data-driven widget example"
  }
}
```

### Documentation
Comprehensive JSDoc comments and examples for AI understanding.

## 📊 Built-in Plugins

### System Monitoring
- **system-info**: CPU, memory, and disk usage
- **process-monitor**: Running processes and resource usage
- **network-monitor**: Network interfaces and traffic

### Development Tools
- **git-status**: Git repository status and changes
- **npm-scripts**: Package.json scripts runner
- **docker-monitor**: Docker containers and images

### Utilities
- **clock**: World clock with multiple timezones
- **weather**: Weather information
- **notes**: Quick notes and reminders

## 🔧 Advanced Configuration

### Environment Detection

Orbiton automatically detects your environment and suggests plugins:

- **Development Machine**: Git status, npm scripts, system monitor
- **Server Environment**: System resources, process monitor, network status
- **Docker Environment**: Container status, image management
- **Minimal Setup**: Clock, basic system info

### Performance Tuning

```json
{
  "performance": {
    "updateInterval": 5000,
    "maxConcurrentUpdates": 5,
    "maxMemoryUsage": 104857600
  }
}
```

### Plugin Isolation

Plugins run in isolation to prevent crashes:
- Error recovery and graceful degradation
- Resource usage monitoring
- Automatic plugin restart on failure

## 🚀 Publishing Plugins

### Prepare for Publishing

```bash
# Package your plugin
orbiton plugin package my-plugin

# Test the package
npm pack
```

### Publish to NPM

```bash
# Publish to npm registry
orbiton plugin publish my-plugin

# Or manually
npm publish
```

### Plugin Naming Convention

- Use prefix: `orbiton-plugin-{name}`
- Example: `orbiton-plugin-weather`
- Keywords: Include `orbiton`, `plugin`, `widget`

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/orbiton.git
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create a Plugin**
   ```bash
   npm run plugin:create my-feature
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Submit Pull Request**

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation
- Use semantic commit messages

## 📚 API Reference

### BaseWidget

```javascript
class BaseWidget {
  constructor(name, options)
  async initialize()
  async render()
  async update()
  async destroy()
  setPosition(row, col, rowSpan, colSpan)
  applyTheme(theme)
  handleError(error)
}
```

### DataWidget

```javascript
class DataWidget extends BaseWidget {
  async fetchData()
  startUpdates()
  stopUpdates()
  pauseUpdates()
  resumeUpdates()
}
```

### Configuration Manager

```javascript
class ConfigManager {
  async loadConfig(configPath)
  async detectEnvironment()
  async migrateFromLegacy()
}
```

## 🐛 Troubleshooting

### Common Issues

**Plugin not loading**
```bash
# Check plugin configuration
orbiton config validate

# Enable debug mode
orbiton --debug
```

**Configuration errors**
```bash
# Reset to defaults
orbiton config reset

# Initialize new configuration
orbiton config init
```

**Performance issues**
```bash
# Check resource usage
orbiton --debug

# Reduce update intervals in configuration
```

### Getting Help

- 📖 [Documentation](https://orbiton.dev/docs)
- 💬 [Discord Community](https://discord.gg/orbiton)
- 🐛 [Issue Tracker](https://github.com/Retasusan/orbiton/issues)
- 📧 [Email Support](mailto:support@orbiton.dev)

## 📄 License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## 🙏 Acknowledgments

- [Blessed.js](https://github.com/chjj/blessed) - Terminal interface library
- [Commander.js](https://github.com/tj/commander.js) - Command line interface
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling

---

**Made with ❤️ by the Orbiton Team**

*Transform your terminal into a powerful dashboard with zero configuration!*