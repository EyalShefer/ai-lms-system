import React, { useEffect, useCallback, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
    IconBold,
    IconItalic,
    IconUnderline,
    IconH2,
    IconH3,
    IconList,
    IconListNumbers,
    IconAlignRight,
    IconAlignCenter,
    IconAlignLeft,
    IconClearFormatting,
    IconLink,
} from '../icons';

interface RichTextEditorProps {
    /** Initial HTML content */
    value: string;
    /** Called on content change with HTML string */
    onChange: (html: string) => void;
    /** Placeholder text (Hebrew default) */
    placeholder?: string;
    /** Minimum height of the editor area */
    minHeight?: string;
    /** Whether to show the toolbar (default: true) */
    showToolbar?: boolean;
    /** Text direction - defaults to 'rtl' for Hebrew */
    direction?: 'rtl' | 'ltr';
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes for the container */
    className?: string;
    /** Auto-focus on mount */
    autoFocus?: boolean;
}

interface ToolbarButtonProps {
    editor: Editor;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    isActive: boolean;
    title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, action, isActive, title }) => (
    <button
        type="button"
        onClick={action}
        className={`rte-toolbar-btn ${isActive ? 'active' : ''}`}
        title={title}
    >
        <Icon className="w-4 h-4" />
    </button>
);

const ToolbarSeparator = () => <div className="rte-toolbar-separator" />;

interface RichTextToolbarProps {
    editor: Editor;
}

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ editor }) => {
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    const setLink = useCallback(() => {
        if (linkUrl) {
            // Add https:// if no protocol
            const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        } else {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        }
        setShowLinkInput(false);
        setLinkUrl('');
    }, [editor, linkUrl]);

    const openLinkInput = () => {
        const previousUrl = editor.getAttributes('link').href || '';
        setLinkUrl(previousUrl);
        setShowLinkInput(true);
    };

    return (
        <div className="rte-toolbar">
            {/* Formatting group */}
            <ToolbarButton
                editor={editor}
                name="bold"
                icon={IconBold}
                action={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="הדגשה (Ctrl+B)"
            />
            <ToolbarButton
                editor={editor}
                name="italic"
                icon={IconItalic}
                action={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="נטוי (Ctrl+I)"
            />
            <ToolbarButton
                editor={editor}
                name="underline"
                icon={IconUnderline}
                action={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="קו תחתון (Ctrl+U)"
            />

            <ToolbarSeparator />

            {/* Headings group */}
            <ToolbarButton
                editor={editor}
                name="h2"
                icon={IconH2}
                action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="כותרת 2"
            />
            <ToolbarButton
                editor={editor}
                name="h3"
                icon={IconH3}
                action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="כותרת 3"
            />

            <ToolbarSeparator />

            {/* Lists group */}
            <ToolbarButton
                editor={editor}
                name="bulletList"
                icon={IconList}
                action={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="רשימה"
            />
            <ToolbarButton
                editor={editor}
                name="orderedList"
                icon={IconListNumbers}
                action={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="רשימה ממוספרת"
            />

            <ToolbarSeparator />

            {/* Link */}
            {showLinkInput ? (
                <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-slate-200">
                    <input
                        type="text"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                setLink();
                            } else if (e.key === 'Escape') {
                                setShowLinkInput(false);
                                setLinkUrl('');
                            }
                        }}
                        placeholder="הזן כתובת URL..."
                        className="text-sm border-none outline-none bg-transparent w-40 px-1"
                        autoFocus
                        dir="ltr"
                    />
                    <button
                        type="button"
                        onClick={setLink}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                    >
                        אישור
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowLinkInput(false);
                            setLinkUrl('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700"
                    >
                        ביטול
                    </button>
                </div>
            ) : (
                <ToolbarButton
                    editor={editor}
                    name="link"
                    icon={IconLink}
                    action={openLinkInput}
                    isActive={editor.isActive('link')}
                    title="קישור (Ctrl+K)"
                />
            )}

            <ToolbarSeparator />

            {/* Alignment group */}
            <ToolbarButton
                editor={editor}
                name="alignRight"
                icon={IconAlignRight}
                action={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="יישור לימין"
            />
            <ToolbarButton
                editor={editor}
                name="alignCenter"
                icon={IconAlignCenter}
                action={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="יישור למרכז"
            />
            <ToolbarButton
                editor={editor}
                name="alignLeft"
                icon={IconAlignLeft}
                action={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="יישור לשמאל"
            />

            <ToolbarSeparator />

            {/* Clear formatting */}
            <ToolbarButton
                editor={editor}
                name="clear"
                icon={IconClearFormatting}
                action={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                isActive={false}
                title="נקה עיצוב"
            />
        </div>
    );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder = 'התחילו לכתוב...',
    minHeight = '200px',
    showToolbar = true,
    direction = 'rtl',
    disabled = false,
    className = '',
    autoFocus = false,
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                // Disable Link and Underline from StarterKit - we configure them separately below
                // This prevents "Duplicate extension names" warning in TipTap v3
                link: false,
                underline: false,
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                alignments: ['left', 'center', 'right'],
                defaultAlignment: direction === 'rtl' ? 'right' : 'left',
            }),
            Placeholder.configure({
                placeholder,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                },
            }),
        ],
        content: value,
        editable: !disabled,
        autofocus: autoFocus,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sync external value changes
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value, false);
        }
    }, [value, editor]);

    // Update editable state when disabled changes
    useEffect(() => {
        if (editor) {
            editor.setEditable(!disabled);
        }
    }, [disabled, editor]);

    if (!editor) {
        return (
            <div className={`rte-container ${className}`} style={{ minHeight }}>
                <div className="p-4 text-slate-400">טוען...</div>
            </div>
        );
    }

    return (
        <div
            className={`rte-container ${className} ${disabled ? 'opacity-60' : ''}`}
            dir={direction}
        >
            {showToolbar && <RichTextToolbar editor={editor} />}
            <EditorContent
                editor={editor}
                style={{ minHeight }}
            />
        </div>
    );
};

export default RichTextEditor;
