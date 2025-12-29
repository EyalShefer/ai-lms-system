import { openai, MODEL_NAME, cleanJsonString } from '../gemini';
import { CitationService } from './citationService';
import type { SourceGuideData } from '../types/gemini.types';

export const SourceGuideService = {
    /**
     * Generates a "Source Guide" (Summary, Topics, FAQ) based on the full text.
     * Uses citations [1] where possible.
     */
    generateGuide: async (fullText: string): Promise<SourceGuideData | null> => {
        if (!fullText || fullText.length < 50) return null;

        // We use the chunks to help the AI cite correctly, 
        // asking it to reference the chunk IDs if possible.
        // For a high-level summary, we might just pass the text and ask for citations by "Paragraph X" 
        // or just let it handle the content. 
        // To be strictly grounded, we should pass the chunked text.

        // For efficiency, let's pass the text and ask it to cite roughly. 
        // Or better: Use the same "Numbered Text" format we used for the Chat.
        const chunks = CitationService.chunkText(fullText);
        const numberedContext = chunks.map(c => `[${c.id}] ${c.text}`).join("\n\n");

        const prompt = `
        Role: Pedagogical Expert.
        Task: Create a "Source Guide" for the following learning material.
        Constraint: Refer to the content as "The Text" (הטקסט) and NOT "The Article" (המאמר).
        
        Input Text (Numbered Chunks):
        """
        ${numberedContext.substring(0, 50000)} 
        """
        (Text truncated if too long)

        Output Requirements (JSON):
        1. "summary": A concise briefing (3-4 sentences) summarizing the main point. MUST include citations like [1].
        2. "topics": An array of 5 key terms/concepts defined in the text.
        3. "faq": An array of 3 questions a student might ask, with brief answers.

        Language: Hebrew.
        
        Format:
        {
            "summary": "...",
            "topics": [{ "term": "...", "definition": "..." }],
            "faq": [{ "question": "...", "answer": "..." }]
        }
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content || "{}";
            return JSON.parse(cleanJsonString(content)) as SourceGuideData;

        } catch (e) {
            console.error("Failed to generate Source Guide:", e);
            return null;
        }
    }
};
