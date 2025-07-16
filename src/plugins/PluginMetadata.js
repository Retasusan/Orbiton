/**
 * @fileoverview Plugin Metadata Management
 * 
 * Handles loading, parsing, and validation of plugin metadata from plugin.json files.
 * Provides dependency resolution and compatibility checking.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { Validator } from '../utils/Validator.js';
import { PluginError, ValidationError, FileSystemError } from '../utils/Errors.js';

/**
 * Plugin metadata manager
 */
export class PluginMetadata {
  constructor() {
    this.logger = new Logger('plugin-metadata');
    this.validator = new Validator();
    this.metadataCache = new Map();
    this.dependencyGraph = new Map();
  }

  /**
   * Load plugin metadata from plugin.json file
   * @param {string} pluginPath - Path to plugin directory
   * @returns {Promise<Object>} Plugin metadata
   */
  async loadMetadata(pluginPath) {
    try {
      const metadataPath = path.join(pluginPath, 'plugin.json');
      
      // Check cache first
      const cacheKey = path.resolve(metadataPath);
      if (this.metadataCache.has(cacheKey)) {
        const cached = this.metadataCache.get(cacheKey);
        // Check if file has been modified
        const stats = await fs.stat(metadataPath);
        if (stats.mtime <= cached.loadTime) {
          return cached.metadata;
        }
      }

      this.logger.debug(`Loading plugin metadata from ${metadataPath}`);
      
      // Read and parse metadata file
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      // Validate metadata
      const validationResult = await this.validateMetadata(metadata);
      if (!validationResult.isValid) {
        throw new ValidationError(
          `Invalid plugin metadata in ${metadataPath}`,
          validationResult.errors
        );
      }

      // Process and normalize metadata
      const processedMetadata = await this.processMetadata(metadata, pluginPath);
      
      // Cache the metadata
      const stats = await fs.stat(metadataPath);
      this.metadataCache.set(cacheKey, {
        metadata: processedMetadata,
        loadTime: stats.mtime
      });
      
      this.logger.debug(`Successfully loaded metadata for plugin: ${metadata.name}`);
      return processedMetadata;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FileSystemError(
          `Plugin metadata file not found: ${path.join(pluginPath, 'plugin.json')}`,
          pluginPath,
          'read'
        );
      }
      
      if (error instanceof SyntaxError) {
        throw new ValidationError(
          `Invalid JSON in plugin metadata: ${error.message}`,
          'plugin.json',
          null,
          'json-syntax'
        );
      }
      
      throw error;
    }
  }

  /**
   * Validate plugin metadata against schema
   * @param {Object} metadata - Plugin metadata to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateMetadata(metadata) {
    const schema = await this.getMetadataSchema();
    return this.validator.validate(metadata, schema);
  }

  /**
   * Get plugin metadata validation schema
   * @returns {Promise<Object>} JSON schema for plugin metadata
   */
  async getMetadataSchema() {
    // Load schema from file or return inline schema
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][a-z0-9-]*$',
          minLength: 2,
          maxLength: 50,
          description: 'Plugin name (lowercase, alphanumeric with hyphens)'
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9-]+)?$',
          description: 'Plugin version (semantic versioning)'
        },
        description: {
          type: 'string',
          minLength: 10,
          maxLength: 200,
          description: 'Plugin description'
        },
        author: {
          type: 'string',
          minLength: 2,
          maxLength: 100,
          description: 'Plugin author'
        },
        license: {
          type: 'string',
          enum: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'],
          description: 'Plugin license'
        },
        keywords: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 30
          },
          minItems: 1,
          maxItems: 10,
          uniqueItems: true,
          description: 'Plugin keywords for discovery'
        },
        category: {
          type: 'string',
          enum: ['system', 'development', 'monitoring', 'utility', 'custom'],
          description: 'Plugin category'
        },
        size: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          default: 'medium',
          description: 'Plugin size classification'
        },
        updateInterval: {
          type: 'integer',
          minimum: 1000,
          default: 5000,
          description: 'Default update interval in milliseconds'
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true,
          default: [],
          description: 'Plugin dependencies'
        },
        peerDependencies: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true,
          default: [],
          description: 'Plugin peer dependencies'
        },
        systemRequirements: {
          type: 'object',
          properties: {
            platform: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['linux', 'darwin', 'win32']
              },
              uniqueItems: true,
              description: 'Supported platforms'
            },
            commands: {
              type: 'array',
              items: { type: 'string' },
              uniqueItems: true,
              description: 'Required system commands'
            },
            minNodeVersion: {
              type: 'string',
              pattern: '^\\d+\\.\\d+\\.\\d+$',
              default: '18.0.0',
              description: 'Minimum Node.js version'
            }
          },
          additionalProperties: false,
          default: {}
        },
        optionsSchema: {
          type: 'object',
          properties: {
            type: { const: 'object' },
            properties: { type: 'object' },
            required: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['type'],
          additionalProperties: true,
          description: 'JSON schema for plugin options'
        },
        examples: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                minLength: 5,
                maxLength: 50
              },
              description: {
                type: 'string',
                minLength: 10,
                maxLength: 200
              },
              config: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  enabled: { type: 'boolean' },
                  position: {
                    type: 'array',
                    items: { type: 'integer' },
                    minItems: 4,
                    maxItems: 4
                  },
                  options: { type: 'object' }
                },
                required: ['name']
              }
            },
            required: ['name', 'description', 'config'],
            additionalProperties: false
          },
          minItems: 1,
          maxItems: 5,
          default: []
        },
        ai: {
          type: 'object',
          properties: {
            patterns: {
              type: 'object',
              properties: {
                baseClass: {
                  type: 'string',
                  enum: ['BaseWidget', 'DataWidget']
                },
                requiredMethods: {
                  type: 'array',
                  items: { type: 'string' }
                },
                optionalMethods: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            examples: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            troubleshooting: {
              type: 'object',
              properties: {
                commonIssues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      issue: { type: 'string' },
                      solution: { type: 'string' }
                    },
                    required: ['issue', 'solution']
                  }
                }
              }
            }
          },
          additionalProperties: false,
          default: {}
        }
      },
      required: [
        'name',
        'version', 
        'description',
        'author',
        'license',
        'keywords',
        'category',
        'optionsSchema'
      ],
      additionalProperties: false
    };
  }

  /**
   * Process and normalize plugin metadata
   * @param {Object} metadata - Raw metadata
   * @param {string} pluginPath - Plugin directory path
   * @returns {Promise<Object>} Processed metadata
   */
  async processMetadata(metadata, pluginPath) {
    const processed = {
      ...metadata,
      // Add computed fields
      pluginPath: path.resolve(pluginPath),
      loadTime: new Date(),
      id: this.generatePluginId(metadata.name, metadata.version),
      
      // Normalize arrays
      dependencies: metadata.dependencies || [],
      peerDependencies: metadata.peerDependencies || [],
      keywords: metadata.keywords || [],
      examples: metadata.examples || [],
      
      // Normalize objects
      systemRequirements: {
        platform: [],
        commands: [],
        minNodeVersion: '18.0.0',
        ...metadata.systemRequirements
      },
      ai: {
        patterns: {},
        examples: {},
        troubleshooting: { commonIssues: [] },
        ...metadata.ai
      }
    };

    // Validate system requirements
    await this.validateSystemRequirements(processed.systemRequirements);
    
    // Process dependencies
    processed.resolvedDependencies = await this.processDependencies(processed.dependencies);
    
    return processed;
  }

  /**
   * Generate unique plugin ID
   * @param {string} name - Plugin name
   * @param {string} version - Plugin version
   * @returns {string} Plugin ID
   */
  generatePluginId(name, version) {
    return `${name}@${version}`;
  }

  /**
   * Validate system requirements
   * @param {Object} requirements - System requirements
   * @returns {Promise<void>}
   */
  async validateSystemRequirements(requirements) {
    // Check platform compatibility
    if (requirements.platform && requirements.platform.length > 0) {
      const currentPlatform = process.platform;
      if (!requirements.platform.includes(currentPlatform)) {
        this.logger.warn(`Plugin requires platforms: ${requirements.platform.join(', ')}, current: ${currentPlatform}`);
      }
    }

    // Check Node.js version
    if (requirements.minNodeVersion) {
      const currentVersion = process.version.slice(1); // Remove 'v' prefix
      if (this.compareVersions(currentVersion, requirements.minNodeVersion) < 0) {
        throw new ValidationError(
          `Plugin requires Node.js ${requirements.minNodeVersion} or higher, current: ${currentVersion}`,
          'minNodeVersion',
          currentVersion,
          'version'
        );
      }
    }

    // Check required commands
    if (requirements.commands && requirements.commands.length > 0) {
      const missingCommands = [];
      for (const command of requirements.commands) {
        if (!(await this.isCommandAvailable(command))) {
          missingCommands.push(command);
        }
      }
      
      if (missingCommands.length > 0) {
        this.logger.warn(`Plugin requires commands: ${missingCommands.join(', ')}`);
      }
    }
  }

  /**
   * Check if a system command is available
   * @param {string} command - Command to check
   * @returns {Promise<boolean>} Whether command is available
   */
  async isCommandAvailable(command) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';
      await execAsync(`${checkCommand} ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compare semantic versions
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Process plugin dependencies
   * @param {Array<string>} dependencies - Dependency list
   * @returns {Promise<Array<Object>>} Resolved dependencies
   */
  async processDependencies(dependencies) {
    const resolved = [];
    
    for (const dep of dependencies) {
      try {
        const depInfo = this.parseDependency(dep);
        resolved.push({
          name: depInfo.name,
          version: depInfo.version,
          type: depInfo.type,
          resolved: false // Will be resolved during plugin loading
        });
      } catch (error) {
        this.logger.warn(`Invalid dependency format: ${dep}`);
      }
    }
    
    return resolved;
  }

  /**
   * Parse dependency string
   * @param {string} dependency - Dependency string (e.g., "plugin-name@1.0.0")
   * @returns {Object} Parsed dependency info
   */
  parseDependency(dependency) {
    const match = dependency.match(/^(@?[a-z0-9-]+\/)?([a-z0-9-]+)(@(.+))?$/);
    if (!match) {
      throw new Error(`Invalid dependency format: ${dependency}`);
    }
    
    const [, scope, name, , version] = match;
    
    return {
      name: scope ? `${scope}${name}` : name,
      version: version || 'latest',
      type: scope ? 'scoped' : 'simple'
    };
  }

  /**
   * Build dependency graph for plugins
   * @param {Array<Object>} plugins - List of plugin metadata
   * @returns {Map<string, Set<string>>} Dependency graph
   */
  buildDependencyGraph(plugins) {
    const graph = new Map();
    
    // Initialize graph nodes
    for (const plugin of plugins) {
      graph.set(plugin.name, new Set());
    }
    
    // Add dependency edges
    for (const plugin of plugins) {
      for (const dep of plugin.dependencies || []) {
        const depInfo = this.parseDependency(dep);
        if (graph.has(depInfo.name)) {
          graph.get(plugin.name).add(depInfo.name);
        }
      }
    }
    
    this.dependencyGraph = graph;
    return graph;
  }

  /**
   * Resolve plugin load order based on dependencies
   * @param {Array<string>} pluginNames - Plugin names to resolve
   * @returns {Array<string>} Ordered plugin names
   */
  resolveDependencyOrder(pluginNames) {
    const visited = new Set();
    const visiting = new Set();
    const result = [];
    
    const visit = (pluginName) => {
      if (visited.has(pluginName)) {
        return;
      }
      
      if (visiting.has(pluginName)) {
        throw new Error(`Circular dependency detected involving: ${pluginName}`);
      }
      
      visiting.add(pluginName);
      
      // Visit dependencies first
      const dependencies = this.dependencyGraph.get(pluginName) || new Set();
      for (const dep of dependencies) {
        if (pluginNames.includes(dep)) {
          visit(dep);
        }
      }
      
      visiting.delete(pluginName);
      visited.add(pluginName);
      result.push(pluginName);
    };
    
    for (const pluginName of pluginNames) {
      visit(pluginName);
    }
    
    return result;
  }

  /**
   * Validate plugin compatibility
   * @param {Object} metadata - Plugin metadata
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Compatibility result
   */
  async validateCompatibility(metadata, context = {}) {
    const issues = [];
    const warnings = [];
    
    // Check system requirements
    try {
      await this.validateSystemRequirements(metadata.systemRequirements);
    } catch (error) {
      issues.push({
        type: 'system-requirement',
        message: error.message,
        severity: 'error'
      });
    }
    
    // Check dependency availability
    for (const dep of metadata.dependencies || []) {
      const depInfo = this.parseDependency(dep);
      const isDependencyAvailable = context.allRegisteredPlugins.some(registeredPlugin => {
        return registeredPlugin.name === depInfo.name;
      }) || await this.checkNpmDependencyAvailability(depInfo.name);

      if (!isDependencyAvailable) {
        issues.push({
          type: 'missing-dependency',
          message: `Required dependency not available: ${depInfo.name}`,
          severity: 'error'
        });
      }
    }
    
    // Check for conflicts
    if (context.loadedPlugins) {
      for (const loadedPlugin of context.loadedPlugins) {
        if (loadedPlugin.name === metadata.name && loadedPlugin.version !== metadata.version) {
          warnings.push({
            type: 'version-conflict',
            message: `Plugin ${metadata.name} version conflict: loaded ${loadedPlugin.version}, requested ${metadata.version}`,
            severity: 'warning'
          });
        }
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues,
      warnings
    };
  }

  async checkNpmDependencyAvailability(dependencyName) {
    try {
      const dependencyPath = path.join(process.cwd(), 'node_modules', dependencyName);
      await fs.access(dependencyPath);
      return true;
    } catch (error) {
      this.logger.debug(`NPM dependency ${dependencyName} not found: ${error.message}`);
      return false;
    }
  }

  /**
   * Get plugin metadata summary
   * @param {Object} metadata - Plugin metadata
   * @returns {Object} Plugin summary
   */
  getPluginSummary(metadata) {
    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      category: metadata.category,
      size: metadata.size,
      keywords: metadata.keywords,
      dependencyCount: metadata.dependencies?.length || 0,
      hasExamples: (metadata.examples?.length || 0) > 0,
      lastLoaded: metadata.loadTime
    };
  }

  /**
   * Clear metadata cache
   */
  clearCache() {
    this.metadataCache.clear();
    this.dependencyGraph.clear();
    this.logger.debug('Plugin metadata cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      metadataCacheSize: this.metadataCache.size,
      dependencyGraphSize: this.dependencyGraph.size
    };
  }
}