export type LearningUnitType = 'acquisition' | 'practice' | 'test';

// סוגי הפעילויות האפשריים (כולל הצ'אט החדש והמשחקים)
export type ActivityBlockType =
    | 'text'
    | 'video'
    | 'image'
    | 'pdf'
    | 'multiple-choice'
    | 'open-question'
    | 'interactive-chat'
    | 'gem-link'
    // New Types
    | 'fill_in_blanks'
    | 'ordering'
    | 'categorization'
    | 'memory_game'
    | 'true_false_speed'
    | 'podcast'
    | 'audio-response'
    | 'drag_and_drop'
    | 'hotspot'
    | 'mindmap'
    | 'infographic'
    // New Interactive Question Types
    | 'matching'           // Connect items with lines
    | 'highlight'          // Circle/underline correct answers in text
    | 'sentence_builder'   // Build sentence from scrambled words
    | 'image_labeling'     // Drag labels onto image
    | 'table_completion'   // Fill in missing cells in table
    | 'text_selection'     // Select words/sentences from text
    | 'rating_scale'       // Rate on a scale (1-5, 1-10)
    | 'matrix'             // Matrix/grid with multiple rows and options
    // Activity-specific blocks
    | 'activity-intro'     // Context image for student activities (The Setting)
    | 'scenario-image'     // Scenario image within questions (The Dilemma)
    // Remotion video blocks
    | 'remotion-video';    // AI-generated animated videos

export interface MultipleChoiceContent {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface OpenQuestionContent {
    question: string;
}

export interface OrderingContent {
    instruction: string;
    correct_order: string[];
}

export interface CategorizationContent {
    question: string;
    categories: string[];
    items: { text: string; category: string }[];
}

export interface MemoryGameContent {
    pairs: { card_a: string; card_b: string }[];
    cardBackEmoji?: string;  // Emoji to show on card back (e.g., "🧠", "🏃")
    cardBackImage?: string;  // Image URL to show on card back
}

export interface DragAndDropContent {
    instruction: string;
    zones: { id: string; label: string; color?: string }[];
    items: { id: string; text: string; correctZone: string }[];
    feedback_correct?: string;
    feedback_incorrect?: string;
}

export interface HotspotContent {
    instruction: string;
    image_description?: string;
    image_prompt?: string;
    image_url?: string; // Populated after AI generation
    hotspots: {
        id: string;
        label: string;
        x: number; // Percentage
        y: number; // Percentage
        width: number;
        height: number;
        feedback: string;
    }[];
}

// --- New Question Type Content Interfaces ---

export interface MatchingContent {
    instruction: string;
    leftItems: { id: string; text: string }[];
    rightItems: { id: string; text: string }[];
    correctMatches: { left: string; right: string }[];
    hints?: string[];
}

export interface HighlightContent {
    instruction: string;
    text: string;
    correctHighlights: { start: number; end: number; text: string }[];
    highlightType: 'circle' | 'underline' | 'background';
    hints?: string[];
}

export interface SentenceBuilderContent {
    instruction: string;
    words: string[];
    correctSentence: string;
    hints?: string[];
}

export interface ImageLabelingContent {
    instruction: string;
    imageUrl: string;
    labels: { id: string; text: string }[];
    dropZones: { id: string; x: number; y: number; width?: number; height?: number; correctLabelId: string }[];
    hints?: string[];
}

export interface TableCompletionContent {
    instruction: string;
    headers: string[];
    rows: {
        cells: { value: string; editable: boolean; correctAnswer?: string }[];
    }[];
    hints?: string[];
}

export interface TextSelectionContent {
    instruction: string;
    text: string;
    selectableUnits: 'word' | 'sentence' | 'paragraph';
    correctSelections: string[];
    minSelections?: number;
    maxSelections?: number;
    hints?: string[];
}

export interface RatingScaleContent {
    question: string;
    minValue: number;
    maxValue: number;
    minLabel: string;
    maxLabel: string;
    correctAnswer?: number;
    showNumbers: boolean;
}

export interface MatrixContent {
    instruction: string;
    columns: string[];
    rows: { question: string; correctAnswer: string }[];
    hints?: string[];
}

// --- Mind Map Types ---
export interface MindMapNode {
    id: string;
    type: 'topic' | 'subtopic' | 'detail' | 'example';
    data: {
        label: string;
        description?: string;
        color?: string; // Hex color
        icon?: string; // Tabler icon name
    };
    position: { x: number; y: number };
    style?: Record<string, any>;
}

export interface MindMapEdge {
    id: string;
    source: string;
    target: string;
    type?: 'default' | 'smoothstep' | 'straight';
    animated?: boolean;
    label?: string;
    style?: Record<string, any>;
}

export interface MindMapContent {
    title: string;
    nodes: MindMapNode[];
    edges: MindMapEdge[];
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    };
    layoutDirection?: 'TB' | 'LR' | 'RL'; // Top-Bottom, Left-Right, Right-Left (RTL default)
}

