#!/usr/bin/env node

/**
 * @fileoverview Main CLI Router for Orbiton Dashboard
 * 
 * Comprehensive command-line interface that handles all Orbiton commands
 * including dashboard management, plugin operations, and configuration.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/Logger.js';
import { DashboardCommands } from './DashboardCommands.js';
import { PluginCommands } from './PluginCommands.js';
import { ConfigCommands } from './ConfigCommands.js';
import { DevCommands } from './DevCommands.js';
import { TestCommands } from './TestCommands.js';

/**
 * Main CLI Router class that orchestrates all command handling
 */
export class CLIRouter {
  constructor() {
    this.logger = new Logger('cli');
    this.program = new Command();
    this.setupProgram();
    this.registerCommands();
  }

  /**
   * Set up the main program configuration
   * @private
   */
  setupProgram() {
    this.program
      .name('orbiton')
      .description('A beautiful, extensible TUI dashboard with zero-config setup')
      .version('2.0.0')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--no-color', 'Disable colored output')
      .option('--config <path>', 'Path to configuration file')
      .hook('preAction', (thisCommand) => {
        // Set up global options
        const opts = thisCommand.opts();
        if (opts.verbose) {
          this.logger.setLevel('debug');
        }
        if (opts.noColor) {
          chalk.level = 0;
        }
      });
  }

  /**
   * Register all command groups
   * @private
   */
  registerCommands() {
    // Dashboard commands (default)
    this.registerDashboardCommands();
    
    // Plugin management commands
    this.registerPluginCommands();
    
    // Configuration commands
    this.registerConfigCommands();
    
    // Development commands
    this.registerDevCommands();
    
    // Test commands
    this.registerTestCommands();
    
    // Help and version commands
    this.registerUtilityCommands();
  }

  /**
   * Register dashboard-related commands
   * @private
   */
  registerDashboardCommands() {
    const dashboardCommands = new DashboardCommands();

    // Default command - start dashboard
    this.program
      .command('start', { isDefault: true })
      .description('Start the Orbiton dashboard')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('-p, --preset <name>', 'Use a specific preset (developer, server, minimal, monitoring)')
      .option('-d, --debug', 'Enable debug mode with detailed logging')
      .option('--dev', 'Enable development mode with hot reloading')
      .option('--port <port>', 'Port for development server (dev mode only)', '3000')
      .option('--no-auto-detect', 'Disable automatic environment detection')
      .action(async (options) => {
        await dashboardCommands.start(options);
      });

    // Stop dashboard
    this.program
      .command('stop')
      .description('Stop running Orbiton dashboard instances')
      .option('-f, --force', 'Force stop all instances')
      .action(async (options) => {
        await dashboardCommands.stop(options);
      });

    // Status command
    this.program
      .command('status')
      .description('Show dashboard status and running instances')
      .option('--json', 'Output status as JSON')
      .action(async (options) => {
        await dashboardCommands.status(options);
      });
  }

  /**
   * Register plugin management commands
   * @private
   */
  registerPluginCommands() {
    const pluginCommands = new PluginCommands();

    const pluginCmd = this.program
      .command('plugin')
      .description('Plugin management commands')
      .alias('p');

    // Install plugin
    pluginCmd
      .command('install <name>')
      .description('Install a plugin from npm or local path')
      .option('-g, --global', 'Install globally')
      .option('-D, --save-dev', 'Install as development dependency')
      .option('-f, --force', 'Force installation (overwrite existing)')
      .option('--no-save', 'Do not save to configuration')
      .action(async (name, options) => {
        await pluginCommands.install(name, options);
      });

    // Uninstall plugin
    pluginCmd
      .command('uninstall <name>')
      .description('Uninstall a plugin')
      .alias('remove')
      .alias('rm')
      .option('-f, --force', 'Force removal')
      .option('--keep-config', 'Keep plugin configuration')
      .action(async (name, options) => {
        await pluginCommands.uninstall(name, options);
      });

    // List plugins
    pluginCmd
      .command('list')
      .description('List installed plugins')
      .alias('ls')
      .option('-a, --all', 'Show all plugins (including disabled)')
      .option('--json', 'Output as JSON')
      .option('--tree', 'Show dependency tree')
      .action(async (options) => {
        await pluginCommands.list(options);
      });

    // Search plugins
    pluginCmd
      .command('search <query>')
      .description('Search for plugins in npm registry')
      .option('-l, --limit <n>', 'Limit number of results', '10')
      .option('--json', 'Output as JSON')
      .action(async (query, options) => {
        await pluginCommands.search(query, options);
      });

    // Plugin info
    pluginCmd
      .command('info <name>')
      .description('Show detailed plugin information')
      .option('--json', 'Output as JSON')
      .action(async (name, options) => {
        await pluginCommands.info(name, options);
      });

    // Enable/disable plugins
    pluginCmd
      .command('enable <name>')
      .description('Enable a plugin')
      .action(async (name) => {
        await pluginCommands.enable(name);
      });

    pluginCmd
      .command('disable <name>')
      .description('Disable a plugin')
      .action(async (name) => {
        await pluginCommands.disable(name);
      });

    // Update plugins
    pluginCmd
      .command('update [name]')
      .description('Update plugins')
      .option('-a, --all', 'Update all plugins')
      .option('--check', 'Check for updates without installing')
      .action(async (name, options) => {
        await pluginCommands.update(name, options);
      });

    // Create plugin
    pluginCmd
      .command('create <name>')
      .description('Create a new plugin from template')
      .option('-t, --type <type>', 'Plugin type (basic, data, advanced)', 'basic')
      .option('-d, --dir <directory>', 'Target directory', './plugins')
      .action(async (name, options) => {
        await pluginCommands.create(name, options);
      });
  }

