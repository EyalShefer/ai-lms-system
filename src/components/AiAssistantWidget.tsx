/**
 * AI Assistant Widget
 * כפתור צף עם ממשק צ'אט לעזרה למורים
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    IconSparkles,
    IconX,
    IconSend,
    IconUser,
    IconRobot,
    IconLoader2,
    IconCopy,
    IconCheck,
    IconRefresh,
    IconBulb,
    IconChartBar,
    IconUsers,
    IconMessage
} from '@tabler/icons-react';
import { refineContentWithPedagogy } from '../services/ai/geminiApi';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface AiAssistantWidgetProps {
    context?: {
        courseTitle?: string;
        studentCount?: number;
        avgAccuracy?: number;
        atRiskStudents?: string[];
    };
    position?: 'bottom-left' | 'bottom-right';
}

// Quick action suggestions
const QUICK_ACTIONS = [
    { id: 'risk', label: 'מי צריך חיזוק?', icon: <IconUsers className="w-4 h-4" /> },
    { id: 'activity', label: 'הצע פעילות', icon: <IconBulb className="w-4 h-4" /> },
    { id: 'feedback', label: 'נסח משוב', icon: <IconMessage className="w-4 h-4" /> },
    { id: 'analyze', label: 'נתח ביצועים', icon: <IconChartBar className="w-4 h-4" /> }
];

// System prompt for teacher assistance
const TEACHER_SYSTEM_PROMPT = `אתה עוזר AI מקצועי למורים במערכת למידה דיגיטלית.
תפקידך לסייע למורים לנתח ביצועי תלמידים, לתכנן פעילויות ולספק משוב מותאם.

יכולותיך:
- ניתוח ביצועי תלמידים וזיהוי מי זקוק לחיזוק
- הצעת פעילויות מותאמות לרמת הכיתה
- ניסוח משוב בונה ומעודד
- המלצות פדגוגיות מבוססות נתונים

הנחיות:
- ענה בעברית תקינה וברורה
- התייחס לנתונים שקיבלת על הכיתה
- הצע פתרונות מעשיים ובני ביצוע
- היה תומך ומקצועי`;

export const AiAssistantWidget: React.FC<AiAssistantWidgetProps> = ({
    context,
    position = 'bottom-left'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Build context string
    const buildContextString = useCallback(() => {
        if (!context) return '';

        const parts = [];
        if (context.courseTitle) parts.push(`פעילות: ${context.courseTitle}`);
        if (context.studentCount) parts.push(`מספר תלמידים: ${context.studentCount}`);
        if (context.avgAccuracy) parts.push(`ממוצע כיתתי: ${context.avgAccuracy}%`);
        if (context.atRiskStudents?.length) {
            parts.push(`תלמידים בסיכון: ${context.atRiskStudents.join(', ')}`);
        }

        return parts.length > 0 ? `\n\nמידע על הכיתה:\n${parts.join('\n')}` : '';
    }, [context]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Build conversation history for context
            const conversationHistory = messages.map(m =>
                `${m.role === 'user' ? 'מורה' : 'עוזר'}: ${m.content}`
            ).join('\n\n');

            const fullPrompt = `${TEACHER_SYSTEM_PROMPT}${buildContextString()}

${conversationHistory ? `היסטוריית שיחה:\n${conversationHistory}\n\n` : ''}מורה: ${content}

עוזר:`;

            const response = await refineContentWithPedagogy(fullPrompt, 'ענה כעוזר AI למורה בקצרה ובעברית');

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'מצטער, אירעה שגיאה. נסה שוב מאוחר יותר.',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading, buildContextString]);

    const handleQuickAction = useCallback((actionId: string) => {
        const actionMessages: Record<string, string> = {
            risk: 'מי מהתלמידים שלי צריך חיזוק ומה אני יכול לעשות כדי לעזור לו?',
            activity: 'הצע פעילות העמקה מעניינת שמתאימה לרמת הכיתה שלי',
            feedback: 'עזור לי לנסח משוב מעודד לתלמיד שמתקשה אבל משתדל',
            analyze: 'נתח לי את ביצועי הכיתה ותן לי תובנות מרכזיות'
        };

        sendMessage(actionMessages[actionId] || '');
    }, [sendMessage]);

    const handleCopy = useCallback(async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(messageId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    const positionClass = position === 'bottom-right' ? 'right-6' : 'left-6';

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    fixed bottom-6 ${positionClass} z-40
                    w-14 h-14 rounded-full shadow-xl
                    flex items-center justify-center
                    transition-all duration-300 transform
                    ${isOpen
                        ? 'bg-slate-700 rotate-0 scale-90'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-110'
                    }
                `}
            >
                {isOpen ? (
                    <IconX className="w-6 h-6 text-white" />
                ) : (
                    <IconSparkles className="w-6 h-6 text-white" />
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    className={`
                        fixed bottom-24 ${positionClass} z-40
                        w-[380px] max-h-[600px]
                        bg-white rounded-[24px] shadow-2xl
                        flex flex-col overflow-hidden
                        border border-slate-200
                        animate-in slide-in-from-bottom-4 duration-300
                    `}
                >
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-l from-indigo-500 to-purple-600 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <IconSparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold">עוזר AI למורים</h3>
                                    <p className="text-xs text-white/70">כאן לעזור לך</p>
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <button
                                    onClick={clearChat}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    title="נקה שיחה"
                                >
                                    <IconRefresh className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
                        {messages.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <IconRobot className="w-8 h-8 text-indigo-600" />
                                </div>
                                <h4 className="font-bold text-slate-700 mb-2">
                                    שלום! איך אוכל לעזור?
                                </h4>
                                <p className="text-sm text-slate-500">
                                    בחר פעולה מהירה או שאל שאלה
                                </p>

                                {/* Quick Actions */}
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {QUICK_ACTIONS.map((action) => (
                                        <button
                                            key={action.id}
                                            onClick={() => handleQuickAction(action.id)}
                                            className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm text-slate-700 transition-colors"
                                        >
                                            <span className="text-indigo-500">{action.icon}</span>
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                        ${message.role === 'user'
                                            ? 'bg-indigo-100 text-indigo-600'
                                            : 'bg-purple-100 text-purple-600'
                                        }
                                    `}>
                                        {message.role === 'user'
                                            ? <IconUser className="w-4 h-4" />
                                            : <IconRobot className="w-4 h-4" />
                                        }
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`
                                        max-w-[85%] rounded-2xl p-3 group relative
                                        ${message.role === 'user'
                                            ? 'bg-indigo-500 text-white rounded-tr-none'
                                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                        }
                                    `}>
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                        {/* Copy button for assistant messages */}
                                        {message.role === 'assistant' && (
                                            <button
                                                onClick={() => handleCopy(message.content, message.id)}
                                                className="absolute -bottom-1 -left-1 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                {copiedId === message.id ? (
                                                    <IconCheck className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <IconCopy className="w-3 h-3 text-slate-400" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                    <IconRobot className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="bg-slate-100 rounded-2xl rounded-tl-none p-3">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">חושב...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="שאל אותי משהו..."
                                className="flex-1 resize-none rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none max-h-24"
                                rows={1}
                                dir="rtl"
                            />
                            <button
                                onClick={() => sendMessage(inputValue)}
                                disabled={!inputValue.trim() || isLoading}
                                className={`
                                    p-3 rounded-xl transition-all
                                    ${!inputValue.trim() || isLoading
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                                    }
                                `}
                            >
                                <IconSend className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AiAssistantWidget;
