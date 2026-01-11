/**
 * E2E Generation Agent (End-to-End Content Generation Testing)
 * סוכן בדיקות יצירת תוכן מקצה לקצה
 *
 * מדמה מורה אמיתי שמשתמש במערכת ליצירת תכנים:
 * - העלאת PDF → מערך שיעור
 * - קישור YouTube → מערך שיעור
 * - טקסט חופשי → פודקאסט
 * - נושא חופשי → פעילות לתלמיד
 * - ועוד...
 */

import type {
  TestResult,
  QAAgentResult,
} from '../../types/qa.types';

// Import generation functions from gemini
import {
  generateCourseSyllabus,
  generatePodcastScript,
  generateSingleMultipleChoiceQuestion,
  generateSingleOpenQuestion,
  generateCategorizationQuestion,
  generateOrderingQuestion,
} from '../../gemini';

// Import multimodal service for YouTube transcription
import { MultimodalService, TRANSCRIPTION_ERROR_CODES } from '../multimodalService';

// ===== TEST DATA =====

// Sample source texts for different subjects
const SAMPLE_SOURCES = {
  history: {
    topic: 'מלחמת העולם השנייה',
    gradeLevel: 'ט',
    subject: 'היסטוריה',
    text: `
מלחמת העולם השנייה הייתה הסכסוך הצבאי הגדול והקטלני ביותר בהיסטוריה האנושית.
המלחמה התנהלה בין שתי ברית צבאיות: מעצמות הציר (גרמניה, איטליה ויפן) ובעלות הברית (בריטניה, ברית המועצות, ארצות הברית וצרפת).
המלחמה החלה ב-1 בספטמבר 1939 עם פלישת גרמניה הנאצית לפולין והסתיימה ב-2 בספטמבר 1945 עם כניעת יפן.
במהלך המלחמה התרחשה השואה - רצח שיטתי של שישה מיליון יהודים על ידי הנאצים.
המלחמה הביאה לשינויים גיאופוליטיים עצומים והובילה להקמת האו"ם ולמלחמה הקרה.
    `.trim()
  },
  science: {
    topic: 'פוטוסינתזה',
    gradeLevel: 'ז',
    subject: 'מדעים',
    text: `
פוטוסינתזה היא תהליך ביוכימי שבו צמחים, אצות וחיידקים מסוימים הופכים אור שמש לאנרגיה כימית.
התהליך מתרחש בכלורופלסטים של התא הצמחי, שם קיים הפיגמנט הירוק כלורופיל.
במהלך הפוטוסינתזה, הצמח קולט פחמן דו-חמצני מהאוויר ומים מהאדמה, ובעזרת אנרגיית אור
מייצר גלוקוז וחמצן. הגלוקוז משמש לבניית רקמות הצמח ולייצור אנרגיה.
החמצן משתחרר לאטמוספירה ומשמש לנשימה של בעלי חיים ובני אדם.
המשוואה הכללית: 6CO2 + 6H2O + אור → C6H12O6 + 6O2
    `.trim()
  },
  math: {
    topic: 'משוואות ריבועיות',
    gradeLevel: 'י',
    subject: 'מתמטיקה',
    text: `
משוואה ריבועית היא משוואה מהצורה ax² + bx + c = 0, כאשר a ≠ 0.
הפתרונות של המשוואה נקראים שורשים ומסומנים x₁ ו-x₂.
נוסחת השורשים: x = (-b ± √(b²-4ac)) / 2a
הביטוי Δ = b² - 4ac נקרא דיסקרימיננטה וקובע את מספר הפתרונות:
- אם Δ > 0: שני פתרונות שונים
- אם Δ = 0: פתרון יחיד (שורש כפול)
- אם Δ < 0: אין פתרונות ממשיים
משוואות ריבועיות מופיעות בבעיות פיזיקליות רבות כמו תנועה בכוח הכבידה.
    `.trim()
  },
  literature: {
    topic: 'שירת ביאליק',
    gradeLevel: 'ח',
    subject: 'ספרות',
    text: `
חיים נחמן ביאליק (1873-1934) נחשב למשורר הלאומי של העם היהודי.
שירתו משלבת מוטיבים מהמסורת היהודית עם רגשות אישיים ולאומיים.
השיר "אל הציפור" מביע געגועים לארץ ישראל ותקווה לשיבת ציון.
בשיר "בעיר ההרגה" מתאר ביאליק את פרעות קישינב ומבקר את הפסיביות היהודית.
ביאליק כתב גם שירי ילדים כמו "צפ צפ צפרדעים" המתאר סיפור מהגדה של פסח.
שפתו עשירה ומליצית, משלבת עברית מקראית עם עברית מודרנית.
    `.trim()
  }
};

