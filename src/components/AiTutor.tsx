import React, { useState, useRef, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { GoogleGenerativeAI } from "@google/generative-ai";

const AiTutor: React.FC = () => {
    const { fullBookContent } = useCourseStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
        { role: 'ai', text: 'היי! אני ה-AI של הקורס. אני מכיר את כל חומר הלימוד. יש לך שאלה?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const context = fullBookContent
                ? `CONTEXT (Book Material): """${fullBookContent.substring(0, 30000)}"""`
                : `CONTEXT: Answer based on general knowledge related to the course topic.`;

            const prompt = `
                You are a helpful tutor.
                ${context}
                Student Question: "${userMsg}"
                Reply in HEBREW.
            `;

            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();

            setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: "תקלה." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 left-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl z-50"
            >
                🤖
            </button>

            {isOpen && (
                <div className="fixed bottom-24 left-6 w-80 h-[400px] bg-white rounded-xl shadow-2xl border flex flex-col z-50">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between">
                        <span>המורה הפרטי</span>
                        <button onClick={() => setIsOpen(false)}>✕</button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`p-2 rounded ${msg.role === 'user' ? 'bg-indigo-100 self-end' : 'bg-white border'}`}>
                                {msg.text}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 border-t flex gap-2">
                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 border p-2 rounded" />
                        <button onClick={handleSend} className="bg-indigo-600 text-white p-2 rounded">➤</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AiTutor;