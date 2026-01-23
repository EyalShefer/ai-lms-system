
import { v4 as uuidv4 } from 'uuid';
import type { RawAiItem, MappedLearningBlock } from '../types/gemini.types';
import type { ActivityBlockType, RichOption } from '../types/courseTypes';
import { calculateQuestionWeight } from '../../utils/scoring';

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
    if (!item) {
        console.warn("mapSystemItemToBlock received null item");
        return null;
    }

    // Enhanced logging for debugging
    console.log("🎮 mapSystemItemToBlock - Input:", JSON.stringify(item, null, 2));

    // 1. ROBUST DATA NORMALIZATION
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
        console.log("🎮 Using standard data path. Keys:", Object.keys(rawData));
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

    console.log("🎮 Detected type:", typeString, "rawData keys:", Object.keys(rawData));

    // Extract Question Text (Handle all known variations - Check Root AND Data)
    const questionObj = rawData.question || item.question;

    // Handle nested question objects: { question: { text: "..." } } or { question: "..." }
    let questionText: string | undefined;
    if (typeof questionObj === 'object' && questionObj !== null) {
        // If it's an object, try to get text from various properties
        questionText = questionObj.text || questionObj.question || questionObj.instruction;
    } else if (typeof questionObj === 'string') {
        questionText = questionObj;
    }

    // Fallback to other common fields
    if (!questionText) {
        questionText = rawData.question_text || rawData.text || rawData.instruction || item.text || item.instruction;
    }

    // Final fallback to prevent empty questions
    if (!questionText || questionText.trim() === '') {
        console.warn("⚠️ mapSystemItemToBlock: No question text found, using placeholder");
        questionText = "שאלה ללא טקסט";
    }

    // Extract learning level from various possible locations
    const validLearningLevels = ['הבנה', 'יישום', 'העמקה'];
    const rawLearningLevel = item.learning_level || rawData.learning_level || (item.data as any)?.learning_level;
    const learningLevel = validLearningLevels.includes(rawLearningLevel) ? rawLearningLevel : undefined;

    const commonMetadata = {
        bloomLevel: item.bloom_level || "ידע ומיומנויות יסוד",
        feedbackCorrect: rawData.feedback_correct || rawData.feedback || "כל הכבוד! התשובה תואמת את הטקסט.",
        feedbackIncorrect: rawData.feedback_incorrect || "לא מדויק. כדאי לנסות שוב או להיעזר ברמז המודגש.",
        sourceReference: rawData.source_reference || rawData.source_reference_hint || null,
        ...(learningLevel && { learningLevel }) // Only add if defined
    };

    // === CASE A: MULTIPLE CHOICE / TRUE-FALSE ===
    // Compare against normalized strings (all hyphens converted to underscores)
    // Note: true_false_speed is a gamified version of true_false - treat the same way
    if (typeString === 'multiple_choice' || typeString === 'true_false' || typeString === 'true_false_speed' || typeString === 'teach_then_ask') {
        console.log("🎮 Handling as MULTIPLE CHOICE");
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
            if (typeString === 'true_false' || typeString === 'true_false_speed') {
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
        if (!normalizedOptions.includes(correctAnswer)) {
            console.warn(`correctAnswer "${correctAnswer}" not found in options. Attempting fuzzy match...`);

            // Try multiple matching strategies
            const lowerCorrect = correctAnswer.toLowerCase().trim();

            // Strategy 1: Case-insensitive exact match
            let matchedOption = normalizedOptions.find(opt =>
                opt.toLowerCase().trim() === lowerCorrect
            );

            // Strategy 2: Substring match (for cases where answer is short and option is long)
            if (!matchedOption) {
                matchedOption = normalizedOptions.find(opt =>
                    opt.toLowerCase().includes(lowerCorrect) ||
                    lowerCorrect.includes(opt.toLowerCase())
                );
            }

            // Strategy 3: true/false mapping for Hebrew
            if (!matchedOption && (lowerCorrect === 'true' || lowerCorrect === 'false')) {
                const trueOptions = ['נכון', 'כן', 'true', 'yes', 'אמת'];
                const falseOptions = ['לא נכון', 'לא', 'false', 'no', 'שקר'];

                if (lowerCorrect === 'true') {
                    matchedOption = normalizedOptions.find(opt =>
                        trueOptions.some(trueOpt => opt.toLowerCase().includes(trueOpt.toLowerCase()))
                    );
                } else if (lowerCorrect === 'false') {
                    matchedOption = normalizedOptions.find(opt =>
                        falseOptions.some(falseOpt => opt.toLowerCase().includes(falseOpt.toLowerCase()))
                    );
                }
            }

            // Strategy 4: Look for the correct answer in the raw data.options (might be different from interaction.choices)
            if (!matchedOption && rawData.correct_answer) {
                const dataCorrect = String(rawData.correct_answer).trim();
                matchedOption = normalizedOptions.find(opt =>
                    opt.toLowerCase().trim() === dataCorrect.toLowerCase().trim()
                );
            }

            if (matchedOption) {
                console.log(`✅ Fuzzy match found: "${correctAnswer}" → "${matchedOption}"`);
                correctAnswer = matchedOption;
            } else {
                // Last resort: use first option and log error
                console.error(`❌ CRITICAL: No valid match for correctAnswer "${correctAnswer}" in options:`, normalizedOptions);
                console.error(`This will result in WRONG ANSWERS for students! Please review the AI output.`);
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
                score: calculateQuestionWeight(typeString, commonMetadata.bloomLevel),
                progressiveHints: rawData.progressive_hints || [],
                richOptions: options.some(o => typeof o === 'object') ? options : undefined
            }
        };
    }

    // === CASE B: OPEN QUESTION ===
    if (typeString === 'open_question' || typeString === 'open_ended') {
        console.log("🎮 Handling as OPEN QUESTION");

        // Robust model answer extraction
        let modelAnswer: string;
        const rawAnswer = rawData.model_answer || rawData.teacher_guidelines || rawData.answer_key;

        if (Array.isArray(rawAnswer)) {
            // Handle array of strings/objects
            modelAnswer = rawAnswer
                .map(item => typeof item === 'string' ? item : (item.text || item.point || JSON.stringify(item)))
                .filter(Boolean)
                .join('\n- ');
            if (modelAnswer) modelAnswer = '- ' + modelAnswer; // Add leading bullet
        } else if (typeof rawAnswer === 'object' && rawAnswer !== null) {
            // Handle object - extract text fields
            modelAnswer = rawAnswer.text || rawAnswer.answer || rawAnswer.content || JSON.stringify(rawAnswer);
        } else if (typeof rawAnswer === 'string') {
            modelAnswer = rawAnswer;
        } else {
            modelAnswer = "התשובה נמצאת בחומר הלימוד.";
        }

        return {
            id: uuidv4(),
            type: 'open-question',
            content: { question: questionText },
            metadata: {
                ...commonMetadata,
                modelAnswer: modelAnswer,
                score: calculateQuestionWeight('open_question', commonMetadata.bloomLevel)
            }
        };
    }

    // === CASE C: ORDERING / SEQUENCING ===
    if (typeString === 'ordering' || typeString === 'sequencing') {
        console.log("🎮 Handling as ORDERING");
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
            metadata: { ...commonMetadata, score: calculateQuestionWeight('ordering', commonMetadata.bloomLevel) }
        };
    }

    // === CASE D-EARLY: MATCHING with leftItems (new format) - must come BEFORE categorization ===
    // This handles the new matching format with leftItems/rightItems (line drawing)
    if (typeString === 'matching' && (rawData.leftItems || rawData.left_items)) {
        console.log("🎮 Handling as MATCHING (line drawing - early check)");
        const leftItems = rawData.leftItems || rawData.left_items || [];
        const rightItems = rawData.rightItems || rawData.right_items || [];
        const correctMatches = rawData.correctMatches || rawData.correct_matches || [];

        return {
            id: uuidv4(),
            type: 'matching' as ActivityBlockType,
            content: {
                instruction: questionText || rawData.instruction || "התאימו בין הפריטים:",
                leftItems: leftItems.length > 0 ? leftItems : [{ id: '1', text: 'פריט 1' }],
                rightItems: rightItems.length > 0 ? rightItems : [{ id: 'a', text: 'התאמה 1' }],
                correctMatches: correctMatches,
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('matching', commonMetadata.bloomLevel) }
        };
    }

    // === CASE D: CATEGORIZATION / GROUPING ===
    // Note: 'matching' with pairs (old format) still falls through here
    if (typeString === 'categorization' || typeString === 'grouping' || (typeString === 'matching' && rawData.pairs)) {
        console.log("🎮 Handling as CATEGORIZATION");
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
            metadata: { ...commonMetadata, score: calculateQuestionWeight('categorization', commonMetadata.bloomLevel) }
        };
    }

    // === CASE F: FILL IN BLANKS ===
    if (typeString === 'fill_in_blanks' || typeString === 'cloze') {
        console.log("🎮 Handling as FILL IN BLANKS");
        const rawSentence = rawData.text || rawData.content || rawData.sentence || questionText || "חסר טקסט להשלמה";
        let bank = rawData.word_bank || rawData.options || [];

        return {
            id: uuidv4(),
            type: 'fill_in_blanks',
            content: {
                sentence: rawSentence,
            },
            metadata: {
                ...commonMetadata,
                score: calculateQuestionWeight('fill_in_blanks', commonMetadata.bloomLevel),
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
                score: calculateQuestionWeight('audio_response', commonMetadata.bloomLevel)
            }
        };
    }

    // === CASE H: MEMORY GAME ===
    if (typeString === 'memory_game' || typeString === 'memory' || typeString === 'matching_pairs') {
        console.log("🎮 Handling as MEMORY GAME");
        const pairs = rawData.pairs || rawData.cards || [];
        console.log("🎮 Memory game pairs found:", pairs.length, pairs);

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

        console.log("🎮 Normalized pairs:", normalizedPairs.length);

        if (normalizedPairs.length < 2) {
            console.warn("❌ Memory game pairs missing or too few. Required: 2+, Got:", normalizedPairs.length);
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
            metadata: { ...commonMetadata, score: calculateQuestionWeight('memory_game', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: MATCHING (התאמה / מתיחת קו) ===
    if (typeString === 'matching_lines' || (typeString === 'matching' && rawData.leftItems)) {
        console.log("🎮 Handling as MATCHING (line drawing)");
        const leftItems = rawData.leftItems || rawData.left_items || [];
        const rightItems = rawData.rightItems || rawData.right_items || [];
        const correctMatches = rawData.correctMatches || rawData.correct_matches || [];

        return {
            id: uuidv4(),
            type: 'matching' as ActivityBlockType,
            content: {
                instruction: questionText || "התאימו בין הפריטים:",
                leftItems: leftItems.length > 0 ? leftItems : [{ id: '1', text: 'פריט 1' }],
                rightItems: rightItems.length > 0 ? rightItems : [{ id: 'a', text: 'התאמה 1' }],
                correctMatches: correctMatches,
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('matching', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: HIGHLIGHT (הקפה / סימון) ===
    if (typeString === 'highlight' || typeString === 'circle' || typeString === 'underline') {
        console.log("🎮 Handling as HIGHLIGHT");
        return {
            id: uuidv4(),
            type: 'highlight' as ActivityBlockType,
            content: {
                instruction: questionText || "סמנו את התשובות הנכונות בטקסט:",
                text: rawData.text || rawData.content || "טקסט לסימון",
                correctHighlights: rawData.correctHighlights || rawData.correct_highlights || [],
                highlightType: rawData.highlightType || rawData.highlight_type || 'background',
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('highlight', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: SENTENCE BUILDER (סידור משפטים) ===
    if (typeString === 'sentence_builder' || typeString === 'word_order' || typeString === 'scrambled_sentence') {
        console.log("🎮 Handling as SENTENCE BUILDER");
        const words = rawData.words || rawData.items || [];
        const correctSentence = rawData.correctSentence || rawData.correct_sentence || words.join(' ');

        return {
            id: uuidv4(),
            type: 'sentence_builder' as ActivityBlockType,
            content: {
                instruction: questionText || "סדרו את המילים למשפט:",
                words: words.length > 0 ? words : ["מילה1", "מילה2", "מילה3"],
                correctSentence: correctSentence,
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('sentence_builder', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: IMAGE LABELING (תיוג תמונה) ===
    if (typeString === 'image_labeling' || typeString === 'diagram_labeling' || typeString === 'label_image') {
        console.log("🎮 Handling as IMAGE LABELING");
        return {
            id: uuidv4(),
            type: 'image_labeling' as ActivityBlockType,
            content: {
                instruction: questionText || "גררו את התוויות למקומות המתאימים:",
                imageUrl: rawData.imageUrl || rawData.image_url || '',
                labels: rawData.labels || [],
                dropZones: rawData.dropZones || rawData.drop_zones || [],
                hints: rawData.hints || rawData.progressive_hints || [],
                imageDescription: rawData.imageDescription || rawData.image_description || ''
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('image_labeling', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: TABLE COMPLETION (השלמת טבלה) ===
    if (typeString === 'table_completion' || typeString === 'fill_table' || typeString === 'complete_table') {
        console.log("🎮 Handling as TABLE COMPLETION");
        return {
            id: uuidv4(),
            type: 'table_completion' as ActivityBlockType,
            content: {
                instruction: questionText || "השלימו את הטבלה:",
                headers: rawData.headers || ["עמודה 1", "עמודה 2"],
                rows: rawData.rows || [],
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('table_completion', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: TEXT SELECTION (בחירת טקסט) ===
    if (typeString === 'text_selection' || typeString === 'select_words' || typeString === 'select_text') {
        console.log("🎮 Handling as TEXT SELECTION");
        return {
            id: uuidv4(),
            type: 'text_selection' as ActivityBlockType,
            content: {
                instruction: questionText || "בחרו את הטקסטים המתאימים:",
                text: rawData.text || rawData.content || "טקסט לבחירה",
                selectableUnits: rawData.selectableUnits || rawData.selectable_units || 'word',
                correctSelections: rawData.correctSelections || rawData.correct_selections || [],
                minSelections: rawData.minSelections || rawData.min_selections || 1,
                maxSelections: rawData.maxSelections || rawData.max_selections,
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('text_selection', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: RATING SCALE (סקאלת דירוג) ===
    if (typeString === 'rating_scale' || typeString === 'scale' || typeString === 'likert') {
        console.log("🎮 Handling as RATING SCALE");
        return {
            id: uuidv4(),
            type: 'rating_scale' as ActivityBlockType,
            content: {
                question: questionText || "דרגו:",
                minValue: rawData.minValue || rawData.min_value || 1,
                maxValue: rawData.maxValue || rawData.max_value || 5,
                minLabel: rawData.minLabel || rawData.min_label || "נמוך",
                maxLabel: rawData.maxLabel || rawData.max_label || "גבוה",
                correctAnswer: rawData.correct_answer,
                showNumbers: rawData.showNumbers !== undefined ? rawData.showNumbers : true
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('rating_scale', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: MATRIX (מטריקס) ===
    if (typeString === 'matrix' || typeString === 'grid' || typeString === 'multi_true_false') {
        console.log("🎮 Handling as MATRIX");
        return {
            id: uuidv4(),
            type: 'matrix' as ActivityBlockType,
            content: {
                instruction: questionText || "ענו על כל השאלות:",
                columns: rawData.columns || ["נכון", "לא נכון"],
                rows: rawData.rows || [],
                hints: rawData.hints || rawData.progressive_hints || []
            },
            metadata: { ...commonMetadata, score: calculateQuestionWeight('matrix', commonMetadata.bloomLevel) }
        };
    }

    // === CASE: FILL IN BLANKS (השלמת משפטים) ===
    if (typeString === 'fill_in_blank' || typeString === 'fill_in_blanks' || typeString === 'fill_blank' || typeString === 'cloze') {
        console.log("🎮 Handling as FILL IN BLANKS");

        // Handle multiple AI response formats:
        // Format 1: { sentences: [{text, answer}, ...], bank: [...] }
        // Format 2: { text: "sentence with [blanks]" } - ClozeQuestion component parses brackets (PREFERRED)
        // Format 3: { sentences: ["text with ___"], answers: ["answer1", "answer2"] } - separate arrays
        // Format 4: questionText contains the cloze sentence directly

        const sentences = rawData.sentences || [];
        const answers = rawData.answers || [];
        const bank = rawData.bank || rawData.word_bank || [];

        // PRIORITY 1: If AI returned text with [brackets], use ClozeQuestion's built-in parsing
        // This is the preferred format because it's unambiguous and handles inline blanks
        const directText = rawData.text || rawData.sentence || rawData.content;

        // Check if directText has brackets (indicating it's properly formatted for ClozeQuestion)
        const hasBrackets = directText && (directText.includes('[') || directText.includes(']'));

        if (hasBrackets) {
            // AI returned properly formatted text with [brackets] - this is the best format
            console.log("🎮 FILL IN BLANKS: Using direct text format with [brackets]:", directText.substring(0, 50) + "...");
            return {
                id: uuidv4(),
                type: 'fill_in_blanks' as ActivityBlockType,
                content: {
                    text: directText, // ClozeQuestion will parse [brackets] from this
                    hidden_words: bank, // Word bank as hidden_words fallback
                    distractors: []
                },
                metadata: {
                    ...commonMetadata,
                    score: calculateQuestionWeight('fill_in_blanks', commonMetadata.bloomLevel),
                    wordBank: bank // Backup for ClozeQuestion's fallback logic
                }
            };
        }

        // PRIORITY 2: Handle Format 3 - sentences as strings + separate answers array
        if (sentences.length > 0 && typeof sentences[0] === 'string' && answers.length > 0) {
            console.log("🎮 FILL IN BLANKS: Converting sentences/answers arrays to blanks format");
            const blanks: { sentence: string; answer: string }[] = (sentences as string[]).map((s: string, i: number) => ({
                sentence: s,
                answer: String(answers[i] || "")
            }));

            return {
                id: uuidv4(),
                type: 'fill_in_blanks' as ActivityBlockType,
                content: {
                    instruction: rawData.instruction || questionText || "השלימו את המשפטים הבאים:",
                    blanks: blanks,
                    wordBank: bank,
                    hints: rawData.hints || rawData.progressive_hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionWeight('fill_in_blanks', commonMetadata.bloomLevel) }
            };
        }

        // PRIORITY 3: Handle Format 1 - sentences as objects with text/answer
        if (sentences.length > 0 && typeof sentences[0] === 'object') {
            console.log("🎮 FILL IN BLANKS: Using object-based sentences format");
            const blanks: { sentence: string; answer: string }[] = sentences.map((s: any) => ({
                sentence: s.text || s.sentence || "",
                answer: s.answer || s.correct || ""
            }));

            return {
                id: uuidv4(),
                type: 'fill_in_blanks' as ActivityBlockType,
                content: {
                    instruction: questionText || "השלימו את המשפטים הבאים:",
                    blanks: blanks,
                    wordBank: bank,
                    hints: rawData.hints || rawData.progressive_hints || []
                },
                metadata: { ...commonMetadata, score: calculateQuestionWeight('fill_in_blanks', commonMetadata.bloomLevel) }
            };
        }

        // FALLBACK: No proper data found - log error and return minimal structure
        console.error("❌ FILL IN BLANKS: No valid data format found. Data:", {
            hasDirectText: !!directText,
            hasBrackets,
            sentencesLength: sentences.length,
            sentencesType: sentences[0] ? typeof sentences[0] : 'none',
            answersLength: answers.length
        });

        // Return empty structure with warning in content
        return {
            id: uuidv4(),
            type: 'fill_in_blanks' as ActivityBlockType,
            content: {
                instruction: "⚠️ שגיאה: לא נמצא תוכן מתאים לשאלה",
                blanks: [],
                wordBank: [],
                hints: []
            },
            metadata: { ...commonMetadata, score: 0, hasError: true }
        };
    }

    // If no type matched, log a warning
    console.warn("❌ mapSystemItemToBlock: Unknown type -", typeString);
    return null;
};