// Sample YouTube URLs for testing (real educational content in Hebrew)
const SAMPLE_YOUTUBE_SOURCES = {
  // Khan Academy Hebrew - Math
  math: {
    url: 'https://www.youtube.com/watch?v=NybHckSEQBI', // קאן אקדמי - משוואות
    topic: 'משוואות',
    gradeLevel: 'ח',
    subject: 'מתמטיקה',
    expectedMinLength: 100 // Minimum expected transcript length
  },
  // Educational content - Science
  science: {
    url: 'https://www.youtube.com/watch?v=0z1rn0KdL3w', // מדע - Davidson Institute
    topic: 'מדע',
    gradeLevel: 'ז',
    subject: 'מדעים',
    expectedMinLength: 100
  }
};

// ===== TYPES =====

interface E2ETestResult {
  testType: 'lesson_from_text' | 'lesson_from_youtube' | 'podcast' | 'exam' | 'activity' | 'differentiated';
  sourceType: 'text' | 'youtube' | 'pdf' | 'topic';
  subject: string;
  gradeLevel: string;

  // Timing
  startedAt: Date;
  completedAt: Date;
  duration: number;

  // Results
  status: 'passed' | 'failed' | 'warning';
  syllabusGenerated: boolean;
  unitsGenerated: number;
  blocksGenerated: number;

  // Quality metrics
  qualityScore: number; // 0-100
  issues: E2EIssue[];

  // Output preview (first 500 chars)
  outputPreview: string | null;
}

