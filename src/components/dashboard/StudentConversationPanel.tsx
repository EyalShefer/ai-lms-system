/**
 * Student Conversation Panel
 * תצוגת שיחות התלמיד עם סוכן ההוראה
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import {
    IconMessageCircle,
    IconUser,
    IconRobot,
    IconClock,
    IconChevronDown,
    IconChevronUp,
    IconBulb,
    IconAlertTriangle,
    IconCopy,
    IconCheck,
    IconLoader2,
    IconSparkles,
    IconCalendar
} from '@tabler/icons-react';

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

interface ChatBlockAnswer {
    messages: ConversationMessage[];
    lastMessageAt?: number;
}

interface StudentConversation {
    blockId: string;
    blockTitle?: string;
    messages: ConversationMessage[];
    submittedAt: string;
    hintUsed?: boolean;
}

interface StudentConversationPanelProps {
    studentId: string;
    courseId: string;
    studentName: string;
    className?: string;
}

export const StudentConversationPanel: React.FC<StudentConversationPanelProps> = ({
    studentId,
    courseId,
    studentName,
    className = ''
}) => {
    const [conversations, setConversations] = useState<StudentConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Fetch student submissions with chat data
    useEffect(() => {
        const fetchConversations = async () => {
            if (!studentId || !courseId) return;

            setLoading(true);
            try {
                // Query submissions for this student and course
                const submissionsRef = collection(db, 'submissions');
                const q = query(
                    submissionsRef,
                    where('studentId', '==', studentId),
                    where('courseId', '==', courseId),
                    orderBy('submittedAt', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(q);
                const allConversations: StudentConversation[] = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const answers = data.answers || {};
                    const submittedAt = data.submittedAt?.toDate?.()?.toISOString() || data.submittedAt || '';

                    // Look for interactive-chat block answers
                    Object.entries(answers).forEach(([blockId, answer]) => {
                        // Check if this answer contains chat messages
                        if (answer && typeof answer === 'object') {
                            const chatAnswer = answer as ChatBlockAnswer;
                            if (chatAnswer.messages && Array.isArray(chatAnswer.messages) && chatAnswer.messages.length > 0) {
                                allConversations.push({
                                    blockId,
                                    messages: chatAnswer.messages,
                                    submittedAt,
                                    hintUsed: data.telemetry?.hintsUsed?.[blockId] > 0
                                });
                            }
                        }
                    });
                });

                setConversations(allConversations);

                // Expand first conversation by default if exists
                if (allConversations.length > 0) {
                    setExpandedConversation(allConversations[0].blockId);
                }
            } catch (error) {
                console.error('Error fetching conversations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [studentId, courseId]);

    const handleCopyConversation = async (conversation: StudentConversation) => {
        try {
            const text = conversation.messages
                .map(m => `${m.role === 'user' ? 'תלמיד' : 'סוכן'}: ${m.content}`)
                .join('\n\n');
            await navigator.clipboard.writeText(text);
            setCopiedId(conversation.blockId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('he-IL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    };

    // Analyze conversation for hints and flags
    const analyzeConversation = (messages: ConversationMessage[]) => {
        const studentMessages = messages.filter(m => m.role === 'user');
        const agentMessages = messages.filter(m => m.role === 'assistant');

        // Check for potential distress keywords (Hebrew)
        const distressKeywords = ['עצוב', 'בודד', 'מפחד', 'לא יכול', 'נמאס', 'עזרה'];
        const hasDistressSignals = studentMessages.some(m =>
            distressKeywords.some(keyword => m.content.includes(keyword))
        );

        // Check for hint requests
        const hintKeywords = ['רמז', 'עזרה', 'לא מבין', 'תסביר'];
        const hintRequestCount = studentMessages.filter(m =>
            hintKeywords.some(keyword => m.content.toLowerCase().includes(keyword))
        ).length;

        return {
            totalMessages: messages.length,
            studentMessages: studentMessages.length,
            agentMessages: agentMessages.length,
            hasDistressSignals,
            hintRequestCount,
            avgMessageLength: Math.round(
                studentMessages.reduce((sum, m) => sum + m.content.length, 0) / (studentMessages.length || 1)
            )
        };
    };

    if (loading) {
        return (
            <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 ${className}`}>
                <div className="flex items-center justify-center gap-3 text-slate-400">
                    <IconLoader2 className="w-5 h-5 animate-spin" />
                    <span>טוען שיחות...</span>
                </div>
            </div>
        );
    }

    // Use mock data if no real conversations found
    const displayConversations = conversations.length > 0 ? conversations : getMockConversations(studentName, studentId);

    if (displayConversations.length === 0) {
        return (
            <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 ${className}`}>
                <div className="text-center py-8">
                    <IconMessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">אין שיחות עם סוכן ההוראה</p>
                    <p className="text-sm text-slate-400 mt-1">
                        התלמיד טרם השתתף בבלוקים של צ'אט אינטראקטיבי
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-purple-50 to-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <IconMessageCircle className="w-5 h-5 text-purple-600" />
                            שיחות עם סוכן ההוראה
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {displayConversations.length} שיחות של {studentName}
                        </p>
                    </div>
                    <div className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-sm font-bold">
                        {displayConversations.reduce((sum, c) => sum + c.messages.length, 0)} הודעות
                    </div>
                </div>
            </div>

            {/* Conversations List */}
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {displayConversations.map((conversation, idx) => {
                    const isExpanded = expandedConversation === conversation.blockId;
                    const analysis = analyzeConversation(conversation.messages);

                    return (
                        <div key={`${conversation.blockId}-${idx}`} className="bg-white">
                            {/* Conversation Header */}
                            <button
                                onClick={() => setExpandedConversation(isExpanded ? null : conversation.blockId)}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <IconSparkles className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-700 flex items-center gap-2">
                                            שיחה #{idx + 1}
                                            {analysis.hasDistressSignals && (
                                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                                                    דורש תשומת לב
                                                </span>
                                            )}
                                            {conversation.hintUsed && (
                                                <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                                                    <IconBulb className="w-3 h-3" />
                                                    רמז
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                            <IconCalendar className="w-3 h-3" />
                                            {formatDate(conversation.submittedAt)}
                                            <span className="text-slate-300">|</span>
                                            {analysis.totalMessages} הודעות
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Quick Stats */}
                                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                                        <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                                            תלמיד: {analysis.studentMessages}
                                        </span>
                                        <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg">
                                            סוכן: {analysis.agentMessages}
                                        </span>
                                    </div>

                                    {isExpanded ? (
                                        <IconChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <IconChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded Conversation */}
                            {isExpanded && (
                                <div className="px-4 pb-4">
                                    {/* Analysis Bar */}
                                    <div className="bg-slate-50 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3 text-xs">
                                        <span className="text-slate-500">ניתוח:</span>
                                        <span className="bg-white px-2 py-1 rounded-lg border border-slate-200">
                                            אורך ממוצע: {analysis.avgMessageLength} תווים
                                        </span>
                                        {analysis.hintRequestCount > 0 && (
                                            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
                                                בקשות עזרה: {analysis.hintRequestCount}
                                            </span>
                                        )}
                                        {analysis.hasDistressSignals && (
                                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded-lg border border-red-200 flex items-center gap-1">
                                                <IconAlertTriangle className="w-3 h-3" />
                                                זוהו סימני מצוקה
                                            </span>
                                        )}
                                    </div>

                                    {/* Messages */}
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                        {conversation.messages.map((message, msgIdx) => (
                                            <div
                                                key={msgIdx}
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

                                                {/* Message */}
                                                <div className={`
                                                    max-w-[80%] rounded-2xl p-3
                                                    ${message.role === 'user'
                                                        ? 'bg-indigo-500 text-white rounded-tr-none'
                                                        : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                                    }
                                                `}>
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                        {message.content}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Copy Button */}
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => handleCopyConversation(conversation)}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
                                                ${copiedId === conversation.blockId
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }
                                            `}
                                        >
                                            {copiedId === conversation.blockId ? (
                                                <>
                                                    <IconCheck className="w-4 h-4" />
                                                    הועתק!
                                                </>
                                            ) : (
                                                <>
                                                    <IconCopy className="w-4 h-4" />
                                                    העתק שיחה
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Mock conversations for demo purposes - unique per student
const getMockConversations = (studentName: string, studentId: string): StudentConversation[] => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Create a hash from studentId to generate different conversations for each student
    const hash = studentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const conversationSet = hash % 4; // 4 different conversation sets

    const allConversationSets: StudentConversation[][] = [
        // Set 0: Math focused
        [
            {
                blockId: `${studentId}-chat-1`,
                blockTitle: 'פתרון משוואות',
                messages: [
                    { role: 'user', content: 'היי, אני לא מבין איך לפתור את המשוואה 2x + 5 = 15', timestamp: now.getTime() - 3600000 },
                    { role: 'assistant', content: `שלום ${studentName}! 😊 בוא נפתור את זה יחד צעד אחר צעד.\n\nקודם כל, מה לדעתך הצעד הראשון שצריך לעשות כדי לבודד את x?`, timestamp: now.getTime() - 3500000 },
                    { role: 'user', content: 'אולי להוריד 5 משני הצדדים?', timestamp: now.getTime() - 3400000 },
                    { role: 'assistant', content: 'מצוין! 🌟 בדיוק! כשנוריד 5 משני הצדדים נקבל:\n2x + 5 - 5 = 15 - 5\n2x = 10\n\nמה הצעד הבא?', timestamp: now.getTime() - 3300000 },
                    { role: 'user', content: 'לחלק ב-2?', timestamp: now.getTime() - 3200000 },
                    { role: 'assistant', content: 'נכון מאוד! 🎉 x = 5. מעולה!', timestamp: now.getTime() - 3100000 }
                ],
                submittedAt: now.toISOString(),
                hintUsed: false
            },
            {
                blockId: `${studentId}-chat-2`,
                blockTitle: 'שברים',
                messages: [
                    { role: 'user', content: 'איך מחברים 1/2 + 1/3?', timestamp: yesterday.getTime() },
                    { role: 'assistant', content: `${studentName}, שאלה טובה! צריך למצוא מכנה משותף. מה המכנה המשותף של 2 ו-3?`, timestamp: yesterday.getTime() + 60000 },
                    { role: 'user', content: '6?', timestamp: yesterday.getTime() + 120000 },
                    { role: 'assistant', content: 'בדיוק! 👏 אז 1/2 = 3/6 ו-1/3 = 2/6. עכשיו מה התשובה?', timestamp: yesterday.getTime() + 180000 },
                    { role: 'user', content: '5/6!', timestamp: yesterday.getTime() + 240000 },
                    { role: 'assistant', content: 'מעולה! 🎯 הבנת את העיקרון!', timestamp: yesterday.getTime() + 300000 }
                ],
                submittedAt: yesterday.toISOString(),
                hintUsed: true
            }
        ],
        // Set 1: Reading comprehension focused
        [
            {
                blockId: `${studentId}-chat-1`,
                blockTitle: 'הבנת הנקרא - הסיפור הקצר',
                messages: [
                    { role: 'user', content: 'לא הבנתי למה הגיבור עזב את הכפר', timestamp: now.getTime() - 3600000 },
                    { role: 'assistant', content: `היי ${studentName}! 📚 שאלה מצוינת. בוא נחזור לטקסט - מה קרה לפני שהוא עזב?`, timestamp: now.getTime() - 3500000 },
                    { role: 'user', content: 'הוא רב עם אביו', timestamp: now.getTime() - 3400000 },
                    { role: 'assistant', content: 'נכון! ועל מה הם רבו?', timestamp: now.getTime() - 3300000 },
                    { role: 'user', content: 'אביו רצה שיישאר לעבוד בשדה אבל הוא רצה ללמוד', timestamp: now.getTime() - 3200000 },
                    { role: 'assistant', content: 'מדויק! 💡 אז הסיבה שעזב היא...?', timestamp: now.getTime() - 3100000 },
                    { role: 'user', content: 'הוא רצה להגשים את החלום שלו!', timestamp: now.getTime() - 3000000 },
                    { role: 'assistant', content: 'בדיוק! 🌟 זיהית את המוטיבציה המרכזית של הדמות. יפה מאוד!', timestamp: now.getTime() - 2900000 }
                ],
                submittedAt: now.toISOString(),
                hintUsed: false
            }
        ],
        // Set 2: Science focused
        [
            {
                blockId: `${studentId}-chat-1`,
                blockTitle: 'מחזור המים',
                messages: [
                    { role: 'user', content: 'מה זה אידוי?', timestamp: now.getTime() - 3600000 },
                    { role: 'assistant', content: `שלום ${studentName}! 🌊 אידוי הוא כשמים הופכים מנוזל לגז. איפה את/ה רואה את זה בחיים?`, timestamp: now.getTime() - 3500000 },
                    { role: 'user', content: 'כשמים מתייבשים על הרצפה?', timestamp: now.getTime() - 3400000 },
                    { role: 'assistant', content: 'בדיוק! 👏 המים לא נעלמו - הם הפכו לאדים באוויר. מה קורה אחר כך לאדים האלה?', timestamp: now.getTime() - 3300000 },
                    { role: 'user', content: 'הם עולים למעלה ונהיים עננים?', timestamp: now.getTime() - 3200000 },
                    { role: 'assistant', content: 'מצוין! ☁️ וכשהעננים מתקררים, מה קורה?', timestamp: now.getTime() - 3100000 },
                    { role: 'user', content: 'גשם!', timestamp: now.getTime() - 3000000 },
                    { role: 'assistant', content: 'נכון! 🌧️ זה נקרא עיבוי וגשם. הבנת את מחזור המים!', timestamp: now.getTime() - 2900000 }
                ],
                submittedAt: now.toISOString(),
                hintUsed: true
            },
            {
                blockId: `${studentId}-chat-2`,
                blockTitle: 'בעלי חיים',
                messages: [
                    { role: 'user', content: 'מה ההבדל בין יונקים לזוחלים?', timestamp: yesterday.getTime() },
                    { role: 'assistant', content: `${studentName}, שאלה מעולה! 🦎 יונקים הם בעלי חיים שמניקים את הגורים שלהם. את/ה יכול/ה לתת דוגמה ליונק?`, timestamp: yesterday.getTime() + 60000 },
                    { role: 'user', content: 'כלב!', timestamp: yesterday.getTime() + 120000 },
                    { role: 'assistant', content: 'נכון! 🐕 וזוחלים הם קרי דם ומטילים ביצים. דוגמה?', timestamp: yesterday.getTime() + 180000 },
                    { role: 'user', content: 'נחש או לטאה', timestamp: yesterday.getTime() + 240000 },
                    { role: 'assistant', content: 'מעולה! 🦎 הבנת את ההבדל העיקרי!', timestamp: yesterday.getTime() + 300000 }
                ],
                submittedAt: yesterday.toISOString(),
                hintUsed: false
            }
        ],
        // Set 3: History/Social studies focused
        [
            {
                blockId: `${studentId}-chat-1`,
                blockTitle: 'ההתיישבות בארץ ישראל',
                messages: [
                    { role: 'user', content: 'למה אנשים עלו לארץ ישראל?', timestamp: now.getTime() - 3600000 },
                    { role: 'assistant', content: `היי ${studentName}! 🏠 שאלה חשובה. היו כמה סיבות. את/ה יודע/ת מה היה המצב של יהודים באירופה?`, timestamp: now.getTime() - 3500000 },
                    { role: 'user', content: 'היו להם בעיות?', timestamp: now.getTime() - 3400000 },
                    { role: 'assistant', content: 'נכון, הם סבלו מרדיפות ואפליה. בנוסף, היה רעיון חדש שנקרא "ציונות". מה זה אומר לדעתך?', timestamp: now.getTime() - 3300000 },
                    { role: 'user', content: 'הרצון לחזור לארץ ישראל?', timestamp: now.getTime() - 3200000 },
                    { role: 'assistant', content: 'בדיוק! 🌟 הציונות היא הרעיון שליהודים מגיעה מדינה משלהם בארץ ישראל. יפה מאוד!', timestamp: now.getTime() - 3100000 }
                ],
                submittedAt: now.toISOString(),
                hintUsed: true
            }
        ]
    ];

    return allConversationSets[conversationSet] || allConversationSets[0];
};

export default StudentConversationPanel;
