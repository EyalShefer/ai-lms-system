import React, { useState, useRef, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { v4 as uuidv4 } from 'uuid';

// נשתמש בקריאה ישירה אם היא לא מיוצאת, או נעתיק אותה לפה לביטחון
// במצב אידיאלי היינו מייצאים את callGeminiDirect מ-gemini.ts, 
// אבל לביטחון נממש כאן צ'אט פשוט עם אותו מפתח.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface Message {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

const AiTutor: React.FC = () => {
    const { course } = useCourseStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'ai', text: 'היי! אני המורה הפרטי שלך לקורס הזה. שאל אותי כל שאלה על החומר! 👋' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // גלילה אוטומטית למטה
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: uuidv4(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // הקשר: שם הקורס וכותרת כללית
            const context = `Context: You are a helpful AI tutor for the course "${course.title}". Answer in Hebrew. Keep answers short and encouraging.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        { role: "user", parts: [{ text: context + "\nStudent question: " + input }] }
                    ]
                })
            });

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "סליחה, אני מתקשה לענות כרגע.";

            setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', text: aiText }]);
        } catch (error) {
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

                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                    }`}>
                                    {msg.text}
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
                        <div ref={messagesEndRef} />
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