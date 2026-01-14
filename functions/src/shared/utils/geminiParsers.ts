
import { v4 as uuidv4 } from 'uuid';
import type { RawAiItem, MappedLearningBlock } from '../types/gemini.types';
import type { ActivityBlockType, RichOption } from '../types/courseTypes';
import { calculateQuestionPoints } from '../../ai/examPrompts';

/**
 * Cleans a JSON string returned by an LLM, removing markdown code blocks.
 */
export const cleanJsonString = (text: string): string => {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const firstBrace = clean.indexOf('{');
        const firstBracket = clean.indexOf('[');
        let startIndex = -1;
        let endIndex = -1;

        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
            startIndex = firstBracket;
            endIndex = clean.lastIndexOf(']') + 1;
        } else if (firstBrace !== -1) {
            startIndex = firstBrace;
            endIndex = clean.lastIndexOf('}') + 1;
        }

        if (startIndex !== -1 && endIndex !== -1) {
            clean = clean.substring(startIndex, endIndex);
        }
        clean = clean.replace(/}\s*{/g, '}, {');
        return clean;
    } catch (e) {
        console.error("JSON cleaning failed, returning original:", e);
        return text;
    }
};

/**
 * Maps the raw, chaotic JSON returned by AI into a strict, UI-ready Content Block.
 * 
 * @param item - The raw JSON object from the AI (RawAiItem).
 * @returns {MappedLearningBlock | null} A strictly typed block ready for the Course Player, or null if invalid.
 */
