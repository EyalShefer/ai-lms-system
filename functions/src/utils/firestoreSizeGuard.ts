/**
 * Firestore Document Size Guard
 *
 * Firestore has a hard limit of 1MiB (1,048,576 bytes) per document.
 * This utility helps prevent exceeding that limit by:
 * 1. Estimating document size before save
 * 2. Moving large content to Cloud Storage
 * 3. Cleaning up redundant data
 *
 * Common size offenders:
 * - fullBookContent: Extracted PDF text (can be 500KB-2MB)
 * - wizardData.pastedText: Duplicate of fullBookContent
 * - activityBlocks with variants: 2-3x block size
 */

import * as logger from 'firebase-functions/logger';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

// ============================================================
// CONSTANTS
// ============================================================

// Firestore limit is 1MiB = 1,048,576 bytes
// We use 900KB as safe threshold to leave room for metadata
export const FIRESTORE_DOC_SIZE_LIMIT = 1048576;
export const SAFE_DOC_SIZE_THRESHOLD = 900 * 1024; // 900KB

// Threshold for moving content to Storage
export const LARGE_CONTENT_THRESHOLD = 100 * 1024; // 100KB

// ============================================================
// SIZE ESTIMATION
// ============================================================

/**
 * Estimate the byte size of a JavaScript value
 * This is an approximation - actual Firestore size may vary slightly
 */
export function estimateSize(value: any): number {
  if (value === null || value === undefined) {
    return 1;
  }

  const type = typeof value;

  if (type === 'boolean') {
    return 1;
  }

  if (type === 'number') {
    return 8;
  }

  if (type === 'string') {
    // UTF-8 encoding: most characters are 1-3 bytes
    // Hebrew characters are typically 2 bytes
    return value.length * 2 + 1;
  }

  if (Array.isArray(value)) {
    let size = 1; // array overhead
    for (const item of value) {
      size += estimateSize(item);
    }
    return size;
  }

  if (type === 'object') {
    // Handle Date, Timestamp, etc.
    if (value instanceof Date || value._seconds !== undefined) {
      return 8;
    }

    let size = 1; // object overhead
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        size += key.length * 2 + 1; // key size
        size += estimateSize(value[key]); // value size
      }
    }
    return size;
  }

  return 1;
}

/**
 * Estimate document size and return details
 */
export function analyzeDocumentSize(doc: any): {
  totalSize: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  fieldSizes: Record<string, number>;
  largestFields: Array<{ field: string; size: number }>;
} {
  const fieldSizes: Record<string, number> = {};
  let totalSize = 0;

  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      const fieldSize = estimateSize(doc[key]);
      fieldSizes[key] = fieldSize;
      totalSize += fieldSize + (key.length * 2); // include key size
    }
  }

  // Sort fields by size
  const largestFields = Object.entries(fieldSizes)
    .map(([field, size]) => ({ field, size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  return {
    totalSize,
    isOverLimit: totalSize > FIRESTORE_DOC_SIZE_LIMIT,
    isNearLimit: totalSize > SAFE_DOC_SIZE_THRESHOLD,
    fieldSizes,
    largestFields
  };
}

// ============================================================
// CONTENT OFFLOADING
// ============================================================

/**
 * Move large content to Cloud Storage and return a reference
 */
export async function offloadToStorage(
  content: string,
  path: string
): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(path);

  await file.save(content, {
    contentType: 'text/plain',
    metadata: {
      cacheControl: 'private, max-age=86400' // 24 hour cache
    }
  });

  logger.info('Content offloaded to Storage', {
    path,
    size: content.length
  });

  return path;
}

/**
 * Retrieve content from Cloud Storage
 */
export async function retrieveFromStorage(path: string): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(path);

  const [content] = await file.download();
  return content.toString('utf-8');
}

// ============================================================
// COURSE DOCUMENT OPTIMIZATION
// ============================================================

/**
 * Optimize a course document to stay within Firestore limits
 * - Moves fullBookContent to Storage if too large
 * - Cleans up wizardData.pastedText (redundant)
 * - Returns optimized document and any external references
 */
export async function optimizeCourseDocument(
  courseId: string,
  courseData: any
): Promise<{
  optimizedData: any;
  offloadedContent: Record<string, string>;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const offloadedContent: Record<string, string> = {};
  const optimizedData = { ...courseData };

  // 1. Check fullBookContent size
  if (optimizedData.fullBookContent) {
    const contentSize = estimateSize(optimizedData.fullBookContent);

    if (contentSize > LARGE_CONTENT_THRESHOLD) {
      // Offload to Storage
      const storagePath = `courses/${courseId}/fullBookContent.txt`;
      await offloadToStorage(optimizedData.fullBookContent, storagePath);

      offloadedContent['fullBookContent'] = storagePath;
      optimizedData.fullBookContentRef = storagePath;
      optimizedData.fullBookContent = null; // Remove from document

      logger.info('fullBookContent offloaded to Storage', {
        courseId,
        originalSize: contentSize,
        storagePath
      });
    }
  }

  // 2. Clean up wizardData.pastedText (redundant with fullBookContent)
  if (optimizedData.wizardData?.pastedText) {
    const pastedTextSize = estimateSize(optimizedData.wizardData.pastedText);

    if (pastedTextSize > 10 * 1024) { // > 10KB
      warnings.push('Removed redundant wizardData.pastedText');
      optimizedData.wizardData = {
        ...optimizedData.wizardData,
        pastedText: null,
        pastedTextCleared: true
      };
    }
  }

  // 3. Ensure syllabus doesn't contain full unit content
  if (optimizedData.syllabus && Array.isArray(optimizedData.syllabus)) {
    optimizedData.syllabus = optimizedData.syllabus.map((module: any) => ({
      ...module,
      learningUnits: module.learningUnits?.map((unit: any) => ({
        id: unit.id,
        title: unit.title,
        type: unit.type,
        goals: unit.goals,
        isLazy: true,
        // Strip heavy content - will be loaded from subcollection
        baseContent: null,
        activityBlocks: []
      })) || []
    }));
  }

  // 4. Analyze final size
  const analysis = analyzeDocumentSize(optimizedData);

  if (analysis.isOverLimit) {
    warnings.push(`Document still over limit: ${Math.round(analysis.totalSize / 1024)}KB`);
    logger.error('Course document exceeds Firestore limit after optimization', {
      courseId,
      size: analysis.totalSize,
      largestFields: analysis.largestFields
    });
  } else if (analysis.isNearLimit) {
    warnings.push(`Document near limit: ${Math.round(analysis.totalSize / 1024)}KB / 1024KB`);
    logger.warn('Course document approaching Firestore limit', {
      courseId,
      size: analysis.totalSize
    });
  }

  return {
    optimizedData,
    offloadedContent,
    warnings
  };
}

