/**
 * Auto-Fix Agent
 * סוכן תיקון אוטומטי - מנתח שגיאות ומציע תיקונים
 */

import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import type {
  TestResult,
  FixSuggestion,
  FixResult,
  FixType,
  TestResultWithFix,
  ContentIssue
} from '../../types/qa.types';
import type { Course, LearningUnit, ActivityBlock } from '../../shared/types/courseTypes';

// Import AI generation functions for regeneration fixes
import {
  generateSingleMultipleChoiceQuestion,
  generateSingleOpenQuestion,
  generateCategorizationQuestion,
  generateOrderingQuestion,
  generateFillInBlanksQuestion
} from '../../gemini';

// ===== FIX SUGGESTION GENERATORS =====

/**
 * Analyze a test result and generate fix suggestions
 */
export function generateFixSuggestions(testResult: TestResult): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  const details = testResult.details || {};

  // Parse error type from test result
  const errorType = parseErrorType(testResult);

  switch (errorType) {
    case 'missing_question':
      suggestions.push(createRegenerateBlockSuggestion(testResult, details));
      break;

    case 'missing_options':
    case 'insufficient_options':
      suggestions.push(createFixOptionsSuggestion(testResult, details));
      break;

    case 'no_correct_answer':
      suggestions.push(createAddCorrectAnswerSuggestion(testResult, details));
      break;

    case 'empty_content':
      suggestions.push(createRegenerateContentSuggestion(testResult, details));
      break;

    case 'invalid_block_structure':
      suggestions.push(createFixStructureSuggestion(testResult, details));
      break;

    case 'missing_feedback':
      suggestions.push(createAddMissingFieldSuggestion(testResult, details, 'feedback'));
      break;

    case 'orphaned_reference':
      suggestions.push(createRemoveInvalidSuggestion(testResult, details));
      break;

    default:
      // For unknown errors, suggest manual review
      suggestions.push(createManualReviewSuggestion(testResult, details));
  }

  return suggestions;
}

function parseErrorType(testResult: TestResult): string {
  const message = testResult.message.toLowerCase();
  const messageHe = testResult.messageHe;

  if (message.includes('missing question') || messageHe.includes('חסר שאלה')) {
    return 'missing_question';
  }
  if (message.includes('no options') || message.includes('insufficient options') || messageHe.includes('אפשרויות')) {
    return 'missing_options';
  }
  if (message.includes('no correct') || messageHe.includes('תשובה נכונה')) {
    return 'no_correct_answer';
  }
  if (message.includes('empty') || messageHe.includes('ריק')) {
    return 'empty_content';
  }
  if (message.includes('invalid structure') || messageHe.includes('מבנה')) {
    return 'invalid_block_structure';
  }
  if (message.includes('feedback') || messageHe.includes('משוב')) {
    return 'missing_feedback';
  }
  if (message.includes('orphan') || message.includes('reference') || messageHe.includes('הפניה')) {
    return 'orphaned_reference';
  }

  return 'unknown';
}

// ===== SUGGESTION CREATORS =====

function createRegenerateBlockSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'regenerate_block',
    description: 'Regenerate the entire block using AI',
    descriptionHe: 'יצירה מחדש של הבלוק באמצעות AI',
    autoFixable: true,
    estimatedDuration: 15,
    riskLevel: 'medium',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      field: 'units',
      blockId: details.blockId as string || ''
    },
    requiresAI: true,
    aiPrompt: `Regenerate ${details.blockType || 'activity'} block for topic: ${details.topic || 'unknown'}`
  };
}

function createFixOptionsSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'fix_options',
    description: 'Add or fix answer options',
    descriptionHe: 'הוספה או תיקון אפשרויות תשובה',
    autoFixable: true,
    estimatedDuration: 10,
    riskLevel: 'low',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      field: 'content.options',
      blockId: details.blockId as string || ''
    },
    requiresAI: true,
    aiPrompt: `Generate 4 answer options for question: ${details.question || 'unknown'}`
  };
}

function createAddCorrectAnswerSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'add_correct_answer',
    description: 'Mark one option as correct answer',
    descriptionHe: 'סימון תשובה נכונה',
    autoFixable: true,
    estimatedDuration: 5,
    riskLevel: 'low',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      field: 'content.correctAnswer',
      blockId: details.blockId as string || ''
    },
    requiresAI: false,
    fixData: {
      action: 'set_first_as_correct'
    }
  };
}

function createRegenerateContentSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'regenerate_content',
    description: 'Regenerate content using AI',
    descriptionHe: 'יצירת תוכן מחדש באמצעות AI',
    autoFixable: true,
    estimatedDuration: 20,
    riskLevel: 'medium',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      field: 'content',
      blockId: details.blockId as string || ''
    },
    requiresAI: true
  };
}

function createFixStructureSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'fix_structure',
    description: 'Fix block structure to match schema',
    descriptionHe: 'תיקון מבנה הבלוק',
    autoFixable: true,
    estimatedDuration: 5,
    riskLevel: 'low',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      blockId: details.blockId as string || ''
    },
    requiresAI: false
  };
}

function createAddMissingFieldSuggestion(testResult: TestResult, details: Record<string, unknown>, field: string): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'add_missing_field',
    description: `Add missing ${field} field`,
    descriptionHe: `הוספת שדה ${field} חסר`,
    autoFixable: true,
    estimatedDuration: 10,
    riskLevel: 'low',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      field: `content.${field}`,
      blockId: details.blockId as string || ''
    },
    requiresAI: field === 'feedback'
  };
}

function createRemoveInvalidSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'remove_invalid',
    description: 'Remove invalid or orphaned reference',
    descriptionHe: 'הסרת הפניה לא תקינה',
    autoFixable: true,
    estimatedDuration: 3,
    riskLevel: 'medium',
    targetPath: {
      collection: 'courses',
      documentId: details.courseId as string || '',
      blockId: details.blockId as string || ''
    },
    requiresAI: false
  };
}

function createManualReviewSuggestion(testResult: TestResult, details: Record<string, unknown>): FixSuggestion {
  return {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testResultId: testResult.id,
    fixType: 'manual_review',
    description: 'This issue requires manual review',
    descriptionHe: 'בעיה זו דורשת בדיקה ידנית',
    autoFixable: false,
    estimatedDuration: 0,
    riskLevel: 'high',
    targetPath: {
      collection: details.collection as string || 'courses',
      documentId: details.documentId as string || details.courseId as string || ''
    },
    requiresAI: false
  };
}

// ===== FIX EXECUTORS =====

/**
 * Execute a fix suggestion and return the result
 */
export async function executeFix(suggestion: FixSuggestion, userId?: string): Promise<FixResult> {
  const startTime = Date.now();

  try {
    let result: FixResult;

    switch (suggestion.fixType) {
      case 'regenerate_block':
        result = await executeRegenerateBlock(suggestion);
        break;

      case 'fix_options':
        result = await executeFixOptions(suggestion);
        break;

      case 'add_correct_answer':
        result = await executeAddCorrectAnswer(suggestion);
        break;

      case 'regenerate_content':
        result = await executeRegenerateContent(suggestion);
        break;

      case 'fix_structure':
        result = await executeFixStructure(suggestion);
        break;

      case 'add_missing_field':
        result = await executeAddMissingField(suggestion);
        break;

      case 'remove_invalid':
        result = await executeRemoveInvalid(suggestion);
        break;

      case 'manual_review':
      default:
        result = {
          id: `result_${Date.now()}`,
          suggestionId: suggestion.id,
          status: 'skipped',
          appliedAt: new Date(),
          appliedBy: userId,
          errorMessage: 'Manual review required - cannot auto-fix'
        };
    }

    result.appliedBy = userId;
    return result;

  } catch (error: any) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      appliedBy: userId,
      errorMessage: error.message || 'Unknown error during fix execution'
    };
  }
}