  /**
   * Register configuration management commands
   * @private
   */
  registerConfigCommands() {
    const configCommands = new ConfigCommands();

    const configCmd = this.program
      .command('config')
      .description('Configuration management commands')
      .alias('c');

    // Initialize configuration
    configCmd
      .command('init')
      .description('Initialize Orbiton configuration')
      .option('-f, --force', 'Overwrite existing configuration')
      .option('-p, --preset <name>', 'Use a preset configuration')
      .option('-i, --interactive', 'Interactive configuration setup')
      .action(async (options) => {
        await configCommands.init(options);
      });

    // Edit configuration
    configCmd
      .command('edit')
      .description('Open configuration in default editor')
      .option('-e, --editor <editor>', 'Specify editor to use')
      .action(async (options) => {
        await configCommands.edit(options);
      });

    // Validate configuration
    configCmd
      .command('validate')
      .description('Validate configuration file')
      .option('-f, --file <path>', 'Configuration file to validate')
      .option('--fix', 'Attempt to fix validation errors')
      .action(async (options) => {
        await configCommands.validate(options);
      });

    // Show configuration
    configCmd
      .command('show')
      .description('Display current configuration')
      .option('--json', 'Output as JSON')
      .option('--resolved', 'Show resolved configuration (with defaults)')
      .action(async (options) => {
        await configCommands.show(options);
      });

    // Reset configuration
    configCmd
      .command('reset')
      .description('Reset configuration to defaults')
      .option('-f, --force', 'Skip confirmation prompt')
      .option('--backup', 'Create backup before reset')
      .action(async (options) => {
        await configCommands.reset(options);
      });

    // Migrate configuration
    configCmd
      .command('migrate')
      .description('Migrate configuration from older versions')
      .option('-f, --from <version>', 'Source version to migrate from')
      .option('--backup', 'Create backup before migration')
      .action(async (options) => {
        await configCommands.migrate(options);
      });
  }

  /**
   * Register development commands
   * @private
   */
  registerDevCommands() {
    const devCommands = new DevCommands();

    const devCmd = this.program
      .command('dev')
      .description('Development tools and utilities')
      .alias('d');

    // Plugin development mode
    devCmd
      .command('plugin <name>')
      .description('Start plugin development mode with hot reloading')
      .option('-p, --port <port>', 'Development server port', '3001')
      .option('--no-reload', 'Disable hot reloading')
      .action(async (name, options) => {
        await devCommands.pluginDev(name, options);
      });

    // Generate plugin scaffolding
    devCmd
      .command('scaffold <name>')
      .description('Generate plugin scaffolding with boilerplate code')
      .option('-t, --type <type>', 'Plugin type (basic, data, advanced)', 'basic')
      .option('--typescript', 'Generate TypeScript plugin')
      .action(async (name, options) => {
        await devCommands.scaffold(name, options);
      });

    // Run tests
    devCmd
      .command('test [pattern]')
      .description('Run tests for plugins or core')
      .option('-w, --watch', 'Watch mode')
      .option('-c, --coverage', 'Generate coverage report')
      .option('--plugin <name>', 'Test specific plugin')
      .action(async (pattern, options) => {
        await devCommands.test(pattern, options);
      });

    // Build documentation
    devCmd
      .command('docs')
      .description('Generate documentation')
      .option('-o, --output <dir>', 'Output directory', './docs')
      .option('--serve', 'Serve documentation locally')
      .action(async (options) => {
        await devCommands.docs(options);
      });

    // Performance profiling
    devCmd
      .command('profile')
      .description('Profile dashboard performance')
      .option('-d, --duration <seconds>', 'Profiling duration', '30')
      .option('-o, --output <file>', 'Output file for profile data')
      .action(async (options) => {
        await devCommands.profile(options);
      });
  }

