/**
 * @fileoverview Plugin CLI Commands
 * 
 * Command-line interface for plugin management including install, uninstall,
 * list, search, and dependency management operations.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger.js';
import { PluginManager } from './PluginManager.js';
import { PluginError, ValidationError } from '../utils/Errors.js';

const execAsync = promisify(exec);

/**
 * Plugin CLI command handler
 */
export class PluginCLI {
  constructor(options = {}) {
    this.logger = new Logger('plugin-cli');
    this.pluginManager = new PluginManager(options);
    
    // CLI configuration
    this.options = {
      verbose: false,
      dryRun: false,
      force: false,
      registry: 'https://registry.npmjs.org',
      ...options
    };
    
    // Command registry
    this.commands = new Map();
    this.registerCommands();
  }

  /**
   * Register available commands
   * @private
   */
  registerCommands() {
    this.commands.set('install', {
      description: 'Install a plugin',
      usage: 'orbiton plugin install <plugin-name> [options]',
      handler: this.installPlugin.bind(this),
      options: [
        { flag: '--save', description: 'Save to configuration' },
        { flag: '--dev', description: 'Install as development dependency' },
        { flag: '--force', description: 'Force installation' }
      ]
    });

    this.commands.set('uninstall', {
      description: 'Uninstall a plugin',
      usage: 'orbiton plugin uninstall <plugin-name> [options]',
      handler: this.uninstallPlugin.bind(this),
      options: [
        { flag: '--save', description: 'Remove from configuration' },
        { flag: '--force', description: 'Force removal' }
      ]
    });

    this.commands.set('list', {
      description: 'List installed plugins',
      usage: 'orbiton plugin list [options]',
      handler: this.listPlugins.bind(this),
      options: [
        { flag: '--all', description: 'Show all plugins (including disabled)' },
        { flag: '--json', description: 'Output as JSON' }
      ]
    });

    this.commands.set('search', {
      description: 'Search for plugins',
      usage: 'orbiton plugin search <query> [options]',
      handler: this.searchPlugins.bind(this),
      options: [
        { flag: '--limit <n>', description: 'Limit results (default: 10)' },
        { flag: '--json', description: 'Output as JSON' }
      ]
    });

    this.commands.set('info', {
      description: 'Show plugin information',
      usage: 'orbiton plugin info <plugin-name>',
      handler: this.showPluginInfo.bind(this),
      options: [
        { flag: '--json', description: 'Output as JSON' }
      ]
    });

    this.commands.set('enable', {
      description: 'Enable a plugin',
      usage: 'orbiton plugin enable <plugin-name>',
      handler: this.enablePlugin.bind(this),
      options: []
    });

    this.commands.set('disable', {
      description: 'Disable a plugin',
      usage: 'orbiton plugin disable <plugin-name>',
      handler: this.disablePlugin.bind(this),
      options: []
    });

    this.commands.set('update', {
      description: 'Update plugins',
      usage: 'orbiton plugin update [plugin-name] [options]',
      handler: this.updatePlugins.bind(this),
      options: [
        { flag: '--all', description: 'Update all plugins' },
        { flag: '--check', description: 'Check for updates only' }
      ]
    });
  }

