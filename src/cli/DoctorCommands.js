/**
 * @fileoverview Doctor Commands
 * 
 * System diagnostics and health check commands for troubleshooting.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger.js';
import { ConfigManager } from '../config/ConfigManager.js';

const execAsync = promisify(exec);

/**
 * Doctor command handler for system diagnostics
 */
export class DoctorCommands {
  constructor() {
    this.logger = new Logger('doctor');
    this.issues = [];
    this.fixes = [];
  }

  /**
   * Run comprehensive system diagnostics
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async diagnose(options) {
    try {
      console.log(chalk.cyan('🔍 Running Orbiton system diagnostics...\n'));

      // Reset state
      this.issues = [];
      this.fixes = [];

      // Run diagnostic checks
      await this.checkNodeVersion();
      await this.checkDependencies();
      await this.checkConfiguration();
      await this.checkPlugins();
      await this.checkSystemRequirements();
      await this.checkPermissions();
      await this.checkDiskSpace();

      // Display results
      this.displayResults();

      // Apply fixes if requested
      if (options.fix && this.fixes.length > 0) {
        await this.applyFixes();
      }

    } catch (error) {
      console.error(chalk.red('❌ Diagnostics failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Check Node.js version compatibility
   * @private
   */
  async checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 18) {
      this.issues.push({
        type: 'error',
        category: 'Node.js',
        message: `Node.js version ${nodeVersion} is not supported`,
        details: 'Orbiton requires Node.js 18 or higher',
        fix: 'Update Node.js to version 18 or higher'
      });
    } else {
      this.logSuccess('Node.js', `Version ${nodeVersion} is supported`);
    }
  }

  /**
   * Check required dependencies
   * @private
   */
  async checkDependencies() {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      const requiredDeps = [
        'blessed',
        'blessed-contrib',
        'commander',
        'chalk',
        'inquirer'
      ];

      for (const dep of requiredDeps) {
        try {
          await import(dep);
          this.logSuccess('Dependencies', `${dep} is available`);
        } catch (error) {
          this.issues.push({
            type: 'error',
            category: 'Dependencies',
            message: `Missing dependency: ${dep}`,
            details: error.message,
            fix: `Run: npm install ${dep}`
          });

          this.fixes.push({
            description: `Install missing dependency: ${dep}`,
            command: `npm install ${dep}`
          });
        }
      }

    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'Dependencies',
        message: 'Failed to check dependencies',
        details: error.message,
        fix: 'Ensure package.json exists and is valid'
      });
    }
  }

  /**
   * Check configuration files
   * @private
   */
  async checkConfiguration() {
    try {
      const configManager = new ConfigManager();
      const configPath = configManager.getConfigPath();

      // Check if config exists
      try {
        await fs.access(configPath);
        this.logSuccess('Configuration', 'Configuration file exists');

        // Validate configuration
        try {
          const config = await configManager.loadConfig();
          this.logSuccess('Configuration', 'Configuration is valid');
        } catch (error) {
          this.issues.push({
            type: 'warning',
            category: 'Configuration',
            message: 'Configuration validation failed',
            details: error.message,
            fix: 'Run: orbiton config validate --fix'
          });

          this.fixes.push({
            description: 'Fix configuration validation errors',
            command: 'orbiton config validate --fix'
          });
        }

      } catch {
        this.issues.push({
          type: 'warning',
          category: 'Configuration',
          message: 'No configuration file found',
          details: 'Orbiton will use default configuration',
          fix: 'Run: orbiton config init'
        });

        this.fixes.push({
          description: 'Create configuration file',
          command: 'orbiton config init'
        });
      }

    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'Configuration',
        message: 'Failed to check configuration',
        details: error.message,
        fix: 'Check file permissions and disk space'
      });
    }
  }

  /**
   * Check plugin status and dependencies
   * @private
   */
  async checkPlugins() {
    try {
      const pluginsDir = path.join(process.cwd(), 'plugins');
      
      try {
        await fs.access(pluginsDir);
        const plugins = await fs.readdir(pluginsDir);
        
        if (plugins.length === 0) {
          this.issues.push({
            type: 'info',
            category: 'Plugins',
            message: 'No plugins found',
            details: 'Consider installing some plugins to enhance functionality',
            fix: 'Run: orbiton plugin search <query>'
          });
        } else {
          this.logSuccess('Plugins', `Found ${plugins.length} plugins`);

          // Check each plugin
          for (const pluginName of plugins) {
            await this.checkPlugin(pluginName);
          }
        }

      } catch {
        this.issues.push({
          type: 'warning',
          category: 'Plugins',
          message: 'Plugins directory not found',
          details: 'No plugins are installed',
          fix: 'Install plugins using: orbiton plugin install <name>'
        });
      }

    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'Plugins',
        message: 'Failed to check plugins',
        details: error.message,
        fix: 'Check plugins directory permissions'
      });
    }
  }

  /**
   * Check individual plugin
   * @param {string} pluginName - Plugin name
   * @private
   */
  async checkPlugin(pluginName) {
    try {
      const pluginDir = path.join(process.cwd(), 'plugins', pluginName);
      const pluginJsonPath = path.join(pluginDir, 'plugin.json');
      const pluginIndexPath = path.join(pluginDir, 'index.js');

      // Check plugin.json
      try {
        await fs.access(pluginJsonPath);
        const pluginJson = JSON.parse(await fs.readFile(pluginJsonPath, 'utf8'));
        
        // Check required fields
        const requiredFields = ['name', 'version', 'description'];
        for (const field of requiredFields) {
          if (!pluginJson[field]) {
            this.issues.push({
              type: 'warning',
              category: 'Plugins',
              message: `Plugin ${pluginName} missing ${field}`,
              details: `plugin.json should include ${field}`,
              fix: `Add ${field} to ${pluginName}/plugin.json`
            });
          }
        }

      } catch {
        this.issues.push({
          type: 'error',
          category: 'Plugins',
          message: `Plugin ${pluginName} missing plugin.json`,
          details: 'plugin.json is required for plugin metadata',
          fix: `Create plugin.json in ${pluginName} directory`
        });
      }

      // Check index.js
      try {
        await fs.access(pluginIndexPath);
      } catch {
        this.issues.push({
          type: 'error',
          category: 'Plugins',
          message: `Plugin ${pluginName} missing index.js`,
          details: 'index.js is required for plugin implementation',
          fix: `Create index.js in ${pluginName} directory`
        });
      }

    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'Plugins',
        message: `Failed to check plugin ${pluginName}`,
        details: error.message,
        fix: 'Check plugin directory structure'
      });
    }
  }

  /**
   * Check system requirements
   * @private
   */
  async checkSystemRequirements() {
    // Check terminal capabilities
    const terminalInfo = {
      TERM: process.env.TERM,
      COLORTERM: process.env.COLORTERM,
      columns: process.stdout.columns,
      rows: process.stdout.rows
    };

    if (!terminalInfo.TERM) {
      this.issues.push({
        type: 'warning',
        category: 'Terminal',
        message: 'TERM environment variable not set',
        details: 'This may cause display issues',
        fix: 'Set TERM environment variable (e.g., export TERM=xterm-256color)'
      });
    }

    if (terminalInfo.columns < 80 || terminalInfo.rows < 24) {
      this.issues.push({
        type: 'warning',
        category: 'Terminal',
        message: 'Terminal size may be too small',
        details: `Current size: ${terminalInfo.columns}x${terminalInfo.rows}`,
        fix: 'Resize terminal to at least 80x24'
      });
    } else {
      this.logSuccess('Terminal', `Size: ${terminalInfo.columns}x${terminalInfo.rows}`);
    }

    // Check common system commands
    const commands = ['git', 'docker', 'curl'];
    for (const cmd of commands) {
      try {
        await execAsync(`which ${cmd}`);
        this.logSuccess('System Commands', `${cmd} is available`);
      } catch {
        this.issues.push({
          type: 'info',
          category: 'System Commands',
          message: `Optional command not found: ${cmd}`,
          details: `Some plugins may require ${cmd}`,
          fix: `Install ${cmd} if needed by your plugins`
        });
      }
    }
  }

  /**
   * Check file permissions
   * @private
   */
  async checkPermissions() {
    const pathsToCheck = [
      process.cwd(),
      path.join(os.homedir(), '.orbiton'),
      path.join(process.cwd(), 'plugins')
    ];

    for (const checkPath of pathsToCheck) {
      try {
        await fs.access(checkPath, fs.constants.R_OK | fs.constants.W_OK);
        this.logSuccess('Permissions', `${checkPath} is readable and writable`);
      } catch (error) {
        this.issues.push({
          type: 'error',
          category: 'Permissions',
          message: `Insufficient permissions for ${checkPath}`,
          details: error.message,
          fix: `Check and fix permissions for ${checkPath}`
        });
      }
    }
  }

  /**
   * Check available disk space
   * @private
   */
  async checkDiskSpace() {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified check - in a real implementation,
      // you'd use a library like 'statvfs' to get actual disk space
      this.logSuccess('Disk Space', 'Directory is accessible');
    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'Disk Space',
        message: 'Failed to check disk space',
        details: error.message,
        fix: 'Ensure sufficient disk space is available'
      });
    }
  }

  /**
   * Display diagnostic results
   * @private
   */
  displayResults() {
    console.log(chalk.bold('\n📊 Diagnostic Results\n'));

    const errorCount = this.issues.filter(i => i.type === 'error').length;
    const warningCount = this.issues.filter(i => i.type === 'warning').length;
    const infoCount = this.issues.filter(i => i.type === 'info').length;

    if (this.issues.length === 0) {
      console.log(chalk.green('✅ All checks passed! Your Orbiton installation looks healthy.\n'));
      return;
    }

    // Summary
    console.log(chalk.bold('Summary:'));
    if (errorCount > 0) console.log(chalk.red(`  Errors: ${errorCount}`));
    if (warningCount > 0) console.log(chalk.yellow(`  Warnings: ${warningCount}`));
    if (infoCount > 0) console.log(chalk.blue(`  Info: ${infoCount}`));
    console.log();

    // Group issues by category
    const categories = [...new Set(this.issues.map(i => i.category))];
    
    for (const category of categories) {
      const categoryIssues = this.issues.filter(i => i.category === category);
      console.log(chalk.bold(`${category}:`));
      
      for (const issue of categoryIssues) {
        const icon = this.getIssueIcon(issue.type);
        const color = this.getIssueColor(issue.type);
        
        console.log(color(`  ${icon} ${issue.message}`));
        if (issue.details) {
          console.log(chalk.gray(`     ${issue.details}`));
        }
        if (issue.fix) {
          console.log(chalk.gray(`     Fix: ${issue.fix}`));
        }
        console.log();
      }
    }

    if (this.fixes.length > 0) {
      console.log(chalk.bold('💡 Available automatic fixes:'));
      this.fixes.forEach((fix, index) => {
        console.log(chalk.cyan(`  ${index + 1}. ${fix.description}`));
        console.log(chalk.gray(`     Command: ${fix.command}`));
      });
      console.log(chalk.gray('\nRun with --fix to apply automatic fixes.\n'));
    }
  }

  /**
   * Apply automatic fixes
   * @private
   */
  async applyFixes() {
    console.log(chalk.cyan('\n🔧 Applying automatic fixes...\n'));

    for (const fix of this.fixes) {
      try {
        console.log(chalk.gray(`Running: ${fix.command}`));
        await execAsync(fix.command);
        console.log(chalk.green(`✅ ${fix.description}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed: ${fix.description}`));
        console.log(chalk.gray(`   Error: ${error.message}`));
      }
    }

    console.log(chalk.green('\n✅ Automatic fixes completed!'));
    console.log(chalk.gray('Run diagnostics again to verify fixes.\n'));
  }

  /**
   * Log successful check
   * @param {string} category - Check category
   * @param {string} message - Success message
   * @private
   */
  logSuccess(category, message) {
    // In verbose mode, we could log these
    // For now, we just track that the check passed
  }

  /**
   * Get icon for issue type
   * @param {string} type - Issue type
   * @returns {string} Icon
   * @private
   */
  getIssueIcon(type) {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  }

  /**
   * Get color function for issue type
   * @param {string} type - Issue type
   * @returns {Function} Chalk color function
   * @private
   */
  getIssueColor(type) {
    switch (type) {
      case 'error': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'info': return chalk.blue;
      default: return chalk.gray;
    }
  }
}