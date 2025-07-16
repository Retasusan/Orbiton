/**
 * @fileoverview Configuration Management Commands
 * 
 * Commands for initializing, editing, and managing Orbiton configuration.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Logger } from '../utils/Logger.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ConfigValidator } from '../config/ConfigValidator.js';

/**
 * Configuration command handler
 */
export class ConfigCommands {
  constructor() {
    this.logger = new Logger('config-cli');
    this.configManager = new ConfigManager();
    this.validator = new ConfigValidator();
  }

  /**
   * Initialize configuration
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async init(options) {
    try {
      console.log(chalk.cyan('🔧 Initializing Orbiton configuration...\n'));

      // Check if config already exists
      const configPath = this.configManager.getConfigPath();
      const configExists = await this.fileExists(configPath);

      if (configExists && !options.force) {
        const { overwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration file already exists. Overwrite?',
          default: false
        }]);

        if (!overwrite) {
          console.log(chalk.yellow('Configuration initialization cancelled.'));
          return;
        }
      }

      let config;

      if (options.interactive) {
        config = await this.interactiveSetup();
      } else if (options.preset) {
        config = await this.loadPreset(options.preset);
      } else {
        config = await this.generateDefaultConfig();
      }

      // Validate configuration
      const validation = await this.validator.validate(config);
      if (!validation.isValid) {
        console.error(chalk.red('❌ Generated configuration is invalid:'));
        validation.errors.forEach(error => {
          console.error(chalk.red(`  - ${error.message}`));
        });
        process.exit(1);
      }

      // Save configuration
      await this.configManager.saveConfig(config);
      
      console.log(chalk.green('✅ Configuration initialized successfully!'));
      console.log(chalk.gray(`Configuration saved to: ${configPath}`));
      
      if (validation.warnings && validation.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        validation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  - ${warning.message}`));
        });
      }

      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray('  orbiton start          # Start dashboard'));
      console.log(chalk.gray('  orbiton config edit    # Edit configuration'));
      console.log(chalk.gray('  orbiton plugin list    # View available plugins'));

    } catch (error) {
      console.error(chalk.red('❌ Configuration initialization failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Edit configuration
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async edit(options) {
    try {
      const configPath = this.configManager.getConfigPath();
      const configExists = await this.fileExists(configPath);

      if (!configExists) {
        console.log(chalk.yellow('⚠️  Configuration file not found.'));
        const { create } = await inquirer.prompt([{
          type: 'confirm',
          name: 'create',
          message: 'Would you like to create a new configuration?',
          default: true
        }]);

        if (create) {
          await this.init({ interactive: true });
          return;
        } else {
          console.log(chalk.gray('Configuration editing cancelled.'));
          return;
        }
      }

      // Determine editor
      const editor = options.editor || process.env.EDITOR || process.env.VISUAL || 'nano';
      
      console.log(chalk.cyan(`📝 Opening configuration in ${editor}...`));
      
      // Open editor
      const { spawn } = await import('child_process');
      const child = spawn(editor, [configPath], {
        stdio: 'inherit'
      });

      child.on('exit', async (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Configuration saved.'));
          
          // Validate the edited configuration
          try {
            const config = await this.configManager.loadConfig();
            const validation = await this.validator.validate(config);
            
            if (!validation.isValid) {
              console.log(chalk.red('\n❌ Configuration validation failed:'));
              validation.errors.forEach(error => {
                console.error(chalk.red(`  - ${error.message}`));
              });
              console.log(chalk.yellow('\nRun "orbiton config validate --fix" to attempt automatic fixes.'));
            } else {
              console.log(chalk.green('✅ Configuration is valid.'));
            }
          } catch (error) {
            console.error(chalk.red('❌ Failed to validate configuration:'), error.message);
          }
        } else {
          console.log(chalk.yellow('Configuration editing cancelled.'));
        }
      });

    } catch (error) {
      console.error(chalk.red('❌ Failed to edit configuration:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Validate configuration
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async validate(options) {
    try {
      console.log(chalk.cyan('🔍 Validating configuration...\n'));

      const configPath = options.file || this.configManager.getConfigPath();
      
      if (!await this.fileExists(configPath)) {
        console.error(chalk.red(`❌ Configuration file not found: ${configPath}`));
        process.exit(1);
      }

      // Load and validate configuration
      const config = await this.configManager.loadConfig(configPath);
      const validation = await this.validator.validate(config);

      if (validation.isValid) {
        console.log(chalk.green('✅ Configuration is valid!'));
        
        if (validation.warnings && validation.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          validation.warnings.forEach(warning => {
            console.log(chalk.yellow(`  - ${warning.message}`));
            if (warning.suggestion) {
              console.log(chalk.gray(`    Suggestion: ${warning.suggestion}`));
            }
          });
        }
      } else {
        console.log(chalk.red('❌ Configuration validation failed:\n'));
        
        validation.errors.forEach(error => {
          console.error(chalk.red(`  - ${error.message}`));
          if (error.suggestion) {
            console.log(chalk.gray(`    Suggestion: ${error.suggestion}`));
          }
        });

        if (options.fix) {
          console.log(chalk.cyan('\n🔧 Attempting to fix errors...\n'));
          
          try {
            const fixedConfig = await this.validator.autoFix(config);
            await this.configManager.saveConfig(fixedConfig);
            
            console.log(chalk.green('✅ Configuration fixed and saved!'));
          } catch (fixError) {
            console.error(chalk.red('❌ Failed to auto-fix configuration:'), fixError.message);
            process.exit(1);
          }
        } else {
          console.log(chalk.yellow('\nRun with --fix to attempt automatic fixes.'));
          process.exit(1);
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Configuration validation failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Show current configuration
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async show(options) {
    try {
      const config = await this.configManager.loadConfig();
      
      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log(chalk.bold('\n📋 Current Configuration\n'));
      
      // Display configuration sections
      this.displayConfigSection('General', {
        'Auto-detect': config.autoDetect !== false ? 'enabled' : 'disabled',
        'Theme': config.theme || 'default',
        'Preset': config.preset || 'auto'
      });

      if (config.plugins && config.plugins.length > 0) {
        this.displayConfigSection('Plugins', 
          config.plugins.reduce((acc, plugin) => {
            acc[plugin.name] = plugin.enabled !== false ? 'enabled' : 'disabled';
            return acc;
          }, {})
        );
      }

      if (config.layout) {
        this.displayConfigSection('Layout', {
          'Grid': config.layout.grid ? `${config.layout.grid.rows}x${config.layout.grid.cols}` : 'auto',
          'Preset': config.layout.preset || 'default'
        });
      }

      if (config.performance) {
        this.displayConfigSection('Performance', {
          'Update Interval': `${config.performance.updateInterval || 5000}ms`,
          'Max Concurrent Updates': config.performance.maxConcurrentUpdates || 5
        });
      }

      console.log(chalk.gray(`\nConfiguration file: ${this.configManager.getConfigPath()}`));

    } catch (error) {
      console.error(chalk.red('❌ Failed to show configuration:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Reset configuration to defaults
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async reset(options) {
    try {
      const configPath = this.configManager.getConfigPath();

      if (!options.force) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to reset configuration to defaults?',
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Configuration reset cancelled.'));
          return;
        }
      }

      // Create backup if requested
      if (options.backup && await this.fileExists(configPath)) {
        const backupPath = `${configPath}.backup.${Date.now()}`;
        await fs.copyFile(configPath, backupPath);
        console.log(chalk.gray(`Backup created: ${backupPath}`));
      }

      // Generate default configuration
      const defaultConfig = await this.generateDefaultConfig();
      await this.configManager.saveConfig(defaultConfig);

      console.log(chalk.green('✅ Configuration reset to defaults!'));
      console.log(chalk.gray(`Configuration saved to: ${configPath}`));

    } catch (error) {
      console.error(chalk.red('❌ Failed to reset configuration:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Migrate configuration from older versions
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async migrate(options) {
    try {
      console.log(chalk.cyan('🔄 Migrating configuration...\n'));

      const migrationResult = await this.configManager.migrateFromLegacy();

      if (migrationResult.success) {
        console.log(chalk.green('✅ Configuration migrated successfully!'));
        if (migrationResult.backupPath) {
          console.log(chalk.gray(`Legacy configuration backed up to: ${migrationResult.backupPath}`));
        }
      } else {
        console.log(chalk.yellow('⚠️  Migration completed with issues:'));
        console.log(chalk.yellow(migrationResult.message));
        
        if (migrationResult.manualSteps && migrationResult.manualSteps.length > 0) {
          console.log(chalk.yellow('\nManual migration steps required:'));
          migrationResult.manualSteps.forEach((step, index) => {
            console.log(chalk.yellow(`${index + 1}. ${step.description}`));
            console.log(chalk.gray(`   ${step.action}`));
          });
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Configuration migration failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Interactive configuration setup
   * @returns {Promise<Object>} Configuration object
   * @private
   */
  async interactiveSetup() {
    console.log(chalk.bold('Interactive Configuration Setup\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'preset',
        message: 'Choose a configuration preset:',
        choices: [
          { name: 'Developer - For development environments', value: 'developer' },
          { name: 'Server - For server monitoring', value: 'server' },
          { name: 'Minimal - Lightweight setup', value: 'minimal' },
          { name: 'Monitoring - Full monitoring suite', value: 'monitoring' },
          { name: 'Custom - Manual configuration', value: 'custom' }
        ]
      }
    ]);