async function executeRegenerateBlock(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath, aiPrompt } = suggestion;

  // Get current block data
  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let blockFound = false;
  let previousValue: unknown;
  let newValue: unknown;

  // Find and update the block
  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.map(block => {
      if (block.id === targetPath.blockId) {
        blockFound = true;
        previousValue = { ...block };

        // Regenerate based on block type
        // For now, mark as needing regeneration
        const updatedBlock = {
          ...block,
          content: {
            ...block.content,
            _needsRegeneration: true,
            _regenerationPrompt: aiPrompt
          }
        };
        newValue = updatedBlock;
        return updatedBlock;
      }
      return block;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!blockFound) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Block not found in course'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    previousValue,
    newValue
  };
}

async function executeFixOptions(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath } = suggestion;

  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let previousValue: unknown;
  let newValue: unknown;
  let updated = false;

  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.map(block => {
      if (block.id === targetPath.blockId && block.type === 'multiple-choice') {
        previousValue = block.content?.options;

        // Ensure at least 4 options
        const currentOptions = block.content?.options || [];
        const question = block.content?.question || '';

        if (currentOptions.length < 4) {
          // Add placeholder options that need AI regeneration
          const newOptions = [...currentOptions];
          while (newOptions.length < 4) {
            newOptions.push({
              id: `opt_${Date.now()}_${newOptions.length}`,
              text: `[דורש יצירה מחדש - אפשרות ${newOptions.length + 1}]`,
              isCorrect: false
            });
          }

          // Ensure at least one is correct
          if (!newOptions.some(opt => opt.isCorrect)) {
            newOptions[0].isCorrect = true;
          }

          newValue = newOptions;
          updated = true;

          return {
            ...block,
            content: {
              ...block.content,
              options: newOptions
            }
          };
        }
      }
      return block;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!updated) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'skipped',
      appliedAt: new Date(),
      errorMessage: 'Block not found or already has enough options'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    previousValue,
    newValue
  };
}

async function executeAddCorrectAnswer(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath } = suggestion;

  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let previousValue: unknown;
  let newValue: unknown;
  let updated = false;

  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.map(block => {
      if (block.id === targetPath.blockId && block.type === 'multiple-choice') {
        const options = block.content?.options || [];
        previousValue = options.map((o: any) => ({ ...o }));

        // Mark first option as correct if none are correct
        if (!options.some((opt: any) => opt.isCorrect)) {
          const newOptions = options.map((opt: any, idx: number) => ({
            ...opt,
            isCorrect: idx === 0
          }));
          newValue = newOptions;
          updated = true;

          return {
            ...block,
            content: {
              ...block.content,
              options: newOptions
            }
          };
        }
      }
      return block;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!updated) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'skipped',
      appliedAt: new Date(),
      errorMessage: 'Block not found or already has correct answer'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    previousValue,
    newValue
  };
}

async function executeRegenerateContent(suggestion: FixSuggestion): Promise<FixResult> {
  // Similar to regenerate block but for specific content field
  return executeRegenerateBlock(suggestion);
}

async function executeFixStructure(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath } = suggestion;

  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let previousValue: unknown;
  let newValue: unknown;
  let updated = false;

  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.map(block => {
      if (block.id === targetPath.blockId) {
        previousValue = { ...block };

        // Ensure required fields exist based on block type
        const fixedBlock = ensureBlockStructure(block);
        newValue = fixedBlock;
        updated = true;

        return fixedBlock;
      }
      return block;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!updated) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'skipped',
      appliedAt: new Date(),
      errorMessage: 'Block not found'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    previousValue,
    newValue
  };
}

function ensureBlockStructure(block: ActivityBlock): ActivityBlock {
  const content = block.content || {};

  switch (block.type) {
    case 'multiple-choice':
      return {
        ...block,
        content: {
          question: content.question || '[שאלה חסרה]',
          options: content.options || [],
          feedback: content.feedback || { correct: 'נכון!', incorrect: 'לא נכון, נסה שוב' },
          ...content
        }
      };

    case 'open-question':
      return {
        ...block,
        content: {
          question: content.question || '[שאלה חסרה]',
          sampleAnswer: content.sampleAnswer || '',
          rubric: content.rubric || [],
          ...content
        }
      };

    case 'fill-in-blanks':
      return {
        ...block,
        content: {
          text: content.text || '[טקסט חסר]',
          blanks: content.blanks || [],
          ...content
        }
      };

    default:
      return block;
  }
}

