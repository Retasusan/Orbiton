# Troubleshooting Guide

## Common Plugin Development Issues

### Plugin Not Loading

#### Symptoms
- Plugin doesn't appear in the dashboard
- No error messages in console
- Plugin listed as "not found" in plugin list

#### Possible Causes & Solutions

**1. Incorrect plugin.json format**
```bash
# Check plugin.json syntax
orbiton config validate plugins/my-plugin/plugin.json
```

**2. Missing or incorrect main export**
```javascript
// ❌ Wrong - named export
export class MyPlugin extends BaseWidget { }

// ✅ Correct - default export
export default class MyPlugin extends BaseWidget { }
```

**3. Plugin name mismatch**
```javascript
// Directory: plugins/my-awesome-plugin/
// plugin.json should have:
{
  "name": "my-awesome-plugin"  // Must match directory name
}
```

**4. Missing dependencies**
```bash
# Check if all dependencies are installed
npm install
```

#### Debug Steps
1. Enable debug mode: `orbiton start --debug`
2. Check plugin loading logs
3. Verify plugin directory structure
4. Test plugin in isolation: `orbiton plugin test my-plugin`

---

### Configuration Validation Errors

#### Symptoms
- "Invalid configuration" errors on startup
- Plugin fails to initialize
- Configuration warnings in console

#### Common Configuration Issues

**1. Missing required fields**
```json
// ❌ Missing required apiKey
{
  "plugins": [
    {
      "name": "weather",
      "options": {
        "city": "London"
      }
    }
  ]
}

// ✅ Include all required fields
{
  "plugins": [
    {
      "name": "weather",
      "options": {
        "apiKey": "your-api-key",
        "city": "London"
      }
    }
  ]
}
```

**2. Invalid data types**
```json
// ❌ Wrong type - should be number
{
  "updateInterval": "5000"
}

// ✅ Correct type
{
  "updateInterval": 5000
}
```

**3. Invalid enum values**
```json
// ❌ Invalid theme value
{
  "theme": "purple"
}

// ✅ Valid theme value
{
  "theme": "dark"
}
```

#### Debug Steps
1. Run configuration validation: `orbiton config validate`
2. Check plugin schema: `orbiton plugin info <plugin-name>`
3. Use minimal configuration to isolate issues
4. Check for typos in field names

---

### Plugin Crashes or Errors

#### Symptoms
- Plugin shows error message instead of content
- Dashboard becomes unresponsive
- Error widgets appear in place of plugins

#### Common Error Patterns

**1. Unhandled async errors**
```javascript
// ❌ Unhandled promise rejection
async fetchData() {
  const response = await fetch(this.apiUrl); // May throw
  return await response.json(); // May throw
}

// ✅ Proper error handling
async fetchData() {
  try {
    const response = await fetch(this.apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null; // Return fallback value
  }
}
```

**2. Missing null checks**
```javascript
// ❌ Potential null reference
async render() {
  this.element.setContent(this.data.message); // this.data might be null
}

// ✅ Safe null checking
async render() {
  if (!this.data) {
    this.element.setContent('Loading...');
    return;
  }
  
  this.element.setContent(this.data.message || 'No message');
}
```

**3. Resource leaks**
```javascript
// ❌ Timer not cleaned up
async initialize() {
  setInterval(() => {
    this.update();
  }, 1000);
}

// ✅ Proper cleanup
async initialize() {
  this.timer = setInterval(() => {
    this.update();
  }, 1000);
}

async destroy() {
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
}
```

#### Debug Steps
1. Check error logs: `orbiton start --debug`
2. Test plugin in isolation: `orbiton plugin test <plugin-name>`
3. Add console.log statements for debugging
4. Use try-catch blocks around risky operations

---

### Performance Issues

#### Symptoms
- Dashboard becomes slow or laggy
- High CPU or memory usage
- Plugins update slowly or freeze

#### Common Performance Problems