export interface MindMapMetadata {
    generatedAt?: number;
    lastEditedAt?: number;
    sourceContentHash?: string; // For cache invalidation
    aiModel?: string;
}

// --- Activity Media Types ---
// For standalone student activities (context and scenario images)

export interface ActivityIntroContent {
    imageUrl: string;           // Generated or uploaded image URL
    title: string;              // Short title like "אתה המהנדס!"
    description?: string;       // Optional longer description
    imagePrompt?: string;       // The prompt used to generate (for regeneration)
}

export interface ScenarioImageContent {
    imageUrl: string;           // Generated or uploaded image URL
    caption?: string;           // What the student should notice
    imagePrompt?: string;       // The prompt used to generate
    relatedBlockId?: string;    // The question block this image relates to
}

// --- Remotion Video Types ---
export type RemotionCompositionType =
    | 'explainer'           // Animated concept explanations
    | 'math-visualization'  // Step-by-step math solutions
    | 'timeline'            // Historical/process timelines
    | 'lesson-summary'      // Lesson recap with achievements
    | 'quiz-intro'          // Quiz introduction
    // New composition types
    | 'assignment-steps'    // Visual step-by-step task instructions
    | 'objectives-intro'    // "What you'll learn today" animated opener
    | 'vocabulary'          // Animated term definitions with visuals
    | 'process-steps'       // Numbered steps animation (procedures, algorithms)
    | 'comparison';         // Side-by-side visual comparison

export type RemotionRenderStatus = 'pending' | 'rendering' | 'ready' | 'error';

export interface RemotionVideoContent {
    compositionId: string;                    // Unique ID for this video
    compositionType: RemotionCompositionType; // Type of composition
    props: Record<string, unknown>;           // Composition props
    videoUrl?: string;                        // URL after rendering
    thumbnailUrl?: string;                    // Preview thumbnail
    duration: number;                         // Duration in seconds
    status: RemotionRenderStatus;             // Current render status
    renderProgress?: number;                  // 0-100 progress
    jobId?: string;                           // Render job ID for tracking
    error?: string;                           // Error message if failed
}

// Union of all strict content types
export type StrictBlockContent =
    | MultipleChoiceContent
    | OpenQuestionContent
    | OrderingContent
    | CategorizationContent
    | DragAndDropContent
    | HotspotContent
    | any; // Temporary fallback for legacy blocks

export type BloomLevel = 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';

// רמת למידה - תיוג פדגוגי פשוט לכל בלוק
// הבנה: שאלות בסיסיות לבדיקת הבנה של החומר
// יישום: שאלות שדורשות יישום הידע במצבים שונים
// העמקה: שאלות מאתגרות שדורשות חשיבה מעמיקה וביקורתית
export type LearningLevel = 'הבנה' | 'יישום' | 'העמקה';

