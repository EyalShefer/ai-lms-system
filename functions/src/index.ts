import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import { v4 as uuidv4 } from 'uuid';

// 1. אתחול
initializeApp();
const db = getFirestore();
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const MODEL_NAME = "gpt-4o-mini";

// --- פונקציות עזר ---

// פונקציה חדשה וקריטית: מנקה שדות undefined שגורמים לקריסה
const sanitizeData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        return value === undefined ? null : value;
    }));
};

const cleanJsonString = (text: string): string => {
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
        logger.error("JSON cleaning failed", e);
        return text;
    }
};

// שימוש ב-any כדי למנוע שגיאות טיפוסים
const mapSystemItemToBlock = (item: any) => {
    const commonMetadata = {
        bloomLevel: item.bloom_level,
        feedbackCorrect: item.feedback_correct,
        feedbackIncorrect: item.feedback_incorrect,
        sourceReference: item.source_reference
    };

    if (item.type === 'multiple_choice' || item.type === 'true_false') {
        let options = item.content.options || [];
        let correctAnswer = "";
        if (typeof item.content.correct_index === 'number' && options[item.content.correct_index]) {
            correctAnswer = options[item.content.correct_index];
        } else {
            correctAnswer = options[0] || "";
        }
        return {
            id: uuidv4(),
            type: 'multiple-choice',
            content: { question: item.question_text, options: options, correctAnswer: correctAnswer },
            metadata: { ...commonMetadata, score: 10 }
        };
    }

    if (item.type === 'open_question') {
        return {
            id: uuidv4(),
            type: 'open-question',
            content: { question: item.question_text },
            metadata: {
                ...commonMetadata,
                modelAnswer: item.content.key_points ? item.content.key_points.join('\n') : "תשובה מלאה",
                hint: item.content.hint, // כאן הבעיה! לפעמים זה undefined
                score: 20
            }
        };
    }

    if (item.type === 'sorting' || item.type === 'sequencing') {
        const isSorting = item.type === 'sorting';
        return {
            id: uuidv4(),
            type: 'multiple-choice',
            content: {
                question: item.question_text + (isSorting ? " (בחר את ההתאמה הנכונה)" : " (בחר את הסדר הנכון)"),
                options: isSorting
                    ? ["התאמה נכונה של הפריטים לקטגוריות", "התאמה שגויה", "התאמה חלקית", "אף תשובה אינה נכונה"]
                    : ["הסדר הנכון כפי שנלמד", "סדר הפוך", "סדר אקראי א", "סדר אקראי ב"],
                correctAnswer: isSorting ? "התאמה נכונה של הפריטים לקטגוריות" : "הסדר הנכון כפי שנלמד"
            },
            metadata: { ...commonMetadata, note: "הומר אוטומטית משאלת מיון/רצף" }
        };
    }

    return null;
};

// --- Cloud Function ---

export const generateLessonPlan = onDocumentCreated(
    {
        document: "course_generation_queue/{docId}",
        secrets: [openAiApiKey],
        timeoutSeconds: 300,
        memory: "512MiB",
    },
    async (event) => {
        if (!event.data) return;

        const docId = event.params.docId;

        // המרה ל-any כדי למנוע שגיאות טיפוסים
        const data = event.data.data() as any;

        if (!data || data.status !== "pending") return;

        try {
            logger.info(`Starting generation for document ${docId}`);
            await event.data.ref.update({ status: "processing" });

            const openai = new OpenAI({ apiKey: openAiApiKey.value() });

            const { topic, gradeLevel, subject = "כללי", fileData } = data;
            const unitTitle = topic || "פעילות למידה";

            const systemPrompt = `
        You are an expert pedagogical content generator for the subject: ${subject}.
        Target Audience: ${gradeLevel}.
        Language: Hebrew (Ivrit).
        Subject Lens: Analyze the topic "${topic}" strictly through the perspective of ${subject}.
        Source Material: ${fileData ? "Base all questions on the provided image/document." : "Use your general knowledge."}
        Output Format: Provide a VALID JSON array of objects. Do not wrap in markdown.
        Schema per item:
        {
          "id": 1,
          "bloom_level": "Knowledge" | "Understanding" | "Analysis",
          "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
          "question_text": "Hebrew question...",
          "source_reference": "Reference if applicable",
          "feedback_correct": "Positive feedback",
          "feedback_incorrect": "Constructive feedback",
          "content": {
              "options": ["Opt1", "Opt2", "Opt3", "Opt4"], 
              "correct_index": 0, 
              "hint": "Hebrew hint",
              "key_points": ["Point 1", "Point 2"]
          }
        }
        Create 6-8 diverse items.
      `;

            const userMessageContent: any[] = [
                { type: "text", text: `Create learning content for topic: ${topic}, Unit: ${unitTitle}.` }
            ];

            if (fileData) {
                const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
                userMessageContent.push({
                    type: "image_url",
                    image_url: { url: dataUrl }
                });
            }

            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessageContent as any }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const responseText = completion.choices[0].message.content || "[]";

            let generatedItems: any;
            try {
                const parsed = JSON.parse(responseText);
                if (Array.isArray(parsed)) {
                    generatedItems = parsed;
                } else {
                    generatedItems = Object.values(parsed)[0];
                }
            } catch (e) {
                generatedItems = JSON.parse(cleanJsonString(responseText));
            }

            const blocks: any[] = [];

            blocks.push({
                id: uuidv4(),
                type: 'text',
                content: `### ברוכים הבאים לשיעור ב${subject}\n**נושא:** ${unitTitle}\nמותאם עבור ${gradeLevel}.`,
                metadata: {}
            });

            blocks.push({
                id: uuidv4(),
                type: 'interactive-chat',
                content: { title: "המורה הוירטואלי", description: `עזרה בנושאי ${subject}` },
                metadata: {
                    botPersona: 'teacher',
                    initialMessage: `שלום! אני המורה ל${subject}. איך אפשר לעזור בנושא ${unitTitle}?`,
                    systemPrompt: `אתה מורה ל${subject} בכיתה ${gradeLevel}. ענה בעברית רק בהקשר ל${topic}.`
                }
            });

            if (Array.isArray(generatedItems)) {
                generatedItems.forEach((item: any) => {
                    const block = mapSystemItemToBlock(item);
                    if (block) blocks.push(block);
                });
            }

            const finalPlan = [
                {
                    id: uuidv4(),
                    title: "פעילות אינטראקטיבית",
                    learningUnits: [
                        {
                            id: uuidv4(),
                            title: topic || "פעילות למידה",
                            type: 'practice',
                            activityBlocks: blocks
                        }
                    ]
                }
            ];

            // --- התיקון: ניקוי הנתונים לפני השמירה ---
            const cleanFinalPlan = sanitizeData(finalPlan);

            await event.data.ref.update({
                status: "completed",
                result: cleanFinalPlan, // שומרים את הגרסה הנקייה
                updatedAt: new Date(),
            });

            logger.info(`Successfully generated lesson for ${docId}`);

        } catch (error: any) {
            logger.error("Error generating lesson:", error);
            await event.data.ref.update({
                status: "error",
                error: error.message || "Unknown error occurred",
            });
        }
    }
);