**1. Too frequent updates**
```javascript
// ❌ Updates every 100ms - too frequent
constructor(name, options) {
  super(name, options);
  this.updateInterval = 100;
}

// ✅ Reasonable update interval
constructor(name, options) {
  super(name, options);
  this.updateInterval = this.options.updateInterval || 5000;
}
```

**2. Expensive render operations**
```javascript
// ❌ Complex calculations in render
async render() {
  const expensiveData = this.calculateComplexStats(); // Slow operation
  this.element.setContent(expensiveData);
}

// ✅ Cache expensive calculations
async update() {
  this.cachedStats = this.calculateComplexStats(); // Calculate once
  await this.render();
}

async render() {
  this.element.setContent(this.cachedStats || 'Loading...');
}
```

**3. Memory leaks**
```javascript
// ❌ Growing arrays without cleanup
async fetchData() {
  this.history.push(await this.getData()); // Array grows forever
}

// ✅ Limit array size
async fetchData() {
  this.history.push(await this.getData());
  
  // Keep only last 100 items
  if (this.history.length > 100) {
    this.history.shift();
  }
}
```

#### Debug Steps
1. Monitor performance: `orbiton start --debug --performance`
2. Check update intervals: Look for plugins updating too frequently
3. Profile memory usage: Use Node.js profiling tools
4. Test with minimal plugin set

---

### Display and Styling Issues

#### Symptoms
- Text appears garbled or incorrectly formatted
- Colors don't display properly
- Layout looks broken
- Content gets cut off

#### Common Styling Problems

**1. Invalid blessed.js tags**
```javascript
// ❌ Invalid tag syntax
this.element.setContent('{bold-red}Text{/bold-red}'); // Wrong format

// ✅ Correct tag syntax
this.element.setContent('{bold}{red-fg}Text{/red-fg}{/bold}');
```

**2. Unclosed tags**
```javascript
// ❌ Unclosed tag
this.element.setContent('{bold}Bold text'); // Missing {/bold}

// ✅ Properly closed tags
this.element.setContent('{bold}Bold text{/bold}');
```

**3. Terminal compatibility issues**
```javascript
// ❌ Using colors not supported by all terminals
this.element.setContent('{#ff0000-fg}Red text{/#ff0000-fg}');

// ✅ Using standard colors
this.element.setContent('{red-fg}Red text{/red-fg}');
```

**4. Content too long for widget**
```javascript
// ❌ Long text without wrapping
this.element.setContent('This is a very long line that will be cut off');

// ✅ Proper text wrapping
const maxWidth = this.element.width - 2; // Account for borders
const wrappedText = this.wrapText(longText, maxWidth);
this.element.setContent(wrappedText);
```

#### Debug Steps
1. Test in different terminals
2. Check terminal color support: `echo $TERM`
3. Verify blessed.js tag syntax
4. Test with different widget sizes

---

### Network and API Issues

#### Symptoms
- Data widgets show "Loading..." indefinitely
- API-dependent plugins fail to load
- Intermittent connection errors

#### Common Network Problems

**1. CORS issues (when using browser APIs)**
```javascript
// ❌ Direct API call may fail due to CORS
async fetchData() {
  const response = await fetch('https://api.example.com/data');
  return await response.json();
}

// ✅ Use proxy or server-side request
async fetchData() {
  // Use a proxy endpoint or make request server-side
  const response = await fetch('/api/proxy/example-data');
  return await response.json();
}
```

**2. Missing error handling for network failures**
```javascript
// ❌ No network error handling
async fetchData() {
  const response = await fetch(this.apiUrl);
  return await response.json();
}

// ✅ Comprehensive error handling
async fetchData() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(this.apiUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

**3. Rate limiting issues**
```javascript
// ❌ No rate limiting consideration
constructor(name, options) {
  super(name, options);
  this.updateInterval = 1000; // Too frequent for most APIs
}

