/**
 * Prompt Registry & Versioning System
 *
 * Manages prompts with versioning, A/B testing, and performance tracking.
 * Every prompt is registered with a unique ID and version.
 *
 * Benefits:
 * - Version tracking: Know which prompt version generated each content
 * - A/B testing: Test different prompt variants
 * - Performance metrics: Track success rates per prompt version
 * - Rollback: Easy revert to previous working versions
 * - Audit trail: Full history of prompt changes
 *
 * Usage:
 * ```typescript
 * // Register a prompt
 * promptRegistry.register('skeleton-generator', {
 *   version: '2.1.0',
 *   template: '...',
 *   description: 'Generates course skeleton'
 * });
 *
 * // Get prompt with metadata
 * const { prompt, metadata } = promptRegistry.get('skeleton-generator');
 *
 * // Record usage for analytics
 * promptRegistry.recordUsage('skeleton-generator', { success: true, latency: 1500 });
 * ```
 */

import * as logger from 'firebase-functions/logger';

// ============================================================
// TYPES
// ============================================================

export interface PromptVersion {
  version: string;           // Semantic version: major.minor.patch
  template: string;          // The actual prompt text/template
  description: string;       // What this prompt does
  author?: string;           // Who created/modified
  createdAt: Date;
  tags?: string[];           // For categorization
  parameters?: string[];     // Expected template parameters
  expectedOutputSchema?: string; // JSON schema reference
}

export interface PromptMetadata {
  id: string;
  version: string;
  hash: string;              // Hash of template for change detection
  retrievedAt: Date;
}

export interface PromptUsageRecord {
  promptId: string;
  version: string;
  timestamp: Date;
  success: boolean;
  latencyMs?: number;
  outputTokens?: number;
  inputTokens?: number;
  errorType?: string;
  metadata?: Record<string, any>;
}

export interface PromptStats {
  promptId: string;
  version: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  lastUsed: Date;
}

export interface ABTestConfig {
  promptId: string;
  variants: Array<{
    version: string;
    weight: number;  // 0-100, must sum to 100
  }>;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

// ============================================================
// PROMPT REGISTRY CLASS
// ============================================================

class PromptRegistry {
  private prompts: Map<string, PromptVersion[]> = new Map();
  private activeVersions: Map<string, string> = new Map();
  private usageRecords: PromptUsageRecord[] = [];
  private abTests: Map<string, ABTestConfig> = new Map();

  // In-memory stats (would be persisted in production)
  private stats: Map<string, PromptStats> = new Map();

  /**
   * Register a new prompt or new version of existing prompt
   */
  register(
    id: string,
    config: Omit<PromptVersion, 'createdAt'> & { setActive?: boolean }
  ): void {
    const version: PromptVersion = {
      ...config,
      createdAt: new Date()
    };

    // Get or create version history
    const history = this.prompts.get(id) || [];
    history.push(version);
    this.prompts.set(id, history);

    // Set as active version if specified or if first version
    if (config.setActive !== false || history.length === 1) {
      this.activeVersions.set(id, version.version);
    }

    logger.info('Prompt registered', {
      id,
      version: version.version,
      isActive: this.activeVersions.get(id) === version.version
    });
  }

  /**
   * Get a prompt by ID (returns active version)
   */
  get(id: string): { prompt: string; metadata: PromptMetadata } | null {
    const activeVersion = this.activeVersions.get(id);
    if (!activeVersion) {
      logger.warn('Prompt not found', { id });
      return null;
    }

    // Check for A/B test
    const abTest = this.abTests.get(id);
    let version = activeVersion;
    if (abTest?.isActive) {
      version = this.selectABVariant(abTest);
    }

    const history = this.prompts.get(id);
    const prompt = history?.find(p => p.version === version);

    if (!prompt) {
      logger.error('Prompt version not found', { id, version });
      return null;
    }

    return {
      prompt: prompt.template,
      metadata: {
        id,
        version: prompt.version,
        hash: this.hashTemplate(prompt.template),
        retrievedAt: new Date()
      }
    };
  }

  /**
   * Get specific version of a prompt
   */
  getVersion(id: string, version: string): PromptVersion | null {
    const history = this.prompts.get(id);
    return history?.find(p => p.version === version) || null;
  }

  /**
   * Set active version for a prompt
   */
  setActiveVersion(id: string, version: string): boolean {
    const history = this.prompts.get(id);
    const exists = history?.some(p => p.version === version);

    if (!exists) {
      logger.error('Cannot set active version - not found', { id, version });
      return false;
    }

    this.activeVersions.set(id, version);
    logger.info('Active version changed', { id, version });
    return true;
  }

  /**
   * Record prompt usage for analytics
   */
  recordUsage(record: Omit<PromptUsageRecord, 'timestamp'>): void {
    const fullRecord: PromptUsageRecord = {
      ...record,
      timestamp: new Date()
    };

    this.usageRecords.push(fullRecord);

    // Update stats
    this.updateStats(fullRecord);

    // Keep only last 10000 records in memory
    if (this.usageRecords.length > 10000) {
      this.usageRecords = this.usageRecords.slice(-10000);
    }
  }