export interface ActivityBlockMetadata {
    difficultyLevel?: number; // 1-5
    bloomLevel?: BloomLevel;
    learningLevel?: LearningLevel; // רמת למידה: הבנה / יישום / העמקה
    score?: number; // 0-100 (הניקוד לשאלה)

    // Curriculum topic identification (links to Knowledge Base chapters)
    curriculumTopicId?: string; // e.g., "חיבור עד 100", "שברים פשוטים" - from curriculum chapter names

    // שדות לשאלות
    modelAnswer?: string;
    sourceHint?: string; // New: Hint pointing to source text

    // שדות לתמונות/וידאו (העלאת קבצים)
    aiPrompt?: string;
    uploadedFileUrl?: string; // ה-URL של הקובץ ב-Firebase Storage
    fileName?: string; // שם הקובץ המקורי לתצוגה

    // שדות לצ'אט אינטראקטיבי
    systemPrompt?: string; // "האישיות" של הבוט
    initialMessage?: string; // הודעת הפתיחה של הבוט

    [key: string]: any;

    // Scaffolding / Error Handling
    progressiveHints?: string[]; // [General, Specific, Almost Answer]
    richOptions?: RichOption[];
    aiValidation?: {
        cefr_level: string;
        readability_score: number;
        cognitive_load: string;
        tone_audit?: string; // e.g. "Objective", "Encouraging"
        timestamp: number;
    };
}


export interface RichOption {
    text?: string;
    label?: string;
    id?: string;
    is_correct?: boolean;
    isCorrect?: boolean;
    feedback?: string;
}

// --- Strict Block Types (Discriminated Union) ---

// --- Strict Block Types (Discriminated Union) ---

export interface TelemetryData {
    timeSeconds: number;
    attempts: number;
    hintsUsed: number;
    lastAnswer: any;
    events?: { event: string; level?: number; timestamp?: number;[key: string]: any }[];
}

export interface ActivityBlockBase {
    id: string;
    metadata?: ActivityBlockMetadata;
}

export interface MultipleChoiceBlock extends ActivityBlockBase {
    type: 'multiple-choice';
    content: MultipleChoiceContent;
}

export interface OpenQuestionBlock extends ActivityBlockBase {
    type: 'open-question';
    content: OpenQuestionContent;
}

export interface OrderingBlock extends ActivityBlockBase {
    type: 'ordering';
    content: OrderingContent;
}

export interface CategorizationBlock extends ActivityBlockBase {
    type: 'categorization';
    content: CategorizationContent;
}

// Simple Media Blocks
export interface MediaBlock extends ActivityBlockBase {
    type: 'text' | 'image' | 'video' | 'pdf' | 'gem-link' | 'infographic';
    content: string; // URL or Text
}

// Complex / Legacy Blocks
export interface GenericBlock extends ActivityBlockBase {
    type: 'interactive-chat' | 'fill_in_blanks' | 'true_false_speed';
    content: any;
}

export interface MemoryGameBlock extends ActivityBlockBase {
    type: 'memory_game';
    content: MemoryGameContent;
}


export interface PodcastBlock extends ActivityBlockBase {
    type: 'podcast';
    content: {
        title?: string;
        audioUrl?: string | null;
        script?: any; // DialogueScript
        transcript?: string;
    };
}

export interface AudioResponseContent {
    question: string;
    description?: string;
    maxDuration?: number; // seconds, default 60
}

export interface AudioResponseBlock extends ActivityBlockBase {
    type: 'audio-response';
    content: AudioResponseContent;
}

export interface MindMapBlock extends ActivityBlockBase {
    type: 'mindmap';
    content: MindMapContent;
    metadata?: ActivityBlockMetadata & MindMapMetadata;
}

// Activity-specific blocks for student activities
export interface ActivityIntroBlock extends ActivityBlockBase {
    type: 'activity-intro';
    content: ActivityIntroContent;
}

