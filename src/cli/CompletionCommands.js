/**
 * @fileoverview Shell Completion Commands
 * 
 * Generate shell completion scripts for bash, zsh, and fish.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import chalk from 'chalk';
import { Logger } from '../utils/Logger.js';

/**
 * Shell completion command handler
 */
export class CompletionCommands {
  constructor() {
    this.logger = new Logger('completion');
  }

  /**
   * Generate shell completion script
   * @param {Object} options - Command options
   * @returns {Promise<void>}
   */
  async generate(options) {
    try {
      const shell = options.shell.toLowerCase();
      
      switch (shell) {
        case 'bash':
          this.generateBashCompletion();
          break;
        case 'zsh':
          this.generateZshCompletion();
          break;
        case 'fish':
          this.generateFishCompletion();
          break;
        default:
          console.error(chalk.red(`❌ Unsupported shell: ${shell}`));
          console.log(chalk.gray('Supported shells: bash, zsh, fish'));
          process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to generate completion:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Generate Bash completion script
   * @private
   */
  generateBashCompletion() {
    const script = `#!/bin/bash

# Orbiton bash completion script
# Add this to your ~/.bashrc or ~/.bash_profile:
# source <(orbiton completion --shell bash)

_orbiton_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local commands="start stop status plugin config dev doctor completion"
    
    # Plugin subcommands
    local plugin_commands="install uninstall list search info enable disable update create"
    
    # Config subcommands
    local config_commands="init edit validate show reset migrate"
    
    # Dev subcommands
    local dev_commands="plugin scaffold test docs profile"

    case \${COMP_CWORD} in
        1)
            COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
            return 0
            ;;
        2)
            case "\${prev}" in
                plugin)
                    COMPREPLY=( \$(compgen -W "\${plugin_commands}" -- \${cur}) )
                    return 0
                    ;;
                config)
                    COMPREPLY=( \$(compgen -W "\${config_commands}" -- \${cur}) )
                    return 0
                    ;;
                dev)
                    COMPREPLY=( \$(compgen -W "\${dev_commands}" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;
        3)
            case "\${COMP_WORDS[1]}" in
                plugin)
                    case "\${prev}" in
                        install|uninstall|info|enable|disable|update)
                            # Complete with installed plugin names
                            local plugins=\$(orbiton plugin list --json 2>/dev/null | jq -r '.[].name' 2>/dev/null || echo "")
                            COMPREPLY=( \$(compgen -W "\${plugins}" -- \${cur}) )
                            return 0
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac

    # Default to file completion
    COMPREPLY=( \$(compgen -f -- \${cur}) )
    return 0
}

complete -F _orbiton_completion orbiton`;

    console.log(script);
    
    console.log(chalk.gray('\n# To enable bash completion, add this to your ~/.bashrc:'));
    console.log(chalk.cyan('source <(orbiton completion --shell bash)'));
  }

  /**
   * Generate Zsh completion script
   * @private
   */
  generateZshCompletion() {
    const script = `#compdef orbiton

# Orbiton zsh completion script
# Add this to your ~/.zshrc:
# source <(orbiton completion --shell zsh)

_orbiton() {
    local context curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '1: :_orbiton_commands' \\
        '*::arg:->args'

    case $state in
        args)
            case $line[1] in
                plugin)
                    _orbiton_plugin
                    ;;
                config)
                    _orbiton_config
                    ;;
                dev)
                    _orbiton_dev
                    ;;
            esac
            ;;
    esac
}

_orbiton_commands() {
    local commands
    commands=(
        'start:Start the Orbiton dashboard'
        'stop:Stop running dashboard instances'
        'status:Show dashboard status'
        'plugin:Plugin management commands'
        'config:Configuration management commands'
        'dev:Development tools and utilities'
        'doctor:Run system diagnostics'
        'completion:Generate shell completion scripts'
    )
    _describe 'commands' commands
}

_orbiton_plugin() {
    local plugin_commands
    plugin_commands=(
        'install:Install a plugin'
        'uninstall:Uninstall a plugin'
        'list:List installed plugins'
        'search:Search for plugins'
        'info:Show plugin information'
        'enable:Enable a plugin'
        'disable:Disable a plugin'
        'update:Update plugins'
        'create:Create a new plugin'
    )
    _describe 'plugin commands' plugin_commands
}

_orbiton_config() {
    local config_commands
    config_commands=(
        'init:Initialize configuration'
        'edit:Edit configuration'
        'validate:Validate configuration'
        'show:Show current configuration'
        'reset:Reset configuration to defaults'
        'migrate:Migrate configuration from older versions'
    )
    _describe 'config commands' config_commands
}

_orbiton_dev() {
    local dev_commands
    dev_commands=(
        'plugin:Start plugin development mode'
        'scaffold:Generate plugin scaffolding'
        'test:Run tests'
        'docs:Generate documentation'
        'profile:Profile dashboard performance'
    )
    _describe 'dev commands' dev_commands
}

_orbiton "$@"`;

    console.log(script);
    
    console.log(chalk.gray('\n# To enable zsh completion, add this to your ~/.zshrc:'));
    console.log(chalk.cyan('source <(orbiton completion --shell zsh)'));
  }

  /**
   * Generate Fish completion script
   * @private
   */
  generateFishCompletion() {
    const script = `# Orbiton fish completion script
# Save this to ~/.config/fish/completions/orbiton.fish

# Main commands
complete -c orbiton -f -n '__fish_use_subcommand' -a 'start' -d 'Start the Orbiton dashboard'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'stop' -d 'Stop running dashboard instances'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'status' -d 'Show dashboard status'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'plugin' -d 'Plugin management commands'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'config' -d 'Configuration management commands'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'dev' -d 'Development tools and utilities'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'doctor' -d 'Run system diagnostics'
complete -c orbiton -f -n '__fish_use_subcommand' -a 'completion' -d 'Generate shell completion scripts'

# Plugin subcommands
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'install' -d 'Install a plugin'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'uninstall' -d 'Uninstall a plugin'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'list' -d 'List installed plugins'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'search' -d 'Search for plugins'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'info' -d 'Show plugin information'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'enable' -d 'Enable a plugin'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'disable' -d 'Disable a plugin'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'update' -d 'Update plugins'
complete -c orbiton -f -n '__fish_seen_subcommand_from plugin' -a 'create' -d 'Create a new plugin'

# Config subcommands
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'init' -d 'Initialize configuration'
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'edit' -d 'Edit configuration'
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'validate' -d 'Validate configuration'
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'show' -d 'Show current configuration'
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'reset' -d 'Reset configuration to defaults'
complete -c orbiton -f -n '__fish_seen_subcommand_from config' -a 'migrate' -d 'Migrate configuration from older versions'

# Dev subcommands
complete -c orbiton -f -n '__fish_seen_subcommand_from dev' -a 'plugin' -d 'Start plugin development mode'
complete -c orbiton -f -n '__fish_seen_subcommand_from dev' -a 'scaffold' -d 'Generate plugin scaffolding'
complete -c orbiton -f -n '__fish_seen_subcommand_from dev' -a 'test' -d 'Run tests'
complete -c orbiton -f -n '__fish_seen_subcommand_from dev' -a 'docs' -d 'Generate documentation'
complete -c orbiton -f -n '__fish_seen_subcommand_from dev' -a 'profile' -d 'Profile dashboard performance'

# Common options
complete -c orbiton -l help -d 'Show help'
complete -c orbiton -l version -d 'Show version'
complete -c orbiton -l verbose -d 'Enable verbose output'
complete -c orbiton -l config -d 'Path to configuration file' -r
complete -c orbiton -l no-color -d 'Disable colored output'`;

    console.log(script);
    
    console.log(chalk.gray('\n# To enable fish completion, save this to:'));
    console.log(chalk.cyan('~/.config/fish/completions/orbiton.fish'));
  }
}