/**
 * Vitest Configuration for Orbiton Dashboard
 * 
 * Comprehensive testing setup with coverage, mocking, and performance testing
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns
    include: [
      'src/**/*.test.js',
      'plugins/**/*.test.js',
      'examples/**/*.test.js',
      'test/**/*.test.js'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**'
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.test.js',
        '**/*.config.js',
        'coverage/**',
        'dist/**',
        'build/**',
        'templates/**',
        'examples/**/test.js'
      ],
      include: [
        'src/**/*.js',
        'plugins/**/*.js'
      ],
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      // Fail if coverage is below thresholds
      skipFull: false
    },
    
    // Setup files
    setupFiles: [
      './test/setup.js'
    ],
    
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      'html'
    ],
    
    // Output directory for reports
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Watch mode configuration
    watch: {
      ignore: [
        'node_modules/**',
        'coverage/**',
        'test-results/**',
        'dist/**'
      ]
    },
    
    // Performance testing
    benchmark: {
      include: [
        'test/benchmarks/**/*.bench.js',
        'src/**/*.bench.js'
      ],
      exclude: [
        'node_modules/**'
      ]
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@plugins': resolve(__dirname, './plugins'),
      '@test': resolve(__dirname, './test'),
      '@examples': resolve(__dirname, './examples')
    }
  },
  
  // Define configuration for different environments
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false
  }
});