export interface TextChunk {
    id: number;
    text: string;
    startChar: number;
    endChar: number;
}

export const CitationService = {
    /**
     * Splits a long text into numbered chunks for the AI to reference.
     * Strategy: Split by paragraphs or roughly 300 characters to keep granularity high.
     */
    chunkText: (fullText: string): TextChunk[] => {
        if (!fullText) return [];

        // Split by newlines first to respect natural paragraphs
        const rawParagraphs = fullText.split(/\n+/).filter(p => p.trim().length > 0);
        let chunks: TextChunk[] = [];
        let globalCharIndex = 0;
        let chunkCounter = 1;

        rawParagraphs.forEach(para => {
            // If paragraph is HUGE, we might want to split it further (future optimization)
            // For now, keep it simple: One paragraph = One chunk (unless it's tiny, maybe merge?)

            // Simple logic: One numbered chunk per paragraph.
            chunks.push({
                id: chunkCounter,
                text: para.trim(),
                startChar: globalCharIndex,
                endChar: globalCharIndex + para.length
            });

            globalCharIndex += para.length + 1; // +1 for the newline
            chunkCounter++;
        });

        return chunks;
    },

    /**
     * Constructs the "Grounded System Prompt" that forces the AI to use citations.
     */
    constructSystemPrompt: (chunks: TextChunk[], personaPrompt: string): string => {
        // Format the context with [1], [2], etc.
        const numberedContext = chunks
            .map(c => `[${c.id}] ${c.text}`)
            .join("\n\n");

        return `
${personaPrompt}

### INSTRUCTIONS FOR GROUNDED ANSWERS (CRITICAL):
1.  **Source Material:** You have been provided with a numbered text below.
2.  **Strict Citation Rule:** Every single claim you make MUST be followed by a citation in the format \`[X]\` where X is the chunk number.
    *   Example: "Napoleon was born in Corsica [1] and rose to power in 1799 [4]."
3.  **No Outside Knowledge:** Answer ONLY based on the text provided. If the answer is not in the text, say "I cannot find the answer in the source material."
4.  **Tone:** Be helpful and pedagogical, but strictly grounded.

### SOURCE TEXT (NUMBERED CHUNKS):
${numberedContext}
`;
    }
};
