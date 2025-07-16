/**
 * @fileoverview Plugin Management Commands
 * 
 * Commands for installing, managing, and developing plugins.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import chalk from 'chalk';
import { Logger } from '../utils/Logger.js';
import { PluginCLI } from '../plugins/PluginCLI.js';
import { PluginDevTools } from '../plugins/PluginDevTools.js';

/**
 * Plugin command handler
 */
export class PluginCommands {
  constructor() {
    this.logger = new Logger('plugin-cli');
    this.pluginCLI = new PluginCLI();
    this.devTools = new PluginDevTools();
  }

  /**
   * Install a plugin
   * @param {string} name - Plugin name
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async install(name, options) {
    try {
      console.log(chalk.cyan(`📦 Installing plugin: ${name}`));
      
      const installOptions = {
        global: options.global,
        dev: options.saveDev,
        force: options.force,
        save: !options.noSave
      };

      await this.pluginCLI.execute(['install', name, ...this.buildFlags(installOptions)]);
      
    } catch (error) {
      console.error(chalk.red('❌ Installation failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Uninstall a plugin
   * @param {string} name - Plugin name
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async uninstall(name, options) {
    try {
      console.log(chalk.yellow(`🗑️  Uninstalling plugin: ${name}`));
      
      const uninstallOptions = {
        force: options.force,
        keepConfig: options.keepConfig
      };

      await this.pluginCLI.execute(['uninstall', name, ...this.buildFlags(uninstallOptions)]);
      
    } catch (error) {
      console.error(chalk.red('❌ Uninstallation failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * List installed plugins
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async list(options) {
    try {
      const listOptions = {
        all: options.all,
        json: options.json,
        tree: options.tree
      };

      await this.pluginCLI.execute(['list', ...this.buildFlags(listOptions)]);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list plugins:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Search for plugins
   * @param {string} query - Search query
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async search(query, options) {
    try {
      console.log(chalk.cyan(`🔍 Searching for plugins: ${query}`));
      
      const searchOptions = {
        limit: options.limit,
        json: options.json
      };

      await this.pluginCLI.execute(['search', query, ...this.buildFlags(searchOptions)]);
      
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Show plugin information
   * @param {string} name - Plugin name
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async info(name, options) {
    try {
      const infoOptions = {
        json: options.json
      };

      await this.pluginCLI.execute(['info', name, ...this.buildFlags(infoOptions)]);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get plugin info:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Enable a plugin
   * @param {string} name - Plugin name
   * @returns {Promise<void>}
   */
  async enable(name) {
    try {
      console.log(chalk.green(`✅ Enabling plugin: ${name}`));
      await this.pluginCLI.execute(['enable', name]);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to enable plugin:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Disable a plugin
   * @param {string} name - Plugin name
   * @returns {Promise<void>}
   */
  async disable(name) {
    try {
      console.log(chalk.yellow(`❌ Disabling plugin: ${name}`));
      await this.pluginCLI.execute(['disable', name]);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to disable plugin:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Update plugins
   * @param {string} name - Plugin name (optional)
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async update(name, options) {
    try {
      if (name) {
        console.log(chalk.cyan(`🔄 Updating plugin: ${name}`));
      } else if (options.all) {
        console.log(chalk.cyan('🔄 Updating all plugins'));
      } else {
        console.error(chalk.red('❌ Please specify a plugin name or use --all'));
        process.exit(1);
      }
      
      const updateOptions = {
        all: options.all,
        check: options.check
      };

      const args = ['update'];
      if (name) args.push(name);
      args.push(...this.buildFlags(updateOptions));

      await this.pluginCLI.execute(args);
      
    } catch (error) {
      console.error(chalk.red('❌ Update failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Create a new plugin
   * @param {string} name - Plugin name
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async create(name, options) {
    try {
      console.log(chalk.cyan(`🛠️  Creating plugin: ${name}`));
      
      await this.devTools.scaffoldPlugin(name, {
        type: options.type,
        directory: options.dir,
        typescript: options.typescript
      });
      
      console.log(chalk.green(`✅ Plugin ${name} created successfully!`));
      console.log(chalk.gray(`Location: ${options.dir}/${name}`));
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray(`  cd ${options.dir}/${name}`));
      console.log(chalk.gray('  # Edit index.js to implement your plugin'));
      console.log(chalk.gray('  orbiton dev plugin ' + name));
      
    } catch (error) {
      console.error(chalk.red('❌ Plugin creation failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Build command flags from options object
   * @param {Object} options - Options object
   * @returns {Array<string>} Command flags
   * @private
   */
  buildFlags(options) {
    const flags = [];
    
    for (const [key, value] of Object.entries(options)) {
      if (value === true) {
        flags.push(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
      } else if (value && value !== false) {
        flags.push(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, String(value));
      }
    }
    
    return flags;
  }
}