export interface ScenarioImageBlock extends ActivityBlockBase {
    type: 'scenario-image';
    content: ScenarioImageContent;
}

export interface RemotionVideoBlock extends ActivityBlockBase {
    type: 'remotion-video';
    content: RemotionVideoContent;
}

// New Question Type Blocks
export interface MatchingBlock extends ActivityBlockBase {
    type: 'matching';
    content: MatchingContent;
}

export interface HighlightBlock extends ActivityBlockBase {
    type: 'highlight';
    content: HighlightContent;
}

export interface SentenceBuilderBlock extends ActivityBlockBase {
    type: 'sentence_builder';
    content: SentenceBuilderContent;
}

export interface ImageLabelingBlock extends ActivityBlockBase {
    type: 'image_labeling';
    content: ImageLabelingContent;
}

export interface TableCompletionBlock extends ActivityBlockBase {
    type: 'table_completion';
    content: TableCompletionContent;
}

export interface TextSelectionBlock extends ActivityBlockBase {
    type: 'text_selection';
    content: TextSelectionContent;
}

export interface RatingScaleBlock extends ActivityBlockBase {
    type: 'rating_scale';
    content: RatingScaleContent;
}

export interface MatrixBlock extends ActivityBlockBase {
    type: 'matrix';
    content: MatrixContent;
}

export type ActivityBlock =
    | MultipleChoiceBlock
    | OpenQuestionBlock
    | OrderingBlock
    | CategorizationBlock
    | MediaBlock
    | GenericBlock
    | MemoryGameBlock
    | PodcastBlock
    | AudioResponseBlock
    | MindMapBlock
    | ActivityIntroBlock
    | ScenarioImageBlock
    | MatchingBlock
    | HighlightBlock
    | SentenceBuilderBlock
    | ImageLabelingBlock
    | TableCompletionBlock
    | TextSelectionBlock
    | RatingScaleBlock
    | MatrixBlock
    | RemotionVideoBlock;

export interface LearningUnit {
    id: string;
    title: string;
    goals?: string[];
    type: LearningUnitType;
    baseContent: string;
    activityBlocks: ActivityBlock[];
    audioOverview?: {
        script: any; // Context: DialogueScript from gemini.types.ts
        audioUrl?: string;
    };
    metadata?: any;
}

export interface Module {
    id: string;
    title: string;
    learningUnits: LearningUnit[];
}

export interface Course {
    id: string;
    teacherId: string;
    title: string;
    targetAudience: string;
    gradeLevel?: string;
    subject?: string;
    botPersona?: string;
    mode?: 'learning' | 'exam' | 'lesson';
    activityLength?: 'short' | 'medium' | 'long';
    syllabus: Module[];
    createdAt?: any;
    updatedAt?: any;
    fullBookContent?: string; // THe full extracted text
    wizardData?: any; // Stores the initial wizard configuration
    showSourceToStudent?: boolean; // Visibility toggle
    pdfSource?: string | null; // URL of the original PDF file
    settings?: {
        totalScore: number;
        passScore: number;
    };
}

export interface Assignment {
    id: string;
    courseId: string;
    title: string;
    instructions?: string;
    dueDate?: string | number;
    activeSubmission?: {
        answers: Record<string, any>;
    };
    [key: string]: any;
}

export interface StudentAnalyticsProfile {
    studentId?: string;
    strengths: string[];          // מיומנויות חזקות
    weaknesses: string[];         // נושאים לחיזוק
    recommendedFocus: string;     // נושא מומלץ לתרגול
    engagementScore: number;      // ציון מעורבות (0-100)

    // מדדי למידה
    learningMetrics?: {
        averageTimePerQuestion: number;  // זמן ממוצע לשאלה (שניות)
        hintUsageRate: number;           // אחוז שימוש ברמזים (0-1)
        attemptsPerQuestion: number;     // ניסיונות ממוצע לשאלה
        completionRate: number;          // אחוז השלמה (0-1)
    };

