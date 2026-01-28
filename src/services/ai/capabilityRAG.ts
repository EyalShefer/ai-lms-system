/**
 * Capability RAG Service V2
 *
 * Retrieves relevant capabilities based on user message context.
 * Uses keyword matching and threshold-based selection.
 *
 * Strategy (Option A - Threshold-based):
 * - If top match score >= MIN_SCORE (5): Send top-5 capabilities to Gemini
 * - Otherwise: Send all 10 capabilities (let Gemini decide)
 */

import type {
    Capability,
    CapabilitySearchResult,
    AgentContext,
    CapabilityCategory
} from '../../shared/types/capabilityTypes';

// ========== Constants ==========

const MIN_SCORE_THRESHOLD = 5;  // Minimum score to consider a "good" match
const TOP_MATCHES_LIMIT = 5;     // Max capabilities to send when we have good matches
const MAX_CAPABILITIES = 10;     // Total capabilities in the system

// ========== Types ==========

export interface RAGSearchOptions {
    maxResults?: number;
    minScore?: number;
    categories?: CapabilityCategory[];
    excludeIds?: string[];
    contentMode?: 'interactive' | 'static' | null;  // Filter by content type
}

export interface RAGSearchResult {
    capabilities: CapabilitySearchResult[];
    strategy: 'filtered' | 'all';  // Which strategy was used
    suggestedCategory?: CapabilityCategory;
}

// ========== In-Memory Cache ==========

let capabilitiesCache: Capability[] = [];
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load capabilities from Firestore (with caching)
 */
export async function loadCapabilities(
    firestore: any,
    forceRefresh: boolean = false
): Promise<Capability[]> {
    const now = Date.now();

    // Return cached if valid
    if (!forceRefresh && capabilitiesCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
        return capabilitiesCache;
    }

    try {
        const snapshot = await firestore
            .collection('capabilities')
            .where('status', '==', 'active')
            .get();

        capabilitiesCache = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
        })) as Capability[];

        cacheTimestamp = now;
        console.log(`[CapabilityRAG] Loaded ${capabilitiesCache.length} capabilities from Firestore`);

        return capabilitiesCache;
    } catch (error) {
        console.error('[CapabilityRAG] Failed to load capabilities:', error);
        // Return cached even if stale
        return capabilitiesCache;
    }
}

/**
 * Clear the capabilities cache
 */
export function clearCapabilitiesCache(): void {
    capabilitiesCache = [];
    cacheTimestamp = 0;
}

// ========== Scoring Functions ==========

/**
 * Calculate keyword match score for a capability
 */
function calculateKeywordScore(
    message: string,
    capability: Capability
): { score: number; matchedKeywords: string[] } {
    const normalizedMessage = message.toLowerCase();
    const matchedKeywords: string[] = [];
    let score = 0;

    // Check trigger keywords (each keyword = 2 points)
    for (const keyword of capability.triggers.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
            score += 2;
        }
    }

    // Check patterns if defined (pattern match = 3 points)
    if (capability.triggers.patterns) {
        for (const pattern of capability.triggers.patterns) {
            try {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(normalizedMessage)) {
                    score += 3;
                }
            } catch {
                // Invalid regex, skip
            }
        }
    }

    // Check exclusions (exclusion match = -5 points)
    if (capability.triggers.exclusions) {
        for (const exclusion of capability.triggers.exclusions) {
            if (normalizedMessage.includes(exclusion.toLowerCase())) {
                score -= 5;
            }
        }
    }

    // Bonus for exact capability name match (+3)
    if (normalizedMessage.includes(capability.name.toLowerCase())) {
        score += 3;
    }

    return { score: Math.max(0, score), matchedKeywords };
}

/**
 * Calculate example similarity score (simple word overlap)
 */
function calculateExampleSimilarityScore(
    message: string,
    capability: Capability
): number {
    const normalizedMessage = message.toLowerCase();
    let maxScore = 0;

    for (const example of capability.examples) {
        const exampleWords = example.userMessage.toLowerCase().split(/\s+/);
        const messageWords = normalizedMessage.split(/\s+/);

        let overlap = 0;
        for (const word of exampleWords) {
            if (word.length > 2 && messageWords.some(mw => mw.includes(word))) {
                overlap++;
            }
        }

        // Each overlapping word = 1 point (max 3)
        const score = Math.min(3, overlap);
        if (score > maxScore) {
            maxScore = score;
        }
    }

    return maxScore;
}

// ========== Main RAG Function ==========

/**
 * Search for relevant capabilities based on user message
 * Uses threshold-based strategy (Option A):
 * - Good matches (score >= 5): Return top 5
 * - No good matches: Return all capabilities
 */
