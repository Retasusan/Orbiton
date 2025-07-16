# User Guide

Welcome to Orbiton! This comprehensive guide will help you get the most out of your terminal dashboard experience.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Configuration](#configuration)
4. [Plugin Management](#plugin-management)
5. [Themes and Customization](#themes-and-customization)
6. [Advanced Features](#advanced-features)
7. [Tips and Tricks](#tips-and-tricks)
8. [FAQ](#faq)

## Getting Started

### First Launch

When you first run Orbiton, it automatically:

1. **Detects your environment** (development machine, server, etc.)
2. **Scans for available tools** (Docker, Git, Node.js, etc.)
3. **Suggests relevant plugins** based on what it finds
4. **Creates an optimal layout** for your terminal size
5. **Starts monitoring** your system immediately

```bash
# Simply run Orbiton
orbiton

# Your dashboard appears instantly with smart defaults!
```

### Understanding the Interface

```
┌─────────────────────────────────────────────────────────────┐
│                    Orbiton Dashboard                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│     Clock       │   System Info   │     Git Status          │
│   12:34:56      │   CPU: 45%      │   main ✓ 2 commits     │
│   2024-01-15    │   RAM: 8.2GB    │   No changes            │
│                 │   Load: 1.2     │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│  Docker Status  │  Network Info   │    Weather              │
│  5 containers   │  eth0: UP       │    London 22°C          │
│  3 running      │  192.168.1.100  │    Partly cloudy        │
│  2 stopped      │  ↑ 1.2MB/s      │    Humidity: 65%        │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Navigation and Controls

- **Tab**: Cycle through widgets
- **Arrow Keys**: Navigate within widgets (if interactive)
- **Enter**: Activate/interact with focused widget
- **r**: Refresh current widget
- **q**: Quit Orbiton
- **h**: Show help overlay

## Basic Usage

### Starting Orbiton

```bash
# Default start (zero configuration)
orbiton

# Start with specific preset
orbiton --preset developer
orbiton --preset ops
orbiton --preset minimal

# Start with custom configuration
orbiton --config my-dashboard.json

# Start in debug mode
orbiton --debug

# Start in development mode (hot reloading)
orbiton --dev
```

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--config <file>` | Use specific configuration file | `orbiton --config dev.json` |
| `--preset <name>` | Use predefined preset | `orbiton --preset ops` |
| `--theme <name>` | Use specific theme | `orbiton --theme dark` |
| `--debug` | Enable debug logging | `orbiton --debug` |
| `--dev` | Development mode with hot reload | `orbiton --dev` |
| `--no-auto-detect` | Disable environment detection | `orbiton --no-auto-detect` |
| `--help` | Show help information | `orbiton --help` |
| `--version` | Show version information | `orbiton --version` |

### Environment Presets

Orbiton includes several built-in presets:

#### Developer Preset
Perfect for software development:
- Git status and branch information
- System resource monitoring
- Docker container status
- NPM script runner
- Clock with multiple timezones

#### Operations Preset
Ideal for system administrators:
- Detailed system monitoring
- Network interface status
- Process monitoring
- Disk usage
- Service status

#### Minimal Preset
Lightweight setup for resource-constrained environments:
- Basic system info
- Clock
- Simple network status

## Configuration

### Zero Configuration (Default)

Orbiton works perfectly without any configuration. It automatically:

- Detects your environment type
- Selects appropriate plugins
- Creates an optimal layout
- Configures sensible defaults

### Manual Configuration

Create `orbiton.json` in your home directory or project root:

```json
{
  "autoDetect": true,
  "layout": {
    "preset": "custom",
    "grid": {
      "rows": 3,
      "cols": 4
    }
  },
  "plugins": [
    {
      "name": "clock",
      "position": [0, 0, 1, 1],
      "options": {
        "format": "24h",
        "showDate": true,
        "timezone": "UTC"
      }
    },
    {
      "name": "system-monitor",
      "position": [0, 1, 1, 2],
      "options": {
        "updateInterval": 2000,
        "showDetails": true,
        "alerts": {
          "cpu": 80,
          "memory": 85
        }
      }
    }
  ],
  "theme": "dark",
  "performance": {
    "updateInterval": 5000,
    "maxConcurrentUpdates": 3
  }
}
```

### Configuration Commands

```bash
# Initialize new configuration
orbiton config init

# Initialize with preset
orbiton config init --preset developer

# Validate current configuration
orbiton config validate

# Edit configuration in default editor
orbiton config edit

# Reset to defaults
orbiton config reset

# Show current configuration
orbiton config show

# Migrate from old format
orbiton config migrate
```

### Configuration Locations

Orbiton looks for configuration files in this order:

1. `./orbiton.json` (current directory)
2. `~/.orbiton/config.json` (user directory)
3. `~/.orbitonrc.json` (legacy format)
4. Built-in defaults

### Widget Positioning

Widgets are positioned using a grid system:

```json
{
  "position": [row, col, rowSpan, colSpan]
}
```

- `row`: Starting row (0-based)
- `col`: Starting column (0-based)
- `rowSpan`: Number of rows to span
- `colSpan`: Number of columns to span

Example:
```json
{
  "name": "system-monitor",
  "position": [0, 0, 2, 3]  // Top-left, 2 rows high, 3 columns wide
}
```

## Plugin Management

### Discovering Plugins

```bash
# List all available plugins
orbiton plugin list

# Search for specific plugins
orbiton plugin search weather
orbiton plugin search monitoring

# Show plugin details
orbiton plugin info weather

# List installed plugins only
orbiton plugin list --installed
```

### Installing Plugins

```bash
# Install from npm registry
orbiton plugin install weather

# Install specific version
orbiton plugin install weather@1.2.0

# Install from GitHub
orbiton plugin install github:user/orbiton-plugin-custom

# Install local plugin
orbiton plugin install ./my-local-plugin

# Install and save to configuration
orbiton plugin install weather --save
```

### Managing Plugins

```bash
# Uninstall plugin
orbiton plugin uninstall weather

# Update plugin
orbiton plugin update weather

# Update all plugins
orbiton plugin update --all

# Enable/disable plugin
orbiton plugin enable weather
orbiton plugin disable weather

# Show plugin configuration
orbiton plugin config weather
```

### Built-in Plugins

#### System Monitoring
- **system-monitor**: CPU, memory, load average
- **process-monitor**: Running processes
- **disk-usage**: Disk space and I/O
- **network-monitor**: Network interfaces and traffic

#### Development Tools
- **git-status**: Git repository information
- **docker-monitor**: Docker containers and images
- **npm-scripts**: Package.json script runner
- **github-status**: GitHub repository stats

#### Utilities
- **clock**: World clock with timezones
- **weather**: Weather information
- **calendar**: Calendar and events
- **notes**: Quick notes and reminders

### Plugin Configuration

Each plugin can be configured individually:

```json
{
  "plugins": [
    {
      "name": "weather",
      "position": [0, 2, 1, 1],
      "enabled": true,
      "options": {
        "apiKey": "your-api-key",
        "city": "London",
        "units": "metric",
        "updateInterval": 600000
      }
    }
  ]
}
```

Common plugin options:
- `updateInterval`: How often to refresh data (milliseconds)
- `enabled`: Whether the plugin is active
- `theme`: Plugin-specific theme overrides

## Themes and Customization

### Built-in Themes

```bash
# Available themes
orbiton --theme default    # Clean and modern
orbiton --theme dark       # Dark theme
orbiton --theme light      # Light theme
orbiton --theme minimal    # Minimal borders
orbiton --theme cyberpunk  # Neon colors
orbiton --theme retro      # Vintage terminal look
```

### Custom Themes

Create custom themes in your configuration:

```json
{
  "theme": {
    "name": "my-theme",
    "colors": {
      "primary": "#00ff41",
      "secondary": "#0080ff",
      "accent": "#ff8000",
      "background": "#000000",
      "foreground": "#ffffff",
      "border": "#333333",
      "success": "#00ff00",
      "warning": "#ffff00",
      "error": "#ff0000"
    },
    "styles": {
      "title": {
        "fg": "primary",
        "bold": true
      },
      "border": {
        "fg": "border",
        "type": "line"
      },
      "focus": {
        "fg": "accent",
        "bg": "background"
      }
    }
  }
}
```

### Layout Customization

#### Grid Layouts

```json
{
  "layout": {
    "type": "grid",
    "grid": {
      "rows": 4,
      "cols": 6
    },
    "spacing": 1,
    "padding": 1
  }
}
```

#### Responsive Layouts

```json
{
  "layout": {
    "responsive": true,
    "breakpoints": {
      "small": { "cols": 2, "rows": 3 },
      "medium": { "cols": 4, "rows": 3 },
      "large": { "cols": 6, "rows": 4 }
    }
  }
}
```

### Widget Styling

Individual widgets can be styled:

```json
{
  "plugins": [
    {
      "name": "clock",
      "style": {
        "border": {
          "type": "double",
          "fg": "cyan"
        },
        "label": {
          "fg": "yellow",
          "bold": true
        }
      }
    }
  ]
}
```

## Advanced Features

### Environment Detection

Orbiton automatically detects your environment:

```bash
# See what Orbiton detected
orbiton doctor

# Disable auto-detection
orbiton --no-auto-detect

# Force specific environment
orbiton --env development
```

Detection includes:
- Operating system and architecture
- Available development tools (Git, Docker, Node.js, etc.)
- Network configuration
- System resources
- Terminal capabilities

### Performance Optimization

#### Update Intervals

Configure how often widgets update:

```json
{
  "performance": {
    "globalUpdateInterval": 5000,
    "maxConcurrentUpdates": 3,
    "pauseInvisibleWidgets": true
  }
}
```

#### Resource Management

```json
{
  "performance": {
    "maxMemoryUsage": 104857600,  // 100MB
    "cpuThrottling": true,
    "networkThrottling": true
  }
}
```

### Plugin Communication

Plugins can communicate with each other:

```json
{
  "plugins": [
    {
      "name": "git-status",
      "events": {
        "emit": ["git-changed"],
        "listen": ["file-changed"]
      }
    },
    {
      "name": "file-watcher",
      "events": {
        "emit": ["file-changed"],
        "listen": ["git-changed"]
      }
    }
  ]
}
```

### Keyboard Shortcuts

Customize keyboard shortcuts:

```json
{
  "keybindings": {
    "quit": ["q", "ctrl+c"],
    "refresh": ["r", "f5"],
    "help": ["h", "f1"],
    "focus-next": ["tab"],
    "focus-prev": ["shift+tab"]
  }
}
```

### Logging and Debugging

```bash
# Enable debug logging
orbiton --debug

# Set log level
orbiton --log-level info

# Log to file
orbiton --log-file orbiton.log

# Show performance metrics
orbiton --performance
```

## Tips and Tricks

### Productivity Tips

1. **Use Presets**: Start with a preset and customize from there
2. **Hot Reloading**: Use `--dev` mode when customizing
3. **Keyboard Navigation**: Learn the keyboard shortcuts for efficiency
4. **Multiple Configs**: Use different configs for different projects

### Configuration Tips

1. **Start Simple**: Begin with auto-detection, then customize
2. **Use Comments**: JSON5 format supports comments in config files
3. **Environment Variables**: Use env vars for sensitive data like API keys
4. **Validation**: Always run `orbiton config validate` after changes

### Performance Tips

1. **Adjust Update Intervals**: Longer intervals for less critical data
2. **Disable Unused Plugins**: Remove plugins you don't need
3. **Use Minimal Theme**: Reduces rendering overhead
4. **Monitor Resource Usage**: Use `orbiton --debug` to check performance

### Development Tips

1. **Plugin Development**: Use `orbiton plugin create` for scaffolding
2. **Testing**: Always test plugins with `orbiton plugin test`
3. **Hot Reloading**: Use development mode for rapid iteration
4. **Error Handling**: Implement proper error handling in custom plugins

## FAQ

### General Questions

**Q: Does Orbiton work without configuration?**
A: Yes! Orbiton works perfectly with zero configuration. It automatically detects your environment and creates a sensible default dashboard.

**Q: Can I use Orbiton on Windows?**
A: Yes, Orbiton works on Windows, macOS, and Linux. For the best experience on Windows, use Windows Terminal.

**Q: How much system resources does Orbiton use?**
A: Orbiton is designed to be lightweight, typically using 50-100MB of RAM and minimal CPU when idle.

### Configuration Questions

**Q: Where should I put my configuration file?**
A: You can put `orbiton.json` in your home directory (`~/.orbiton/config.json`) or in your project directory.

**Q: Can I have different configurations for different projects?**
A: Yes! Place an `orbiton.json` file in your project directory, and it will override the global configuration.

**Q: How do I reset my configuration?**
A: Run `orbiton config reset` to return to default settings.

### Plugin Questions

**Q: How do I find available plugins?**
A: Use `orbiton plugin search` or `orbiton plugin list` to see available plugins.

**Q: Can I create my own plugins?**
A: Absolutely! Use `orbiton plugin create my-plugin` to get started. See the Plugin Development Guide for details.

**Q: Why isn't my plugin loading?**
A: Check the plugin configuration with `orbiton config validate` and ensure all required options are provided.

### Performance Questions

**Q: Orbiton seems slow. How can I improve performance?**
A: Try increasing update intervals, disabling unused plugins, or using the minimal theme. Run with `--debug` to identify bottlenecks.

**Q: Can I limit Orbiton's resource usage?**
A: Yes, you can set limits in the performance section of your configuration.

### Troubleshooting Questions

**Q: Orbiton won't start. What should I do?**
A: First, try `orbiton doctor` to check your system. If that doesn't work, try `orbiton --debug` for detailed error information.

**Q: My terminal doesn't display colors correctly.**
A: Check your terminal's color support with `tput colors`. You may need to set `TERM=xterm-256color`.

**Q: How do I get help?**
A: Check the documentation, use `orbiton --help`, or join our community on Discord or GitHub Discussions.

## Getting Help

### Documentation
- **Plugin Development**: `docs/plugin-development.md`
- **API Reference**: `docs/api-reference.md`
- **Troubleshooting**: `docs/troubleshooting.md`
- **Installation**: `docs/installation.md`

### Community
- **Discord**: Join our Discord server for real-time help
- **GitHub Discussions**: Ask questions and share ideas
- **GitHub Issues**: Report bugs and request features

### Support Commands
```bash
# System diagnostics
orbiton doctor

# Show help
orbiton --help

# Show version and system info
orbiton --version --verbose

# Validate configuration
orbiton config validate
```

---

**Happy dashboarding! 🚀**

*Remember: Orbiton is designed to work beautifully out of the box, but the real power comes from customization. Start simple and gradually add the features you need.*