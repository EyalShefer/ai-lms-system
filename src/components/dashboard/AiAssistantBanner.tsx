/**
 * AI Assistant Banner Component
 * באנר עוזר AI למורה בראש הדף - בולט עם דוגמאות לשאלות
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    IconSparkles,
    IconSend,
    IconUser,
    IconRobot,
    IconLoader2,
    IconX,
    IconBulb,
    IconChartBar,
    IconUsers,
    IconMessage,
    IconChevronDown,
    IconChevronUp,
    IconCopy,
    IconCheck
} from '@tabler/icons-react';
import { refineContentWithPedagogy } from '../../services/ai/geminiApi';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface AiAssistantBannerProps {
    context?: {
        courseTitle?: string;
        studentCount?: number;
        avgAccuracy?: number;
        atRiskStudents?: string[];
    };
    className?: string;
}

// Quick action suggestions
const QUICK_ACTIONS = [
    {
        id: 'risk',
        label: 'מי צריך חיזוק?',
        icon: <IconUsers className="w-4 h-4" />,
        question: 'מי מהתלמידים שלי צריך חיזוק ומה אני יכול לעשות כדי לעזור לו?'
    },
    {
        id: 'activity',
        label: 'הצע פעילות',
        icon: <IconBulb className="w-4 h-4" />,
        question: 'הצע פעילות העשרה מעניינת שמתאימה לרמת הכיתה שלי'
    },
    {
        id: 'feedback',
        label: 'נסח משוב',
        icon: <IconMessage className="w-4 h-4" />,
        question: 'עזור לי לנסח משוב מעודד לתלמיד שמתקשה אבל משתדל'
    },
    {
        id: 'analyze',
        label: 'נתח ביצועים',
        icon: <IconChartBar className="w-4 h-4" />,
        question: 'נתח לי את ביצועי הכיתה ותן לי תובנות מרכזיות'
    }
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

export const AiAssistantBanner: React.FC<AiAssistantBannerProps> = ({
    context,
    className = ''
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current && isExpanded) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isExpanded]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

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
        setIsExpanded(true);

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

    const handleQuickAction = useCallback((action: typeof QUICK_ACTIONS[0]) => {
        sendMessage(action.question);
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

    return (
        <div className={`bg-gradient-to-l from-indigo-600 to-purple-700 rounded-[24px] shadow-xl overflow-hidden ${className}`}>
            {/* Header - Always Visible */}
            <div className="p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* AI Icon */}
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <IconSparkles className="w-8 h-8 text-white" />
                        </div>

                        {/* Title & Description */}
                        <div className="text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                עוזר AI למורים
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-normal">
                                    Beta
                                </span>
                            </h2>
                            <p className="text-white/70 text-sm">
                                שאל אותי כל שאלה על הכיתה שלך - אני כאן לעזור!
                            </p>
                        </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        {isExpanded ? (
                            <IconChevronUp className="w-5 h-5 text-white" />
                        ) : (
                            <IconChevronDown className="w-5 h-5 text-white" />
                        )}
                    </button>
                </div>

                {/* Quick Actions - Always Visible */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-white/60 text-sm ml-2">שאלות לדוגמה:</span>
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleQuickAction(action)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expandable Chat Section */}
            {isExpanded && (
                <div className="bg-white rounded-t-[24px]">
                    {/* Messages Area */}
                    <div className="max-h-[400px] overflow-y-auto p-5 space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <IconRobot className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm">
                                    לחץ על אחת השאלות למעלה או הקלד שאלה משלך
                                </p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div className={`
                                        w-9 h-9 rounded-full flex items-center justify-center shrink-0
                                        ${message.role === 'user'
                                            ? 'bg-indigo-100 text-indigo-600'
                                            : 'bg-purple-100 text-purple-600'
                                        }
                                    `}>
                                        {message.role === 'user'
                                            ? <IconUser className="w-5 h-5" />
                                            : <IconRobot className="w-5 h-5" />
                                        }
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`
                                        max-w-[80%] rounded-2xl p-4 group relative
                                        ${message.role === 'user'
                                            ? 'bg-indigo-500 text-white rounded-tr-none'
                                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                        }
                                    `}>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                                        {/* Copy button for assistant messages */}
                                        {message.role === 'assistant' && (
                                            <button
                                                onClick={() => handleCopy(message.content, message.id)}
                                                className="absolute -bottom-2 -left-2 p-2 bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                {copiedId === message.id ? (
                                                    <IconCheck className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <IconCopy className="w-4 h-4 text-slate-400 hover:text-slate-600" />
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
                                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                                    <IconRobot className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="bg-slate-100 rounded-2xl rounded-tl-none p-4">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">חושב...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[24px]">
                        <div className="flex items-end gap-3">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="הקלד שאלה..."
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
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }
                                `}
                            >
                                <IconSend className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Clear chat button */}
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                נקה שיחה
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiAssistantBanner;