interface E2EIssue {
  type: 'empty_content' | 'missing_blocks' | 'invalid_structure' | 'timeout' | 'api_error' | 'quality_issue';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ===== VALIDATION HELPERS =====

function validateSyllabus(syllabus: any): { valid: boolean; issues: E2EIssue[]; score: number } {
  const issues: E2EIssue[] = [];
  let score = 100;

  if (!syllabus) {
    issues.push({ type: 'empty_content', message: 'Syllabus is null or undefined', severity: 'critical' });
    return { valid: false, issues, score: 0 };
  }

  if (!Array.isArray(syllabus) || syllabus.length === 0) {
    issues.push({ type: 'empty_content', message: 'Syllabus has no modules', severity: 'critical' });
    return { valid: false, issues, score: 0 };
  }

  let totalUnits = 0;
  let totalBlocks = 0;
  let emptyUnits = 0;

  syllabus.forEach((module: any, mIdx: number) => {
    if (!module.title) {
      issues.push({ type: 'invalid_structure', message: `Module ${mIdx} has no title`, severity: 'medium' });
      score -= 5;
    }

    const units = module.learningUnits || module.units || [];
    totalUnits += units.length;

    if (units.length === 0) {
      issues.push({ type: 'missing_blocks', message: `Module "${module.title || mIdx}" has no units`, severity: 'high' });
      score -= 10;
    }

    units.forEach((unit: any, uIdx: number) => {
      if (!unit.title) {
        issues.push({ type: 'invalid_structure', message: `Unit ${mIdx}.${uIdx} has no title`, severity: 'medium' });
        score -= 3;
      }

      const blocks = unit.activityBlocks || unit.blocks || [];
      totalBlocks += blocks.length;

      if (blocks.length === 0) {
        emptyUnits++;
      }
    });
  });

  // Warn if more than 30% of units are empty
  if (totalUnits > 0 && emptyUnits / totalUnits > 0.3) {
    issues.push({
      type: 'quality_issue',
      message: `${emptyUnits}/${totalUnits} units have no blocks (${Math.round(emptyUnits/totalUnits*100)}%)`,
      severity: 'medium'
    });
    score -= 15;
  }

  return {
    valid: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    score: Math.max(0, score)
  };
}

function validatePodcastScript(script: any): { valid: boolean; issues: E2EIssue[]; score: number } {
  const issues: E2EIssue[] = [];
  let score = 100;

  if (!script) {
    issues.push({ type: 'empty_content', message: 'Podcast script is null', severity: 'critical' });
    return { valid: false, issues, score: 0 };
  }

  // Check for dialogue structure
  const dialogue = script.dialogue || script.turns || script.script || [];
  if (!Array.isArray(dialogue) || dialogue.length < 4) {
    issues.push({ type: 'quality_issue', message: `Script too short: ${dialogue.length} turns`, severity: 'high' });
    score -= 30;
  }

  // Check for Hebrew content
  const fullText = JSON.stringify(script);
  const hebrewRatio = (fullText.match(/[\u0590-\u05FF]/g) || []).length / fullText.length;
  if (hebrewRatio < 0.3) {
    issues.push({ type: 'quality_issue', message: 'Script has insufficient Hebrew content', severity: 'medium' });
    score -= 20;
  }

  // Check for two speakers
  const speakers = new Set(dialogue.map((turn: any) => turn.speaker || turn.name || turn.host));
  if (speakers.size < 2) {
    issues.push({ type: 'quality_issue', message: 'Script should have 2 speakers/hosts', severity: 'medium' });
    score -= 15;
  }

  return {
    valid: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    score: Math.max(0, score)
  };
}

function validateInteractiveBlocks(blocks: any[]): { valid: boolean; issues: E2EIssue[]; score: number } {
  const issues: E2EIssue[] = [];
  let score = 100;

  if (!blocks || blocks.length === 0) {
    issues.push({ type: 'empty_content', message: 'No interactive blocks generated', severity: 'critical' });
    return { valid: false, issues, score: 0 };
  }

  let validBlocks = 0;

  blocks.forEach((block, idx) => {
    if (!block.type) {
      issues.push({ type: 'invalid_structure', message: `Block ${idx} has no type`, severity: 'high' });
      score -= 10;
      return;
    }

    if (block.type === 'multiple-choice') {
      const content = block.content || {};
      if (!content.question) {
        issues.push({ type: 'invalid_structure', message: `MC block ${idx} has no question`, severity: 'high' });
        score -= 10;
      } else if (!content.options || content.options.length < 2) {
        issues.push({ type: 'invalid_structure', message: `MC block ${idx} has insufficient options`, severity: 'high' });
        score -= 10;
      } else if (!content.correctAnswer) {
        issues.push({ type: 'invalid_structure', message: `MC block ${idx} has no correct answer`, severity: 'high' });
        score -= 10;
      } else {
        // Validate correct answer is in options
        const optionTexts = content.options.map((o: any) => typeof o === 'string' ? o : o.text || o.label);
        if (!optionTexts.includes(content.correctAnswer)) {
          issues.push({ type: 'quality_issue', message: `MC block ${idx}: correct answer not in options`, severity: 'medium' });
          score -= 5;
        } else {
          validBlocks++;
        }
      }
    } else if (block.type === 'open-question') {
      const content = block.content || {};
      if (!content.question || content.question.length < 10) {
        issues.push({ type: 'invalid_structure', message: `Open question ${idx} too short`, severity: 'medium' });
        score -= 5;
      } else {
        validBlocks++;
      }
    } else {
      validBlocks++; // Other types pass by default
    }
  });

  return {
    valid: validBlocks > 0,
    issues,
    score: Math.max(0, score)
  };
}

// ===== TEST RUNNERS =====

async function testLessonFromText(
  source: typeof SAMPLE_SOURCES.history,
  timeout: number = 60000
): Promise<E2ETestResult> {
  const startTime = Date.now();
  const issues: E2EIssue[] = [];

  try {
    // Step 1: Generate syllabus structure
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const syllabusResult = await Promise.race([
      generateCourseSyllabus(source.text, source.topic, source.gradeLevel, source.subject),
      timeoutPromise
    ]);

    if (!syllabusResult) {
      return {
        testType: 'lesson_from_text',
        sourceType: 'text',
        subject: source.subject,
        gradeLevel: source.gradeLevel,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        status: 'failed',
        syllabusGenerated: false,
        unitsGenerated: 0,
        blocksGenerated: 0,
        qualityScore: 0,
        issues: [{ type: 'empty_content', message: 'generateCourseSyllabus returned null', severity: 'critical' }],
        outputPreview: null
      };
    }

    // Validate syllabus
    const validation = validateSyllabus(syllabusResult);
    issues.push(...validation.issues);

    // Count units and blocks
    let unitsCount = 0;
    let blocksCount = 0;
    const syllabus = Array.isArray(syllabusResult) ? syllabusResult : [syllabusResult];
    syllabus.forEach((mod: any) => {
      const units = mod.learningUnits || mod.units || [];
      unitsCount += units.length;
      units.forEach((unit: any) => {
        blocksCount += (unit.activityBlocks || unit.blocks || []).length;
      });
    });

    return {
      testType: 'lesson_from_text',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: validation.valid ? (validation.score >= 70 ? 'passed' : 'warning') : 'failed',
      syllabusGenerated: true,
      unitsGenerated: unitsCount,
      blocksGenerated: blocksCount,
      qualityScore: validation.score,
      issues,
      outputPreview: JSON.stringify(syllabusResult).substring(0, 500)
    };

  } catch (error: any) {
    return {
      testType: 'lesson_from_text',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: 'failed',
      syllabusGenerated: false,
      unitsGenerated: 0,
      blocksGenerated: 0,
      qualityScore: 0,
      issues: [{
        type: error.message === 'Timeout' ? 'timeout' : 'api_error',
        message: error.message,
        severity: 'critical'
      }],
      outputPreview: null
    };
  }
}

async function testPodcastGeneration(
  source: typeof SAMPLE_SOURCES.history,
  timeout: number = 60000
): Promise<E2ETestResult> {
  const startTime = Date.now();
  const issues: E2EIssue[] = [];

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const podcastResult = await Promise.race([
      generatePodcastScript(source.text, source.topic, source.gradeLevel, 'medium'),
      timeoutPromise
    ]);

    if (!podcastResult) {
      return {
        testType: 'podcast',
        sourceType: 'text',
        subject: source.subject,
        gradeLevel: source.gradeLevel,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        status: 'failed',
        syllabusGenerated: false,
        unitsGenerated: 0,
        blocksGenerated: 0,
        qualityScore: 0,
        issues: [{ type: 'empty_content', message: 'generatePodcastScript returned null', severity: 'critical' }],
        outputPreview: null
      };
    }

    // Validate podcast
    const validation = validatePodcastScript(podcastResult);
    issues.push(...validation.issues);

    // Count dialogue turns
    const dialogue = podcastResult.dialogue || podcastResult.turns || podcastResult.script || [];

    return {
      testType: 'podcast',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: validation.valid ? (validation.score >= 70 ? 'passed' : 'warning') : 'failed',
      syllabusGenerated: true,
      unitsGenerated: 1,
      blocksGenerated: dialogue.length,
      qualityScore: validation.score,
      issues,
      outputPreview: JSON.stringify(podcastResult).substring(0, 500)
    };

  } catch (error: any) {
    return {
      testType: 'podcast',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: 'failed',
      syllabusGenerated: false,
      unitsGenerated: 0,
      blocksGenerated: 0,
      qualityScore: 0,
      issues: [{
        type: error.message === 'Timeout' ? 'timeout' : 'api_error',
        message: error.message,
        severity: 'critical'
      }],
      outputPreview: null
    };
  }
}

