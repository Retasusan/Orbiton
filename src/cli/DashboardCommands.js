/**
 * @fileoverview Dashboard Management Commands
 * 
 * Commands for starting, stopping, and managing the Orbiton dashboard.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import chalk from 'chalk';
import { Logger } from '../utils/Logger.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { PluginManager } from '../plugins/PluginManager.js';
import { DashboardEngine } from '../dashboard/DashboardEngine.js';

/**
 * Dashboard command handler
 */
export class DashboardCommands {
  constructor() {
    this.logger = new Logger('dashboard-cli');
  }

  /**
   * Start the dashboard
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async start(options) {
    // Temporarily remove global error handlers to see if they're interfering

    try {
      

      // Initialize configuration manager
      const configManager = new ConfigManager();
      
      // Load configuration with options
      const configOptions = {
        configPath: options.config,
        preset: options.preset,
        autoDetect: !options.noAutoDetect
      };
      
      const config = await configManager.loadConfig(configOptions);
      
      if (options.debug) {
        this.logger.setLevel('debug');
      }

      // Initialize plugin manager
      const pluginManager = new PluginManager();
      await pluginManager.initialize({
        scanPaths: [
          '/Users/gotoukenta/develop/orbiton/plugins'
        ]
      });
      
      // Create a simple blessed dashboard directly
      const blessed = await import('blessed');
      
      // Create screen
      const screen = blessed.default.screen({
        smartCSR: true,
        title: 'Orbiton Dashboard',
        cursor: {
          artificial: true,
          shape: 'line',
          blink: true,
          color: null
        },
        debug: false,
        fullUnicode: true,
        dockBorders: true,
        autoPadding: true,
      });

      // Create a simple widget
      const clockBox = blessed.default.box({
        top: 0,
        left: 0,
        width: '50%',
        height: '50%',
        label: 'Clock',
        content: 'Current time: ' + new Date().toLocaleTimeString(),
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: 'white' },
          fg: 'white',
          bg: 'black'
        }
      });

      const infoBox = blessed.default.box({
        top: 0,
        left: '50%',
        width: '50%',
        height: '50%',
        label: 'System Info',
        content: 'System: ' + process.platform + '\nNode: ' + process.version,
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: 'white' },
          fg: 'white',
          bg: 'black'
        }
      });

      const statusBox = blessed.default.box({
        top: '50%',
        left: 0,
        width: '100%',
        height: '50%',
        label: 'Status',
        content: 'Orbiton Dashboard is running!\n\nPress q, Ctrl+C, or Escape to quit.',
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: 'white' },
          fg: 'white',
          bg: 'black'
        }
      });

      screen.append(clockBox);
      screen.append(infoBox);
      screen.append(statusBox);

      // Set up key handlers
      screen.key(['escape', 'q', 'C-c'], (ch, key) => {
        return process.exit(0);
      });

      // Update clock every second
      setInterval(() => {
        clockBox.setContent('Current time: ' + new Date().toLocaleTimeString());
        screen.render();
      }, 1000);

      // Render the screen
      screen.render();

      console.log('Dashboard rendered, setting up handlers...');

      // Set up signal handlers for graceful shutdown
      process.on('SIGINT', () => {
        console.log('Received SIGINT, exiting...');
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('Received SIGTERM, exiting...');
        process.exit(0);
      });
      
      console.log('Handlers set up, starting keep-alive interval...');
      
      // Keep the process alive with a simple interval (like the working blessed test)
      setInterval(() => {
        // Do nothing, just keep the process alive
      }, 1000);
      
      console.log('Keep-alive interval started, creating infinite promise...');
      
      // Use an infinite loop to prevent the function from returning
      // This ensures the process stays alive
      await new Promise(() => {
        console.log('Inside infinite promise - this should keep the process alive');
        // This Promise never resolves, keeping the function from returning
      });

      

    } catch (error) {
      console.error(chalk.red('❌ Failed to start dashboard:'), error.message);
      
      if (error.code === 'CONFIG_ERROR') {
        console.log(chalk.yellow('\n💡 Try running:'), chalk.cyan('orbiton config init'));
      } else if (error.code === 'PLUGIN_ERROR') {
        console.log(chalk.yellow('\n💡 Try running:'), chalk.cyan('orbiton plugin list'));
      }
      
      if (this.logger.level === 'debug') {
        console.error('\nStack trace:', error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Stop running dashboard instances
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async stop(options) {
    try {
      console.log(chalk.yellow('🛑 Stopping Orbiton Dashboard...'));

      // Find running instances (this would typically check for PID files or processes)
      const runningInstances = await this.findRunningInstances();
      
      if (runningInstances.length === 0) {
        console.log(chalk.gray('No running dashboard instances found.'));
        return;
      }

      for (const instance of runningInstances) {
        try {
          await this.stopInstance(instance, options.force);
          console.log(chalk.green(`✅ Stopped instance ${instance.pid}`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to stop instance ${instance.pid}:`, error.message));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to stop dashboard:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Show dashboard status
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async status(options) {
    try {
      const runningInstances = await this.findRunningInstances();
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig().catch(() => null);

      const status = {
        running: runningInstances.length > 0,
        instances: runningInstances,
        config: config ? {
          path: configManager.getConfigPath(),
          plugins: config.plugins?.length || 0,
          preset: config.preset || 'auto'
        } : null,
        timestamp: new Date().toISOString()
      };

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      // Display human-readable status
      console.log(chalk.bold('\n📊 Orbiton Dashboard Status\n'));
      
      if (status.running) {
        console.log(chalk.green('Status: ✅ Running'));
        console.log(chalk.gray(`Instances: ${status.instances.length}`));
        
        for (const instance of status.instances) {
          console.log(chalk.gray(`  - PID ${instance.pid} (started ${instance.startTime})`));
        }
      } else {
        console.log(chalk.red('Status: ❌ Not running'));
      }

      if (status.config) {
        console.log(chalk.gray(`\nConfiguration: ${status.config.path}`));
        console.log(chalk.gray(`Plugins: ${status.config.plugins}`));
        console.log(chalk.gray(`Preset: ${status.config.preset}`));
      } else {
        console.log(chalk.yellow('\nConfiguration: Not found'));
        console.log(chalk.gray('Run "orbiton config init" to create configuration'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Display startup information
   * @param {Object} config - Dashboard configuration
   * @param {Object} options - Command options
   * @private
   */
  displayStartupInfo(config, options) {
    console.log(chalk.bold('Configuration:'));
    
    if (options.preset) {
      console.log(chalk.gray(`  Preset: ${options.preset}`));
    }
    
    if (config.plugins && config.plugins.length > 0) {
      console.log(chalk.gray(`  Plugins: ${config.plugins.length} enabled`));
      
      if (options.debug) {
        config.plugins.forEach(plugin => {
          console.log(chalk.gray(`    - ${plugin.name}`));
        });
      }
    }
    
    if (config.theme) {
      console.log(chalk.gray(`  Theme: ${config.theme}`));
    }
    
    console.log();
  }

  /**
   * Find running dashboard instances
   * @returns {Promise<Array>} Running instances
   * @private
   */
  async findRunningInstances() {
    // This would typically check for:
    // - PID files in ~/.orbiton/
    // - Process list for orbiton processes
    // - Lock files or sockets
    
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Stop a specific dashboard instance
   * @param {Object} instance - Instance to stop
   * @param {boolean} force - Force stop
   * @returns {Promise<void>}
   * @private
   */
  async stopInstance(instance, force) {
    // This would typically:
    // - Send SIGTERM to the process
    // - Wait for graceful shutdown
    // - Send SIGKILL if force is true
    // - Clean up PID files
    
    // Placeholder implementation
    console.log(`Stopping instance ${instance.pid}${force ? ' (forced)' : ''}`);
  }
}