export function searchCapabilities(
    message: string,
    capabilities: Capability[],
    options: RAGSearchOptions = {}
): RAGSearchResult {
    const {
        categories,
        excludeIds = [],
        contentMode
    } = options;

    console.log(`[CapabilityRAG] Searching for: "${message.substring(0, 50)}..." (contentMode: ${contentMode || 'any'})`);

    // Score all capabilities
    const scoredCapabilities: CapabilitySearchResult[] = [];

    for (const capability of capabilities) {
        // Skip excluded capabilities
        if (excludeIds.includes(capability.id)) continue;

        // Skip if category filter applied
        if (categories && !categories.includes(capability.category)) continue;

        // Skip if content mode filter applied
        if (contentMode) {
            const isInteractive = capability.category === 'interactive_content';
            const isStatic = capability.category === 'static_content';

            if (contentMode === 'interactive' && !isInteractive) continue;
            if (contentMode === 'static' && !isStatic) continue;
        }

        // Calculate scores
        const keywordResult = calculateKeywordScore(message, capability);
        const exampleScore = calculateExampleSimilarityScore(message, capability);

        // Total score
        const totalScore = keywordResult.score + exampleScore;

        scoredCapabilities.push({
            capability,
            score: totalScore,
            matchedTriggers: keywordResult.matchedKeywords,
            reasoning: generateReasoning(keywordResult.matchedKeywords, totalScore)
        });
    }

    // Sort by score descending
    scoredCapabilities.sort((a, b) => b.score - a.score);

    // Apply threshold strategy (Option A)
    const topScore = scoredCapabilities[0]?.score ?? 0;
    const goodMatches = scoredCapabilities.filter(c => c.score >= MIN_SCORE_THRESHOLD);

    let results: CapabilitySearchResult[];
    let strategy: 'filtered' | 'all';

    if (goodMatches.length >= 3 && topScore >= MIN_SCORE_THRESHOLD) {
        // Good matches found - send top 5
        results = goodMatches.slice(0, TOP_MATCHES_LIMIT);
        strategy = 'filtered';
        console.log(`[CapabilityRAG] Strategy: FILTERED - ${results.length} good matches (top score: ${topScore})`);
    } else {
        // No clear match - send all capabilities, let Gemini decide
        results = scoredCapabilities;
        strategy = 'all';
        console.log(`[CapabilityRAG] Strategy: ALL - no clear match (top score: ${topScore})`);
    }

    // Determine suggested category based on top result
    let suggestedCategory: CapabilityCategory | undefined;
    if (results.length > 0 && results[0].score >= MIN_SCORE_THRESHOLD) {
        suggestedCategory = results[0].capability.category;
    }

    console.log(`[CapabilityRAG] Returning ${results.length} capabilities`);

    return {
        capabilities: results,
        strategy,
        suggestedCategory
    };
}

/**
 * Generate reasoning for why a capability was selected
 */
function generateReasoning(
    matchedKeywords: string[],
    score: number
): string {
    const parts: string[] = [];

    if (matchedKeywords.length > 0) {
        parts.push(`מילות מפתח: ${matchedKeywords.join(', ')}`);
    }

    if (score >= MIN_SCORE_THRESHOLD) {
        parts.push('התאמה טובה');
    }

    return parts.join(' | ') || 'התאמה כללית';
}

// ========== Context Builder ==========

/**
 * Build agent context with relevant capabilities
 */
export function buildAgentContext(
    message: string,
    capabilities: Capability[],
    userPreferences?: {
        preferredGrade?: string;
        preferredSubject?: string;
        recentTopics?: string[];
    }
): AgentContext {
    // Search for relevant capabilities
    const searchResult = searchCapabilities(message, capabilities);

    return {
        relevantCapabilities: searchResult.capabilities,
        userPreferences,
        systemState: {
            hasActiveWizard: false
        }
    };
}

// ========== Function Declaration Generator ==========

/**
 * Generate Gemini function declarations from capabilities
 */
export function generateFunctionDeclarations(
    capabilities: CapabilitySearchResult[]
): any[] {
    return capabilities.map(result => result.capability.functionDeclaration);
}

/**
 * Generate function declarations directly from capabilities array
 */
export function capabilitiesToFunctionDeclarations(
    capabilities: Capability[]
): any[] {
    return capabilities.map(cap => cap.functionDeclaration);
}

/**
 * Generate a slim system prompt section for the relevant capabilities
 */
export function generateCapabilityContextPrompt(
    capabilities: CapabilitySearchResult[]
): string {
    if (capabilities.length === 0) {
        return '';
    }

    const lines: string[] = [
        '### יכולות רלוונטיות לבקשה:',
        ''
    ];

    for (const result of capabilities) {
        const cap = result.capability;
        lines.push(`**${cap.name}** (${cap.id})`);
        lines.push(`- ${cap.shortDescription}`);
        lines.push(`- דוגמה: "${cap.examples[0]?.userMessage || 'אין דוגמה'}"`);
        if (result.matchedTriggers.length > 0) {
            lines.push(`- מילים שזוהו: ${result.matchedTriggers.join(', ')}`);
        }
        lines.push('');
    }

    lines.push('---');
    lines.push('השתמש ביכולות אלה כדי לענות על בקשת המשתמש.');
    lines.push('אם לא ברור מה המשתמש רוצה, שאל שאלת הבהרה.');

    return lines.join('\n');
}
