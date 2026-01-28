/**
 * SmartCreationChat V2 - AI-powered content creation with dynamic capabilities
 *
 * This is the next-generation chat interface that uses:
 * - Dynamic capability loading from Firestore
 * - Gemini Function Calling
 * - RAG-based context injection
 * - Smart content type detection
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    IconSparkles,
    IconSend,
    IconLoader2,
    IconChevronLeft,
    IconRefresh,
    IconRobot,
    IconFileTypePdf,
    IconFileTypeDoc,
    IconCheck
} from '@tabler/icons-react';
import { useCapabilities } from '../hooks/useCapabilities';
import {
    analyzeIntentV2,
    quickClassifyIntent,
    detectContentTypeResponse,
    type SmartResponseV2,
    type ConversationContext
} from '../services/ai/smartCreationServiceV2';
import { searchCapabilities } from '../services/ai/capabilityRAG';
import { executeCapability, type ExecutorContext } from '../services/ai/toolExecutor';
import type { Capability } from '../shared/types/capabilityTypes';
import type { ChatMessage } from '../services/ProxyService';

// ========== Types ==========

interface SmartCreationChatV2Props {
    onCreateContent: (wizardData: any) => void;
    onOpenWizard?: (mode: string, product: string, chatContext: any) => void;
    onCancel?: () => void;
    isExpanded?: boolean;
}

interface StaticContentResult {
    success: boolean;
    contentType: string;
    title: string;
    topic: string;
    content: string;
    grade?: string;
}

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    quickReplies?: string[];
    isLoading?: boolean;
    capability?: string;
    timestamp: number;
    staticContent?: StaticContentResult;
}

// ========== Component ==========

const SmartCreationChatV2: React.FC<SmartCreationChatV2Props> = ({
    onCreateContent,
    onOpenWizard,
    onCancel,
    isExpanded = false
}) => {
    // ========== State ==========
    const [messages, setMessages] = useState<DisplayMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'היי! 👋 ספרו לי מה תרצו ליצור ואעזור לכם.',
            quickReplies: ['שיעור אינטראקטיבי', 'פעילות תרגול', 'מבחן', 'דף עבודה להדפסה'],
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
    const [contentMode, setContentMode] = useState<'interactive' | 'static' | null>(null);
    // For prompt-aware flow: track pending execution waiting for more fields
    const [pendingExecution, setPendingExecution] = useState<{
        functionName: string;
        collectedParams: Record<string, any>;
        missingFields: string[];
        contentType?: string;
    } | null>(null);

    // ========== Hooks ==========
    const { capabilities, isLoading: capabilitiesLoading, error: capabilitiesError, refresh: refreshCapabilities } = useCapabilities();

    // Debug: Log capabilities on load
    useEffect(() => {
        console.log(`📚 [SmartCreationChatV2] Capabilities loaded: ${capabilities.length}`, capabilities.map(c => c.id));
    }, [capabilities]);

    // ========== Refs ==========
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ========== Effects ==========
    useEffect(() => {
        // Scroll within container only, not the whole page
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // ========== Download Handler ==========

    const handleDownloadStaticContent = async (content: StaticContentResult, format: 'pdf' | 'doc') => {
        try {
            // Create styled HTML for export
            const styledHtml = `
                <!DOCTYPE html>
                <html lang="he" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${content.title}</title>
                    <style>
                        body { font-family: 'David', 'Arial', sans-serif; direction: rtl; padding: 20px; line-height: 1.8; }
                        h1, h2, h3 { color: #1a365d; }
                        .question { margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #e2e8f0; }
                        .answer-line { border-bottom: 1px dotted #999; height: 30px; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    ${content.content}
                </body>
                </html>
            `;

            if (format === 'pdf') {
                // Use html2pdf.js for PDF generation
                const html2pdf = (await import('html2pdf.js')).default;
                const element = document.createElement('div');
                element.innerHTML = styledHtml;
                element.style.direction = 'rtl';

                const opt = {
                    margin: 10,
                    filename: `${content.title}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                await html2pdf().set(opt).from(element).save();
            } else {
                // For Word, create HTML blob that Word can open
                const blob = new Blob([styledHtml], {
                    type: 'application/vnd.ms-word'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${content.title}.doc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('שגיאה בהורדת הקובץ. נסו שוב.');
        }
    };

    // ========== Handlers ==========

    const handleSend = useCallback(async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text || isLoading || capabilitiesLoading) return;

        // Add user message
        const userMessage: DisplayMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Add to conversation history
        const newHistory: ChatMessage[] = [
            ...conversationHistory,
            { role: 'user' as const, content: text }
        ];
        setConversationHistory(newHistory);

        try {
            // Check if user is responding to content type clarification
            const detectedMode = detectContentTypeResponse(text);
            if (detectedMode) {
                console.log(`✅ [SmartCreationChatV2] User chose content mode: ${detectedMode}`);
                setContentMode(detectedMode);
            }

            // Check if this is a NEW content request (not a clarification response)
            // If so, reset contentMode so the clarification question triggers
            const AMBIGUOUS_TERMS = ['מערך שיעור', 'שיעור', 'מבחן', 'בוחן', 'פעילות', 'דף עבודה'];
            const isNewContentRequest = !detectedMode && AMBIGUOUS_TERMS.some(term => text.includes(term));

            let effectiveContentMode = detectedMode || contentMode;
            if (isNewContentRequest && contentMode) {
                console.log('🔄 [SmartCreationChatV2] New content request detected, resetting contentMode');
                setContentMode(null);
                effectiveContentMode = null;
                // Also clear pending execution for fresh start
                if (pendingExecution) {
                    console.log('🧹 [SmartCreationChatV2] Clearing pending execution for new request');
                    setPendingExecution(null);
                }
            }
            const context: ConversationContext = {
                messages: newHistory,
                contentMode: effectiveContentMode,
                pendingExecution: pendingExecution || undefined
            };

            // Build executor context
            const executorContext: ExecutorContext = {
                capabilities: new Map(capabilities.map(c => [c.id, c])),
                onWizardTrigger: (wizardData) => {
                    console.log('🧙 [SmartCreationChatV2] Wizard triggered:', wizardData);

                    // Map productType to IngestionWizard product format
                    const productTypeMap: Record<string, string> = {
                        'activity': 'activity',
                        'lesson': 'lesson',
                        'exam': 'exam',
                        'micro': 'micro'
                    };
                    const product = productTypeMap[wizardData.productType] || 'activity';

                    // Build chatContext for IngestionWizard
                    const chatContext = {
                        topic: wizardData.topic,
                        grade: wizardData.grade,
                        subject: wizardData.subject,
                        productType: product,
                        activityLength: wizardData.activityLength
                    };

                    // If onOpenWizard is provided, open IngestionWizard with pre-filled data
                    if (onOpenWizard) {
                        console.log('🧙 [SmartCreationChatV2] Opening wizard with chatContext:', chatContext);
                        onOpenWizard('learning', product, chatContext);
                    } else {
                        // Fallback: go directly to content creation (old behavior)
                        onCreateContent(wizardData);
                    }
                },
                onStaticContentGenerated: (content) => {
                    console.log('📄 [SmartCreationChatV2] Static content generated:', content);
                    // Store static content for download, show clean message
                    setMessages(prev => [...prev, {
                        id: `static-${Date.now()}`,
                        role: 'assistant',
                        content: `✅ יצרתי לך: ${content.title}`,
                        staticContent: content as StaticContentResult,
                        timestamp: Date.now()
                    }]);
                }
            };

            // Analyze intent with V2 service
            const response = await analyzeIntentV2(
                text,
                context,
                capabilities,
                executorContext
            );

            console.log('🤖 [SmartCreationChatV2] Response:', response);

            // Handle response based on type
            switch (response.type) {
                case 'function_call':
                    // Function was executed - clear pending execution
                    if (pendingExecution) {
                        console.log('🧹 [SmartCreationChatV2] Clearing pending execution after successful call');
                        setPendingExecution(null);
                    }

                    if (response.executionResult?.success) {
                        if (response.executionResult.result?.action === 'wizard_triggered') {
                            // Wizard will be triggered via callback
                            setMessages(prev => [...prev, {
                                id: `assistant-${Date.now()}`,
                                role: 'assistant',
                                content: response.message,
                                quickReplies: response.quickReplies,
                                capability: response.functionCall?.name,
                                timestamp: Date.now()
                            }]);
                        }
                    } else {
                        // Execution failed
                        setMessages(prev => [...prev, {
                            id: `error-${Date.now()}`,
                            role: 'assistant',
                            content: `❌ ${response.executionResult?.error?.message || 'משהו השתבש'}`,
                            quickReplies: ['נסה שוב'],
                            timestamp: Date.now()
                        }]);
                    }
                    break;

                case 'clarification':
                    // Need more info
                    setMessages(prev => [...prev, {
                        id: `clarify-${Date.now()}`,
                        role: 'assistant',
                        content: response.message,
                        quickReplies: response.quickReplies,
                        timestamp: Date.now()
                    }]);

                    // Update content mode if determined
                    if (response.contentAnalysis?.mode !== 'ambiguous') {
                        setContentMode(response.contentAnalysis?.mode || null);
                    }

                    // Store pending execution for prompt-aware flow
                    if (response.pendingExecution) {
                        console.log('💾 [SmartCreationChatV2] Storing pending execution:', response.pendingExecution);
                        setPendingExecution(response.pendingExecution);
                    }
                    break;

                case 'message':
                    // Regular message
                    setMessages(prev => [...prev, {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: response.message,
                        quickReplies: response.quickReplies,
                        timestamp: Date.now()
                    }]);
                    break;

                case 'error':
                default:
                    setMessages(prev => [...prev, {
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: response.message || 'סליחה, משהו השתבש. נסו שוב?',
                        quickReplies: ['נסה שוב', 'התחל מחדש'],
                        timestamp: Date.now()
                    }]);
            }

            // Add assistant response to history
            setConversationHistory(prev => [
                ...prev,
                { role: 'assistant' as const, content: response.message }
            ]);

        } catch (error) {
            console.error('❌ [SmartCreationChatV2] Error:', error);
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
    }, [input, isLoading, capabilities, capabilitiesLoading, conversationHistory, contentMode, onCreateContent]);

    const handleQuickReply = (reply: string) => {
        if (reply === 'התחל מחדש') {
            handleReset();
            return;
        }
        handleSend(reply);
    };

    const handleReset = () => {
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: 'היי! 👋 ספרו לי מה תרצו ליצור ואעזור לכם.',
            quickReplies: ['שיעור אינטראקטיבי', 'פעילות תרגול', 'מבחן', 'דף עבודה להדפסה'],
            timestamp: Date.now()
        }]);
        setConversationHistory([]);
        setContentMode(null);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ========== Render ==========

    return (
        <div className={`smart-creation-chat-v2 ${isExpanded ? 'expanded' : ''}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#1e40af',
                color: 'white'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconRobot size={24} />
                    <span style={{ fontWeight: 600 }}>העוזר האישי שלך ליצירת תוכן</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleReset}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                        title="התחל מחדש"
                    >
                        <IconRefresh size={20} />
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <IconChevronLeft size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Capabilities Loading Error */}
            {capabilitiesError && (
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '14px'
                }}>
                    ⚠️ שגיאה בטעינת יכולות. משתמש במצב בסיסי.
                </div>
            )}

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                {messages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%'
                        }}
                    >
                        <div style={{
                            backgroundColor: message.role === 'user' ? '#1e40af' : 'white',
                            color: message.role === 'user' ? 'white' : '#1f2937',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            borderTopRightRadius: message.role === 'user' ? '4px' : '16px',
                            borderTopLeftRadius: message.role === 'user' ? '16px' : '4px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {message.content}

                            {/* Static Content Download Card */}
                            {message.staticContent && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '16px',
                                    backgroundColor: '#f0fdf4',
                                    border: '2px solid #86efac',
                                    borderRadius: '12px'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '12px'
                                    }}>
                                        <IconCheck size={20} style={{ color: '#16a34a' }} />
                                        <span style={{ fontWeight: 600, color: '#15803d' }}>
                                            {message.staticContent.title}
                                        </span>
                                    </div>
                                    <p style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        marginBottom: '12px'
                                    }}>
                                        נושא: {message.staticContent.topic}
                                        {message.staticContent.grade && ` | כיתה ${message.staticContent.grade}`}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleDownloadStaticContent(message.staticContent!, 'pdf')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 16px',
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: 500
                                            }}
                                        >
                                            <IconFileTypePdf size={18} />
                                            הורד PDF
                                        </button>
                                        <button
                                            onClick={() => handleDownloadStaticContent(message.staticContent!, 'doc')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 16px',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: 500
                                            }}
                                        >
                                            <IconFileTypeDoc size={18} />
                                            הורד Word
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick Replies */}
                        {message.quickReplies && message.quickReplies.length > 0 && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginTop: '8px'
                            }}>
                                {message.quickReplies.map((reply, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleQuickReply(reply)}
                                        disabled={isLoading}
                                        style={{
                                            padding: '8px 14px',
                                            backgroundColor: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '20px',
                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            color: '#4b5563',
                                            transition: 'all 0.2s',
                                            opacity: isLoading ? 0.5 : 1
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isLoading) {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.borderColor = '#1e40af';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'white';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <div style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#6b7280'
                    }}>
                        <IconLoader2 size={20} className="animate-spin" />
                        <span>חושב...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: 'white'
            }}>
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-end'
                }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="ספרו לי מה תרצו ליצור..."
                        disabled={isLoading || capabilitiesLoading}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            resize: 'none',
                            minHeight: '44px',
                            maxHeight: '120px',
                            fontSize: '15px',
                            direction: 'rtl',
                            outline: 'none'
                        }}
                        rows={1}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading || capabilitiesLoading}
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: input.trim() && !isLoading ? '#1e40af' : '#e5e7eb',
                            color: 'white',
                            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isLoading ? (
                            <IconLoader2 size={20} className="animate-spin" />
                        ) : (
                            <IconSend size={20} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartCreationChatV2;