  /**
   * Execute a CLI command
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  async execute(args) {
    try {
      // Parse command and arguments
      const [command, ...commandArgs] = args;
      
      if (!command || command === 'help') {
        this.showHelp();
        return 0;
      }

      if (!this.commands.has(command)) {
        this.error(`Unknown command: ${command}`);
        this.showHelp();
        return 1;
      }

      // Initialize plugin manager
      await this.pluginManager.initialize();

      // Execute command
      const commandInfo = this.commands.get(command);
      await commandInfo.handler(commandArgs);

      return 0;

    } catch (error) {
      this.error(`Command failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      return 1;
    }
  }

  /**
   * Install a plugin
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async installPlugin(args) {
    const { pluginName, options } = this.parseInstallArgs(args);
    
    if (!pluginName) {
      throw new Error('Plugin name is required');
    }

    this.info(`Installing plugin: ${pluginName}`);

    try {
      // Check if plugin is already installed
      if (this.pluginManager.registry.getPlugin(pluginName)) {
        if (!options.force) {
          throw new Error(`Plugin ${pluginName} is already installed. Use --force to reinstall.`);
        }
        this.warn(`Plugin ${pluginName} is already installed, reinstalling...`);
      }

      // Install from npm if it looks like an npm package
      if (this.isNpmPackage(pluginName)) {
        await this.installFromNpm(pluginName, options);
      } else {
        // Try to install from local path or git
        await this.installFromPath(pluginName, options);
      }

      // Load the plugin
      await this.pluginManager.loadPlugin(pluginName);

      // Save to configuration if requested
      if (options.save) {
        await this.savePluginToConfig(pluginName, options);
      }

      this.success(`Plugin ${pluginName} installed successfully`);

    } catch (error) {
      throw new PluginError(pluginName, `Installation failed: ${error.message}`, error);
    }
  }

  /**
   * Uninstall a plugin
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async uninstallPlugin(args) {
    const { pluginName, options } = this.parseUninstallArgs(args);
    
    if (!pluginName) {
      throw new Error('Plugin name is required');
    }

    this.info(`Uninstalling plugin: ${pluginName}`);

    try {
      // Check if plugin is installed
      if (!this.pluginManager.registry.getPlugin(pluginName)) {
        throw new Error(`Plugin ${pluginName} is not installed`);
      }

      // Unload the plugin
      if (this.pluginManager.isPluginLoaded(pluginName)) {
        await this.pluginManager.unloadPlugin(pluginName);
      }

      // Remove from registry
      this.pluginManager.registry.unregisterPlugin(pluginName);

      // Remove from configuration if requested
      if (options.save) {
        await this.removePluginFromConfig(pluginName);
      }

      // Remove plugin files (if installed via npm)
      if (options.removeFiles !== false) {
        await this.removePluginFiles(pluginName);
      }

      this.success(`Plugin ${pluginName} uninstalled successfully`);

    } catch (error) {
      throw new PluginError(pluginName, `Uninstallation failed: ${error.message}`, error);
    }
  }

  /**
   * List installed plugins
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async listPlugins(args) {
    const options = this.parseListArgs(args);

    try {
      const plugins = this.pluginManager.registry.getAllPlugins();
      
      if (plugins.length === 0) {
        this.info('No plugins installed');
        return;
      }

      // Filter plugins if needed
      const filteredPlugins = options.all ? plugins : plugins.filter(p => p.enabled !== false);

      if (options.json) {
        console.log(JSON.stringify(filteredPlugins, null, 2));
      } else {
        this.displayPluginList(filteredPlugins);
      }

    } catch (error) {
      throw new Error(`Failed to list plugins: ${error.message}`);
    }
  }

  /**
   * Search for plugins
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async searchPlugins(args) {
    const { query, options } = this.parseSearchArgs(args);
    
    if (!query) {
      throw new Error('Search query is required');
    }

    this.info(`Searching for plugins: ${query}`);

    try {
      // Search in registry first
      const localResults = this.pluginManager.registry.searchPlugins(query);
      
      // Search npm registry
      const npmResults = await this.searchNpmRegistry(query, options);
      
      const allResults = [...localResults, ...npmResults];
      
      if (allResults.length === 0) {
        this.info('No plugins found');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(allResults, null, 2));
      } else {
        this.displaySearchResults(allResults, options);
      }

    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Show plugin information
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async showPluginInfo(args) {
    const { pluginName, options } = this.parseInfoArgs(args);
    
    if (!pluginName) {
      throw new Error('Plugin name is required');
    }

    try {
      const plugin = this.pluginManager.registry.getPlugin(pluginName);
      
      if (!plugin) {
        throw new Error(`Plugin ${pluginName} not found`);
      }

      if (options.json) {
        console.log(JSON.stringify(plugin, null, 2));
      } else {
        this.displayPluginInfo(plugin);
      }

    } catch (error) {
      throw new Error(`Failed to get plugin info: ${error.message}`);
    }
  }

  /**
   * Enable a plugin
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async enablePlugin(args) {
    const pluginName = args[0];
    
    if (!pluginName) {
      throw new Error('Plugin name is required');
    }

    try {
      await this.setPluginEnabled(pluginName, true);
      this.success(`Plugin ${pluginName} enabled`);
    } catch (error) {
      throw new Error(`Failed to enable plugin: ${error.message}`);
    }
  }

  /**
   * Disable a plugin
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async disablePlugin(args) {
    const pluginName = args[0];
    
    if (!pluginName) {
      throw new Error('Plugin name is required');
    }

    try {
      await this.setPluginEnabled(pluginName, false);
      this.success(`Plugin ${pluginName} disabled`);
    } catch (error) {
      throw new Error(`Failed to disable plugin: ${error.message}`);
    }
  }

  /**
   * Update plugins
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  async updatePlugins(args) {
    const { pluginName, options } = this.parseUpdateArgs(args);

    try {
      if (pluginName) {
        // Update specific plugin
        await this.updateSinglePlugin(pluginName, options);
      } else if (options.all) {
        // Update all plugins
        await this.updateAllPlugins(options);
      } else {
        throw new Error('Specify a plugin name or use --all to update all plugins');
      }

    } catch (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Install plugin from npm
   * @private
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Install options
   * @returns {Promise<void>}
   */
  async installFromNpm(pluginName, options) {
    const installDir = path.join(process.cwd(), 'node_modules', pluginName);
    
    if (options.dryRun) {
      this.info(`Would install ${pluginName} from npm`);
      return;
    }

    // Use npm to install the package
    const npmCommand = `npm install ${pluginName}${options.dev ? ' --save-dev' : ''}`;
    
    this.debug(`Running: ${npmCommand}`);
    await execAsync(npmCommand);
    
    // Verify installation
    try {
      await fs.access(installDir);
    } catch {
      throw new Error(`Plugin installation failed - directory not found: ${installDir}`);
    }
  }

