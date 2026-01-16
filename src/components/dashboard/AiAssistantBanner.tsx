/**
 * AI Assistant Banner Component
 * באנר עוזר AI למורה - בסגנון דף הבית עם טקסט רץ
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
    IconCheck,
    IconArrowUp
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

// Placeholder examples for typing animation
const PLACEHOLDER_EXAMPLES = [
    "מי מהתלמידים צריך חיזוק?",
    "הצע פעילות העשרה לכיתה...",
    "נתח לי את ביצועי הכיתה...",
    "עזור לי לנסח משוב לתלמיד...",
    "איזה נושאים הכיתה מתקשה בהם?"
];

export const AiAssistantBanner: React.FC<AiAssistantBannerProps> = ({
    context,
    className = ''
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [placeholderText, setPlaceholderText] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Typing animation effect for placeholder
    useEffect(() => {
        if (inputValue) return; // Don't animate if user is typing

        let currentIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let timeoutId: NodeJS.Timeout;

        const type = () => {
            const currentText = PLACEHOLDER_EXAMPLES[currentIndex];

            if (!isDeleting) {
                setPlaceholderText(currentText.substring(0, charIndex + 1));
                charIndex++;

                if (charIndex === currentText.length) {
                    isDeleting = true;
                    timeoutId = setTimeout(type, 2000); // Pause before deleting
                    return;
                }
            } else {
                setPlaceholderText(currentText.substring(0, charIndex - 1));
                charIndex--;

                if (charIndex === 0) {
                    isDeleting = false;
                    currentIndex = (currentIndex + 1) % PLACEHOLDER_EXAMPLES.length;
                }
            }

            timeoutId = setTimeout(type, isDeleting ? 30 : 80);
        };

        type();
        return () => clearTimeout(timeoutId);
    }, [inputValue]);

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
        <div className={`card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl shadow-lg border border-slate-200/80 overflow-hidden ${className}`} dir="rtl">
            {/* Main Input Section - Homepage Style */}
            <div className="p-5">
                {/* Title */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg">
                        <IconSparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">עוזר AI למורים</h3>
                        <p className="text-xs text-slate-500">שאלו אותי כל שאלה על הכיתה</p>
                    </div>
                </div>

                {/* Input with running placeholder - Homepage Style */}
                <div className="relative bg-slate-50 rounded-2xl border-2 border-slate-100 focus-within:border-wizdi-royal transition-all">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholderText || "שאלו שאלה..."}
                        className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-base p-4 pb-14 resize-none focus:outline-none min-h-[80px] text-right"
                        rows={2}
                    />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        {/* Clear button */}
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                נקה שיחה
                            </button>
                        )}
                        {/* Submit button */}
                        <button
                            onClick={() => sendMessage(inputValue)}
                            disabled={!inputValue.trim() || isLoading}
                            className="w-10 h-10 bg-wizdi-royal hover:bg-wizdi-royal/90 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <IconLoader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <IconArrowUp className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Actions - Small chips */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">או נסו:</span>
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleQuickAction(action)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-wizdi-royal/10 rounded-full text-slate-600 hover:text-wizdi-royal text-xs font-medium transition-all disabled:opacity-50"
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages Section - Expandable */}
            {messages.length > 0 && (
                <div className="border-t border-slate-100">
                    {/* Toggle Messages */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full p-3 flex items-center justify-center gap-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        {isExpanded ? (
                            <>
                                <IconChevronUp className="w-4 h-4" />
                                הסתר שיחה
                            </>
                        ) : (
                            <>
                                <IconChevronDown className="w-4 h-4" />
                                הצג שיחה ({messages.length} הודעות)
                            </>
                        )}
                    </button>

                    {/* Messages Area */}
                    {isExpanded && (
                        <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 bg-slate-50">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                        ${message.role === 'user'
                                            ? 'bg-wizdi-royal/10 text-wizdi-royal'
                                            : 'bg-wizdi-cyan/10 text-wizdi-cyan'
                                        }
                                    `}>
                                        {message.role === 'user'
                                            ? <IconUser className="w-4 h-4" />
                                            : <IconRobot className="w-4 h-4" />
                                        }
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`
                                        max-w-[80%] rounded-2xl p-3 group relative
                                        ${message.role === 'user'
                                            ? 'bg-wizdi-royal text-white rounded-tr-none'
                                            : 'bg-white text-slate-700 rounded-tl-none shadow-sm border border-slate-100'
                                        }
                                    `}>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                                        {/* Copy button for assistant messages */}
                                        {message.role === 'assistant' && (
                                            <button
                                                onClick={() => handleCopy(message.content, message.id)}
                                                className="absolute -bottom-2 -left-2 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity border border-slate-100"
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
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-wizdi-cyan/10 flex items-center justify-center">
                                        <IconRobot className="w-4 h-4 text-wizdi-cyan" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">חושב...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AiAssistantBanner;
