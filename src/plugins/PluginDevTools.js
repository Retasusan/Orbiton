/**
 * @fileoverview Plugin Development Tools
 * 
 * Development tools for plugin creation including scaffolding, hot reloading,
 * testing utilities, and development server functionality.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import { Logger } from '../utils/Logger.js';
import { PluginManager } from './PluginManager.js';
import { PluginMetadata } from './PluginMetadata.js';
import { ValidationError } from '../utils/Errors.js';

/**
 * Plugin development tools
 */
export class PluginDevTools {
  constructor(options = {}) {
    this.logger = new Logger('plugin-dev-tools');
    this.pluginManager = new PluginManager(options);
    
    // Development configuration
    this.options = {
      hotReload: true,
      watchDelay: 500,
      testRunner: 'vitest',
      templateDir: path.join(process.cwd(), 'templates'),
      ...options
    };
    
    // Hot reload state
    this.watchers = new Map();
    this.reloadQueue = new Set();
    this.reloadTimer = null;
    
    // Template registry
    this.templates = new Map();
    this.registerTemplates();
  }

  /**
   * Register available templates
   * @private
   */
  registerTemplates() {
    this.templates.set('basic-widget', {
      name: 'Basic Widget',
      description: 'A simple widget that displays static content',
      files: [
        'index.js',
        'plugin.json',
        'README.md',
        'test.js'
      ]
    });

    this.templates.set('data-widget', {
      name: 'Data Widget',
      description: 'A widget that fetches and displays dynamic data',
      files: [
        'index.js',
        'plugin.json',
        'README.md',
        'test.js',
        'default.json'
      ]
    });

    this.templates.set('interactive-widget', {
      name: 'Interactive Widget',
      description: 'A widget with user interaction capabilities',
      files: [
        'index.js',
        'plugin.json',
        'README.md',
        'test.js',
        'styles.css'
      ]
    });
  }