    if (answers.preset !== 'custom') {
      return await this.loadPreset(answers.preset);
    }

    // Custom configuration
    const customAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'autoDetect',
        message: 'Enable automatic environment detection?',
        default: true
      },
      {
        type: 'list',
        name: 'theme',
        message: 'Choose a theme:',
        choices: ['default', 'dark', 'light', 'colorful']
      },
      {
        type: 'checkbox',
        name: 'plugins',
        message: 'Select plugins to enable:',
        choices: [
          { name: 'Clock - Display current time', value: 'clock' },
          { name: 'System Info - System monitoring', value: 'sysinfo' },
          { name: 'Docker Monitor - Docker containers', value: 'docker-monitor' },
          { name: 'GitHub Status - GitHub activity', value: 'github-status' },
          { name: 'Weather - Weather information', value: 'weather' }
        ]
      }
    ]);

    return {
      autoDetect: customAnswers.autoDetect,
      theme: customAnswers.theme,
      plugins: customAnswers.plugins.map(name => ({ name, enabled: true }))
    };
  }

  /**
   * Load a configuration preset
   * @param {string} presetName - Preset name
   * @returns {Promise<Object>} Configuration object
   * @private
   */
  async loadPreset(presetName) {
    const presets = {
      developer: {
        autoDetect: true,
        theme: 'default',
        plugins: [
          { name: 'clock', enabled: true },
          { name: 'sysinfo', enabled: true },
          { name: 'docker-monitor', enabled: true },
          { name: 'github-status', enabled: true }
        ]
      },
      server: {
        autoDetect: true,
        theme: 'minimal',
        plugins: [
          { name: 'sysinfo', enabled: true },
          { name: 'docker-monitor', enabled: true }
        ]
      },
      minimal: {
        autoDetect: false,
        theme: 'minimal',
        plugins: [
          { name: 'clock', enabled: true }
        ]
      },
      monitoring: {
        autoDetect: true,
        theme: 'colorful',
        plugins: [
          { name: 'clock', enabled: true },
          { name: 'sysinfo', enabled: true },
          { name: 'docker-monitor', enabled: true },
          { name: 'weather', enabled: true }
        ]
      }
    };

    const preset = presets[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    return { ...preset, preset: presetName };
  }

  /**
   * Generate default configuration
   * @returns {Promise<Object>} Default configuration
   * @private
   */
  async generateDefaultConfig() {
    return {
      autoDetect: true,
      theme: 'default',
      plugins: [
        { name: 'clock', enabled: true },
        { name: 'sysinfo', enabled: true }
      ]
    };
  }

  /**
   * Display a configuration section
   * @param {string} title - Section title
   * @param {Object} items - Section items
   * @private
   */
  displayConfigSection(title, items) {
    console.log(chalk.bold(`${title}:`));
    for (const [key, value] of Object.entries(items)) {
      console.log(chalk.gray(`  ${key}: ${value}`));
    }
    console.log();
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} Whether file exists
   * @private
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}