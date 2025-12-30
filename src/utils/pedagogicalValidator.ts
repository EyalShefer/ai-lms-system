
import type { ActivityBlock } from '../courseTypes';

export interface ComplianceRule {
    id: string;
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
    scoreImpact: number; // How much this deducts from 100
}

export interface AuditResult {
    score: number;
    rules: ComplianceRule[];
    blockId: string;
}

/**
 * Client-Side Pedagogical Validator (The "Wizdi-Monitor")
 * 
 * Analyzes a rendered block against PROJECT_DNA.md standards in real-time.
 */
export const validateBlock = (block: ActivityBlock, mode: 'learning' | 'exam', blockIndex: number = 1): AuditResult => {
    const rules: ComplianceRule[] = [];
    let score = 100;

    // --- 1. PROMPT / QUESTION TEXT ---
    if (!block.content) {
        rules.push({ id: 'struct-content', name: 'Struct: No Content', status: 'FAIL', message: 'Block has no content object', scoreImpact: 100 });
        return { score: 0, rules, blockId: block.id };
    }

    // Check for "Wall of Text" (approximated by length without interaction)
    // For 'text' blocks, we just check length.
    if (block.type === 'text') {
        if (mode === 'exam') {
            // EXEMPTION: First block (Introduction) is allowed to be text.
            if (blockIndex === 0) {
                rules.push({ id: 'exam-intro', name: 'Exam: Introduction', status: 'PASS', message: 'Introduction text allowed.', scoreImpact: 0 });
            } else {
                rules.push({ id: 'exam-ban-text', name: 'Exam Security: Teaching Content', status: 'FAIL', message: 'Teaching blocks are FORBIDDEN in Exam Mode (except introduction).', scoreImpact: 100 });
                return { score: 0, rules, blockId: block.id };
            }
        }

        const textLen = typeof block.content === 'string' ? block.content.length : 0;
        if (textLen > 1000) {
            rules.push({ id: 'ped-text-wall', name: 'Pedagogy: Wall of Text', status: 'WARNING', message: `Text chunk is very long (${textLen} chars). Consider splitting.`, scoreImpact: 10 });
        } else {
            rules.push({ id: 'ped-text-wall', name: 'Pedagogy: Text Length', status: 'PASS', message: 'Text length is appropriate', scoreImpact: 0 });
        }
        return { score: Math.max(0, score - rules.reduce((sum, r) => sum + (r.status !== 'PASS' ? r.scoreImpact : 0), 0)), rules, blockId: block.id };
    }

    const questionText = typeof block.content === 'object' ? (block.content as any).question || (block.content as any).instruction || '' : '';
    if (!questionText || questionText.length < 5) {
        rules.push({ id: 'struct-question', name: 'Struct: Missing Question', status: 'FAIL', message: 'Question text is missing or too short', scoreImpact: 20 });
    } else {
        rules.push({ id: 'struct-question', name: 'Struct: Question Text', status: 'PASS', message: 'Question text exists', scoreImpact: 0 });
    }

    // --- 2. OPTIONS / INTERACTION DATA ---
    if (block.type === 'multiple-choice') {
        const opts = (block.content as any).options || [];
        if (opts.length < 2) {
            rules.push({ id: 'struct-options', name: 'Struct: Min Options', status: 'FAIL', message: `Found only ${opts.length} options. Need at least 2.`, scoreImpact: 20 });
        } else {
            rules.push({ id: 'struct-options', name: 'Struct: Options Count', status: 'PASS', message: `Found ${opts.length} options`, scoreImpact: 0 });
        }
    }

    // --- 3. PEDAGOGICAL SCAFFOLDING (HINTS) ---
    const hints = block.metadata?.progressiveHints || [];
    if (mode === 'learning') {
        if (hints.length === 0) {
            rules.push({ id: 'ped-hints-learning', name: 'Pedagogy: Missing Hints', status: 'FAIL', message: 'Learning Mode requires Progressive Hints (none found).', scoreImpact: 15 });
        } else if (hints.length < 2) {
            rules.push({ id: 'ped-hints-count', name: 'Pedagogy: Few Hints', status: 'WARNING', message: `Found ${hints.length} hints. Recommended: 2-3.`, scoreImpact: 5 });
        } else {
            rules.push({ id: 'ped-hints', name: 'Pedagogy: Hints', status: 'PASS', message: `${hints.length} hints available`, scoreImpact: 0 });
        }
    } else if (mode === 'exam') {
        if (hints.length > 0) {
            rules.push({ id: 'security-hints-exam', name: 'Security: Hints in Exam', status: 'FAIL', message: `Exam Mode found ${hints.length} hints. MUST be empty.`, scoreImpact: 30 });
        } else {
            rules.push({ id: 'security-hints', name: 'Security: No Hints', status: 'PASS', message: 'No hints present (Correct for Exam)', scoreImpact: 0 });
        }
    }

    // --- 4. FEEDBACK ---
    const hasFeedback = block.metadata?.feedbackCorrect || (block.content as any).feedback;
    const hasIncorrectFeedback = block.metadata?.feedbackIncorrect;

    if (mode === 'learning') {
        if (!hasFeedback && !hasIncorrectFeedback) {
            rules.push({ id: 'ped-feedback', name: 'Pedagogy: Score Feedback', status: 'FAIL', message: 'No feedback found for Learning Mode.', scoreImpact: 15 });
        } else {
            // Check for specificity (naive check)
            const fbText = (hasFeedback || '') + (hasIncorrectFeedback || '');
            if (fbText.includes('כל הכבוד') && fbText.length < 20) {
                rules.push({ id: 'ped-feedback-generic', name: 'Pedagogy: Generic Feedback', status: 'WARNING', message: 'Feedback seems generic ("כל הכבוד"). Add specific explanation.', scoreImpact: 5 });
            } else {
                rules.push({ id: 'ped-feedback-quality', name: 'Pedagogy: Feedback Quality', status: 'PASS', message: 'Feedback present', scoreImpact: 0 });
            }
        }
    } else if (mode === 'exam') {
        // In strict exam mode, feedback might be suppressed by UI, but existence in data isn't necessarily a violation 
        // UNLESS passing it reveals the answer in the HTML source? 
        // For now, we allow it in data but warn if it looks like "Teaching".
        const teachWords = ['review chapter', 'look at section', 'remember that'];
        const fbText = ((hasFeedback || '') + (hasIncorrectFeedback || '')).toLowerCase();
        if (teachWords.some(w => fbText.includes(w))) {
            rules.push({ id: 'security-feedback-leak', name: 'Security: Coaching Feedback', status: 'WARNING', message: 'Feedback contains coaching/teaching language in Exam Mode.', scoreImpact: 10 });
        }
    }

    // --- 5. GROUNDING (CITATIONS) ---
    // Check if citations exist in question or hints or content
    const allText = (questionText + hints.join(' ')).toLowerCase();
    // Very rough check for "[1]" or similar pattern
    const hasCitation = /\[\d+\]/.test(allText);
    if (mode === 'learning' || mode === 'exam') {
        if (!hasCitation) {
            rules.push({ id: 'ped-grounding', name: 'Pedagogy: Missing Citations', status: 'WARNING', message: 'No source citations ([1]) found in text.', scoreImpact: 5 });
        } else {
            rules.push({ id: 'ped-grounding', name: 'Pedagogy: Grounding', status: 'PASS', message: 'Content appears grounded (citations found).', scoreImpact: 0 });
        }
    }

    // --- 6. BLOOM'S TAXONOMY (Pedagogical Depth) ---
    const bloomLevel = block.metadata?.bloomLevel;
    if (bloomLevel) {
        rules.push({ id: 'ped-bloom', name: 'Pedagogy: Bloom Level', status: 'PASS', message: `Classified as: ${bloomLevel}`, scoreImpact: 0 });
    } else {
        rules.push({ id: 'ped-bloom', name: 'Pedagogy: Bloom Level', status: 'WARNING', message: 'No Bloom Level defined (Defaulting to Foundation)', scoreImpact: 5 });
    }

    // --- 7. LINGUISTIC AUDIT (AI METRICS) ---
    const aiVal = block.metadata?.aiValidation;
    if (aiVal) {
        rules.push({ id: 'ling-audit', name: 'Linguistic: Level', status: 'PASS', message: `Verified Level: ${aiVal.cefr_level} (Score: ${aiVal.readability_score})`, scoreImpact: 0 });
    } else {
        rules.push({ id: 'ling-audit-missing', name: 'Linguistic: Missing', status: 'WARNING', message: 'No linguistic audit data found.', scoreImpact: 5 });
    }

    // --- 8. EXAM MODE STRICT RULES ---
    if (mode === 'exam') {
        // A. THE TEACHING BAN


        // B. COGNITIVE LOAD CHECK
        const lowLevels = ['knowledge', 'comprehension', 'remember', 'understand'];
        if (bloomLevel && lowLevels.includes(bloomLevel.toLowerCase())) {
            rules.push({ id: 'exam-bloom-low', name: 'Exam Quality: Cognitive Load', status: 'WARNING', message: 'Exam contains low-level questions. Prefer Analysis/Evaluation.', scoreImpact: 10 });
        }

        // C. TONE AUDIT
        if (aiVal?.tone_audit && !['objective', 'neutral', 'examiner'].includes(aiVal.tone_audit.toLowerCase())) {
            rules.push({ id: 'exam-tone', name: 'Exam Tone: Subjective', status: 'WARNING', message: `Tone detected as '${aiVal.tone_audit}'. Exams must be Objective.`, scoreImpact: 5 });
        }
    }

    // Calculate Final Deductions
    const deduction = rules.reduce((sum, r) => sum + (r.status !== 'PASS' ? r.scoreImpact : 0), 0);
    score = Math.max(0, 100 - deduction);

    return { score, rules, blockId: block.id };
};