export const mapSystemItemToBlock = (item: RawAiItem | null): MappedLearningBlock | null => {
    try {
        if (!item) return null;

        // 1. ROBUST DATA NORMALIZATION
        // console.log("Raw AI Item for Mapping:", JSON.stringify(item)); // DEBUG LOG

        // Handle different AI nesting styles (Direct object vs 'data' wrapper vs 'interactive_question' wrapper)
        // Sometimes AI returns data: { data: { ... } }
        // We use 'as RawAiItem' because the nesting can be recursive and unpredictable, but we know it conforms to the partial shape
        const rawData: RawAiItem = (item.data?.data || item.data || item.interactive_question || item) as RawAiItem;

        // Extract Type
        // Keep as string for loose matching against AI outputs (which might use underscores)
        const typeString = item.selected_interaction || item.type || rawData.type || 'multiple_choice';

        // Extract Question Text (Handle all known variations - Check Root AND Data)
        const questionObj = rawData.question || item.question;
        const questionText =
            (typeof questionObj === 'object' ? questionObj?.text : questionObj) || // Handle { question: { text: "..." } }
            rawData.question_text ||
            rawData.text ||
            rawData.instruction ||
            rawData.text ||
            rawData.instruction;

        const commonMetadata = {
            bloomLevel: item.bloom_level || "ידע ומיומנויות יסוד",
            feedbackCorrect: rawData.feedback_correct || rawData.feedback || "כל הכבוד! התשובה תואמת את הטקסט.",
            feedbackIncorrect: rawData.feedback_incorrect || "לא מדויק. כדאי לנסות שוב או להיעזר ברמז המודגש.",
            sourceReference: rawData.source_reference || rawData.source_reference_hint || null
        };

        // === CASE A: MULTIPLE CHOICE / TRUE-FALSE ===
        // Compare against loose strings from AI
        if (typeString === 'multiple_choice' || typeString === 'multiple-choice' || typeString === 'true_false' || typeString === 'teach_then_ask') {
            // Robust Options Extraction
            let options: (string | RichOption)[] = [];
            if (Array.isArray(rawData.options)) options = rawData.options;
            else if (Array.isArray(item.options)) options = item.options; // Check root as fallback
            else if (Array.isArray(rawData.choices)) options = rawData.choices;
            else if (Array.isArray(rawData.answers)) options = rawData.answers;

            // Normalize Options to Strings for Content, Keep Rich Data in Metadata
            const normalizedOptions: string[] = options.map((o) =>
                typeof o === 'string' ? o : (o.text || o.label || "")
            );

            // Fallback if empty options
            if (normalizedOptions.length < 2) {
                if (typeString === 'true_false') {
                    normalizedOptions.push("נכון", "לא נכון");
                } else {
                    console.warn("Invalid options detected for MC, returning null to force retry/skip");
                    return null; // Better to fail than show "Option A"
                }
            }

            // Robust Correct Answer Extraction
            let correctAnswer = "";

            // 1. Check for "is_correct" flag in rich objects
            const correctOptObj = options.find((o) => typeof o === 'object' && (o.is_correct || o.isCorrect === true)) as RichOption | undefined;
            if (correctOptObj) {
                correctAnswer = correctOptObj.text || correctOptObj.label || "";
            }
            // 2. Check for explicit correct answer string
            else if (rawData.correct_answer && typeof rawData.correct_answer === 'string') {
                correctAnswer = rawData.correct_answer;
            }
            // 3. Check for correct index
            else if (rawData.correct_index !== undefined && normalizedOptions[rawData.correct_index]) {
                correctAnswer = normalizedOptions[rawData.correct_index];
            }
            // 4. Fallback to first option
            else {
                correctAnswer = normalizedOptions[0];
            }

            // 🛡️ VALIDATION: Ensure correctAnswer matches one of the options
            // If not, try to find a partial match or default to first option
            if (!normalizedOptions.includes(correctAnswer)) {
                console.warn(`correctAnswer "${correctAnswer}" not found in options. Attempting fuzzy match...`);

                // Try case-insensitive match
                const lowerCorrect = correctAnswer.toLowerCase().trim();
                const matchedOption = normalizedOptions.find(opt =>
                    opt.toLowerCase().trim() === lowerCorrect ||
                    opt.toLowerCase().includes(lowerCorrect) ||
                    lowerCorrect.includes(opt.toLowerCase())
                );

                if (matchedOption) {
                    console.log(`Found fuzzy match: "${matchedOption}"`);
                    correctAnswer = matchedOption;
                } else {
                    // Last resort: use first option and log warning
                    console.warn(`No match found. Defaulting to first option: "${normalizedOptions[0]}"`);
                    correctAnswer = normalizedOptions[0];
                }
            }

            // Normalize type to accepted enum
            const finalType: ActivityBlockType = typeString === 'true_false' ? 'multiple-choice' : 'multiple-choice';

            return {
                id: uuidv4(),
                type: finalType,
                content: {
                    question: questionText,
                    options: normalizedOptions,
                    correctAnswer: correctAnswer
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, typeString),
                    progressiveHints: rawData.progressive_hints || [],
                    richOptions: options.some(o => typeof o === 'object') ? options : undefined
                }
            };
        }

        // === CASE B: OPEN QUESTION ===
        if (typeString === 'open_question' || typeString === 'open-question' || typeString === 'open_ended') {
            return {
                id: uuidv4(),
                type: 'open-question',
                content: { question: questionText },
                metadata: {
                    ...commonMetadata,
                    // Teacher guidelines - rich pedagogical instructions
                    modelAnswer: rawData.teacher_guidelines ||
                                 (Array.isArray(rawData.model_answer)
                                    ? rawData.model_answer.join('\n- ')
                                    : (rawData.model_answer || rawData.answer_key || "🎯 מה לחפש: תשובה המבוססת על החומר הנלמד")),
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, 'open_question')
                }
            };
        }

        // === CASE C: ORDERING / SEQUENCING ===
        if (typeString === 'ordering' || typeString === 'sequencing') {
            const rawItems = rawData.items || rawData.steps || rawData.correct_order || [];
            // Ensure items are strings
            const items = rawItems.map((i) => {
                if (typeof i === 'string') return i;
                // i is an object from the union in RawAiItem
                return i.text || i.step || i.content || (i as any).description || JSON.stringify(i);
            });

            // Valid Sequence Check
            if (items.length < 2) {
                console.warn("Ordering items missing or too few. Attempting auto-repair from text.");
                // Fallback: Try to split the question/instruction text into steps
                if (questionText && questionText.length > 20) {
                    // Try splitting by newlines first
                    let splitText = questionText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    if (splitText.length < 2) {
                        // Try splitting by periods (sentences)
                        splitText = questionText.split('.').map(s => s.trim()).filter(s => s.length > 5);
                    }

                    if (splitText.length >= 2) {
                        items.push(...splitText);
                        // Update items in the block
                    } else {
                        return null; // Truly failed
                    }
                } else {
                    return null; // Fail
                }
            }

            return {
                id: uuidv4(),
                type: 'ordering',
                content: {
                    instruction: questionText !== "שאלה ללא טקסט" ? questionText : "סדרו את הצעדים הבאים:",
                    correct_order: items
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'ordering') }
            };
        }

        // === CASE D: CATEGORIZATION / GROUPING / MATCHING ===
        if (typeString === 'categorization' || typeString === 'grouping' || typeString === 'matching') {
            let categories: string[] = [];
            let items: { text: string; category: string }[] = [];

            // Handle Matching (Pairs)
            if (typeString === 'matching' || rawData.pairs) {
                const pairs = rawData.pairs || [];
                const uniqueCats = new Set<string>();
                pairs.forEach((p) => uniqueCats.add(p.right || p.category || ""));
                categories = Array.from(uniqueCats).filter(Boolean);
                items = pairs.map((p) => ({
                    text: p.left || p.item || "",
                    category: p.right || p.category || ""
                }));
            }
            // Handle Standard Grouping
            else {
                categories = rawData.groups || rawData.categories || ["קטגוריה 1", "קטגוריה 2"];
                const rawListing = rawData.items || [];

                // Map items with group index if needed
                items = rawListing.map((item) => {
                    // If item is object with 'category' prop
                    if (typeof item === 'object' && item.category) {
                        const txt = item.text || item.content || JSON.stringify(item);
                        return { text: txt, category: item.category };
                    }
                    // If item has group_index
                    if (typeof item === 'object' && item.group_index !== undefined && categories[item.group_index]) {
                        return { text: item.text || item.content || "", category: categories[item.group_index] };
                    }
                    // Fallback: If AI returns items as simple strings but didn't assign categories, we can't guess.
                    // But if AI returns { text: "X", group: "Y" } handle that.
                    if (typeof item === 'object' && item.group) return { text: item.text || JSON.stringify(item), category: item.group };

                    // Fallback for simple strings (default to first category to prevent crash, or mark as Uncategorized)
                    return {
                        text: typeof item === 'string' ? item : (item.text || JSON.stringify(item)),
                        category: categories[0] || "כללי"
                    };
                });
            }

            // Fallback for empty items
            if (items.length === 0) {
                console.warn("Categorization items missing. Attempting to parse from text.");

                // Auto-Repair: Look for bullet points in text
                const bulletPoints = questionText ? questionText.match(/[-*•]\s?(.+)/g) : null;
                if (bulletPoints && bulletPoints.length >= 2) {
                    bulletPoints.forEach(bp => {
                        const cleanText = bp.replace(/[-*•]\s?/, '').trim();
                        if (cleanText) {
                            items.push({ text: cleanText, category: categories[0] || "General" });
                        }
                    });
                }

                if (items.length === 0) {
                    return null; // Truly failed
                }
            }

            return {
                id: uuidv4(),
                type: 'categorization',
                content: {
                    question: questionText !== "שאלה ללא טקסט" ? questionText : "מיינו את הפריטים לקטגוריות:",
                    categories: categories,
                    items: items
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'categorization') }
            };
        }

        if (typeString === 'fill_in_blanks' || typeString === 'cloze') {
            const rawSentence = rawData.text || rawData.content || questionText || "חסר טקסט להשלמה";
            let bank = rawData.word_bank || rawData.options || [];

            return {
                id: uuidv4(),
                type: 'fill_in_blanks',
                content: {
                    sentence: rawSentence,
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, 'fill_in_blanks'),
                    wordBank: bank // Optional word bank
                }
            };
        }

        // === CASE G: AUDIO RESPONSE ===
        if (typeString === 'audio_response' || typeString === 'oral_answer' || typeString === 'record_answer') {
            return {
                id: uuidv4(),
                type: 'audio-response',
                content: {
                    question: questionText || "הקליטו את תשובתכם:",
                    description: rawData.description || "לחצו על כפתור ההקלטה כדי לענות.",
                    maxDuration: rawData.max_duration || 60
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, 'open_question') // Audio is like open question
                }
            };
        }

        // === CASE E: MEMORY GAME ===
        if (typeString === 'memory_game' || typeString === 'memory' || typeString === 'matching_pairs') {
            const pairs = rawData.pairs || rawData.cards || [];

            // Normalize Pairs
            const normalizedPairs: { card_a: string; card_b: string }[] = [];

            if (Array.isArray(pairs)) {
                pairs.forEach((p: any) => {
                    if (p.card_a && p.card_b) normalizedPairs.push({ card_a: p.card_a, card_b: p.card_b });
                    else if (p.left && p.right) normalizedPairs.push({ card_a: p.left, card_b: p.right });
                    else if (Array.isArray(p) && p.length === 2) normalizedPairs.push({ card_a: p[0], card_b: p[1] });
                });
            }

            if (normalizedPairs.length < 2) {
                console.warn("Memory game pairs missing or too few.");
                return null;
            }

            return {
                id: uuidv4(),
                type: 'memory_game',
                content: {
                    pair_count: normalizedPairs.length,
                    pairs: normalizedPairs,
                    question: questionText || "מצאו את הזוגות המתאימים:"
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'multiple_choice') } // Memory game is similar to MC
            };
        }

        return null;
    } catch (error) {
        console.error("Critical Mapping Error in mapSystemItemToBlock:", error);
        return null; // Fail gracefully instead of crashing
    }
};