  /**
   * Get statistics for a prompt
   */
  getStats(id: string, version?: string): PromptStats | null {
    const key = version ? `${id}:${version}` : `${id}:${this.activeVersions.get(id)}`;
    return this.stats.get(key) || null;
  }

  /**
   * List all registered prompts
   */
  listPrompts(): Array<{
    id: string;
    activeVersion: string;
    versions: string[];
    description: string;
  }> {
    const result: Array<{
      id: string;
      activeVersion: string;
      versions: string[];
      description: string;
    }> = [];

    for (const [id, history] of this.prompts) {
      const activeVersion = this.activeVersions.get(id) || '';
      const active = history.find(p => p.version === activeVersion);

      result.push({
        id,
        activeVersion,
        versions: history.map(p => p.version),
        description: active?.description || ''
      });
    }

    return result;
  }

  /**
   * Configure A/B test for a prompt
   */
  configureABTest(config: ABTestConfig): void {
    // Validate weights sum to 100
    const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error(`A/B test weights must sum to 100, got ${totalWeight}`);
    }

    // Validate all versions exist
    const history = this.prompts.get(config.promptId);
    for (const variant of config.variants) {
      if (!history?.some(p => p.version === variant.version)) {
        throw new Error(`Version ${variant.version} not found for prompt ${config.promptId}`);
      }
    }

    this.abTests.set(config.promptId, config);
    logger.info('A/B test configured', {
      promptId: config.promptId,
      variants: config.variants
    });
  }

  /**
   * Stop A/B test
   */
  stopABTest(promptId: string): void {
    const test = this.abTests.get(promptId);
    if (test) {
      test.isActive = false;
      test.endDate = new Date();
      logger.info('A/B test stopped', { promptId });
    }
  }

  /**
   * Get A/B test results
   */
  getABTestResults(promptId: string): {
    variants: Array<{
      version: string;
      stats: PromptStats | null;
    }>;
  } | null {
    const test = this.abTests.get(promptId);
    if (!test) return null;

    return {
      variants: test.variants.map(v => ({
        version: v.version,
        stats: this.getStats(promptId, v.version)
      }))
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private selectABVariant(config: ABTestConfig): string {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of config.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.version;
      }
    }

    // Fallback to first variant
    return config.variants[0].version;
  }

  private updateStats(record: PromptUsageRecord): void {
    const key = `${record.promptId}:${record.version}`;
    const existing = this.stats.get(key) || {
      promptId: record.promptId,
      version: record.version,
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
      lastUsed: new Date()
    };

    existing.totalCalls++;
    if (record.success) {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }

    if (record.latencyMs) {
      // Running average
      existing.avgLatencyMs = (
        (existing.avgLatencyMs * (existing.totalCalls - 1) + record.latencyMs) /
        existing.totalCalls
      );
    }

    existing.lastUsed = record.timestamp;
    this.stats.set(key, existing);
  }

  private hashTemplate(template: string): string {
    // Simple hash for change detection
    let hash = 0;
    for (let i = 0; i < template.length; i++) {
      const char = template.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const promptRegistry = new PromptRegistry();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a versioned prompt wrapper
 * Automatically tracks version metadata with LLM calls
 */
export function createVersionedPrompt<TParams extends any[], TResult extends string>(
  id: string,
  version: string,
  description: string,
  promptFn: (...params: TParams) => TResult
): (...params: TParams) => { prompt: TResult; metadata: PromptMetadata } {
  // Register the prompt
  promptRegistry.register(id, {
    version,
    template: `[Function: ${promptFn.name || 'anonymous'}]`,
    description,
    setActive: true
  });

  // Return wrapped function
  return (...params: TParams) => {
    const prompt = promptFn(...params);
    return {
      prompt,
      metadata: {
        id,
        version,
        hash: promptRegistry['hashTemplate'](prompt),
        retrievedAt: new Date()
      }
    };
  };
}

/**
 * Record prompt usage with timing
 */
export async function withPromptTracking<T>(
  metadata: PromptMetadata,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorType: string | undefined;

  try {
    return await operation();
  } catch (error: any) {
    success = false;
    errorType = error.name || 'UnknownError';
    throw error;
  } finally {
    promptRegistry.recordUsage({
      promptId: metadata.id,
      version: metadata.version,
      success,
      latencyMs: Date.now() - startTime,
      errorType
    });
  }
}

// ============================================================
// PROMPT VERSION CONSTANTS
// ============================================================

/**
 * Current versions for all major prompts
 * Increment when making changes
 */
export const PROMPT_VERSIONS = {
  SKELETON_GENERATOR: '2.0.0',
  STEP_CONTENT: '2.0.0',
  EXAM_GENERATOR: '1.5.0',
  GRADING: '1.2.0',
  VARIANT_GENERATOR: '1.0.0',
  BOT_PERSONA: '1.0.0',
  LINGUISTIC_CONSTRAINTS: '1.1.0'
} as const;

/**
 * Get version info for artifact storage
 */
export function getPromptVersionInfo(promptId: keyof typeof PROMPT_VERSIONS): {
  promptId: string;
  version: string;
  timestamp: string;
} {
  return {
    promptId,
    version: PROMPT_VERSIONS[promptId],
    timestamp: new Date().toISOString()
  };
}