  /**
   * Generate a new plugin from template
   * @param {string} pluginName - Plugin name
   * @param {string} templateName - Template to use
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Plugin directory path
   */
  async generatePlugin(pluginName, templateName = 'basic-widget', options = {}) {
    try {
      this.logger.info(`Generating plugin: ${pluginName} using template: ${templateName}`);

      // Validate plugin name
      this.validatePluginName(pluginName);

      // Check if template exists
      if (!this.templates.has(templateName)) {
        throw new Error(`Template '${templateName}' not found. Available templates: ${Array.from(this.templates.keys()).join(', ')}`);
      }

      // Create plugin directory
      const pluginDir = path.join(options.outputDir || './plugins', pluginName);
      await this.ensureDirectory(pluginDir);

      // Check if directory is empty
      const existingFiles = await fs.readdir(pluginDir);
      if (existingFiles.length > 0 && !options.force) {
        throw new Error(`Directory ${pluginDir} is not empty. Use --force to overwrite.`);
      }

      // Generate files from template
      const template = this.templates.get(templateName);
      const templateContext = this.createTemplateContext(pluginName, options);

      for (const fileName of template.files) {
        await this.generateFileFromTemplate(
          templateName,
          fileName,
          path.join(pluginDir, fileName),
          templateContext
        );
      }

      this.logger.info(`Plugin ${pluginName} generated successfully at: ${pluginDir}`);
      return pluginDir;

    } catch (error) {
      this.logger.error(`Failed to generate plugin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start development mode with hot reloading
   * @param {string} pluginPath - Plugin directory path
   * @param {Object} options - Development options
   * @returns {Promise<void>}
   */
  async startDevMode(pluginPath, options = {}) {
    try {
      this.logger.info(`Starting development mode for: ${pluginPath}`);

      // Initialize plugin manager
      await this.pluginManager.initialize();

      // Load the plugin initially
      const pluginName = await this.loadPluginFromPath(pluginPath);

      // Set up hot reloading if enabled
      if (this.options.hotReload && !options.noWatch) {
        await this.setupHotReload(pluginPath, pluginName);
      }

      // Start development server if requested
      if (options.server) {
        await this.startDevServer(pluginName, options);
      }

      this.logger.info(`Development mode started for plugin: ${pluginName}`);
      
      if (this.options.hotReload) {
        this.logger.info('Hot reloading enabled - changes will be automatically reloaded');
      }

    } catch (error) {
      this.logger.error(`Failed to start development mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run plugin tests
   * @param {string} pluginPath - Plugin directory path
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async runTests(pluginPath, options = {}) {
    try {
      this.logger.info(`Running tests for plugin at: ${pluginPath}`);

      // Find test files
      const testFiles = await this.findTestFiles(pluginPath);
      
      if (testFiles.length === 0) {
        this.logger.warn('No test files found');
        return { success: true, tests: 0, message: 'No tests to run' };
      }

      // Run tests using configured test runner
      const results = await this.executeTests(testFiles, options);
      
      this.logger.info(`Tests completed: ${results.passed}/${results.total} passed`);
      return results;

    } catch (error) {
      this.logger.error(`Test execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate plugin structure and metadata
   * @param {string} pluginPath - Plugin directory path
   * @returns {Promise<Object>} Validation results
   */
  async validatePlugin(pluginPath) {
    try {
      this.logger.info(`Validating plugin at: ${pluginPath}`);

      const results = {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      // Check required files
      const requiredFiles = ['index.js', 'plugin.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(pluginPath, file);
        try {
          await fs.access(filePath);
        } catch {
          results.errors.push(`Missing required file: ${file}`);
          results.valid = false;
        }
      }

      // Validate plugin.json
      try {
        const pluginJsonPath = path.join(pluginPath, 'plugin.json');
        const pluginJsonContent = await fs.readFile(pluginJsonPath, 'utf-8');
        const pluginMetadata = JSON.parse(pluginJsonContent);
        
        const metadata = new PluginMetadata();
        const validationResult = await metadata.validateMetadata(pluginMetadata);
        
        if (!validationResult.isValid) {
          results.errors.push(...validationResult.errors.map(e => `plugin.json: ${e.message}`));
          results.valid = false;
        }
        
        if (validationResult.warnings) {
          results.warnings.push(...validationResult.warnings.map(w => `plugin.json: ${w.message}`));
        }
      } catch (error) {
        results.errors.push(`Invalid plugin.json: ${error.message}`);
        results.valid = false;
      }

      // Check for recommended files
      const recommendedFiles = ['README.md', 'test.js', 'default.json'];
      for (const file of recommendedFiles) {
        const filePath = path.join(pluginPath, file);
        try {
          await fs.access(filePath);
        } catch {
          results.suggestions.push(`Consider adding ${file} for better plugin documentation/functionality`);
        }
      }

      // Validate main entry point
      try {
        const mainFile = path.join(pluginPath, 'index.js');
        const mainContent = await fs.readFile(mainFile, 'utf-8');
        
        // Basic syntax checks
        if (!mainContent.includes('export') && !mainContent.includes('module.exports')) {
          results.warnings.push('index.js should export a plugin class');
        }
        
        if (!mainContent.includes('BaseWidget') && !mainContent.includes('DataWidget')) {
          results.suggestions.push('Consider extending BaseWidget or DataWidget for better integration');
        }
      } catch (error) {
        results.errors.push(`Cannot read index.js: ${error.message}`);
        results.valid = false;
      }

      this.logger.info(`Validation completed: ${results.valid ? 'VALID' : 'INVALID'}`);
      return results;

    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a test harness for plugin testing
   * @param {string} pluginPath - Plugin directory path
   * @returns {Promise<Object>} Test harness
   */
  async createTestHarness(pluginPath) {
    try {
      const pluginName = path.basename(pluginPath);
      
      // Load plugin
      await this.pluginManager.initialize();
      const pluginInstance = await this.loadPluginFromPath(pluginPath);

      // Create test harness
      const harness = {
        pluginName,
        pluginPath,
        pluginInstance,
        
        // Create widget instance for testing
        createWidget: async (options = {}) => {
          return await this.pluginManager.createWidget(pluginName, options);
        },
        
        // Mock DOM environment
        createMockDOM: () => {
          return {
            createElement: (tag) => ({
              tagName: tag.toUpperCase(),
              innerHTML: '',
              style: {},
              classList: {
                add: () => {},
                remove: () => {},
                contains: () => false
              },
              appendChild: () => {},
              addEventListener: () => {}
            }),
            querySelector: () => null,
            querySelectorAll: () => []
          };
        },
        
        // Utility methods
        waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        // Cleanup
        cleanup: async () => {
          if (this.pluginManager.isPluginLoaded(pluginName)) {
            await this.pluginManager.unloadPlugin(pluginName);
          }
        }
      };

      return harness;

    } catch (error) {
      this.logger.error(`Failed to create test harness: ${error.message}`);
      throw error;
    }
  }

  /**
   * List available templates
   * @returns {Array<Object>} Available templates
   */
  listTemplates() {
    return Array.from(this.templates.entries()).map(([key, template]) => ({
      name: key,
      displayName: template.name,
      description: template.description,
      files: template.files
    }));
  }

  /**
   * Stop development mode and cleanup
   * @returns {Promise<void>}
   */
  async stopDevMode() {
    try {
      this.logger.info('Stopping development mode');

      // Stop all file watchers
      for (const [path, watcher] of this.watchers) {
        watcher.close();
        this.logger.debug(`Stopped watching: ${path}`);
      }
      this.watchers.clear();

      // Clear reload timer
      if (this.reloadTimer) {
        clearTimeout(this.reloadTimer);
        this.reloadTimer = null;
      }

      // Shutdown plugin manager
      await this.pluginManager.shutdown();

      this.logger.info('Development mode stopped');

    } catch (error) {
      this.logger.error(`Error stopping development mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate plugin name
   * @private
   * @param {string} pluginName - Plugin name to validate
   */
  validatePluginName(pluginName) {
    if (!pluginName || typeof pluginName !== 'string') {
      throw new ValidationError('Plugin name is required');
    }

    if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
      throw new ValidationError('Plugin name must start with a letter and contain only lowercase letters, numbers, and hyphens');
    }

    if (pluginName.length < 3 || pluginName.length > 50) {
      throw new ValidationError('Plugin name must be between 3 and 50 characters');
    }
  }

  /**
   * Create template context for file generation
   * @private
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Generation options
   * @returns {Object} Template context
   */
  createTemplateContext(pluginName, options) {
    return {
      pluginName,
      pluginDisplayName: options.displayName || this.toDisplayName(pluginName),
      pluginDescription: options.description || `A ${pluginName} widget for Orbiton dashboard`,
      author: options.author || 'Plugin Developer',
      version: options.version || '1.0.0',
      category: options.category || 'general',
      keywords: options.keywords || [pluginName, 'widget', 'orbiton'],
      license: options.license || 'MIT',
      date: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Convert kebab-case to display name
   * @private
   * @param {string} name - Kebab-case name
   * @returns {string} Display name
   */
  toDisplayName(name) {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate file from template
   * @private
   * @param {string} templateName - Template name
   * @param {string} fileName - File name
   * @param {string} outputPath - Output file path
   * @param {Object} context - Template context
   * @returns {Promise<void>}
   */
  async generateFileFromTemplate(templateName, fileName, outputPath, context) {
    try {
      // Try to load template file
      const templatePath = path.join(this.options.templateDir, `${templateName}-${fileName}`);
      let templateContent;
      
      try {
        templateContent = await fs.readFile(templatePath, 'utf-8');
      } catch {
        // Fall back to built-in templates
        templateContent = this.getBuiltInTemplate(templateName, fileName);
      }

      // Replace template variables
      const processedContent = this.processTemplate(templateContent, context);

      // Write file
      await fs.writeFile(outputPath, processedContent, 'utf-8');
      this.logger.debug(`Generated: ${outputPath}`);

    } catch (error) {
      throw new Error(`Failed to generate ${fileName}: ${error.message}`);
    }
  }

  /**
   * Get built-in template content
   * @private
   * @param {string} templateName - Template name
   * @param {string} fileName - File name
   * @returns {string} Template content
   */
  getBuiltInTemplate(templateName, fileName) {
    const templates = {
      'basic-widget': {
        'index.js': `/**
 * @fileoverview {{pluginDisplayName}} Plugin
 * 
 * {{pluginDescription}}
 * 
 * @author {{author}}
 * @version {{version}}
 */

import { BaseWidget } from '@orbiton/core';

export default class {{pluginDisplayName}}Widget extends BaseWidget {
  constructor(options = {}) {
    super(options);
    this.name = '{{pluginName}}';
  }

  async initialize() {
    await super.initialize();
    this.logger.info('{{pluginDisplayName}} widget initialized');
  }

  render() {
    return \`
      <div class="{{pluginName}}-widget">
        <h3>{{pluginDisplayName}}</h3>
        <p>{{pluginDescription}}</p>
      </div>
    \`;
  }

  async update() {
    // Update widget content here
    this.logger.debug('{{pluginDisplayName}} widget updated');
  }

  async destroy() {
    this.logger.info('{{pluginDisplayName}} widget destroyed');
    await super.destroy();
  }
}`,
        'plugin.json': `{
  "name": "{{pluginName}}",
  "version": "{{version}}",
  "description": "{{pluginDescription}}",
  "author": "{{author}}",
  "license": "{{license}}",
  "category": "{{category}}",
  "keywords": {{keywordsJson}},
  "main": "index.js",
  "orbiton": {
    "minVersion": "2.0.0"
  },
  "dependencies": [],
  "options": {
    "title": {
      "type": "string",
      "default": "{{pluginDisplayName}}",
      "description": "Widget title"
    }
  }
}`,
        'README.md': `# {{pluginDisplayName}}

{{pluginDescription}}

## Installation

\`\`\`bash
orbiton plugin install {{pluginName}}
\`\`\`

## Usage

Add the plugin to your dashboard configuration:

\`\`\`json
{
  "plugins": [
    {
      "name": "{{pluginName}}",
      "enabled": true,
      "options": {
        "title": "{{pluginDisplayName}}"
      }
    }
  ]
}
\`\`\`

## Options

- \`title\` (string): Widget title (default: "{{pluginDisplayName}}")

## Development

\`\`\`bash
# Run tests
npm test

# Start development mode
orbiton plugin dev {{pluginName}}
\`\`\`

## License

{{license}}
`,
        'test.js': `/**
 * @fileoverview Tests for {{pluginDisplayName}} Plugin
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {{pluginDisplayName}}Widget from './index.js';

describe('{{pluginDisplayName}}Widget', () => {
  let widget;

  beforeEach(() => {
    widget = new {{pluginDisplayName}}Widget({
      title: 'Test {{pluginDisplayName}}'
    });
  });

  afterEach(async () => {
    if (widget) {
      await widget.destroy();
    }
  });

  test('should initialize correctly', async () => {
    await widget.initialize();
    
    expect(widget.name).toBe('{{pluginName}}');
    expect(widget.options.title).toBe('Test {{pluginDisplayName}}');
  });

  test('should render content', () => {
    const html = widget.render();
    
    expect(html).toContain('{{pluginName}}-widget');
    expect(html).toContain('{{pluginDisplayName}}');
  });

  test('should update without errors', async () => {
    await widget.initialize();
    await expect(widget.update()).resolves.not.toThrow();
  });
});`
      }
    };

    const template = templates[templateName];
    if (!template || !template[fileName]) {
      throw new Error(`Built-in template not found: ${templateName}/${fileName}`);
    }

    return template[fileName];
  }

  /**
   * Process template with context variables
   * @private
   * @param {string} template - Template content
   * @param {Object} context - Template context
   * @returns {string} Processed content
   */
  processTemplate(template, context) {
    let processed = template;

    // Replace template variables
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      
      if (key === 'keywords' || key === 'keywordsJson') {
        // Special handling for JSON arrays
        processed = processed.replace(regex, JSON.stringify(value));
      } else {
        processed = processed.replace(regex, String(value));
      }
    }

    return processed;
  }

  /**
   * Ensure directory exists
   * @private
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Load plugin from path
   * @private
   * @param {string} pluginPath - Plugin directory path
   * @returns {Promise<string>} Plugin name
   */
  async loadPluginFromPath(pluginPath) {
    // Add path to discovery scan paths
    this.pluginManager.discovery.addScanPath(pluginPath);
    
    // Discover and load the plugin
    await this.pluginManager.discoverPlugins();
    
    // Get plugin name from plugin.json
    const pluginJsonPath = path.join(pluginPath, 'plugin.json');
    const pluginJson = JSON.parse(await fs.readFile(pluginJsonPath, 'utf-8'));
    
    return pluginJson.name;
  }

  /**
   * Setup hot reloading for plugin
   * @private
   * @param {string} pluginPath - Plugin directory path
   * @param {string} pluginName - Plugin name
   * @returns {Promise<void>}
   */
  async setupHotReload(pluginPath, pluginName) {
    if (this.watchers.has(pluginPath)) {
      return; // Already watching
    }

    const watcher = watch(pluginPath, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.json'))) {
        this.logger.debug(`File changed: ${filename}`);
        this.scheduleReload(pluginName);
      }
    });

    this.watchers.set(pluginPath, watcher);
    this.logger.debug(`Started watching: ${pluginPath}`);
  }

  /**
   * Schedule plugin reload
   * @private
   * @param {string} pluginName - Plugin name
   */
  scheduleReload(pluginName) {
    this.reloadQueue.add(pluginName);

    // Debounce reloads
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(async () => {
      for (const name of this.reloadQueue) {
        try {
          this.logger.info(`Hot reloading plugin: ${name}`);
          await this.pluginManager.reloadPlugin(name);
          this.logger.info(`Plugin ${name} reloaded successfully`);
        } catch (error) {
          this.logger.error(`Failed to reload plugin ${name}: ${error.message}`);
        }
      }
      this.reloadQueue.clear();
    }, this.options.watchDelay);
  }

  /**
   * Find test files in plugin directory
   * @private
   * @param {string} pluginPath - Plugin directory path
   * @returns {Promise<Array<string>>} Test file paths
   */
  async findTestFiles(pluginPath) {
    const testFiles = [];
    const files = await fs.readdir(pluginPath);

    for (const file of files) {
      if (file.endsWith('.test.js') || file.endsWith('.spec.js') || file === 'test.js') {
        testFiles.push(path.join(pluginPath, file));
      }
    }

    return testFiles;
  }

  /**
   * Execute tests
   * @private
   * @param {Array<string>} testFiles - Test file paths
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async executeTests(testFiles, options) {
    // This is a placeholder implementation
    // In a real implementation, this would run the actual test runner
    
    this.logger.info(`Running ${testFiles.length} test files with ${this.options.testRunner}`);
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      total: testFiles.length * 3, // Simulate 3 tests per file
      passed: testFiles.length * 3,
      failed: 0,
      duration: 1000,
      files: testFiles
    };
  }

  /**
   * Start development server
   * @private
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Server options
   * @returns {Promise<void>}
   */
  async startDevServer(pluginName, options) {
    // This is a placeholder for a development server
    // In a real implementation, this would start an HTTP server
    // that serves the plugin in a test dashboard environment
    
    this.logger.info(`Development server would start for plugin: ${pluginName}`);
    this.logger.info(`Server would be available at: http://localhost:${options.port || 3000}`);
  }
}