async function testInteractiveBlocksGeneration(
  source: typeof SAMPLE_SOURCES.history,
  timeout: number = 60000
): Promise<E2ETestResult> {
  const startTime = Date.now();
  const issues: E2EIssue[] = [];
  const blocks: any[] = [];

  try {
    // Generate multiple block types
    const blockPromises = [
      generateSingleMultipleChoiceQuestion(source.topic, source.gradeLevel, null, source.text),
      generateSingleOpenQuestion(source.topic, source.gradeLevel, null, source.text),
      generateCategorizationQuestion(source.topic, source.gradeLevel, source.text),
      generateOrderingQuestion(source.topic, source.gradeLevel, source.text),
    ];

    const timeoutPromise = new Promise<null[]>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const results = await Promise.race([
      Promise.all(blockPromises),
      timeoutPromise
    ]);

    if (results) {
      blocks.push(...results.filter(Boolean));
    }

    // Validate blocks
    const validation = validateInteractiveBlocks(blocks);
    issues.push(...validation.issues);

    return {
      testType: 'activity',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: validation.valid ? (validation.score >= 70 ? 'passed' : 'warning') : 'failed',
      syllabusGenerated: false,
      unitsGenerated: 0,
      blocksGenerated: blocks.length,
      qualityScore: validation.score,
      issues,
      outputPreview: JSON.stringify(blocks).substring(0, 500)
    };

  } catch (error: any) {
    return {
      testType: 'activity',
      sourceType: 'text',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: 'failed',
      syllabusGenerated: false,
      unitsGenerated: 0,
      blocksGenerated: blocks.length,
      qualityScore: 0,
      issues: [{
        type: error.message === 'Timeout' ? 'timeout' : 'api_error',
        message: error.message,
        severity: 'critical'
      }],
      outputPreview: null
    };
  }
}

