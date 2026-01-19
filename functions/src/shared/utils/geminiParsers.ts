
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

        // Handle different AI nesting styles:
        // - Direct object
        // - 'data' wrapper: { data: { ... } }
        // - 'interactive_question' wrapper
        // - NEW: 'interaction' wrapper: { interaction: { type: "...", ...data } }

        // First, check if there's a nested 'interaction' object (new AI format)
        // AI sometimes returns 'interaction' instead of 'data' for the question content
        const interactionObj = item.interaction || (item.data as any)?.interaction;

        // If we have an interaction object, use it as the primary data source
        let rawData: RawAiItem;
        if (interactionObj && typeof interactionObj === 'object') {
            // New format: { stepNumber, title, interaction: { type, pairs/options/etc } }
            // Merge the interaction data with top-level metadata AND item.data (for hints etc)
            const dataObj = item.data && typeof item.data === 'object' ? item.data : {};
            rawData = { ...item, ...dataObj, ...interactionObj } as RawAiItem;
            console.log("🎮 Found nested interaction object, merging data. Keys:", Object.keys(rawData));
        } else {
            // Old format: direct data or wrapped in 'data'/'interactive_question'
            rawData = (item.data?.data || item.data || item.interactive_question || item) as RawAiItem;
        }

        // Extract Type - check multiple sources including the new 'interaction' object
        // Priority: interaction.type > suggested_interaction_type > selected_interaction > item.type > rawData.type
        let typeString =
            interactionObj?.type ||
            item.suggested_interaction_type ||
            item.selected_interaction ||
            item.type ||
            rawData.type ||
            'multiple_choice';

        // Normalize: convert hyphens to underscores for consistent matching
        typeString = typeString.replace(/-/g, '_');

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

        // === CASE D-EARLY: MATCHING with leftItems (new format) - must come BEFORE categorization ===
        // This handles the new matching format with leftItems/rightItems (line drawing)
        if (typeString === 'matching' && (rawData.leftItems || rawData.left_items)) {
            const leftItems = rawData.leftItems || rawData.left_items || [];
            const rightItems = rawData.rightItems || rawData.right_items || [];
            const correctMatches = rawData.correctMatches || rawData.correct_matches || [];

            return {
                id: uuidv4(),
                type: 'matching',
                content: {
                    instruction: questionText || rawData.instruction || "התאימו בין הפריטים:",
                    leftItems: leftItems.length > 0 ? leftItems : [{ id: '1', text: 'פריט 1' }],
                    rightItems: rightItems.length > 0 ? rightItems : [{ id: 'a', text: 'התאמה 1' }],
                    correctMatches: correctMatches,
                    hints: rawData.hints || rawData.progressive_hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'matching') }
            };
        }

        // === CASE D: CATEGORIZATION / GROUPING ===
        // Note: 'matching' with pairs (old format) still falls through here
        if (typeString === 'categorization' || typeString === 'grouping' || (typeString === 'matching' && rawData.pairs)) {
            let categories: string[] = [];
            let items: { text: string; category: string }[] = [];

            // Handle Matching (Pairs) - old format
            if (rawData.pairs) {
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
                // Categories can be array of strings or array of objects with {id, label}
                const rawCategories = rawData.groups || rawData.categories || ["קטגוריה 1", "קטגוריה 2"];

                // Build category map for id -> label lookup
                const categoryMap: Record<string, string> = {};
                categories = rawCategories.map((cat: any) => {
                    if (typeof cat === 'string') return cat;
                    if (typeof cat === 'object' && cat.label) {
                        // Store mapping from id to label
                        if (cat.id) categoryMap[cat.id] = cat.label;
                        return cat.label;
                    }
                    return String(cat);
                });

                const rawListing = rawData.items || [];

                // Map items with group index if needed
                items = rawListing.map((item: any) => {
                    // If item is object with 'category_id' prop (new format)
                    if (typeof item === 'object' && item.category_id) {
                        const txt = item.text || item.content || JSON.stringify(item);
                        // Look up the label from categoryMap, fallback to category_id
                        const categoryLabel = categoryMap[item.category_id] || item.category_id;
                        return { text: txt, category: categoryLabel };
                    }
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

        if (typeString === 'fill_in_blank' || typeString === 'fill_in_blanks' || typeString === 'fill_blank' || typeString === 'cloze') {
            // Handle multiple AI response formats:
            // Format 1: { text: "sentence with [blanks]" }
            // Format 2: { sentence: "...", word_bank: [...] }
            const rawSentence = rawData.text || rawData.sentence || rawData.content || questionText || "חסר טקסט להשלמה";
            let bank = rawData.word_bank || rawData.bank || rawData.options || [];

            console.log("🎮 FILL IN BLANKS: Using text:", rawSentence.substring(0, 50) + "...");

            return {
                id: uuidv4(),
                type: 'fill_in_blanks',
                content: {
                    text: rawSentence, // Use 'text' to match ClozeQuestion's expected format
                    hidden_words: bank,
                    distractors: []
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, 'fill_in_blanks'),
                    wordBank: bank // Backup for ClozeQuestion's fallback logic
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
                    else if (p.card1 && p.card2) normalizedPairs.push({ card_a: p.card1, card_b: p.card2 });
                    else if (p.left && p.right) normalizedPairs.push({ card_a: p.left, card_b: p.right });
                    else if (p.term && p.definition) normalizedPairs.push({ card_a: p.term, card_b: p.definition });
                    else if (p.concept && p.meaning) normalizedPairs.push({ card_a: p.concept, card_b: p.meaning });
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

        // === CASE: MATCHING (Draw Lines) ===
        if (typeString === 'matching_lines' || (typeString === 'matching' && rawData.leftItems)) {
            const leftItems = rawData.leftItems || [];
            const rightItems = rawData.rightItems || [];
            const correctMatches = rawData.correctMatches || [];

            if (leftItems.length < 2 || rightItems.length < 2) {
                console.warn("Matching items missing or too few.");
                return null;
            }

            return {
                id: uuidv4(),
                type: 'matching',
                content: {
                    instruction: questionText || rawData.instruction || "התאימו בין הפריטים:",
                    leftItems,
                    rightItems,
                    correctMatches,
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'matching') }
            };
        }

        // === CASE: HIGHLIGHT ===
        if (typeString === 'highlight' || typeString === 'circle' || typeString === 'underline') {
            return {
                id: uuidv4(),
                type: 'highlight',
                content: {
                    instruction: rawData.instruction || questionText || "סמנו את המילים הנכונות:",
                    text: rawData.text || "",
                    correctHighlights: rawData.correctHighlights || [],
                    highlightType: rawData.highlightType || 'background',
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'highlight') }
            };
        }

        // === CASE: SENTENCE BUILDER ===
        if (typeString === 'sentence_builder' || typeString === 'word_order' || typeString === 'scrambled_sentence') {
            const words = rawData.words || [];
            const correctSentence = rawData.correctSentence || rawData.correct_sentence || words.join(' ');

            if (words.length < 3) {
                console.warn("Sentence builder words missing or too few.");
                return null;
            }

            return {
                id: uuidv4(),
                type: 'sentence_builder',
                content: {
                    instruction: rawData.instruction || questionText || "סדרו את המילים למשפט:",
                    words,
                    correctSentence,
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'sentence_builder') }
            };
        }

        // === CASE: IMAGE LABELING ===
        if (typeString === 'image_labeling' || typeString === 'diagram_labeling' || typeString === 'label_image') {
            return {
                id: uuidv4(),
                type: 'image_labeling',
                content: {
                    instruction: rawData.instruction || questionText || "גררו את התוויות למקומות המתאימים:",
                    imageUrl: rawData.imageUrl || rawData.image_url || '',
                    labels: rawData.labels || [],
                    dropZones: rawData.dropZones || rawData.drop_zones || [],
                    hints: rawData.hints || []
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionPoints(commonMetadata.bloomLevel, 'image_labeling'),
                    imageDescription: rawData.imageDescription || rawData.image_description || ''
                }
            };
        }

        // === CASE: TABLE COMPLETION ===
        if (typeString === 'table_completion' || typeString === 'fill_table' || typeString === 'complete_table') {
            return {
                id: uuidv4(),
                type: 'table_completion',
                content: {
                    instruction: rawData.instruction || questionText || "השלימו את הטבלה:",
                    headers: rawData.headers || [],
                    rows: rawData.rows || [],
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'table_completion') }
            };
        }

        // === CASE: TEXT SELECTION ===
        if (typeString === 'text_selection' || typeString === 'select_words' || typeString === 'select_text') {
            return {
                id: uuidv4(),
                type: 'text_selection',
                content: {
                    instruction: rawData.instruction || questionText || "בחרו את המילים הנכונות:",
                    text: rawData.text || "",
                    selectableUnits: rawData.selectableUnits || rawData.selectable_units || 'word',
                    correctSelections: rawData.correctSelections || rawData.correct_selections || [],
                    minSelections: rawData.minSelections || rawData.min_selections || 1,
                    maxSelections: rawData.maxSelections || rawData.max_selections,
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'text_selection') }
            };
        }

        // === CASE: RATING SCALE ===
        if (typeString === 'rating_scale' || typeString === 'scale' || typeString === 'likert') {
            return {
                id: uuidv4(),
                type: 'rating_scale',
                content: {
                    question: questionText || rawData.question || "דרגו:",
                    minValue: rawData.minValue || rawData.min_value || 1,
                    maxValue: rawData.maxValue || rawData.max_value || 5,
                    minLabel: rawData.minLabel || rawData.min_label || "נמוך",
                    maxLabel: rawData.maxLabel || rawData.max_label || "גבוה",
                    correctAnswer: rawData.correct_answer,
                    showNumbers: rawData.showNumbers !== undefined ? rawData.showNumbers : true
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'rating_scale') }
            };
        }

        // === CASE: MATRIX ===
        if (typeString === 'matrix' || typeString === 'grid' || typeString === 'multi_true_false') {
            return {
                id: uuidv4(),
                type: 'matrix',
                content: {
                    instruction: rawData.instruction || questionText || "ענו על כל השאלות:",
                    columns: rawData.columns || ["נכון", "לא נכון"],
                    rows: rawData.rows || [],
                    hints: rawData.hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionPoints(commonMetadata.bloomLevel, 'matrix') }
            };
        }

        return null;
    } catch (error) {
        console.error("Critical Mapping Error in mapSystemItemToBlock:", error);
        return null; // Fail gracefully instead of crashing
    }
};
