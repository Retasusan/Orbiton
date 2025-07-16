/**
 * Plugin-specific TypeScript definitions
 * 
 * Detailed type definitions for plugin development, including
 * base classes, interfaces, and utility types specifically
 * designed for plugin authors.
 */

declare module 'orbiton/plugins' {
    // Import types from the main module
    import type * as Orbiton from 'orbiton';

    // Type aliases for convenience
    type BaseWidget = Orbiton.BaseWidget;
    type DataWidget = Orbiton.DataWidget;
    type PluginConfig = Orbiton.PluginConfig;
    type PluginMetadata = Orbiton.PluginMetadata;
    type JSONSchema = Orbiton.JSONSchema;
    type ThemeConfig = Orbiton.ThemeConfig;
    type EventBus = Orbiton.EventBus;

    // Define Logger interface locally since it's not exported from main module
    interface Logger {
        /** Log debug message */
        debug(message: string, ...args: any[]): void;
        /** Log info message */
        info(message: string, ...args: any[]): void;
        /** Log warning message */
        warn(message: string, ...args: any[]): void;
        /** Log error message */
        error(message: string, ...args: any[]): void;
    }

    // ============================================================================
    // Plugin Development Interfaces
    // ============================================================================

    /**
     * Plugin development context provided to plugins
     */
    export interface PluginContext {
        /** Plugin name */
        name: string;

        /** Plugin configuration */
        config: PluginConfig;

        /** Event bus for communication */
        eventBus: EventBus;

        /** Logger instance */
        logger: Logger;

        /** Theme configuration */
        theme: ThemeConfig;

        /** Dashboard dimensions */
        dimensions: {
            width: number;
            height: number;
            rows: number;
            cols: number;
        };

        /** Utility functions */
        utils: PluginUtils;
    }

    /**
     * Plugin utility functions
     */
    export interface PluginUtils {
        /** Format time */
        formatTime(date: Date, format?: string): string;

        /** Format bytes */
        formatBytes(bytes: number, decimals?: number): string;

        /** Format duration */
        formatDuration(ms: number): string;

        /** Debounce function */
        debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;

        /** Throttle function */
        throttle<T extends (...args: any[]) => any>(func: T, limit: number): T;

        /** Deep merge objects */
        deepMerge<T>(target: T, ...sources: Partial<T>[]): T;

        /** Validate data against schema */
        validate(data: any, schema: JSONSchema): ValidationResult;

        /** Create blessed.js element */
        createElement(type: string, options: any): any;

        /** Parse blessed.js tags */
        parseTags(text: string): string;

        /** Strip blessed.js tags */
        stripTags(text: string): string;
    }

    /**
     * Validation result for plugin utilities
     */
    export interface ValidationResult {
        valid: boolean;
        errors: Array<{
            path: string;
            message: string;
            value: any;
        }>;
    }

    // ============================================================================
    // Plugin Lifecycle Hooks
    // ============================================================================

    /**
     * Plugin lifecycle hooks interface
     */
    export interface PluginLifecycleHooks {
        /** Called before plugin initialization */
        beforeInit?: () => Promise<void> | void;

        /** Called after plugin initialization */
        afterInit?: () => Promise<void> | void;

        /** Called before first render */
        beforeFirstRender?: () => Promise<void> | void;

        /** Called after first render */
        afterFirstRender?: () => Promise<void> | void;

        /** Called before each render */
        beforeRender?: () => Promise<void> | void;

        /** Called after each render */
        afterRender?: () => Promise<void> | void;

        /** Called before plugin destruction */
        beforeDestroy?: () => Promise<void> | void;

        /** Called after plugin destruction */
        afterDestroy?: () => Promise<void> | void;

        /** Called when plugin becomes visible */
        onShow?: () => Promise<void> | void;

        /** Called when plugin becomes hidden */
        onHide?: () => Promise<void> | void;

        /** Called when plugin gains focus */
        onFocus?: () => Promise<void> | void;

        /** Called when plugin loses focus */
        onBlur?: () => Promise<void> | void;

        /** Called when plugin is resized */
        onResize?: (width: number, height: number) => Promise<void> | void;

        /** Called when theme changes */
        onThemeChange?: (theme: ThemeConfig) => Promise<void> | void;

        /** Called when configuration changes */
        onConfigChange?: (config: PluginConfig) => Promise<void> | void;
    }

    // ============================================================================
    // Advanced Plugin Interfaces
    // ============================================================================