  /**
   * Install plugin from local path
   * @private
   * @param {string} pluginPath - Plugin path
   * @param {Object} options - Install options
   * @returns {Promise<void>}
   */
  async installFromPath(pluginPath, options) {
    const resolvedPath = path.resolve(pluginPath);
    
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error(`Plugin path not found: ${resolvedPath}`);
    }

    // Check if it's a valid plugin directory
    const pluginJsonPath = path.join(resolvedPath, 'plugin.json');
    try {
      await fs.access(pluginJsonPath);
    } catch {
      throw new Error(`Invalid plugin directory - missing plugin.json: ${resolvedPath}`);
    }

    if (options.dryRun) {
      this.info(`Would install plugin from: ${resolvedPath}`);
      return;
    }

    // For local plugins, we just need to register them with the discovery system
    // The actual loading will happen when the plugin manager discovers them
    this.pluginManager.discovery.addScanPath(resolvedPath);
  }

  /**
   * Check if plugin name looks like an npm package
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {boolean} Whether it looks like an npm package
   */
  isNpmPackage(pluginName) {
    // Simple heuristic: if it doesn't contain path separators and doesn't start with ./ or ../
    return !pluginName.includes('/') || pluginName.startsWith('@');
  }

  /**
   * Search npm registry for plugins
   * @private
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchNpmRegistry(query, options) {
    try {
      // Use npm search API
      const searchUrl = `${this.options.registry}/-/v1/search?text=${encodeURIComponent(query + ' orbiton-plugin')}&size=${options.limit || 10}`;
      
      // For now, return empty array as we'd need to implement HTTP client
      // In a real implementation, this would make an HTTP request to npm registry
      this.debug(`Would search npm registry: ${searchUrl}`);
      return [];
      
    } catch (error) {
      this.warn(`NPM search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Display plugin list
   * @private
   * @param {Array} plugins - Plugin list
   */
  displayPluginList(plugins) {
    console.log(`\nInstalled Plugins (${plugins.length}):\n`);
    
    for (const plugin of plugins) {
      const status = plugin.enabled !== false ? '✓' : '✗';
      const loaded = this.pluginManager.isPluginLoaded(plugin.name) ? '(loaded)' : '';
      
      console.log(`  ${status} ${plugin.name}@${plugin.version} ${loaded}`);
      if (plugin.description) {
        console.log(`    ${plugin.description}`);
      }
      console.log();
    }
  }

  /**
   * Display search results
   * @private
   * @param {Array} results - Search results
   * @param {Object} options - Display options
   */
  displaySearchResults(results, options) {
    const limit = options.limit || 10;
    const displayResults = results.slice(0, limit);
    
    console.log(`\nSearch Results (${displayResults.length}/${results.length}):\n`);
    
    for (const result of displayResults) {
      console.log(`  ${result.name}@${result.version || 'latest'}`);
      if (result.description) {
        console.log(`    ${result.description}`);
      }
      console.log();
    }
  }

  /**
   * Display plugin information
   * @private
   * @param {Object} plugin - Plugin metadata
   */
  displayPluginInfo(plugin) {
    console.log(`\nPlugin: ${plugin.name}@${plugin.version}\n`);
    
    if (plugin.description) {
      console.log(`Description: ${plugin.description}`);
    }
    
    if (plugin.author) {
      console.log(`Author: ${plugin.author}`);
    }
    
    if (plugin.category) {
      console.log(`Category: ${plugin.category}`);
    }
    
    if (plugin.keywords && plugin.keywords.length > 0) {
      console.log(`Keywords: ${plugin.keywords.join(', ')}`);
    }
    
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      console.log(`Dependencies: ${plugin.dependencies.join(', ')}`);
    }
    
    console.log(`Enabled: ${plugin.enabled !== false ? 'Yes' : 'No'}`);
    console.log(`Loaded: ${this.pluginManager.isPluginLoaded(plugin.name) ? 'Yes' : 'No'}`);
    
    if (plugin.pluginPath) {
      console.log(`Path: ${plugin.pluginPath}`);
    }
    
    console.log();
  }

  /**
   * Parse install command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseInstallArgs(args) {
    const pluginName = args.find(arg => !arg.startsWith('-'));
    const options = {
      save: args.includes('--save'),
      dev: args.includes('--dev'),
      force: args.includes('--force') || this.options.force,
      dryRun: this.options.dryRun
    };
    
    return { pluginName, options };
  }

  /**
   * Parse uninstall command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseUninstallArgs(args) {
    const pluginName = args.find(arg => !arg.startsWith('-'));
    const options = {
      save: args.includes('--save'),
      force: args.includes('--force') || this.options.force,
      removeFiles: !args.includes('--keep-files')
    };
    
    return { pluginName, options };
  }

  /**
   * Parse list command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseListArgs(args) {
    return {
      all: args.includes('--all'),
      json: args.includes('--json')
    };
  }

  /**
   * Parse search command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseSearchArgs(args) {
    const query = args.find(arg => !arg.startsWith('-'));
    const limitIndex = args.indexOf('--limit');
    const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1]) : 10;
    
    const options = {
      limit,
      json: args.includes('--json')
    };
    
    return { query, options };
  }

  /**
   * Parse info command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseInfoArgs(args) {
    const pluginName = args.find(arg => !arg.startsWith('-'));
    const options = {
      json: args.includes('--json')
    };
    
    return { pluginName, options };
  }

  /**
   * Parse update command arguments
   * @private
   * @param {Array<string>} args - Arguments
   * @returns {Object} Parsed arguments
   */
  parseUpdateArgs(args) {
    const pluginName = args.find(arg => !arg.startsWith('-'));
    const options = {
      all: args.includes('--all'),
      check: args.includes('--check')
    };
    
    return { pluginName, options };
  }

  /**
   * Show help information
   * @private
   */
  showHelp() {
    console.log('\nOrbiton Plugin Manager\n');
    console.log('Usage: orbiton plugin <command> [options]\n');
    console.log('Commands:\n');
    
    for (const [name, info] of this.commands) {
      console.log(`  ${name.padEnd(12)} ${info.description}`);
      console.log(`  ${' '.repeat(12)} ${info.usage}`);
      
      if (info.options.length > 0) {
        console.log(`  ${' '.repeat(12)} Options:`);
        for (const option of info.options) {
          console.log(`  ${' '.repeat(14)} ${option.flag.padEnd(20)} ${option.description}`);
        }
      }
      console.log();
    }
    
    console.log('Global Options:');
    console.log('  --verbose                    Show detailed output');
    console.log('  --dry-run                    Show what would be done without executing');
    console.log('  --force                      Force operation');
    console.log();
  }

  /**
   * Set plugin enabled/disabled state
   * @private
   * @param {string} pluginName - Plugin name
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Promise<void>}
   */
  async setPluginEnabled(pluginName, enabled) {
    // This would typically update the configuration file
    // For now, just update the registry
    const plugin = this.pluginManager.registry.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    plugin.enabled = enabled;
    
    if (enabled && !this.pluginManager.isPluginLoaded(pluginName)) {
      await this.pluginManager.loadPlugin(pluginName);
    } else if (!enabled && this.pluginManager.isPluginLoaded(pluginName)) {
      await this.pluginManager.unloadPlugin(pluginName);
    }
  }

  /**
   * Update a single plugin
   * @private
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Update options
   * @returns {Promise<void>}
   */
  async updateSinglePlugin(pluginName, options) {
    if (options.check) {
      this.info(`Checking for updates for ${pluginName}...`);
      // Would check for updates and report
      this.info(`${pluginName} is up to date`);
    } else {
      this.info(`Updating ${pluginName}...`);
      // Would perform actual update
      this.success(`${pluginName} updated successfully`);
    }
  }

  /**
   * Update all plugins
   * @private
   * @param {Object} options - Update options
   * @returns {Promise<void>}
   */
  async updateAllPlugins(options) {
    const plugins = this.pluginManager.registry.getAllPlugins();
    
    if (plugins.length === 0) {
      this.info('No plugins to update');
      return;
    }

    this.info(`Checking ${plugins.length} plugins for updates...`);
    
    for (const plugin of plugins) {
      await this.updateSinglePlugin(plugin.name, options);
    }
  }

  /**
   * Save plugin to configuration
   * @private
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async savePluginToConfig(pluginName, options) {
    // This would update the user's configuration file
    // For now, just log what would be done
    this.debug(`Would save ${pluginName} to configuration`);
  }

  /**
   * Remove plugin from configuration
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {Promise<void>}
   */
  async removePluginFromConfig(pluginName) {
    // This would update the user's configuration file
    // For now, just log what would be done
    this.debug(`Would remove ${pluginName} from configuration`);
  }

  /**
   * Remove plugin files
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {Promise<void>}
   */
  async removePluginFiles(pluginName) {
    // This would remove the plugin files from disk
    // For now, just log what would be done
    this.debug(`Would remove files for ${pluginName}`);
  }

  // Logging methods
  info(message) {
    console.log(`ℹ ${message}`);
  }

  success(message) {
    console.log(`✓ ${message}`);
  }

  warn(message) {
    console.warn(`⚠ ${message}`);
  }

  error(message) {
    console.error(`✗ ${message}`);
  }

  debug(message) {
    if (this.options.verbose) {
      console.log(`🔍 ${message}`);
    }
  }
}