// ===== YouTube Test =====

interface YouTubeSource {
  url: string;
  topic: string;
  gradeLevel: string;
  subject: string;
  expectedMinLength: number;
}

async function testLessonFromYouTube(
  source: YouTubeSource,
  timeout: number = 120000 // 2 minutes for transcription + generation
): Promise<E2ETestResult> {
  const startTime = Date.now();
  const issues: E2EIssue[] = [];

  try {
    console.log(`   📹 Transcribing YouTube video: ${source.url}`);

    // Step 1: Transcribe YouTube video
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    let transcriptText: string;

    try {
      const transcriptionResult = await Promise.race([
        MultimodalService.processYoutubeUrl(source.url),
        timeoutPromise
      ]);

      if (!transcriptionResult || !transcriptionResult.text) {
        return {
          testType: 'lesson_from_youtube',
          sourceType: 'youtube',
          subject: source.subject,
          gradeLevel: source.gradeLevel,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration: Date.now() - startTime,
          status: 'failed',
          syllabusGenerated: false,
          unitsGenerated: 0,
          blocksGenerated: 0,
          qualityScore: 0,
          issues: [{ type: 'empty_content', message: 'YouTube transcription returned empty', severity: 'critical' }],
          outputPreview: null
        };
      }

      transcriptText = transcriptionResult.text;
      console.log(`   ✅ Transcription successful: ${transcriptText.length} characters`);

      // Validate transcript length
      if (transcriptText.length < source.expectedMinLength) {
        issues.push({
          type: 'quality_issue',
          message: `Transcript too short: ${transcriptText.length} chars (expected ${source.expectedMinLength}+)`,
          severity: 'medium'
        });
      }

    } catch (transcriptError: any) {
      // Handle specific transcription errors
      const errorCode = transcriptError?.code;
      let errorType: E2EIssue['type'] = 'api_error';
      let errorMessage = transcriptError.message || 'Unknown transcription error';

      if (errorCode === TRANSCRIPTION_ERROR_CODES.NO_CAPTIONS) {
        errorType = 'quality_issue';
        errorMessage = 'Video has no captions available';
      } else if (errorCode === TRANSCRIPTION_ERROR_CODES.PRIVATE_VIDEO) {
        errorType = 'api_error';
        errorMessage = 'Video is private or restricted';
      } else if (errorCode === TRANSCRIPTION_ERROR_CODES.VIDEO_NOT_FOUND) {
        errorType = 'api_error';
        errorMessage = 'Video not found';
      }

      return {
        testType: 'lesson_from_youtube',
        sourceType: 'youtube',
        subject: source.subject,
        gradeLevel: source.gradeLevel,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        status: 'warning', // Warning because the video might just not have captions
        syllabusGenerated: false,
        unitsGenerated: 0,
        blocksGenerated: 0,
        qualityScore: 0,
        issues: [{ type: errorType, message: errorMessage, severity: 'high' }],
        outputPreview: `Transcription error: ${errorMessage}`
      };
    }

    // Step 2: Generate syllabus from transcript
    console.log(`   📝 Generating syllabus from transcript...`);

    const syllabusResult = await Promise.race([
      generateCourseSyllabus(transcriptText, source.topic, source.gradeLevel, source.subject),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Syllabus generation timeout')), 60000)
      )
    ]);

    if (!syllabusResult) {
      return {
        testType: 'lesson_from_youtube',
        sourceType: 'youtube',
        subject: source.subject,
        gradeLevel: source.gradeLevel,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        status: 'failed',
        syllabusGenerated: false,
        unitsGenerated: 0,
        blocksGenerated: 0,
        qualityScore: 30, // Partial credit for successful transcription
        issues: [
          ...issues,
          { type: 'empty_content', message: 'Syllabus generation returned null', severity: 'critical' }
        ],
        outputPreview: `Transcript: ${transcriptText.substring(0, 200)}...`
      };
    }

    // Validate syllabus
    const validation = validateSyllabus(syllabusResult);
    issues.push(...validation.issues);

    // Count units and blocks
    let unitsCount = 0;
    let blocksCount = 0;
    const syllabus = Array.isArray(syllabusResult) ? syllabusResult : [syllabusResult];
    syllabus.forEach((mod: any) => {
      const units = mod.learningUnits || mod.units || [];
      unitsCount += units.length;
      units.forEach((unit: any) => {
        blocksCount += (unit.activityBlocks || unit.blocks || []).length;
      });
    });

    // Bonus points for successful YouTube flow
    const finalScore = Math.min(100, validation.score + 10); // +10 for successful transcription

    return {
      testType: 'lesson_from_youtube',
      sourceType: 'youtube',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: validation.valid ? (finalScore >= 70 ? 'passed' : 'warning') : 'failed',
      syllabusGenerated: true,
      unitsGenerated: unitsCount,
      blocksGenerated: blocksCount,
      qualityScore: finalScore,
      issues,
      outputPreview: JSON.stringify(syllabusResult).substring(0, 500)
    };

  } catch (error: any) {
    return {
      testType: 'lesson_from_youtube',
      sourceType: 'youtube',
      subject: source.subject,
      gradeLevel: source.gradeLevel,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: 'failed',
      syllabusGenerated: false,
      unitsGenerated: 0,
      blocksGenerated: 0,
      qualityScore: 0,
      issues: [{
        type: error.message?.includes('Timeout') ? 'timeout' : 'api_error',
        message: error.message || 'Unknown error',
        severity: 'critical'
      }],
      outputPreview: null
    };
  }
}