    /**
     * Interactive plugin interface
     */
    export interface InteractivePlugin {
        /** Handle keyboard input */
        onKeyPress?(ch: string, key: KeyEvent): Promise<void> | void;

        /** Handle mouse input */
        onMouse?(event: MouseEvent): Promise<void> | void;

        /** Handle scroll input */
        onScroll?(direction: 'up' | 'down', amount: number): Promise<void> | void;

        /** Get interactive elements */
        getInteractiveElements?(): InteractiveElement[];

        /** Set focus to specific element */
        setFocus?(elementId: string): void;

        /** Get currently focused element */
        getFocusedElement?(): string | null;
    }

    /**
     * Key event interface
     */
    export interface KeyEvent {
        name: string;
        sequence: string;
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        alt: boolean;
    }

    /**
     * Mouse event interface
     */
    export interface MouseEvent {
        type: 'click' | 'dblclick' | 'mousedown' | 'mouseup' | 'mousemove';
        x: number;
        y: number;
        button: 'left' | 'right' | 'middle';
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        alt: boolean;
    }

    /**
     * Interactive element interface
     */
    export interface InteractiveElement {
        id: string;
        type: 'button' | 'input' | 'select' | 'checkbox' | 'radio' | 'custom';
        bounds: { x: number; y: number; width: number; height: number };
        focusable: boolean;
        enabled: boolean;
        onActivate?: () => Promise<void> | void;
    }

    /**
     * Configurable plugin interface
     */
    export interface ConfigurablePlugin {
        /** Get configuration schema */
        getConfigSchema(): JSONSchema;

        /** Validate configuration */
        validateConfig(config: any): ValidationResult;

        /** Apply configuration changes */
        applyConfig(config: any): Promise<void> | void;

        /** Get default configuration */
        getDefaultConfig(): any;

        /** Get configuration documentation */
        getConfigDocs(): ConfigDocumentation;
    }

    /**
     * Configuration documentation interface
     */
    export interface ConfigDocumentation {
        title: string;
        description: string;
        sections: ConfigSection[];
        examples: ConfigExample[];
    }

    /**
     * Configuration section interface
     */
    export interface ConfigSection {
        title: string;
        description: string;
        properties: ConfigProperty[];
    }

    /**
     * Configuration property interface
     */
    export interface ConfigProperty {
        name: string;
        type: string;
        description: string;
        required: boolean;
        default?: any;
        examples?: any[];
        validation?: {
            min?: number;
            max?: number;
            pattern?: string;
            enum?: any[];
        };
    }

    /**
     * Configuration example interface
     */
    export interface ConfigExample {
        title: string;
        description: string;
        config: any;
    }

    /**
     * Themeable plugin interface
     */
    export interface ThemeablePlugin {
        /** Apply theme to plugin */
        applyTheme(theme: ThemeConfig): Promise<void> | void;

        /** Get theme requirements */
        getThemeRequirements(): ThemeRequirements;

        /** Get custom theme properties */
        getCustomThemeProperties(): CustomThemeProperty[];
    }

    /**
     * Theme requirements interface
     */
    export interface ThemeRequirements {
        colors: string[];
        styles: string[];
        optional: string[];
    }

    /**
     * Custom theme property interface
     */
    export interface CustomThemeProperty {
        name: string;
        type: 'color' | 'style' | 'border' | 'font';
        description: string;
        default: any;
        validation?: any;
    }

    // ============================================================================
    // Plugin State Management
    // ============================================================================

    /**
     * Stateful plugin interface
     */
    export interface StatefulPlugin {
        /** Get current state */
        getState(): any;

        /** Set state */
        setState(state: any): Promise<void> | void;

        /** Reset state to default */
        resetState(): Promise<void> | void;

        /** Save state to persistent storage */
        saveState(): Promise<void> | void;

        /** Load state from persistent storage */
        loadState(): Promise<void> | void;

        /** Subscribe to state changes */
        onStateChange(callback: (state: any) => void): () => void;
    }

    /**
     * Cacheable plugin interface
     */
    export interface CacheablePlugin {
        /** Get cache key for data */
        getCacheKey(params?: any): string;

        /** Check if cached data is valid */
        isCacheValid(key: string): boolean;

        /** Get cached data */
        getCachedData(key: string): any;

        /** Set cached data */
        setCachedData(key: string, data: any, ttl?: number): void;

        /** Clear cache */
        clearCache(key?: string): void;

        /** Get cache statistics */
        getCacheStats(): CacheStats;
    }