  /**
   * Register test commands
   * @private
   */
  registerTestCommands() {
    const testCommands = new TestCommands();

    const testCmd = this.program
      .command('test')
      .description('Plugin testing commands')
      .alias('t');

    // Visual test runner
    testCmd
      .command('visual')
      .description('Launch interactive visual test runner')
      .alias('ui')
      .option('--theme <theme>', 'UI theme (dark, light)', 'dark')
      .option('--auto-run', 'Automatically run all tests on startup')
      .option('--plugin <name>', 'Test specific plugin only')
      .action(async (options) => {
        await testCommands.visual(options);
      });

    // Run tests in headless mode
    testCmd
      .command('run')
      .description('Run plugin tests in headless mode')
      .option('--plugin <name>', 'Test specific plugin')
      .option('--verbose', 'Show detailed test output')
      .option('--export <file>', 'Export results to file')
      .option('--include-accessibility', 'Include accessibility tests')
      .option('--include-responsive', 'Include responsive design tests')
      .action(async (options) => {
        await testCommands.run(options);
      });

    // Generate test template
    testCmd
      .command('generate <name>')
      .description('Generate test template for a plugin')
      .alias('gen')
      .option('--type <type>', 'Test type (unit, integration, e2e)', 'unit')
      .action(async (name, options) => {
        await testCommands.generate(name, options);
      });

    // Benchmark performance
    testCmd
      .command('benchmark')
      .description('Run performance benchmarks for plugins')
      .alias('bench')
      .option('--plugin <name>', 'Benchmark specific plugin')
      .option('--export <file>', 'Export benchmark results')
      .action(async (options) => {
        await testCommands.benchmark(options);
      });
  }

  /**
   * Register utility commands
   * @private
   */
  registerUtilityCommands() {
    // Doctor command - system diagnostics
    this.program
      .command('doctor')
      .description('Run system diagnostics and health checks')
      .option('--fix', 'Attempt to fix detected issues')
      .action(async (options) => {
        const { DoctorCommands } = await import('./DoctorCommands.js');
        const doctorCommands = new DoctorCommands();
        await doctorCommands.diagnose(options);
      });

    // Completion command
    this.program
      .command('completion')
      .description('Generate shell completion scripts')
      .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish)', 'bash')
      .action(async (options) => {
        const { CompletionCommands } = await import('./CompletionCommands.js');
        const completionCommands = new CompletionCommands();
        await completionCommands.generate(options);
      });
  }

  /**
   * Parse command line arguments and execute
   * @param {string[]} argv - Command line arguments
   * @returns {Promise<void>}
   */
  async execute(argv = process.argv) {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * Handle CLI errors with user-friendly messages
   * @param {Error} error - The error to handle
   * @private
   */
  handleError(error) {
    if (error.code === 'commander.unknownCommand') {
      console.error(chalk.red('✗ Unknown command:'), error.message);
      console.log('\nRun', chalk.cyan('orbiton --help'), 'to see available commands.');
    } else if (error.code === 'commander.missingArgument') {
      console.error(chalk.red('✗ Missing required argument:'), error.message);
    } else if (error.code === 'EACCES') {
      console.error(chalk.red('✗ Permission denied:'), error.message);
      console.log('Try running with', chalk.cyan('sudo'), 'or check file permissions.');
    } else if (error.code === 'ENOENT') {
      console.error(chalk.red('✗ File not found:'), error.message);
    } else {
      console.error(chalk.red('✗ Error:'), error.message);
      
      if (this.logger.level === 'debug') {
        console.error('\nStack trace:');
        console.error(error.stack);
      } else {
        console.log('\nRun with', chalk.cyan('--verbose'), 'for more details.');
      }
    }
  }

  /**
   * Show welcome message and basic usage
   */
  showWelcome() {
    console.log(chalk.cyan.bold('\n🚀 Welcome to Orbiton Dashboard!\n'));
    console.log('A beautiful, extensible TUI dashboard with zero-config setup.\n');
    
    console.log(chalk.bold('Quick Start:'));
    console.log('  orbiton                    # Start dashboard with auto-detection');
    console.log('  orbiton --preset developer # Start with developer preset');
    console.log('  orbiton plugin list        # List available plugins');
    console.log('  orbiton config init        # Initialize configuration');
    console.log('  orbiton --help             # Show all commands\n');
    
    console.log(chalk.gray('For more information, visit: https://github.com/Retasusan/orbiton'));
  }
}

/**
 * Create and export CLI router instance
 */
export const cliRouter = new CLIRouter();

/**
 * Main CLI entry point
 */
export async function main(argv) {
  // Show welcome message if no arguments provided
  if (argv.length <= 2) {
    cliRouter.showWelcome();
    return;
  }
  
  await cliRouter.execute(argv);
}