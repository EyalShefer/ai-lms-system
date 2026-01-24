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
    IconRefresh,
    IconMicrophone,
    IconUpload,
    IconBook,
    IconBrandYoutube,
    IconRobot
} from '@tabler/icons-react';
import {
    analyzeTeacherIntent,
    prepareWizardData,
    mergeCollectedData,
    getInitialCollectedData
} from '../services/ai/smartCreationService';
import type {
    CollectedData,
    ContentOption,
    ConversationMessage,
    AIResponse,
    ContentTemplate,
    ReuseContentSuggestion,
    PromptSuggestion
} from '../services/ai/smartCreationService';
import { DIFFICULTY_LEVELS } from '../courseConstants';

interface SmartCreationChatProps {
    onCreateContent: (wizardData: any) => void;
    onCancel?: () => void;
    isExpanded?: boolean;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    quickReplies?: string[];
    options?: ContentOption[];
    curriculumResults?: any[];
    contentResults?: any[];
    templateSuggestions?: any[];
    reuseOptions?: ReuseContentSuggestion[];
    promptSuggestions?: any[];
    timestamp: number;
}

const SmartCreationChat: React.FC<SmartCreationChatProps> = ({
    onCreateContent,
    onCancel,
    isExpanded = false
}) => {
    // State
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'מה ניצור היום? ספרו לי על הנושא והכיתה!',
            quickReplies: ['פעילות', 'מבחן', 'דף עבודה', 'שיעור', 'פודקאסט'],
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
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom - only within the messages container, not the whole page
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
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
            console.log('🤖 [SmartCreation] AI Response:', response);

            // Update collected data
            if (response.collectedData) {
                setCollectedData(prev => mergeCollectedData(prev, response.collectedData!));
            }

            // Handle curriculum query
            if (response.type === 'curriculum_query' && response.curriculumQuery) {
                // Show loading message
                const loadingMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, loadingMessage]);

                // Fetch curriculum standards
                try {
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const { getApp } = await import('firebase/app');
                    const functions = getFunctions(getApp());
                    const queryCurriculumStandards = httpsCallable(functions, 'queryCurriculumStandards');

                    const result: any = await queryCurriculumStandards(response.curriculumQuery);

                    if (result.data.success && result.data.standards.length > 0) {
                        // Add curriculum results message
                        const resultsMessage: ChatMessage = {
                            id: `curriculum-${Date.now()}`,
                            role: 'assistant',
                            content: `מצאתי ${result.data.count} תקני תוכ"ל:`,
                            curriculumResults: result.data.standards,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, resultsMessage]);
                    } else {
                        setMessages(prev => [...prev, {
                            id: `no-results-${Date.now()}`,
                            role: 'assistant',
                            content: 'לא מצאתי תקנים מתאימים. נסו לשנות את הפרמטרים.',
                            timestamp: Date.now()
                        }]);
                    }
                } catch (error) {
                    console.error('Curriculum query error:', error);
                    setMessages(prev => [...prev, {
                        id: `error-curriculum-${Date.now()}`,
                        role: 'assistant',
                        content: 'שגיאה בחיפוש תקני תוכ"ל. נסה שוב.',
                        timestamp: Date.now()
                    }]);
                }
            }
            // Handle content search
            else if (response.type === 'content_search' && response.contentSearch) {
                // Show loading message
                const loadingMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, loadingMessage]);

                // Search user content
                try {
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const { getApp } = await import('firebase/app');
                    const functions = getFunctions(getApp());
                    const searchUserContent = httpsCallable(functions, 'searchUserContent');

                    const result: any = await searchUserContent(response.contentSearch);

                    if (result.data.success && result.data.results.length > 0) {
                        // Add content search results message
                        const resultsMessage: ChatMessage = {
                            id: `content-${Date.now()}`,
                            role: 'assistant',
                            content: `מצאתי ${result.data.count} תכנים:`,
                            contentResults: result.data.results,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, resultsMessage]);
                    } else {
                        setMessages(prev => [...prev, {
                            id: `no-results-${Date.now()}`,
                            role: 'assistant',
                            content: 'לא מצאתי תכנים מתאימים. נסו לשנות את מילות החיפוש.',
                            timestamp: Date.now()
                        }]);
                    }
                } catch (error) {
                    console.error('Content search error:', error);
                    setMessages(prev => [...prev, {
                        id: `error-content-${Date.now()}`,
                        role: 'assistant',
                        content: 'שגיאה בחיפוש תכנים. נסה שוב.',
                        timestamp: Date.now()
                    }]);
                }
            }
            // Handle template suggestions
            else if (response.type === 'template_suggestion' && response.templates) {
                // Add template suggestions message
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    templateSuggestions: response.templates,
                    quickReplies: response.quickReplies,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
            // Handle reuse suggestions
            else if (response.type === 'reuse_suggestion' && response.contentSearch) {
                // Show loading message
                const loadingMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, loadingMessage]);

                // Search user content for reuse
                try {
                    console.log('🔍 [SmartCreation] Starting reuse search with:', response.contentSearch);
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const { getApp } = await import('firebase/app');
                    const functions = getFunctions(getApp());
                    const searchUserContent = httpsCallable(functions, 'searchUserContent');

                    console.log('🔍 [SmartCreation] Calling searchUserContent...');
                    const result: any = await searchUserContent(response.contentSearch);
                    console.log('🔍 [SmartCreation] searchUserContent result:', result);

                    if (result.data.success && result.data.results.length > 0) {
                        // Add reuse options message
                        const reuseMessage: ChatMessage = {
                            id: `reuse-${Date.now()}`,
                            role: 'assistant',
                            content: `מצאתי ${result.data.count} תכנים קיימים שיכולים להתאים:`,
                            reuseOptions: result.data.results,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, reuseMessage]);
                    } else {
                        // No existing content - continue to templates or options
                        setMessages(prev => [...prev, {
                            id: `no-reuse-${Date.now()}`,
                            role: 'assistant',
                            content: 'לא מצאתי תכנים דומים בעבר. בוא ניצור משהו חדש!',
                            quickReplies: ['המשך'],
                            timestamp: Date.now()
                        }]);
                    }
                } catch (error) {
                    console.error('Reuse search error:', error);
                    setMessages(prev => [...prev, {
                        id: `error-reuse-${Date.now()}`,
                        role: 'assistant',
                        content: 'בוא ניצור משהו חדש.',
                        timestamp: Date.now()
                    }]);
                }
            }
            // Handle prompt suggestions
            else if (response.type === 'prompt_suggestion' && response.promptSearch) {
                // Show loading message
                const loadingMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, loadingMessage]);

                // Search prompts library
                try {
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const { getApp } = await import('firebase/app');
                    const functions = getFunctions(getApp());
                    const searchRelevantPrompts = httpsCallable(functions, 'searchRelevantPrompts');

                    const result: any = await searchRelevantPrompts(response.promptSearch);

                    if (result.data.success && result.data.prompts.length > 0) {
                        // Add prompt suggestions message
                        const promptMessage: ChatMessage = {
                            id: `prompts-${Date.now()}`,
                            role: 'assistant',
                            content: `מצאתי לכם ${result.data.count} פרומפטים מעולים! 🌟\n\nבחרו את המתאים לכם, לחצו על "העתק" והדביקו ב-ChatGPT או Gemini - ותקבלו תוכן מקצועי מוכן להדפסה! ✨`,
                            promptSuggestions: result.data.prompts,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, promptMessage]);
                    } else {
                        // No prompts found - ask for more details
                        setMessages(prev => [...prev, {
                            id: `no-prompts-${Date.now()}`,
                            role: 'assistant',
                            content: 'ספרו לי עוד קצת מה אתם צריכים, ואני אעזור לכם לבנות משהו.',
                            timestamp: Date.now()
                        }]);
                    }
                } catch (error) {
                    console.error('Prompt search error:', error);
                    setMessages(prev => [...prev, {
                        id: `error-prompts-${Date.now()}`,
                        role: 'assistant',
                        content: 'ספרו לי עוד קצת מה אתם צריכים.',
                        timestamp: Date.now()
                    }]);
                }
            } else {
                // Add regular assistant message
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    quickReplies: response.quickReplies,
                    options: response.options,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }

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

    // Handle template selection
    const handleTemplateSelect = (template: ContentTemplate) => {
        // Update collected data with template values
        const updatedData: CollectedData = {
            ...collectedData,
            productType: template.productType,
            profile: template.profile,
            activityLength: template.activityLength,
            difficultyLevel: template.difficultyLevel,
            includeBot: template.includeBot ?? collectedData.includeBot,
            customQuestionTypes: template.customQuestionTypes ?? collectedData.customQuestionTypes
        };
        setCollectedData(updatedData);

        // Send message about template selection
        const message = `נהדר! בחרת ${template.name} ${template.icon || ''}`;
        handleSend(message);
    };

    // Handle reuse content action
    const handleReuseAction = (action: 'reuse' | 'edit' | 'inspired' | 'new', content?: ReuseContentSuggestion) => {
        if (action === 'new') {
            // Continue to regular flow - templates or options
            handleSend('צור משהו חדש לגמרי');
        } else if (content) {
            if (action === 'reuse') {
                // Use the existing content as-is (navigate to it or duplicate it)
                setMessages(prev => [...prev, {
                    id: `reuse-confirm-${Date.now()}`,
                    role: 'assistant',
                    content: `מעולה! אפשר להשתמש ב"${content.title}" ישירות או לשכפל אותו לקורס חדש.`,
                    quickReplies: ['פתח את התוכן', 'שכפל לקורס חדש', 'בחר אחר'],
                    timestamp: Date.now()
                }]);
            } else if (action === 'edit') {
                // TODO: Open editor with existing content
                setMessages(prev => [...prev, {
                    id: `edit-todo-${Date.now()}`,
                    role: 'assistant',
                    content: `עריכת תוכן קיים תהיה זמינה בקרוב! בינתיים, אפשר לשכפל ולערוך ידנית.`,
                    timestamp: Date.now()
                }]);
            } else if (action === 'inspired') {
                // Create new content inspired by existing
                setMessages(prev => [...prev, {
                    id: `inspired-${Date.now()}`,
                    role: 'assistant',
                    content: `מעולה! ניצור תוכן חדש בהשראת "${content.title}". איזה שינויים תרצו?`,
                    quickReplies: ['יותר שאלות', 'רמת קושי שונה', 'נושא קשור', 'פשוט צור'],
                    timestamp: Date.now()
                }]);
            }
        }
    };

    // Handle prompt action
    const handlePromptAction = (prompt: any) => {
        // Show the prompt template in a friendly way
        setMessages(prev => [...prev, {
            id: `prompt-use-${Date.now()}`,
            role: 'assistant',
            content: `בחירה מעולה! 🎯\n\nהנה הפרומפט **"${prompt.title}"**:\n\n\`\`\`\n${prompt.promptTemplate}\n\`\`\`\n\nלחצו על "העתק פרומפט" למעלה, הדביקו ב-ChatGPT, מלאו את החלקים ב-{{}} - וזהו! ✨`,
            timestamp: Date.now()
        }]);
    };

    // Handle reset
    const handleReset = () => {
        setMessages([{
            id: '1',
            role: 'assistant',
            content: 'בסדר, מתחילים מחדש! מה תרצו ליצור?',
            quickReplies: ['שיעור', 'פעילות אינטראקטיבית', 'מבחן', 'פודקאסט', 'יש לי קובץ'],
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
            case 'podcast': return <IconMicrophone className="w-5 h-5" />;
            default: return <IconSparkles className="w-5 h-5" />;
        }
    };

    // Get source mode icon
    const getSourceIcon = (mode: string | null) => {
        switch (mode) {
            case 'file': return <IconUpload className="w-4 h-4" />;
            case 'textbook': return <IconBook className="w-4 h-4" />;
            case 'youtube': return <IconBrandYoutube className="w-4 h-4" />;
            default: return null;
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

    // Get difficulty level display using centralized constants
    const getDifficultyLevelDisplay = (level: string) => {
        const colors = {
            support: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            enrichment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            core: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        };
        const key = (level === 'support' || level === 'enrichment') ? level : 'core';
        return {
            label: DIFFICULTY_LEVELS[key].label,
            color: colors[key]
        };
    };

    return (
        <div className={`flex flex-col h-full ${isExpanded ? '' : 'max-h-[500px]'} bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-l from-wizdi-royal/5 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-lg flex items-center justify-center">
                        <IconSparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">יצירת תוכן חכמה</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">כתבו בחופשיות, או בחרו מתוך הצעות</p>
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
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div className="max-w-[85%]">
                            {/* Message bubble - WhatsApp Hebrew style: bot on right (start in RTL), user on left (end in RTL) */}
                            <div
                                className={`px-4 py-2.5 rounded-2xl ${
                                    message.role === 'assistant'
                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tr-md'
                                        : 'bg-emerald-500 text-white rounded-tl-md'
                                }`}
                            >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            </div>

                            {/* Quick replies */}
                            {message.quickReplies && message.quickReplies.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2 text-left flex items-center gap-1">
                                        <span>💡</span>
                                        <span>דוגמאות לבחירה מהירה:</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        {message.quickReplies.map((reply, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleQuickReply(reply)}
                                                disabled={isLoading || isGenerating}
                                                className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-500 rounded-lg hover:bg-wizdi-royal/10 hover:border-wizdi-royal/50 hover:text-wizdi-royal dark:hover:bg-wizdi-cyan/10 dark:hover:border-wizdi-cyan/50 dark:hover:text-wizdi-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
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
                                                        {option.difficultyLevel && option.difficultyLevel !== 'all' && (
                                                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getDifficultyLevelDisplay(option.difficultyLevel).color}`}>
                                                                {getDifficultyLevelDisplay(option.difficultyLevel).label}
                                                            </span>
                                                        )}
                                                        {/* Three levels badge */}
                                                        {option.difficultyLevel === 'all' && (
                                                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gradient-to-r from-green-100 via-blue-100 to-purple-100 text-slate-700 dark:from-green-900/30 dark:via-blue-900/30 dark:to-purple-900/30 dark:text-slate-300">
                                                                3 רמות
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getProfileColor(option.profile)}`}>
                                                            {option.profile === 'educational' ? 'לימודי' : option.profile === 'game' ? 'משחקי' : option.profile === 'custom' ? 'מותאם' : 'מאוזן'}
                                                        </span>
                                                        {/* Source mode indicator */}
                                                        {collectedData.sourceMode && collectedData.sourceMode !== 'topic' && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                                {getSourceIcon(collectedData.sourceMode)}
                                                                {collectedData.sourceMode === 'file' ? 'מקובץ' :
                                                                 collectedData.sourceMode === 'textbook' ? 'מספר' :
                                                                 collectedData.sourceMode === 'youtube' ? 'מיוטיוב' : 'מטקסט'}
                                                            </span>
                                                        )}
                                                        {/* Bot indicator */}
                                                        {collectedData.includeBot && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                                <IconRobot className="w-3 h-3" />
                                                                בוט מלווה
                                                            </span>
                                                        )}
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

                            {/* Curriculum Results */}
                            {message.curriculumResults && message.curriculumResults.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {message.curriculumResults.map((standard: any, idx: number) => (
                                        <div
                                            key={standard.id || idx}
                                            className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-right"
                                        >
                                            <div className="flex items-start gap-2 mb-2">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1">
                                                        {standard.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                        {standard.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center text-xs">
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                                                    {standard.gradeLevel && `כיתה ${standard.gradeLevel}`}
                                                </span>
                                                {standard.domain && (
                                                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md">
                                                        {standard.domain}
                                                    </span>
                                                )}
                                                {standard.topic && (
                                                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md">
                                                        {standard.topic}
                                                    </span>
                                                )}
                                            </div>
                                            {standard.learningObjectives && standard.learningObjectives.length > 0 && (
                                                <div className="mt-2 pr-3">
                                                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">מטרות למידה:</p>
                                                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                                                        {standard.learningObjectives.slice(0, 3).map((obj: string, i: number) => (
                                                            <li key={i} className="pr-2">• {obj}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Content Search Results */}
                            {message.contentResults && message.contentResults.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {message.contentResults.map((content: any, idx: number) => (
                                        <div
                                            key={content.id || idx}
                                            className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg text-right"
                                        >
                                            <div className="flex items-start gap-2 mb-2">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1">
                                                        {content.metadata?.title || 'ללא כותרת'}
                                                    </h4>
                                                    {content.metadata?.topic && (
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                            {content.metadata.topic}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center text-xs">
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md font-medium">
                                                    {content.blockType === 'activity' ? 'פעילות' :
                                                     content.blockType === 'exam' ? 'מבחן' :
                                                     content.blockType === 'lesson' ? 'שיעור' :
                                                     content.blockType === 'podcast' ? 'פודקאסט' : content.blockType}
                                                </span>
                                                {content.metadata?.gradeLevel && (
                                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                                                        כיתה {content.metadata.gradeLevel}
                                                    </span>
                                                )}
                                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md">
                                                    מתוך: {content.courseName}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Template Suggestions */}
                            {message.templateSuggestions && message.templateSuggestions.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2 text-right flex items-center gap-1 justify-end">
                                        <span>תבניות מהירות:</span>
                                        <span>⚡</span>
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {message.templateSuggestions.map((template: ContentTemplate) => (
                                            <button
                                                key={template.id}
                                                onClick={() => handleTemplateSelect(template)}
                                                disabled={isLoading || isGenerating}
                                                className="group relative w-full text-right p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-xl hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                                            >
                                                {/* Animated gradient background on hover */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-amber-100/50 to-orange-100/50 dark:from-amber-800/30 dark:to-orange-800/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                <div className="relative flex items-center gap-3">
                                                    {/* Icon */}
                                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl shadow-md group-hover:scale-110 transition-transform">
                                                        {template.icon || '✨'}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">
                                                            {template.name}
                                                        </h4>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                                                            {template.description}
                                                        </p>
                                                    </div>

                                                    {/* Arrow */}
                                                    <IconChevronLeft className="w-5 h-5 text-amber-400 dark:text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-[-4px] transition-all flex-shrink-0" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reuse Content Options */}
                            {message.reuseOptions && message.reuseOptions.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2 text-right flex items-center gap-1 justify-end">
                                        <span>תכנים שיצרת בעבר:</span>
                                        <span>🔄</span>
                                    </p>
                                    <div className="space-y-3">
                                        {message.reuseOptions.map((content: ReuseContentSuggestion, idx: number) => (
                                            <div
                                                key={content.id || idx}
                                                className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-2 border-cyan-200 dark:border-cyan-700 rounded-xl"
                                            >
                                                {/* Content Info */}
                                                <div className="mb-3">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white flex-1">
                                                            {content.title || content.metadata?.title || 'ללא כותרת'}
                                                        </h4>
                                                        {/* Quality Score Badge */}
                                                        {content.relevanceScore !== undefined && content.relevanceScore > 0 && (
                                                            <div className={`px-2 py-1 rounded-md font-bold text-xs ${
                                                                content.relevanceScore >= 80 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                                                content.relevanceScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                                                                'bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300'
                                                            }`}>
                                                                ⭐ {content.relevanceScore}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {content.topic && (
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                            {content.topic}
                                                        </p>
                                                    )}

                                                    {/* Usage Stats */}
                                                    {content.usageStats && content.usageStats.studentCount > 0 && (
                                                        <div className="flex flex-wrap gap-2 items-center text-[10px] mb-2 pb-2 border-b border-cyan-200 dark:border-cyan-800">
                                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md font-medium">
                                                                ✓ {content.usageStats.successRate}% הצלחה
                                                            </span>
                                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                                                                📊 {content.usageStats.avgScore}% ציון ממוצע
                                                            </span>
                                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md font-medium">
                                                                👥 {content.usageStats.studentCount} תלמידים
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap gap-2 items-center text-xs">
                                                        <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-md font-medium">
                                                            {content.blockType === 'activity' ? 'פעילות' :
                                                             content.blockType === 'exam' ? 'מבחן' :
                                                             content.blockType === 'lesson' ? 'שיעור' :
                                                             content.blockType === 'podcast' ? 'פודקאסט' : content.blockType}
                                                        </span>
                                                        {content.gradeLevel && (
                                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                                                                כיתה {content.gradeLevel}
                                                            </span>
                                                        )}
                                                        {content.courseName && (
                                                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md text-[10px]">
                                                                {content.courseName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => handleReuseAction('reuse', content)}
                                                        disabled={isLoading || isGenerating}
                                                        className="px-3 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        🔄 השתמש בזה
                                                    </button>
                                                    <button
                                                        onClick={() => handleReuseAction('inspired', content)}
                                                        disabled={isLoading || isGenerating}
                                                        className="px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        💡 בהשראת זה
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Create New Button */}
                                        <button
                                            onClick={() => handleReuseAction('new')}
                                            disabled={isLoading || isGenerating}
                                            className="w-full px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-dashed border-slate-300 dark:border-slate-600"
                                        >
                                            ✨ צור משהו חדש לגמרי
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Prompt Suggestions */}
                            {message.promptSuggestions && message.promptSuggestions.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2 text-right flex items-center gap-1 justify-end">
                                        <span>פרומפטים מומלצים מהמאגר:</span>
                                        <span>💡</span>
                                    </p>
                                    <div className="space-y-3">
                                        {message.promptSuggestions.map((prompt: any, idx: number) => (
                                            <div
                                                key={prompt.id || idx}
                                                className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-xl"
                                            >
                                                {/* Prompt Info */}
                                                <div className="mb-3">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white flex-1">
                                                            {prompt.title}
                                                        </h4>
                                                        {/* Rating Badge */}
                                                        {prompt.averageRating > 0 && (
                                                            <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md font-bold text-xs">
                                                                ⭐ {prompt.averageRating.toFixed(1)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                        {prompt.description}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2 items-center text-xs mb-2">
                                                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md font-medium">
                                                            {prompt.category}
                                                        </span>
                                                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-md">
                                                            {prompt.subcategory}
                                                        </span>
                                                        {prompt.usageCount > 0 && (
                                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[10px]">
                                                                🔥 {prompt.usageCount} שימושים
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(prompt.promptTemplate);
                                                            // Show copied notification
                                                            setMessages(prev => [...prev, {
                                                                id: `copied-${Date.now()}`,
                                                                role: 'assistant',
                                                                content: '✅ הפרומפט הועתק! עכשיו הדביקו אותו ב-ChatGPT או Gemini והתחילו למלא את השדות.',
                                                                timestamp: Date.now()
                                                            }]);
                                                        }}
                                                        disabled={isLoading || isGenerating}
                                                        className="flex-1 px-3 py-2 text-xs font-medium bg-gradient-to-r from-wizdi-royal to-wizdi-cyan hover:from-wizdi-royal/90 hover:to-wizdi-cyan/90 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                                                    >
                                                        <IconClipboardCheck className="w-4 h-4" />
                                                        העתק פרומפט
                                                    </button>
                                                    <button
                                                        onClick={() => handlePromptAction(prompt)}
                                                        disabled={isLoading || isGenerating}
                                                        className="flex-1 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-1.5"
                                                    >
                                                        <IconSparkles className="w-4 h-4" />
                                                        ראה פרטים
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Create from Scratch Button */}
                                        <button
                                            onClick={() => handleSend('בוא ניצור מאפס')}
                                            disabled={isLoading || isGenerating}
                                            className="w-full px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-dashed border-slate-300 dark:border-slate-600"
                                        >
                                            📝 צור מאפס (בלי פרומפט)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading indicator - on right side like bot messages (justify-start in RTL) */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2.5 rounded-2xl rounded-tr-md">
                            <div className="flex items-center gap-2">
                                <IconLoader2 className="w-4 h-4 animate-spin text-wizdi-royal" />
                                <span className="text-sm text-slate-500 dark:text-slate-400">חושב...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Generating indicator - on right side like bot messages (justify-start in RTL) */}
                {isGenerating && (
                    <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-wizdi-royal/10 to-wizdi-cyan/10 dark:from-wizdi-royal/20 dark:to-wizdi-cyan/20 px-4 py-3 rounded-2xl rounded-tr-md border border-wizdi-royal/20">
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

            {/* File upload indicator */}
            {collectedData.hasFileToUpload && (
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                            <IconUpload className="w-4 h-4" />
                            <span className="text-sm font-medium">יש להעלות קובץ</span>
                        </div>
                        <button
                            onClick={() => {
                                // Trigger file selection in parent (wizard)
                                const wizardData = prepareWizardData(
                                    {
                                        id: 0,
                                        title: collectedData.topic || 'תוכן חדש',
                                        description: '',
                                        productType: collectedData.productType || 'activity',
                                        profile: collectedData.profile || 'balanced',
                                        activityLength: collectedData.activityLength || 'medium',
                                        difficultyLevel: collectedData.difficultyLevel || 'core',
                                        questionCount: 5,
                                        estimatedTime: '15 דקות',
                                        questionTypes: []
                                    },
                                    collectedData
                                );
                                onCreateContent(wizardData);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                            <IconUpload className="w-4 h-4" />
                            העלאת קובץ
                        </button>
                    </div>
                </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="כתבו מה שתרצו, או לחצו על אחת הדוגמאות למעלה..."
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
