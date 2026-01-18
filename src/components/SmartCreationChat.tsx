/**
 * SmartCreationChat - AI-powered intelligent content creation assistant
 * Replaces simple keyword routing with a conversational interface
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    IconSparkles,
    IconSend,
    IconLoader2,
    IconClipboardCheck,
    IconLayoutList,
    IconMoodSmile,
    IconClock,
    IconHash,
    IconChevronLeft,
    IconRefresh
} from '@tabler/icons-react';
import {
    analyzeTeacherIntent,
    prepareWizardData,
    mergeCollectedData,
    getInitialCollectedData,
    CollectedData,
    ContentOption,
    ConversationMessage,
    AIResponse
} from '../services/ai/smartCreationService';

interface SmartCreationChatProps {
    onCreateContent: (wizardData: any) => void;
    onCancel?: () => void;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    quickReplies?: string[];
    options?: ContentOption[];
    timestamp: number;
}

const SmartCreationChat: React.FC<SmartCreationChatProps> = ({
    onCreateContent,
    onCancel
}) => {
    // State
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'היי! מה נרצה ליצור היום? ספרו לי על הנושא, הכיתה וסוג התוכן שאתם צריכים.',
            quickReplies: ['שיעור', 'פעילות אינטראקטיבית', 'מבחן', 'צריך רעיונות'],
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [collectedData, setCollectedData] = useState<CollectedData>(getInitialCollectedData());
    const [selectedOption, setSelectedOption] = useState<ContentOption | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Build conversation history for AI context
    const getConversationHistory = useCallback((): ConversationMessage[] => {
        return messages.map(m => ({
            role: m.role,
            content: m.content
        }));
    }, [messages]);

    // Handle sending a message
    const handleSend = useCallback(async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text || isLoading) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Get AI response
            const response: AIResponse = await analyzeTeacherIntent(
                text,
                getConversationHistory(),
                collectedData
            );

            // Update collected data
            if (response.collectedData) {
                setCollectedData(prev => mergeCollectedData(prev, response.collectedData!));
            }

            // Add assistant message
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.message,
                quickReplies: response.quickReplies,
                options: response.options,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Chat error:', error);
            // Add error message
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'סליחה, משהו השתבש. אפשר לנסות שוב?',
                quickReplies: ['נסה שוב', 'התחל מחדש'],
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, collectedData, getConversationHistory]);

    // Handle quick reply click
    const handleQuickReply = (reply: string) => {
        if (reply === 'התחל מחדש') {
            handleReset();
            return;
        }
        handleSend(reply);
    };

    // Handle option selection
    const handleSelectOption = async (option: ContentOption) => {
        setSelectedOption(option);
        setIsGenerating(true);

        // Add confirmation message
        setMessages(prev => [...prev, {
            id: `confirm-${Date.now()}`,
            role: 'assistant',
            content: `מצוין! יוצר "${option.title}"... 🚀`,
            timestamp: Date.now()
        }]);

        // Prepare wizard data and trigger creation
        const wizardData = prepareWizardData(option, collectedData);

        // Small delay for UX
        await new Promise(resolve => setTimeout(resolve, 800));

        onCreateContent(wizardData);
    };

    // Handle reset
    const handleReset = () => {
        setMessages([{
            id: '1',
            role: 'assistant',
            content: 'בסדר, מתחילים מחדש! מה תרצו ליצור?',
            quickReplies: ['שיעור', 'פעילות אינטראקטיבית', 'מבחן', 'צריך רעיונות'],
            timestamp: Date.now()
        }]);
        setCollectedData(getInitialCollectedData());
        setSelectedOption(null);
        setIsGenerating(false);
        setInput('');
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Get product type icon
    const getProductIcon = (type: string) => {
        switch (type) {
            case 'lesson': return <IconLayoutList className="w-5 h-5" />;
            case 'exam': return <IconClipboardCheck className="w-5 h-5" />;
            case 'activity': return <IconMoodSmile className="w-5 h-5" />;
            default: return <IconSparkles className="w-5 h-5" />;
        }
    };

    // Get profile color
    const getProfileColor = (profile: string) => {
        switch (profile) {
            case 'educational': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'game': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
            default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        }
    };

    // Get difficulty level display
    const getDifficultyLevelDisplay = (level: string) => {
        switch (level) {
            case 'support': return { label: 'תמיכה', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
            case 'enrichment': return { label: 'העשרה', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
            case 'core':
            default: return { label: 'ליבה', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[500px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-l from-wizdi-royal/5 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-lg flex items-center justify-center">
                        <IconSparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">יצירת תוכן חכמה</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ספרו לי מה אתם צריכים</p>
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="התחל מחדש"
                >
                    <IconRefresh className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                            {/* Message bubble */}
                            <div
                                className={`px-4 py-2.5 rounded-2xl ${
                                    message.role === 'user'
                                        ? 'bg-wizdi-royal text-white rounded-tr-md'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-md'
                                }`}
                            >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            </div>

                            {/* Quick replies */}
                            {message.quickReplies && message.quickReplies.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2 justify-end">
                                    {message.quickReplies.map((reply, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickReply(reply)}
                                            disabled={isLoading || isGenerating}
                                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-600 text-wizdi-royal dark:text-wizdi-cyan border border-wizdi-royal/30 dark:border-wizdi-cyan/30 rounded-full hover:bg-wizdi-royal/10 dark:hover:bg-wizdi-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {reply}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Options cards */}
                            {message.options && message.options.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {message.options.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => handleSelectOption(option)}
                                            disabled={isLoading || isGenerating}
                                            className="w-full text-right p-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-wizdi-royal dark:hover:border-wizdi-cyan hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-wizdi-royal group-hover:text-white transition-colors text-wizdi-royal">
                                                    {getProductIcon(option.productType)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                                                        {option.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                                        {option.description}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {/* Difficulty Level Badge */}
                                                        {option.difficultyLevel && (
                                                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getDifficultyLevelDisplay(option.difficultyLevel).color}`}>
                                                                {getDifficultyLevelDisplay(option.difficultyLevel).label}
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getProfileColor(option.profile)}`}>
                                                            {option.profile === 'educational' ? 'לימודי' : option.profile === 'game' ? 'משחקי' : 'מאוזן'}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                                            <IconHash className="w-3 h-3" />
                                                            {option.questionCount} שאלות
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                                            <IconClock className="w-3 h-3" />
                                                            {option.estimatedTime}
                                                        </span>
                                                    </div>
                                                </div>
                                                <IconChevronLeft className="w-5 h-5 text-slate-300 dark:text-slate-500 group-hover:text-wizdi-royal dark:group-hover:text-wizdi-cyan transition-colors flex-shrink-0" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex justify-end">
                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2.5 rounded-2xl rounded-tl-md">
                            <div className="flex items-center gap-2">
                                <IconLoader2 className="w-4 h-4 animate-spin text-wizdi-royal" />
                                <span className="text-sm text-slate-500 dark:text-slate-400">חושב...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Generating indicator */}
                {isGenerating && (
                    <div className="flex justify-end">
                        <div className="bg-gradient-to-r from-wizdi-royal/10 to-wizdi-cyan/10 dark:from-wizdi-royal/20 dark:to-wizdi-cyan/20 px-4 py-3 rounded-2xl rounded-tl-md border border-wizdi-royal/20">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <IconSparkles className="w-5 h-5 text-wizdi-royal animate-pulse" />
                                    <div className="absolute inset-0 w-5 h-5 bg-wizdi-cyan/50 rounded-full animate-ping" />
                                </div>
                                <span className="text-sm font-medium text-wizdi-royal dark:text-wizdi-cyan">
                                    יוצר את התוכן שלך...
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="כתבו כאן..."
                        disabled={isLoading || isGenerating}
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-wizdi-royal/50 focus:border-wizdi-royal disabled:opacity-50 disabled:cursor-not-allowed"
                        dir="rtl"
                        rows={1}
                        style={{ minHeight: '42px', maxHeight: '100px' }}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading || isGenerating}
                        className="w-10 h-10 bg-wizdi-royal hover:bg-wizdi-royal/90 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <IconLoader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <IconSend className="w-5 h-5 rotate-180" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartCreationChat;
