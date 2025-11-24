// --- פונקציה 4: שכתוב פדגוגי (מטה הקסם) ---
export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) throw new Error("Missing API Key");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const promptText = `
    Act as a Pedagogical Expert.
    Rewrite and enhance the following text to specifically foster the skill of: "${skill}".
    
    Original Text:
    "${text}"

    Instructions for "${skill}":
    - If "Critical Thinking": Add probing questions, present conflicting viewpoints, encourage skepticism.
    - If "Creativity": Use metaphors, storytelling, ask "what if" questions.
    - If "Empathy/Perspective": Focus on the human experience, emotions, and different points of view.
    - If "Information Literacy": Encourage checking sources, distinguishing fact from opinion.
    - If "Simplification": Make it simpler for younger students.

    Output Requirement:
    - Return ONLY the rewritten text in HEBREW.
    - Keep the same core facts, but change the tone and structure to match the skill.
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;

  } catch (error) {
    console.error("Refinement failed:", error);
    return text; // במקרה של שגיאה, נחזיר את המקור
  }
}