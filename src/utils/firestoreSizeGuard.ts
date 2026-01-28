/**
 * Firestore Document Size Guard (Frontend)
 *
 * Client-side validation to prevent Firestore 1MiB limit errors.
 * Estimates document size and warns/errors before save.
 */

// Firestore limit is 1MiB = 1,048,576 bytes
export const FIRESTORE_DOC_SIZE_LIMIT = 1048576;
export const SAFE_DOC_SIZE_THRESHOLD = 900 * 1024; // 900KB warning threshold
export const LARGE_CONTENT_THRESHOLD = 100 * 1024; // 100KB for individual fields

/**
 * Estimate the byte size of a JavaScript value
 */
export function estimateSize(value: any): number {
  if (value === null || value === undefined) {
    return 1;
  }

  const type = typeof value;

  if (type === 'boolean') return 1;
  if (type === 'number') return 8;

  if (type === 'string') {
    // UTF-8: Hebrew characters are typically 2 bytes
    return value.length * 2 + 1;
  }

  if (Array.isArray(value)) {
    let size = 1;
    for (const item of value) {
      size += estimateSize(item);
    }
    return size;
  }

  if (type === 'object') {
    if (value instanceof Date) return 8;

    let size = 1;
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        size += key.length * 2 + 1;
        size += estimateSize(value[key]);
      }
    }
    return size;
  }

  return 1;
}

export interface SizeAnalysis {
  totalSize: number;
  totalSizeKB: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  percentOfLimit: number;
  fieldSizes: Record<string, number>;
  largestFields: Array<{ field: string; size: number; sizeKB: number }>;
  warnings: string[];
}

/**
 * Analyze document size and identify problematic fields
 */
export function analyzeDocumentSize(doc: any): SizeAnalysis {
  const fieldSizes: Record<string, number> = {};
  let totalSize = 0;
  const warnings: string[] = [];

  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      const fieldSize = estimateSize(doc[key]);
      fieldSizes[key] = fieldSize;
      totalSize += fieldSize + (key.length * 2);

      // Warn about large individual fields
      if (fieldSize > LARGE_CONTENT_THRESHOLD) {
        warnings.push(`Field "${key}" is large: ${Math.round(fieldSize / 1024)}KB`);
      }
    }
  }

  const largestFields = Object.entries(fieldSizes)
    .map(([field, size]) => ({
      field,
      size,
      sizeKB: Math.round(size / 1024)
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  const isOverLimit = totalSize > FIRESTORE_DOC_SIZE_LIMIT;
  const isNearLimit = totalSize > SAFE_DOC_SIZE_THRESHOLD;

  if (isOverLimit) {
    warnings.unshift(`Document exceeds 1MiB limit: ${Math.round(totalSize / 1024)}KB`);
  } else if (isNearLimit) {
    warnings.unshift(`Document approaching limit: ${Math.round(totalSize / 1024)}KB / 1024KB`);
  }

  return {
    totalSize,
    totalSizeKB: Math.round(totalSize / 1024),
    isOverLimit,
    isNearLimit,
    percentOfLimit: Math.round((totalSize / FIRESTORE_DOC_SIZE_LIMIT) * 100),
    fieldSizes,
    largestFields,
    warnings
  };
}

/**
 * Validate document before save - throws if over limit
 */
export function validateDocumentSize(doc: any, docName: string = 'Document'): void {
  const analysis = analyzeDocumentSize(doc);

  if (analysis.isOverLimit) {
    const error = new Error(
      `${docName} exceeds Firestore 1MiB limit (${analysis.totalSizeKB}KB). ` +
      `Largest fields: ${analysis.largestFields.slice(0, 3).map(f => `${f.field}(${f.sizeKB}KB)`).join(', ')}`
    );
    console.error('Firestore size validation failed:', analysis);
    throw error;
  }

  if (analysis.isNearLimit) {
    console.warn(`${docName} approaching Firestore limit:`, {
      size: `${analysis.totalSizeKB}KB / 1024KB`,
      percent: `${analysis.percentOfLimit}%`,
      largestFields: analysis.largestFields.slice(0, 3)
    });
  }
}

/**
 * Clean course data to reduce size before save
 * - Removes redundant wizardData.pastedText
 * - Truncates oversized content with warning
 */
export function optimizeCourseForSave(course: any): {
  optimized: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  const optimized = { ...course };

  // 1. Clean up wizardData.pastedText if fullBookContent exists
  if (optimized.wizardData?.pastedText && optimized.fullBookContent) {
    const pastedSize = estimateSize(optimized.wizardData.pastedText);
    if (pastedSize > 10 * 1024) {
      optimized.wizardData = {
        ...optimized.wizardData,
        pastedText: null,
        pastedTextCleared: true
      };
      warnings.push(`Cleared redundant wizardData.pastedText (${Math.round(pastedSize / 1024)}KB)`);
    }
  }

  // 2. Check fullBookContent size
  if (optimized.fullBookContent) {
    const contentSize = estimateSize(optimized.fullBookContent);
    if (contentSize > 500 * 1024) { // > 500KB
      warnings.push(
        `fullBookContent is very large (${Math.round(contentSize / 1024)}KB). ` +
        `Consider using external storage for PDF content.`
      );
    }
  }

  // 3. Ensure syllabus is lightweight (no embedded content)
  if (optimized.syllabus && Array.isArray(optimized.syllabus)) {
    let hasEmbeddedContent = false;

    optimized.syllabus = optimized.syllabus.map((module: any) => ({
      ...module,
      learningUnits: module.learningUnits?.map((unit: any) => {
        if (unit.baseContent || unit.activityBlocks?.length > 0) {
          hasEmbeddedContent = true;
        }
        return {
          id: unit.id,
          title: unit.title,
          type: unit.type,
          goals: unit.goals,
          isLazy: true,
          baseContent: null,
          activityBlocks: []
        };
      }) || []
    }));

    if (hasEmbeddedContent) {
      warnings.push('Stripped embedded content from syllabus (will be saved to subcollection)');
    }
  }

  return { optimized, warnings };
}

/**
 * Analyze a unit document for size issues
 */
export function analyzeUnitSize(unit: any): SizeAnalysis & {
  variantCount: number;
  variantSize: number;
} {
  const analysis = analyzeDocumentSize(unit);

  // Count variants in activity blocks
  let variantCount = 0;
  let variantSize = 0;

  if (unit.activityBlocks && Array.isArray(unit.activityBlocks)) {
    for (const block of unit.activityBlocks) {
      if (block.metadata) {
        const variantKeys = ['הבנה_variant', 'העמקה_variant', 'scaffold_variant'];
        for (const key of variantKeys) {
          if (block.metadata[key] && typeof block.metadata[key] === 'object') {
            variantCount++;
            variantSize += estimateSize(block.metadata[key]);
          }
        }
      }
    }
  }

  if (variantSize > 100 * 1024) {
    analysis.warnings.push(
      `Unit has ${variantCount} variants totaling ${Math.round(variantSize / 1024)}KB. ` +
      `Consider lazy-loading variants.`
    );
  }

  return {
    ...analysis,
    variantCount,
    variantSize
  };
}

/**
 * Format size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