async function executeAddMissingField(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath } = suggestion;
  const fieldName = targetPath.field?.split('.').pop() || '';

  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let updated = false;
  let newValue: unknown;

  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.map(block => {
      if (block.id === targetPath.blockId) {
        const content = block.content || {};

        // Add default value for missing field
        let defaultValue: unknown;
        switch (fieldName) {
          case 'feedback':
            defaultValue = { correct: 'כל הכבוד!', incorrect: 'נסה שוב' };
            break;
          case 'hint':
            defaultValue = 'חשוב על התשובה שוב';
            break;
          default:
            defaultValue = '';
        }

        newValue = defaultValue;
        updated = true;

        return {
          ...block,
          content: {
            ...content,
            [fieldName]: defaultValue
          }
        };
      }
      return block;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!updated) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'skipped',
      appliedAt: new Date(),
      errorMessage: 'Block not found'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    newValue
  };
}

async function executeRemoveInvalid(suggestion: FixSuggestion): Promise<FixResult> {
  const { targetPath } = suggestion;

  const courseRef = doc(db, 'courses', targetPath.documentId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'failed',
      appliedAt: new Date(),
      errorMessage: 'Course not found'
    };
  }

  const course = courseSnap.data() as Course;
  let previousValue: unknown;
  let removed = false;

  const updatedUnits = course.units?.map(unit => {
    const updatedBlocks = unit.activityBlocks?.filter(block => {
      if (block.id === targetPath.blockId) {
        previousValue = block;
        removed = true;
        return false; // Remove this block
      }
      return true;
    });
    return { ...unit, activityBlocks: updatedBlocks };
  });

  if (!removed) {
    return {
      id: `result_${Date.now()}`,
      suggestionId: suggestion.id,
      status: 'skipped',
      appliedAt: new Date(),
      errorMessage: 'Block not found'
    };
  }

  await updateDoc(courseRef, { units: updatedUnits });

  return {
    id: `result_${Date.now()}`,
    suggestionId: suggestion.id,
    status: 'success',
    appliedAt: new Date(),
    previousValue
  };
}

// ===== BATCH FIX EXECUTION =====

/**
 * Execute multiple fixes and return results
 */
export async function executeFixBatch(
  suggestions: FixSuggestion[],
  userId?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<FixResult[]> {
  const results: FixResult[] = [];
  const autoFixable = suggestions.filter(s => s.autoFixable);

  for (let i = 0; i < autoFixable.length; i++) {
    const suggestion = autoFixable[i];
    const result = await executeFix(suggestion, userId);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, autoFixable.length);
    }

    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// ===== ENHANCE TEST RESULTS WITH FIX SUGGESTIONS =====

/**
 * Add fix suggestions to test results
 */
export function enhanceTestResultsWithFixes(testResults: TestResult[]): TestResultWithFix[] {
  return testResults.map(result => {
    if (result.status === 'failed' || result.status === 'warning') {
      const fixSuggestions = generateFixSuggestions(result);
      return {
        ...result,
        fixSuggestions,
        canAutoFix: fixSuggestions.some(s => s.autoFixable)
      };
    }
    return {
      ...result,
      fixSuggestions: [],
      canAutoFix: false
    };
  });
}

// ===== REVALIDATION =====

/**
 * Revalidate a specific test after applying a fix
 */
export async function revalidateAfterFix(
  suggestion: FixSuggestion,
  originalTest: TestResult
): Promise<TestResult> {
  // This would re-run the specific validation that created the original test
  // For now, return a placeholder that indicates revalidation is needed

  return {
    ...originalTest,
    id: `revalidate_${Date.now()}`,
    status: 'running',
    message: 'Revalidation in progress...',
    messageHe: 'מתבצעת בדיקה מחדש...',
    timestamp: new Date()
  };
}
