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
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const context = fullBookContent
                ? `CONTEXT (Book Material): """${fullBookContent.substring(0, 30000)}"""`
                : `CONTEXT: Answer based on general knowledge related to the course topic.`;

            const prompt = `
                You are a helpful tutor.
                ${context}
                Student Question: "${userMsg}"
                Reply in HEBREW. Be concise and helpful.
            `;

            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();

            setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: "אופס, יש בעיית תקשורת." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 left-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-all z-50 flex items-center gap-2"
            >
                <span className="text-2xl">🤖</span>
                {!isOpen && <span className="font-bold hidden md:inline">עזרה</span>}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 left-6 w-80 md:w-96 h-[400px] md:h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                        <div className="font-bold flex items-center gap-2"><span>🤖</span> המורה הפרטי</div>
                        <button onClick={() => setIsOpen(false)} className="text-white hover:bg-indigo-500 rounded-full p-1 font-bold">✕</button>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="text-xs text-gray-400 mr-2">מקליד...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 bg-white border-t flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="שאל משהו..."
                            className="flex-1 p-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
                        />
                        <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 font-bold">➤</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AiTutor;