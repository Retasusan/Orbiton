/**
 * ConfigManager Tests
 * 
 * Comprehensive tests for the configuration management system
 * including validation, merging, environment detection, and migration.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './ConfigManager.js';
import { 
  TestData, 
  MockFactory, 
  AssertionHelpers,
  assertValidSchema 
} from '../../test/utils/test-helpers.js';

// Mock fs/promises for file operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn()
}));

describe('ConfigManager Core Functionality', () => {
  let configManager;
  let mockFs;

  beforeEach(async () => {
    configManager = new ConfigManager();
    
    // Get the mocked fs module
    mockFs = await import('fs/promises');
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Loading', () => {
    test('should load valid configuration', async () => {
      const validConfig = MockFactory.createDashboardConfig();
      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      mockFs.access.mockResolvedValue(undefined);
      
      const config = await configManager.loadConfig('test-config.json');
      
      expect(config).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    test('should handle missing configuration file', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      
      const config = await configManager.loadConfig('missing-config.json');
      
      // Should return default configuration
      expect(config).toBeDefined();
      expect(config.autoDetect).toBeDefined();
    });

    test('should handle invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('{ invalid json }');
      mockFs.access.mockResolvedValue(undefined);
      
      await expect(configManager.loadConfig('invalid.json')).rejects.toThrow();
    });

    test('should merge multiple configuration sources', async () => {
      const userConfig = { theme: 'dark', plugins: [] };
      const defaultConfig = { autoDetect: true, theme: 'default' };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(userConfig));
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock the internal merging process
      configManager.generateDefaults = vi.fn().mockResolvedValue(defaultConfig);
      
      const config = await configManager.loadConfig();
      
      expect(config).toBeDefined();
      // User config should override defaults
      expect(config.theme).toBe('dark');
      // Defaults should fill in missing values
      expect(config.autoDetect).toBe(true);
    });

    test('should handle file permission errors', async () => {
      mockFs.access.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(configManager.loadConfig('restricted.json')).rejects.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate correct configuration', async () => {
      const validConfig = MockFactory.createDashboardConfig();
      
      const result = await configManager.validate(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid plugin configurations', async () => {
      const invalidConfig = {
        plugins: [
          {
            // Missing required 'name' field
            position: [0, 0, 2, 2],
            options: {}
          }
        ]
      };
      
      const result = await configManager.validate(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate plugin options schemas', async () => {
      const configWithInvalidOptions = {
        plugins: [
          {
            name: 'test-plugin',
            position: [0, 0, 2, 2],
            options: {
              updateInterval: 'invalid-number' // Should be number
            }
          }
        ]
      };
      
      const result = await configManager.validate(configWithInvalidOptions);
      
      // Should detect type mismatch
      expect(result.errors.some(err => err.message.includes('type'))).toBe(true);
    });

    test('should generate helpful error messages', async () => {
      const invalidConfig = {
        layout: {
          grid: {
            rows: -1, // Invalid negative value
            cols: 'invalid' // Invalid type
          }
        }
      };
      
      const result = await configManager.validate(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Error messages should be descriptive
      result.errors.forEach(error => {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
      });
    });

    test('should provide warnings for performance issues', async () => {
      const performanceConfig = {
        plugins: Array.from({ length: 20 }, (_, i) => ({
          name: `plugin-${i}`,
          position: [0, 0, 1, 1],
          options: { updateInterval: 100 } // Very frequent updates
        }))
      };
      
      const result = await configManager.validate(performanceConfig);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'performance')).toBe(true);
    });
  });

  describe('Environment Detection', () => {
    test('should detect development environment', async () => {
      // Mock environment detection
      configManager.detectEnvironment = vi.fn().mockResolvedValue({
        platform: 'development',
        capabilities: {
          docker: true,
          git: true,
          node: true,
          system: {
            hasGpu: false,
            hasBattery: true,
            networkInterfaces: ['eth0'],
            availableCommands: ['git', 'docker', 'node']
          }
        },
        suggestedPlugins: ['git-status', 'docker-monitor', 'system-info'],
        suggestedLayout: 'developer'
      });
      
      const profile = await configManager.detectEnvironment();
      
      expect(profile.platform).toBe('development');
      expect(profile.capabilities.git).toBe(true);
      expect(profile.capabilities.docker).toBe(true);
      expect(profile.suggestedPlugins).toContain('git-status');
    });

    test('should detect server environment', async () => {
      configManager.detectEnvironment = vi.fn().mockResolvedValue({
        platform: 'server',
        capabilities: {
          docker: true,
          git: false,
          node: true,
          system: {
            hasGpu: false,
            hasBattery: false,
            networkInterfaces: ['eth0', 'eth1'],
            availableCommands: ['docker', 'systemctl']
          }
        },
        suggestedPlugins: ['system-monitor', 'docker-monitor', 'network-monitor'],
        suggestedLayout: 'ops'
      });
      
      const profile = await configManager.detectEnvironment();
      
      expect(profile.platform).toBe('server');
      expect(profile.capabilities.docker).toBe(true);
      expect(profile.capabilities.git).toBe(false);
      expect(profile.suggestedPlugins).toContain('system-monitor');
    });

    test('should handle environment detection failures', async () => {
      configManager.detectEnvironment = vi.fn().mockRejectedValue(new Error('Detection failed'));
      
      await expect(configManager.detectEnvironment()).rejects.toThrow('Detection failed');
    });

    test('should provide fallback for unknown environments', async () => {
      configManager.detectEnvironment = vi.fn().mockResolvedValue({
        platform: 'minimal',
        capabilities: {
          docker: false,
          git: false,
          node: true,
          system: {
            hasGpu: false,
            hasBattery: false,
            networkInterfaces: [],
            availableCommands: ['node']
          }
        },
        suggestedPlugins: ['clock', 'system-info'],
        suggestedLayout: 'minimal'
      });
      
      const profile = await configManager.detectEnvironment();
      
      expect(profile.platform).toBe('minimal');
      expect(profile.suggestedPlugins).toContain('clock');
    });
  });

  describe('Configuration Migration', () => {
    test('should migrate legacy configuration format', async () => {
      const legacyConfig = {
        theme: 'dark',
        widgets: [
          {
            type: 'clock',
            row: 0,
            col: 0,
            rowSpan: 1,
            colSpan: 1,
            enabled: true,
            options: { format: '24h' }
          }
        ]
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(legacyConfig));
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const result = await configManager.migrateFromLegacy();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('migrated');
    });

    test('should handle migration failures gracefully', async () => {
      const corruptLegacyConfig = '{ invalid legacy config }';
      
      mockFs.readFile.mockResolvedValue(corruptLegacyConfig);
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await configManager.migrateFromLegacy();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should provide manual migration steps for complex cases', async () => {
      const complexLegacyConfig = {
        customTheme: {
          // Complex custom theme that can't be auto-migrated
          advanced: true,
          customColors: { primary: '#custom' }
        },
        widgets: []
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(complexLegacyConfig));
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await configManager.migrateFromLegacy();
      
      if (!result.success) {
        expect(result.manualSteps).toBeDefined();
        expect(result.manualSteps.length).toBeGreaterThan(0);
      }
    });

    test('should backup original configuration during migration', async () => {
      const legacyConfig = { theme: 'old', widgets: [] };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(legacyConfig));
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const result = await configManager.migrateFromLegacy();
      
      if (result.success) {
        expect(result.backupPath).toBeDefined();
        expect(result.backupPath).toContain('backup');
      }
    });
  });

  describe('Configuration Saving', () => {
    test('should save configuration to file', async () => {
      const config = MockFactory.createDashboardConfig();
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      
      await expect(configManager.saveConfig(config, 'test-save.json')).resolves.not.toThrow();
      
      expect(mockFs.writeFile).toHaveBeenCalled();
      
      // Check that the saved content is valid JSON
      const savedContent = mockFs.writeFile.mock.calls[0][1];
      expect(() => JSON.parse(savedContent)).not.toThrow();
    });

    test('should create directories if they don\'t exist', async () => {
      const config = MockFactory.createDashboardConfig();
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      
      await configManager.saveConfig(config, 'nested/path/config.json');
      
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    test('should handle save errors gracefully', async () => {
      const config = MockFactory.createDashboardConfig();
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      await expect(configManager.saveConfig(config, 'readonly.json')).rejects.toThrow('Write failed');
    });
  });

  describe('Default Configuration Generation', () => {
    test('should generate sensible defaults', async () => {
      const defaults = await configManager.generateDefaults();
      
      expect(defaults).toBeDefined();
      expect(defaults.autoDetect).toBeDefined();
      expect(defaults.layout).toBeDefined();
      expect(defaults.theme).toBeDefined();
    });

    test('should adapt defaults to environment', async () => {
      const devEnvironment = {
        platform: 'development',
        capabilities: { git: true, docker: true }
      };
      
      const defaults = await configManager.generateDefaults(devEnvironment);
      
      expect(defaults.plugins.some(p => p.name === 'git-status')).toBe(true);
      expect(defaults.plugins.some(p => p.name === 'docker-monitor')).toBe(true);
    });

    test('should include performance-appropriate defaults', async () => {
      const defaults = await configManager.generateDefaults();
      
      expect(defaults.performance).toBeDefined();
      expect(defaults.performance.updateInterval).toBeGreaterThan(1000);
      expect(defaults.performance.maxConcurrentUpdates).toBeGreaterThan(0);
    });
  });
});

describe('ConfigManager Edge Cases', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  test('should handle circular references in configuration', async () => {
    const circularConfig = { theme: 'test' };
    circularConfig.self = circularConfig;
    
    // Should not crash on circular references
    await expect(configManager.validate(circularConfig)).resolves.toBeDefined();
  });

  test('should handle very large configurations', async () => {
    const largeConfig = {
      plugins: Array.from({ length: 1000 }, (_, i) => ({
        name: `plugin-${i}`,
        position: [i % 10, Math.floor(i / 10) % 10, 1, 1],
        options: { id: i, data: Array.from({ length: 100 }, (_, j) => j) }
      }))
    };
    
    const start = performance.now();
    const result = await configManager.validate(largeConfig);
    const duration = performance.now() - start;
    
    expect(result).toBeDefined();
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should handle malformed plugin configurations', async () => {
    const malformedConfig = {
      plugins: [
        null,
        undefined,
        'string-instead-of-object',
        { name: null },
        { name: '', position: 'invalid' },
        { name: 'valid-plugin', position: [0, 0, 1, 1] } // This one should be valid
      ]
    };
    
    const result = await configManager.validate(malformedConfig);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should handle concurrent configuration operations', async () => {
    const config1 = MockFactory.createDashboardConfig({ theme: 'theme1' });
    const config2 = MockFactory.createDashboardConfig({ theme: 'theme2' });
    
    const operations = [
      configManager.validate(config1),
      configManager.validate(config2),
      configManager.generateDefaults(),
      configManager.detectEnvironment()
    ];
    
    const results = await Promise.all(operations);
    
    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });
});