// ✅ Respect API rate limits
constructor(name, options) {
  super(name, options);
  // Default to 30 seconds for external APIs
  this.updateInterval = this.options.updateInterval || 30000;
}
```

#### Debug Steps
1. Test API endpoints manually: `curl -v https://api.example.com/data`
2. Check network connectivity
3. Verify API keys and authentication
4. Monitor rate limiting headers
5. Test with longer timeouts

---

### Installation and Dependencies

#### Symptoms
- "Module not found" errors
- Plugin installation fails
- Missing system dependencies

#### Common Installation Issues

**1. Missing Node.js dependencies**
```bash
# Check for missing dependencies
npm ls --depth=0

# Install missing dependencies
npm install
```

**2. System command dependencies**
```javascript
// ❌ Using system command without checking availability
async fetchData() {
  const { exec } = require('child_process');
  const result = await exec('docker ps'); // May not be installed
  return result;
}

// ✅ Check command availability first
async initialize() {
  try {
    await this.checkCommand('docker');
    this.dockerAvailable = true;
  } catch (error) {
    this.dockerAvailable = false;
    console.warn('Docker not available, some features disabled');
  }
}

async checkCommand(command) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(`which ${command}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
```

**3. Permission issues**
```bash
# Fix npm permission issues
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

#### Debug Steps
1. Check Node.js version: `node --version`
2. Verify npm installation: `npm --version`
3. Check global npm permissions
4. Test plugin installation in clean environment

---

## Environment-Specific Issues

### macOS Issues

**1. Terminal app compatibility**
- Some terminals don't support all colors
- Try iTerm2 for better compatibility

**2. Permission issues with system monitoring**
```bash
# Grant terminal app permissions in System Preferences > Security & Privacy
```

### Linux Issues

**1. Missing system packages**
```bash
# Install required system packages
sudo apt-get install build-essential python3

# For CentOS/RHEL
sudo yum groupinstall "Development Tools"
```

**2. Terminal color support**
```bash
# Check terminal capabilities
echo $COLORTERM
tput colors
```

### Windows Issues

**1. Windows Terminal vs Command Prompt**
- Use Windows Terminal for better Unicode and color support
- Avoid Command Prompt for best experience

**2. Path issues**
```bash
# Use forward slashes in paths
const pluginPath = 'plugins/my-plugin/index.js'; // ✅
const pluginPath = 'plugins\\my-plugin\\index.js'; // ❌ May cause issues
```

---

## Getting Help

### Debug Information Collection

When reporting issues, include:

```bash
# System information
orbiton doctor

# Configuration validation
orbiton config validate

# Plugin information
orbiton plugin list --installed

# Debug logs
orbiton start --debug > debug.log 2>&1
```

### Log Analysis

**Look for these patterns in logs:**

1. **Plugin loading errors:**
   ```
   ERROR: Failed to load plugin 'my-plugin': Module not found
   ```

2. **Configuration errors:**
   ```
   WARN: Invalid configuration for plugin 'weather': Missing required field 'apiKey'
   ```

3. **Performance warnings:**
   ```
   WARN: Plugin 'slow-plugin' update took 2.5s, consider increasing update interval
   ```

### Community Resources

1. **GitHub Issues:** Report bugs and feature requests
2. **Documentation:** Check the latest docs for updates
3. **Examples:** Look at built-in plugins for reference patterns
4. **Discord/Forums:** Get help from the community

### Creating Minimal Reproduction Cases

When reporting bugs:

1. **Create minimal plugin:**
   ```javascript
   export default class MinimalPlugin extends BaseWidget {
     async render() {
       this.element.setContent('Test');
     }
   }
   ```

2. **Use minimal configuration:**
   ```json
   {
     "plugins": [
       {
         "name": "minimal-plugin",
         "position": [0, 0, 2, 2]
       }
     ]
   }
   ```

3. **Include exact error messages and steps to reproduce**

This troubleshooting guide should help you resolve most common issues. If you encounter problems not covered here, please check the GitHub issues or create a new issue with detailed information about your problem.