    /**
     * Cache statistics interface
     */
    export interface CacheStats {
        hits: number;
        misses: number;
        size: number;
        maxSize: number;
        ttl: number;
    }

    // ============================================================================
    // Plugin Communication
    // ============================================================================

    /**
     * Communicating plugin interface
     */
    export interface CommunicatingPlugin {
        /** Get events this plugin emits */
        getEmittedEvents(): EventDefinition[];

        /** Get events this plugin listens to */
        getListenedEvents(): EventDefinition[];

        /** Handle incoming event */
        handleEvent(event: string, data: any): Promise<void> | void;

        /** Emit event to other plugins */
        emitEvent(event: string, data: any): void;

        /** Subscribe to events from other plugins */
        subscribeToEvents(events: string[]): void;

        /** Unsubscribe from events */
        unsubscribeFromEvents(events: string[]): void;
    }

    /**
     * Event definition interface
     */
    export interface EventDefinition {
        name: string;
        description: string;
        dataSchema?: JSONSchema;
        frequency?: 'once' | 'periodic' | 'on-demand';
        examples?: any[];
    }

    // ============================================================================
    // Plugin Performance
    // ============================================================================

    /**
     * Performance-aware plugin interface
     */
    export interface PerformanceAwarePlugin {
        /** Get performance metrics */
        getPerformanceMetrics(): PerformanceMetrics;

        /** Optimize performance */
        optimize(): Promise<void> | void;

        /** Set performance budget */
        setPerformanceBudget(budget: PerformanceBudget): void;

        /** Check if performance budget is exceeded */
        isPerformanceBudgetExceeded(): boolean;

        /** Get performance recommendations */
        getPerformanceRecommendations(): PerformanceRecommendation[];
    }

    /**
     * Performance metrics interface
     */
    export interface PerformanceMetrics {
        renderTime: {
            average: number;
            min: number;
            max: number;
            samples: number;
        };
        updateTime: {
            average: number;
            min: number;
            max: number;
            samples: number;
        };
        memoryUsage: {
            current: number;
            peak: number;
            average: number;
        };
        cpuUsage: {
            average: number;
            peak: number;
        };
        networkRequests: {
            count: number;
            totalTime: number;
            averageTime: number;
            errors: number;
        };
    }

    /**
     * Performance budget interface
     */
    export interface PerformanceBudget {
        maxRenderTime: number;
        maxUpdateTime: number;
        maxMemoryUsage: number;
        maxCpuUsage: number;
        maxNetworkRequests: number;
    }

    /**
     * Performance recommendation interface
     */
    export interface PerformanceRecommendation {
        type: 'warning' | 'error' | 'info';
        message: string;
        metric: string;
        currentValue: number;
        recommendedValue: number;
        action: string;
    }

    // ============================================================================
    // Plugin Testing
    // ============================================================================

    /**
     * Testable plugin interface
     */
    export interface TestablePlugin {
        /** Get test scenarios */
        getTestScenarios(): TestScenario[];

        /** Run self-test */
        runSelfTest(): Promise<TestResult>;

        /** Get mock data for testing */
        getMockData(): any;

        /** Set test mode */
        setTestMode(enabled: boolean): void;

        /** Get test configuration */
        getTestConfig(): TestConfig;
    }

    /**
     * Test scenario interface
     */
    export interface TestScenario {
        name: string;
        description: string;
        setup: () => Promise<void> | void;
        test: () => Promise<void> | void;
        teardown: () => Promise<void> | void;
        expectedResult: any;
    }

    /**
     * Test result interface
     */
    export interface TestResult {
        passed: boolean;
        errors: string[];
        warnings: string[];
        duration: number;
        coverage?: number;
    }

    /**
     * Test configuration interface
     */
    export interface TestConfig {
        mockData: boolean;
        skipNetworkRequests: boolean;
        timeout: number;
        retries: number;
    }

    // ============================================================================
    // Plugin Decorators and Helpers
    // ============================================================================

    /**
     * Plugin decorator for adding metadata
     */
    export function plugin(metadata: Partial<PluginMetadata>): ClassDecorator;

    /**
     * Method decorator for caching results
     */
    export function cached(ttl?: number): MethodDecorator;

    /**
     * Method decorator for throttling calls
     */
    export function throttled(limit: number): MethodDecorator;

    /**
     * Method decorator for debouncing calls
     */
    export function debounced(wait: number): MethodDecorator;

    /**
     * Method decorator for performance monitoring
     */
    export function monitored(metric?: string): MethodDecorator;

