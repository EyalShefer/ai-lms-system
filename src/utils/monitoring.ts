/**
 * Monitoring and Analytics Utilities
 * Provides hooks for performance tracking and error monitoring
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ErrorLog {
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// In-memory storage (replace with actual analytics service)
const performanceMetrics: PerformanceMetric[] = [];
const errorLogs: ErrorLog[] = [];
const MAX_STORED_METRICS = 100;

/**
 * Track performance of a function
 */
export async function trackPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    logPerformanceMetric({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    logPerformanceMetric({
      name: `${name}_error`,
      duration,
      timestamp: Date.now(),
      metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Log performance metric
 */
function logPerformanceMetric(metric: PerformanceMetric) {
  performanceMetrics.push(metric);

  // Keep only recent metrics
  if (performanceMetrics.length > MAX_STORED_METRICS) {
    performanceMetrics.shift();
  }

  // Log to console in dev
  if (import.meta.env.DEV) {
    console.debug(
      `[Perf] ${metric.name}: ${metric.duration.toFixed(2)}ms`,
      metric.metadata
    );
  }

  // TODO: Send to analytics service (e.g., Google Analytics, Mixpanel)
  // sendToAnalytics('performance', metric);
}

/**
 * Log error
 */
export function logError(
  error: Error | string,
  context?: Record<string, any>,
  severity: ErrorLog['severity'] = 'medium'
) {
  const errorLog: ErrorLog = {
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: Date.now(),
    context,
    severity,
  };

  errorLogs.push(errorLog);

  // Keep only recent errors
  if (errorLogs.length > MAX_STORED_METRICS) {
    errorLogs.shift();
  }

  // Log to console
  const logFn = severity === 'critical' ? console.error : console.warn;
  logFn(`[Error:${severity}]`, errorLog.message, context);

  // TODO: Send to error tracking service (e.g., Sentry)
  // sendToSentry(errorLog);
}

/**
 * Track user event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  const event = {
    name: eventName,
    properties,
    timestamp: Date.now(),
  };

  // Log in dev
  if (import.meta.env.DEV) {
    console.debug('[Event]', event);
  }

  // TODO: Send to analytics service
  // analytics.track(eventName, properties);
}

/**
 * Track page view
 */
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  trackEvent('page_view', { page: pageName, ...properties });
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  if (performanceMetrics.length === 0) {
    return null;
  }

  const durations = performanceMetrics.map((m) => m.duration);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  // Group by name
  const byName: Record<string, number[]> = {};
  performanceMetrics.forEach((m) => {
    if (!byName[m.name]) {
      byName[m.name] = [];
    }
    byName[m.name].push(m.duration);
  });

  const averageByName = Object.entries(byName).map(([name, durations]) => ({
    name,
    average: durations.reduce((a, b) => a + b, 0) / durations.length,
    count: durations.length,
  }));

  return {
    total: performanceMetrics.length,
    average: avg,
    min,
    max,
    byName: averageByName,
  };
}

/**
 * Get error summary
 */
export function getErrorSummary() {
  if (errorLogs.length === 0) {
    return null;
  }

  const bySeverity: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  errorLogs.forEach((e) => {
    bySeverity[e.severity]++;
  });

  return {
    total: errorLogs.length,
    bySeverity,
    recent: errorLogs.slice(-5),
  };
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics() {
  performanceMetrics.length = 0;
  errorLogs.length = 0;
}

/**
 * Monitor component render time
 */
export function usePerformanceMonitor(componentName: string) {
  if (import.meta.env.DEV) {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      console.debug(`[Render] ${componentName}: ${duration.toFixed(2)}ms`);
    };
  }

  return () => {};
}

/**
 * Telemetry for AI generation
 */
export function trackAIGeneration(
  type: 'skeleton' | 'step' | 'chat' | 'grading',
  params: {
    topic?: string;
    duration: number;
    success: boolean;
    error?: string;
    tokenCount?: number;
  }
) {
  trackPerformance(`ai_${type}`, async () => params.duration, {
    type,
    ...params,
  });

  trackEvent(`ai_generation_${type}`, {
    success: params.success,
    duration: params.duration,
    error: params.error,
  });
}

/**
 * Track user interaction
 */
export function trackUserInteraction(
  action: 'answer_submit' | 'hint_request' | 'chat_message' | 'block_complete',
  metadata?: Record<string, any>
) {
  trackEvent(`user_${action}`, metadata);
}

/**
 * Performance budget checker
 * Warns if operation exceeds expected duration
 */
export function checkPerformanceBudget(
  operationName: string,
  duration: number,
  budgetMs: number
) {
  if (duration > budgetMs) {
    console.warn(
      `[Performance Budget] ${operationName} exceeded budget: ${duration.toFixed(2)}ms > ${budgetMs}ms`
    );

    trackEvent('performance_budget_exceeded', {
      operation: operationName,
      duration,
      budget: budgetMs,
      overBudget: duration - budgetMs,
    });
  }
}

// ============================================
// Activity Creation Performance Timer
// ============================================

interface TimerStep {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class ActivityCreationTimer {
  private sessionId: string = '';
  private sessionStartTime: number = 0;
  private steps: TimerStep[] = [];
  private currentStep: TimerStep | null = null;

  /**
   * Start a new timing session for activity creation
   */
  startSession(productType: string = 'activity') {
    this.sessionId = `session_${Date.now()}`;
    this.sessionStartTime = performance.now();
    this.steps = [];
    this.currentStep = null;

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  ⏱️  ACTIVITY CREATION TIMER - ${productType.toUpperCase().padEnd(20)}       ║`);
    console.log(`║  Session: ${this.sessionId.padEnd(45)}  ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
  }

  /**
   * Start timing a specific step
   */
  startStep(stepName: string) {
    // End previous step if exists
    if (this.currentStep && !this.currentStep.endTime) {
      this.endStep();
    }

    const step: TimerStep = {
      name: stepName,
      startTime: performance.now(),
    };

    this.currentStep = step;
    this.steps.push(step);

    console.log(`║  ▶️  START: ${stepName.padEnd(45)}  ║`);
  }

  /**
   * End the current step
   */
  endStep(additionalInfo?: string) {
    if (!this.currentStep) return;

    this.currentStep.endTime = performance.now();
    this.currentStep.duration = this.currentStep.endTime - this.currentStep.startTime;

    const durationStr = this.formatDuration(this.currentStep.duration);
    const info = additionalInfo ? ` (${additionalInfo})` : '';

    console.log(`║  ✅ END:   ${this.currentStep.name.substring(0, 30).padEnd(30)} ${durationStr.padStart(8)}${info.substring(0, 10).padEnd(10)} ║`);

    this.currentStep = null;
  }

  /**
   * Log an intermediate checkpoint within a step
   */
  checkpoint(message: string) {
    const elapsed = this.currentStep
      ? performance.now() - this.currentStep.startTime
      : performance.now() - this.sessionStartTime;

    console.log(`║     📍 ${message.substring(0, 40).padEnd(40)} +${this.formatDuration(elapsed).padStart(7)} ║`);
  }

  /**
   * End the timing session and print summary
   */
  endSession() {
    // End any open step
    if (this.currentStep && !this.currentStep.endTime) {
      this.endStep();
    }

    const totalDuration = performance.now() - this.sessionStartTime;

    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                         📊 SUMMARY                           ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    // Sort steps by duration (longest first)
    const sortedSteps = [...this.steps]
      .filter(s => s.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    sortedSteps.forEach((step, index) => {
      const percent = ((step.duration || 0) / totalDuration * 100).toFixed(1);
      const bar = this.createBar(Number(percent));
      console.log(`║  ${(index + 1).toString().padStart(2)}. ${step.name.substring(0, 25).padEnd(25)} ${this.formatDuration(step.duration || 0).padStart(8)} ${percent.padStart(5)}% ${bar} ║`);
    });

    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  🏁 TOTAL TIME: ${this.formatDuration(totalDuration).padEnd(42)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Store in window for debugging
    if (typeof window !== 'undefined') {
      (window as any).__lastActivityTiming = {
        sessionId: this.sessionId,
        totalDuration,
        steps: this.steps,
      };
    }

    return {
      sessionId: this.sessionId,
      totalDuration,
      steps: this.steps,
    };
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const mins = Math.floor(ms / 60000);
      const secs = ((ms % 60000) / 1000).toFixed(0);
      return `${mins}m ${secs}s`;
    }
  }

  private createBar(percent: number): string {
    const width = 10;
    const filled = Math.round((percent / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }
}

// Singleton instance
export const activityTimer = new ActivityCreationTimer();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).__monitoring = {
    getPerformanceStats,
    getErrorSummary,
    clearMetrics,
    activityTimer,
  };
}
