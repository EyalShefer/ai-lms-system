import { openai, MODEL_NAME } from './geminiApi';

const openaiClient = openai;

export const generateMindMapFromContent = async (
    sourceText: string,
    topic: string,
    gradeLevel: string,
    maxNodes: number = 12
): Promise<{
    title: string;
    nodes: Array<{
        id: string;
        type: 'topic' | 'subtopic' | 'detail' | 'example';
        data: { label: string; description?: string; color?: string };
        position: { x: number; y: number };
    }>;
    edges: Array<{ id: string; source: string; target: string; type?: string }>;
    suggestedLayout?: string;
} | null> => {
    const trimmedText = sourceText.slice(0, 3000);
    const prompt = `Create a Mind Map for the topic: "${topic}"
Grade level: ${gradeLevel}
Maximum nodes: ${maxNodes}

Source content:
${trimmedText}

Return JSON with this structure:
{
    "title": "Map Title",
    "nodes": [
        {
            "id": "node-1",
            "type": "topic",
            "data": { "label": "Main Topic", "description": "Short description", "color": "#4F46E5" },
            "position": { "x": 0, "y": 0 }
        },
        {
            "id": "node-2",
            "type": "subtopic",
            "data": { "label": "Subtopic", "color": "#10B981" },
            "position": { "x": 200, "y": -100 }
        }
    ],
    "edges": [
        { "id": "edge-1", "source": "node-1", "target": "node-2", "type": "smoothstep" }
    ],
    "suggestedLayout": "RL"
}

Guidelines:
- First node (type: "topic") is central, positioned at 0,0
- Arrange nodes hierarchically: topic -> subtopic -> detail -> example
- Use different colors for each level
- Create edges between related nodes
- suggestedLayout can be: "TB", "BT", "LR", "RL" (right-to-left for Hebrew)`;

    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7
        });
        const text = res.choices[0].message.content || "{}";
        return JSON.parse(text);
    } catch (e) {
        console.error("Mind Map Generation Error", e);
        return null;
    }
};