// ============================================================
// UNIT DOCUMENT OPTIMIZATION
// ============================================================

/**
 * Optimize a unit document
 * - Moves variant blocks to separate collection if too large
 * - Keeps references to variants instead of full content
 */
export async function optimizeUnitDocument(
  courseId: string,
  unitId: string,
  unitData: any
): Promise<{
  optimizedData: any;
  variantsOffloaded: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const optimizedData = { ...unitData };
  let variantsOffloaded = false;

  // Analyze current size
  const analysis = analyzeDocumentSize(optimizedData);

  // If near limit, offload variants to separate collection
  if (analysis.isNearLimit && optimizedData.activityBlocks) {
    const db = getFirestore();
    const variantCache: any[] = [];

    optimizedData.activityBlocks = optimizedData.activityBlocks.map((block: any, index: number) => {
      const variants: any = {};

      // Check for variant fields in metadata
      if (block.metadata) {
        const variantKeys = ['הבנה_variant', 'העמקה_variant', 'scaffold_variant'];

        for (const key of variantKeys) {
          if (block.metadata[key]) {
            // Store variant in cache
            variantCache.push({
              blockIndex: index,
              blockId: block.id,
              variantKey: key,
              variant: block.metadata[key]
            });

            // Replace with reference
            variants[key] = { isRef: true, cached: true };
          }
        }

        // Clean up metadata
        if (Object.keys(variants).length > 0) {
          block.metadata = {
            ...block.metadata,
            הבנה_variant: variants['הבנה_variant'] || block.metadata['הבנה_variant'],
            העמקה_variant: variants['העמקה_variant'] || block.metadata['העמקה_variant'],
            scaffold_variant: variants['scaffold_variant'] || block.metadata['scaffold_variant']
          };
        }
      }

      return block;
    });

    // Save variants to separate collection if any were found
    if (variantCache.length > 0) {
      const variantRef = db.collection('courses').doc(courseId)
        .collection('units').doc(unitId)
        .collection('variant_cache');

      // Batch write variants
      const batch = db.batch();
      for (const variant of variantCache) {
        const docRef = variantRef.doc(`${variant.blockId}_${variant.variantKey}`);
        batch.set(docRef, variant);
      }
      await batch.commit();

      variantsOffloaded = true;
      warnings.push(`Offloaded ${variantCache.length} variants to cache collection`);

      logger.info('Unit variants offloaded to cache', {
        courseId,
        unitId,
        variantCount: variantCache.length
      });
    }
  }

  // Final size check
  const finalAnalysis = analyzeDocumentSize(optimizedData);
  if (finalAnalysis.isOverLimit) {
    warnings.push(`Unit document over limit: ${Math.round(finalAnalysis.totalSize / 1024)}KB`);
  }

  return {
    optimizedData,
    variantsOffloaded,
    warnings
  };
}

// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================

/**
 * Validate document size before save
 * Throws error if document exceeds limit
 */
export function validateDocumentSize(
  doc: any,
  docPath: string
): void {
  const analysis = analyzeDocumentSize(doc);

  if (analysis.isOverLimit) {
    logger.error('Document exceeds Firestore size limit', {
      path: docPath,
      size: analysis.totalSize,
      limit: FIRESTORE_DOC_SIZE_LIMIT,
      largestFields: analysis.largestFields
    });

    throw new Error(
      `Document exceeds Firestore 1MiB limit: ${Math.round(analysis.totalSize / 1024)}KB. ` +
      `Largest fields: ${analysis.largestFields.map(f => `${f.field}(${Math.round(f.size / 1024)}KB)`).join(', ')}`
    );
  }

  if (analysis.isNearLimit) {
    logger.warn('Document approaching Firestore size limit', {
      path: docPath,
      size: analysis.totalSize,
      threshold: SAFE_DOC_SIZE_THRESHOLD
    });
  }
}

// ============================================================
// MONITORING
// ============================================================

/**
 * Log document size metrics for monitoring
 */
export function logDocumentSizeMetrics(
  collection: string,
  docId: string,
  doc: any
): void {
  const analysis = analyzeDocumentSize(doc);

  logger.info('Document size metrics', {
    collection,
    docId,
    totalSizeKB: Math.round(analysis.totalSize / 1024),
    percentOfLimit: Math.round((analysis.totalSize / FIRESTORE_DOC_SIZE_LIMIT) * 100),
    topFields: analysis.largestFields.slice(0, 3).map(f => ({
      field: f.field,
      sizeKB: Math.round(f.size / 1024)
    }))
  });
}
