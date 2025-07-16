/**
 * @fileoverview Tests for PluginMetadata class
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginMetadata } from './PluginMetadata.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');

describe('PluginMetadata', () => {
  let pluginMetadata;
  let mockPluginData;

  beforeEach(() => {
    pluginMetadata = new PluginMetadata();
    
    mockPluginData = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin for unit testing',
      author: 'Test Author',
      license: 'MIT',
      keywords: ['test', 'plugin'],
      category: 'utility',
      size: 'small',
      updateInterval: 5000,
      dependencies: [],
      peerDependencies: [],
      systemRequirements: {
        platform: ['linux', 'darwin'],
        commands: ['git'],
        minNodeVersion: '18.0.0'
      },
      optionsSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            default: 'Test Plugin'
          }
        }
      },
      examples: [
        {
          name: 'Basic Usage',
          description: 'Simple test plugin configuration',
          config: {
            name: 'test-plugin',
            enabled: true,
            position: [0, 0, 4, 4],
            options: {
              title: 'My Test Plugin'
            }
          }
        }
      ]
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    pluginMetadata.clearCache();
  });

  describe('loadMetadata', () => {
    test('should load and validate plugin metadata successfully', async () => {
      const pluginPath = '/test/plugin/path';
      const metadataPath = path.join(pluginPath, 'plugin.json');
      
      // Mock file system calls
      fs.readFile.mockResolvedValue(JSON.stringify(mockPluginData));
      fs.stat.mockResolvedValue({ mtime: new Date() });
      
      const metadata = await pluginMetadata.loadMetadata(pluginPath);
      
      expect(fs.readFile).toHaveBeenCalledWith(metadataPath, 'utf-8');
      expect(metadata.name).toBe('test-plugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.pluginPath).toBe(path.resolve(pluginPath));
      expect(metadata.id).toBe('test-plugin@1.0.0');
    });

    test('should throw error for missing plugin.json file', async () => {
      const pluginPath = '/test/plugin/path';
      
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await expect(pluginMetadata.loadMetadata(pluginPath))
        .rejects.toThrow('Plugin metadata file not found');
    });

    test('should throw error for invalid JSON', async () => {
      const pluginPath = '/test/plugin/path';
      
      fs.readFile.mockResolvedValue('{ invalid json }');
      fs.stat.mockResolvedValue({ mtime: new Date() });
      
      await expect(pluginMetadata.loadMetadata(pluginPath))
        .rejects.toThrow('Invalid JSON in plugin metadata');
    });

    test('should use cached metadata when file unchanged', async () => {
      const pluginPath = '/test/plugin/path';
      const mtime = new Date('2023-01-01');
      
      fs.readFile.mockResolvedValue(JSON.stringify(mockPluginData));
      fs.stat.mockResolvedValue({ mtime });
      
      // First load
      await pluginMetadata.loadMetadata(pluginPath);
      
      // Second load should use cache
      const metadata = await pluginMetadata.loadMetadata(pluginPath);
      
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(metadata.name).toBe('test-plugin');
    });
  });

  describe('validateMetadata', () => {
    test('should validate correct metadata', async () => {
      const result = await pluginMetadata.validateMetadata(mockPluginData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject metadata with missing required fields', async () => {
      const invalidData = { ...mockPluginData };
      delete invalidData.name;
      delete invalidData.version;
      
      const result = await pluginMetadata.validateMetadata(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.field === 'name' || err.message.includes('name'))).toBe(true);
      expect(result.errors.some(err => err.field === 'version' || err.message.includes('version'))).toBe(true);
    });

    test('should reject invalid plugin name format', async () => {
      const invalidData = { ...mockPluginData, name: 'Invalid Name!' };
      
      const result = await pluginMetadata.validateMetadata(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.field.includes('name'))).toBe(true);
    });

    test('should reject invalid version format', async () => {
      const invalidData = { ...mockPluginData, version: 'not-a-version' };
      
      const result = await pluginMetadata.validateMetadata(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.field.includes('version'))).toBe(true);
    });
  });

  describe('processMetadata', () => {
    test('should process and normalize metadata', async () => {
      const pluginPath = '/test/plugin/path';
      
      const processed = await pluginMetadata.processMetadata(mockPluginData, pluginPath);
      
      expect(processed.pluginPath).toBe(path.resolve(pluginPath));
      expect(processed.loadTime).toBeInstanceOf(Date);
      expect(processed.id).toBe('test-plugin@1.0.0');
      expect(processed.dependencies).toEqual([]);
      expect(processed.systemRequirements.minNodeVersion).toBe('18.0.0');
    });

    test('should normalize missing arrays and objects', async () => {
      const minimalData = {
        name: 'minimal-plugin',
        version: '1.0.0',
        description: 'Minimal plugin for testing',
        author: 'Test Author',
        license: 'MIT',
        keywords: ['test'],
        category: 'utility',
        optionsSchema: { type: 'object' }
      };
      
      const processed = await pluginMetadata.processMetadata(minimalData, '/test/path');
      
      expect(processed.dependencies).toEqual([]);
      expect(processed.peerDependencies).toEqual([]);
      expect(processed.examples).toEqual([]);
      expect(processed.systemRequirements.platform).toEqual([]);
      expect(processed.ai.patterns).toEqual({});
    });
  });

  describe('dependency management', () => {
    test('should parse simple dependency', () => {
      const dep = 'other-plugin@1.2.3';
      const parsed = pluginMetadata.parseDependency(dep);
      
      expect(parsed.name).toBe('other-plugin');
      expect(parsed.version).toBe('1.2.3');
      expect(parsed.type).toBe('simple');
    });

    test('should parse scoped dependency', () => {
      const dep = '@scope/plugin-name@2.0.0';
      const parsed = pluginMetadata.parseDependency(dep);
      
      expect(parsed.name).toBe('@scope/plugin-name');
      expect(parsed.version).toBe('2.0.0');
      expect(parsed.type).toBe('scoped');
    });

    test('should handle dependency without version', () => {
      const dep = 'plugin-name';
      const parsed = pluginMetadata.parseDependency(dep);
      
      expect(parsed.name).toBe('plugin-name');
      expect(parsed.version).toBe('latest');
    });

    test('should build dependency graph', () => {
      const plugins = [
        { name: 'plugin-a', dependencies: ['plugin-b@1.0.0'] },
        { name: 'plugin-b', dependencies: [] },
        { name: 'plugin-c', dependencies: ['plugin-a@1.0.0', 'plugin-b@1.0.0'] }
      ];
      
      const graph = pluginMetadata.buildDependencyGraph(plugins);
      
      expect(graph.get('plugin-a')).toEqual(new Set(['plugin-b']));
      expect(graph.get('plugin-b')).toEqual(new Set());
      expect(graph.get('plugin-c')).toEqual(new Set(['plugin-a', 'plugin-b']));
    });

    test('should resolve dependency order', () => {
      const plugins = [
        { name: 'plugin-a', dependencies: ['plugin-b@1.0.0'] },
        { name: 'plugin-b', dependencies: [] },
        { name: 'plugin-c', dependencies: ['plugin-a@1.0.0'] }
      ];
      
      pluginMetadata.buildDependencyGraph(plugins);
      const order = pluginMetadata.resolveDependencyOrder(['plugin-c', 'plugin-a', 'plugin-b']);
      
      expect(order).toEqual(['plugin-b', 'plugin-a', 'plugin-c']);
    });

    test('should detect circular dependencies', () => {
      const plugins = [
        { name: 'plugin-a', dependencies: ['plugin-b@1.0.0'] },
        { name: 'plugin-b', dependencies: ['plugin-a@1.0.0'] }
      ];
      
      pluginMetadata.buildDependencyGraph(plugins);
      
      expect(() => {
        pluginMetadata.resolveDependencyOrder(['plugin-a', 'plugin-b']);
      }).toThrow('Circular dependency detected');
    });
  });

  describe('version comparison', () => {
    test('should compare versions correctly', () => {
      expect(pluginMetadata.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(pluginMetadata.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(pluginMetadata.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(pluginMetadata.compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(pluginMetadata.compareVersions('1.0', '1.0.0')).toBe(0);
    });
  });

  describe('compatibility validation', () => {
    test('should validate compatible plugin', async () => {
      const result = await pluginMetadata.validateCompatibility(mockPluginData, {
        availablePlugins: [],
        loadedPlugins: []
      });
      
      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect missing dependencies', async () => {
      const pluginWithDeps = {
        ...mockPluginData,
        dependencies: ['missing-plugin@1.0.0']
      };
      
      const result = await pluginMetadata.validateCompatibility(pluginWithDeps, {
        availablePlugins: [],
        loadedPlugins: []
      });
      
      expect(result.compatible).toBe(false);
      expect(result.issues.some(issue => issue.type === 'missing-dependency')).toBe(true);
    });

    test('should detect version conflicts', async () => {
      const result = await pluginMetadata.validateCompatibility(mockPluginData, {
        availablePlugins: ['test-plugin'],
        loadedPlugins: [{ name: 'test-plugin', version: '2.0.0' }]
      });
      
      expect(result.warnings.some(warning => warning.type === 'version-conflict')).toBe(true);
    });
  });

  describe('utility methods', () => {
    test('should generate plugin ID', () => {
      const id = pluginMetadata.generatePluginId('test-plugin', '1.0.0');
      expect(id).toBe('test-plugin@1.0.0');
    });

    test('should create plugin summary', () => {
      const summary = pluginMetadata.getPluginSummary(mockPluginData);
      
      expect(summary.name).toBe('test-plugin');
      expect(summary.version).toBe('1.0.0');
      expect(summary.category).toBe('utility');
      expect(summary.dependencyCount).toBe(0);
      expect(summary.hasExamples).toBe(true);
    });

    test('should provide cache statistics', () => {
      const stats = pluginMetadata.getCacheStats();
      
      expect(stats).toHaveProperty('metadataCacheSize');
      expect(stats).toHaveProperty('dependencyGraphSize');
      expect(typeof stats.metadataCacheSize).toBe('number');
      expect(typeof stats.dependencyGraphSize).toBe('number');
    });

    test('should clear cache', () => {
      // Add something to cache first
      pluginMetadata.metadataCache.set('test', { data: 'test' });
      pluginMetadata.dependencyGraph.set('test', new Set());
      
      expect(pluginMetadata.getCacheStats().metadataCacheSize).toBe(1);
      expect(pluginMetadata.getCacheStats().dependencyGraphSize).toBe(1);
      
      pluginMetadata.clearCache();
      
      expect(pluginMetadata.getCacheStats().metadataCacheSize).toBe(0);
      expect(pluginMetadata.getCacheStats().dependencyGraphSize).toBe(0);
    });
  });
});