    // העדפות למידה
    learningPreferences?: {
        visual: number;      // 0-1
        textual: number;
        gamified: number;
        scaffolded: number;
    };
}

// --- Validation Types ---
export type ValidationStatus = 'PASS' | 'REJECT';

export interface ValidationMetrics {
    cefr_level: string; // e.g., 'A2', 'B1'
    readability_score: number; // 0-100
    cognitive_load: 'Low' | 'Medium' | 'High';
}

export interface ValidationIssue {
    module_index: number;
    issue_type: string; // e.g., 'Grammar', 'Tone', 'Complexity'
    description: string;
    suggested_fix: string;
}

export interface ValidationResult {
    status: ValidationStatus;
    metrics: ValidationMetrics;
    issues: ValidationIssue[];
}

// --- Gamification Types ---
export interface GamificationProfile {
    // Basic Stats
    xp: number;
    level: number;
    currentStreak: number;
    lastActivityDate: string; // ISO Date to check streak
    frozenDays: number; // Inventory of Streak Freezes

    // Currency
    gems: number;

    // Social
    leagueTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
    leagueWeeklyXp: number; // Resets weekly

    // Unlocks
    unlockedThemes: string[];
    equippedTheme: string;
}

export type GamificationEventType = 'XP_GAIN' | 'LEVEL_UP' | 'STREAK_MAINTAINED' | 'STREAK_LOST' | 'GEM_EARNED';

export interface GamificationEventPayload {
    type: GamificationEventType;
    amount?: number;
    reason?: string;
    newLevel?: number;
    timestamp: number;
}

// --- Student Task/Assignment System ---
export type TaskStatus = 'new' | 'in_progress' | 'submitted' | 'graded' | 'late';
export type TaskAssignmentTarget = 'all' | 'group' | 'individual';
export type StudentGroupType = 'support' | 'core' | 'enrichment';

export interface StudentTask {
    id: string;

    // Teacher info
    teacherId: string;
    teacherName: string;

    // What is the task
    courseId: string;
    courseTitle: string;
    unitId?: string;
    unitTitle?: string;
    title: string;
    instructions?: string;

    // Assignment target
    assignedTo: TaskAssignmentTarget;
    classId?: string;
    className?: string;
    studentIds?: string[]; // For individual assignments
    groupType?: StudentGroupType; // For group-based assignments

    // Timing
    assignedAt: any; // Firestore Timestamp
    dueDate?: any; // Firestore Timestamp

    // Scoring
    maxPoints: number;

    // Task type
    taskType: 'activity' | 'exam' | 'practice';

    // Email report settings
    emailReportEnabled?: boolean;  // Whether to send email report when due date passes
    emailReportSentAt?: any;       // Timestamp when report was sent (prevents duplicates)
}

export interface StudentTaskSubmission {
    id: string;
    taskId: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;

    // Status tracking
    status: TaskStatus;
    startedAt?: any;
    submittedAt?: any;
    gradedAt?: any;

    // Progress (before submission)
    progress: number; // 0-100
    lastBlockIndex?: number;

    // Results (after submission)
    score?: number;
    maxScore?: number;
    percentage?: number;

    // Detailed answers
    answers?: Record<string, any>;
    telemetry?: {
        stepResults: Record<string, 'success' | 'failure' | 'viewed'>;
        hintsUsed: Record<string, number>;
        totalBlocks: number;
        completedBlocks: number;
        successBlocks: number;
        failureBlocks: number;
        timeSpentSeconds?: number;
    };

    // Teacher feedback
    teacherFeedback?: string;
    gradedBy?: string;
}

export interface ClassInfo {
    id: string;
    name: string;
    teacherId: string;
    studentCount?: number;
    students?: {
        id: string;
        name: string;
        email?: string;
    }[];
}