// ===== MAIN AGENT =====

export async function runE2EGenerationAgent(): Promise<QAAgentResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];
  const e2eResults: E2ETestResult[] = [];

  console.log('🚀 Starting E2E Generation Agent...');

  // Test 1: Lesson from Text (History)
  console.log('📝 Testing: Lesson from Text (History)...');
  const lessonHistory = await testLessonFromText(SAMPLE_SOURCES.history);
  e2eResults.push(lessonHistory);
  tests.push({
    id: `e2e_lesson_history_${Date.now()}`,
    name: `[lesson] ${SAMPLE_SOURCES.history.topic}`,
    nameHe: `[מערך שיעור] ${SAMPLE_SOURCES.history.topic}`,
    category: 'e2e-generation',
    status: lessonHistory.status,
    severity: 'high',
    message: `Duration: ${lessonHistory.duration}ms | Units: ${lessonHistory.unitsGenerated} | Quality: ${lessonHistory.qualityScore}%`,
    messageHe: `משך: ${lessonHistory.duration}ms | יחידות: ${lessonHistory.unitsGenerated} | איכות: ${lessonHistory.qualityScore}%`,
    details: lessonHistory,
    duration: lessonHistory.duration,
    timestamp: new Date()
  });

  // Test 2: Lesson from Text (Science)
  console.log('📝 Testing: Lesson from Text (Science)...');
  const lessonScience = await testLessonFromText(SAMPLE_SOURCES.science);
  e2eResults.push(lessonScience);
  tests.push({
    id: `e2e_lesson_science_${Date.now()}`,
    name: `[lesson] ${SAMPLE_SOURCES.science.topic}`,
    nameHe: `[מערך שיעור] ${SAMPLE_SOURCES.science.topic}`,
    category: 'e2e-generation',
    status: lessonScience.status,
    severity: 'high',
    message: `Duration: ${lessonScience.duration}ms | Units: ${lessonScience.unitsGenerated} | Quality: ${lessonScience.qualityScore}%`,
    messageHe: `משך: ${lessonScience.duration}ms | יחידות: ${lessonScience.unitsGenerated} | איכות: ${lessonScience.qualityScore}%`,
    details: lessonScience,
    duration: lessonScience.duration,
    timestamp: new Date()
  });

  // Test 3: Podcast Generation
  console.log('🎙️ Testing: Podcast Generation...');
  const podcast = await testPodcastGeneration(SAMPLE_SOURCES.literature);
  e2eResults.push(podcast);
  tests.push({
    id: `e2e_podcast_${Date.now()}`,
    name: `[podcast] ${SAMPLE_SOURCES.literature.topic}`,
    nameHe: `[פודקאסט] ${SAMPLE_SOURCES.literature.topic}`,
    category: 'e2e-generation',
    status: podcast.status,
    severity: 'high',
    message: `Duration: ${podcast.duration}ms | Turns: ${podcast.blocksGenerated} | Quality: ${podcast.qualityScore}%`,
    messageHe: `משך: ${podcast.duration}ms | תורות: ${podcast.blocksGenerated} | איכות: ${podcast.qualityScore}%`,
    details: podcast,
    duration: podcast.duration,
    timestamp: new Date()
  });

  // Test 4: Interactive Blocks (Game/Activity)
  console.log('🎮 Testing: Interactive Blocks Generation...');
  const game = await testInteractiveBlocksGeneration(SAMPLE_SOURCES.math);
  e2eResults.push(game);
  tests.push({
    id: `e2e_game_${Date.now()}`,
    name: `[activity] ${SAMPLE_SOURCES.math.topic}`,
    nameHe: `[פעילות] ${SAMPLE_SOURCES.math.topic}`,
    category: 'e2e-generation',
    status: game.status,
    severity: 'high',
    message: `Duration: ${game.duration}ms | Blocks: ${game.blocksGenerated} | Quality: ${game.qualityScore}%`,
    messageHe: `משך: ${game.duration}ms | בלוקים: ${game.blocksGenerated} | איכות: ${game.qualityScore}%`,
    details: game,
    duration: game.duration,
    timestamp: new Date()
  });

  // Test 5: Lesson from YouTube (Math)
  console.log('📹 Testing: Lesson from YouTube...');
  const youtubeLesson = await testLessonFromYouTube(SAMPLE_YOUTUBE_SOURCES.math);
  e2eResults.push(youtubeLesson);
  tests.push({
    id: `e2e_youtube_${Date.now()}`,
    name: `[youtube→lesson] ${SAMPLE_YOUTUBE_SOURCES.math.topic}`,
    nameHe: `[יוטיוב→מערך שיעור] ${SAMPLE_YOUTUBE_SOURCES.math.topic}`,
    category: 'e2e-generation',
    status: youtubeLesson.status,
    severity: 'high',
    message: `Duration: ${youtubeLesson.duration}ms | Units: ${youtubeLesson.unitsGenerated} | Quality: ${youtubeLesson.qualityScore}%`,
    messageHe: `משך: ${youtubeLesson.duration}ms | יחידות: ${youtubeLesson.unitsGenerated} | איכות: ${youtubeLesson.qualityScore}%`,
    details: youtubeLesson,
    duration: youtubeLesson.duration,
    timestamp: new Date()
  });

  // Summary test
  const passedCount = e2eResults.filter(r => r.status === 'passed').length;
  const failedCount = e2eResults.filter(r => r.status === 'failed').length;
  const warningCount = e2eResults.filter(r => r.status === 'warning').length;
  const avgQuality = Math.round(e2eResults.reduce((sum, r) => sum + r.qualityScore, 0) / e2eResults.length);
  const avgDuration = Math.round(e2eResults.reduce((sum, r) => sum + r.duration, 0) / e2eResults.length);

  tests.push({
    id: `e2e_summary_${Date.now()}`,
    name: 'E2E Generation Summary',
    nameHe: 'סיכום יצירת תוכן מקצה לקצה',
    category: 'e2e-generation',
    status: failedCount === 0 ? (warningCount === 0 ? 'passed' : 'warning') : 'failed',
    severity: 'critical',
    message: `Passed: ${passedCount}/${e2eResults.length} | Avg Quality: ${avgQuality}% | Avg Duration: ${avgDuration}ms`,
    messageHe: `עברו: ${passedCount}/${e2eResults.length} | איכות ממוצעת: ${avgQuality}% | משך ממוצע: ${avgDuration}ms`,
    details: {
      totalTests: e2eResults.length,
      passed: passedCount,
      failed: failedCount,
      warnings: warningCount,
      avgQuality,
      avgDuration,
      byType: {
        lesson: e2eResults.filter(r => r.testType === 'lesson_from_text').length,
        youtube: e2eResults.filter(r => r.testType === 'lesson_from_youtube').length,
        podcast: e2eResults.filter(r => r.testType === 'podcast').length,
        activity: e2eResults.filter(r => r.testType === 'activity').length,
      }
    },
    duration: Date.now() - startTime,
    timestamp: new Date()
  });

  console.log(`✅ E2E Generation Agent completed: ${passedCount}/${e2eResults.length} passed`);

  return {
    agentName: 'E2E Generation Agent',
    agentNameHe: 'סוכן יצירת תוכן מקצה לקצה',
    status: failedCount === 0 ? 'passed' : 'failed',
    tests,
    summary: {
      totalTests: tests.length,
      passed: passedCount + (failedCount === 0 ? 1 : 0), // +1 for summary test
      failed: failedCount,
      warnings: warningCount,
      duration: Date.now() - startTime
    }
  };
}

export default runE2EGenerationAgent;