    /**
     * Property decorator for configuration binding
     */
    export function config(path?: string): PropertyDecorator;

    /**
     * Property decorator for theme binding
     */
    export function theme(property?: string): PropertyDecorator;

    /**
     * Method decorator for event handling
     */
    export function eventHandler(event: string): MethodDecorator;

    /**
     * Class decorator for automatic event subscription
     */
    export function eventSubscriber(events: string[]): ClassDecorator;

    // ============================================================================
    // Plugin Factory Functions
    // ============================================================================

    /**
     * Base widget constructor type
     */
    export type BaseWidgetConstructor = new (name: string, options?: Record<string, any>) => BaseWidget;

    /**
     * Data widget constructor type
     */
    export type DataWidgetConstructor = new (name: string, options?: Record<string, any>) => DataWidget;

    /**
     * Create a basic widget plugin
     */
    export function createBasicWidget(
        name: string,
        render: (this: BaseWidget) => Promise<void> | void,
        options?: Partial<PluginMetadata>
    ): BaseWidgetConstructor;

    /**
     * Create a data widget plugin
     */
    export function createDataWidget(
        name: string,
        fetchData: (this: DataWidget) => Promise<any>,
        render: (this: DataWidget) => Promise<void> | void,
        options?: Partial<PluginMetadata>
    ): DataWidgetConstructor;

    /**
     * Create an interactive widget plugin
     */
    export function createInteractiveWidget(
        name: string,
        handlers: {
            render: (this: BaseWidget) => Promise<void> | void;
            onKeyPress?: (this: BaseWidget, ch: string, key: KeyEvent) => Promise<void> | void;
            onMouse?: (this: BaseWidget, event: MouseEvent) => Promise<void> | void;
        },
        options?: Partial<PluginMetadata>
    ): BaseWidgetConstructor;

    /**
     * Create a configurable widget plugin
     */
    export function createConfigurableWidget(
        name: string,
        schema: JSONSchema,
        render: (this: BaseWidget) => Promise<void> | void,
        options?: Partial<PluginMetadata>
    ): BaseWidgetConstructor;

    // ============================================================================
    // Plugin Mixins
    // ============================================================================

    /**
     * Constructor type that includes caching capabilities
     */
    export type CacheableWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & CacheablePlugin;

    /**
     * Constructor type that includes state management
     */
    export type StatefulWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & StatefulPlugin;

    /**
     * Constructor type that includes performance monitoring
     */
    export type PerformanceAwareWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & PerformanceAwarePlugin;

    /**
     * Constructor type that includes event communication
     */
    export type CommunicatingWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & CommunicatingPlugin;

    /**
     * Constructor type that includes interactivity
     */
    export type InteractiveWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & InteractivePlugin;

    /**
     * Constructor type that includes theme support
     */
    export type ThemeableWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & ThemeablePlugin;

    /**
     * Constructor type that includes configuration support
     */
    export type ConfigurableWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & ConfigurablePlugin;

    /**
     * Constructor type that includes testing support
     */
    export type TestableWidgetConstructor<T extends BaseWidget = BaseWidget> = new (name: string, options?: Record<string, any>) => T & TestablePlugin;

    /**
     * Mixin for adding caching capabilities
     */
    export function withCaching<T extends BaseWidgetConstructor>(Base: T): CacheableWidgetConstructor;

    /**
     * Mixin for adding state management
     */
    export function withState<T extends BaseWidgetConstructor>(Base: T): StatefulWidgetConstructor;

    /**
     * Mixin for adding performance monitoring
     */
    export function withPerformanceMonitoring<T extends BaseWidgetConstructor>(Base: T): PerformanceAwareWidgetConstructor;

    /**
     * Mixin for adding event communication
     */
    export function withEventCommunication<T extends BaseWidgetConstructor>(Base: T): CommunicatingWidgetConstructor;

    /**
     * Mixin for adding interactivity
     */
    export function withInteractivity<T extends BaseWidgetConstructor>(Base: T): InteractiveWidgetConstructor;

    /**
     * Mixin for adding theme support
     */
    export function withTheming<T extends BaseWidgetConstructor>(Base: T): ThemeableWidgetConstructor;

    /**
     * Mixin for adding configuration support
     */
    export function withConfiguration<T extends BaseWidgetConstructor>(Base: T): ConfigurableWidgetConstructor;

    /**
     * Mixin for adding testing support
     */
    export function withTesting<T extends BaseWidgetConstructor>(Base: T): TestableWidgetConstructor;
}