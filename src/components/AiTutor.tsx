import React, { useState, useRef, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { validateInput, checkForDistress } from '../services/securityService';
import { openai, MODEL_NAME, BOT_PERSONAS } from '../services/ai/geminiApi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

const AiTutor: React.FC = () => {
    const { course } = useCourseStore();
    const { currentUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Determine Persona
    const personaId = course?.botPersona || 'socratic';
    const persona = BOT_PERSONAS[personaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;

    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'ai', text: persona.initialMessage }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // גלילה אוטומטית למטה (ללא קפיצות דף)
    useEffect(() => {
        if (isOpen && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        // 1. Safety Check (Distress/Violence)
        if (checkForDistress(input)) {
            // Create Alert in DB
            try {
                await addDoc(collection(db, 'safety_alerts'), {
                    studentId: currentUser?.uid || "anonymous",
                    studentName: currentUser?.displayName || "Anonymous Student",
                    courseId: course?.id || "unknown",
                    content: input,
                    severity: 'high',
                    isHandled: false,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error("Failed to save safety alert", e);
            }

            // Show supportive message & Refer to adult
            const userMsg: Message = { id: uuidv4(), role: 'user', text: input };
            const safetyMsg: Message = {
                id: uuidv4(),
                role: 'ai',
                text: `אני שומע שאתה נמצא במצוקה או חווה קושי. אני כאן ככלי עזר לימודי, אך חשוב מאוד לא להישאר עם זה לבד. אנא פנה/י בדחיפות לקבלת עזרה ממורה, הורה, יועצת בית הספר או כל מבוגר אחר שאת/ה סומך/ת עליו. הם יוכלו לסייע לך בצורה הטובה ביותר. ❤️`
            };

            setMessages(prev => [...prev, userMsg, safetyMsg]);
            setInput('');
            return;
        }

        // 2. Security Check (LLM-Filter / PII)
        const validation = validateInput(input);
        if (!validation.isValid) {
            const userMsg: Message = { id: uuidv4(), role: 'user', text: input };
            const errorMsg: Message = {
                id: uuidv4(),
                role: 'ai',
                text: `🛑 ${validation.reason}`
            };
            setMessages(prev => [...prev, userMsg, errorMsg]);
            setInput('');
            return;
        }

        // 3. Normal Flow
        const userMsg: Message = { id: uuidv4(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            let context = `Context: ${persona.systemPrompt}\nCourse: "${course?.title || 'General'}". Answer in Hebrew.`;
            if (course?.botPersona === 'concise') context += " Keep answers very short.";

            // שימוש בקליינט של OpenAI (פרוקסי)
            const response = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: context },
                    { role: "user", content: input }
                ]
            });

            const aiText = response.choices[0]?.message?.content || "סליחה, אני מתקשה לענות כרגע.";
            setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', text: aiText }]);

        } catch (error) {
            console.error("AiTutor Connection Error (OpenAI):", error);
            setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', text: "יש לי בעיית תקשורת קלה, נסה שוב עוד רגע." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`fixed bottom-6 left-6 z-50 transition-all duration-300 ${isOpen ? 'w-80 sm:w-96' : 'w-auto'}`}>
            {/* כפתור פתיחה/סגירה */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
                >
                    <span className="text-2xl">💬</span>
                </button>
            )}

            {/* חלון הצ'אט */}
            {isOpen && (
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[500px] animate-fade-in-up">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🤖</span>
                            <span className="font-bold">המורה הפרטי שלך</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 p-1 rounded transition-colors">✕</button>
                    </div>

                    <div
                        ref={containerRef}
                        className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4"
                    >
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                    }`}>
                                    <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 text-inherit">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-200 p-3 rounded-2xl rounded-bl-none animate-pulse text-gray-500 text-xs">
                                    מקליד...
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-3 bg-white border-t flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="שאל משהו..."
                            className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiTutor;