/**
 * HTML Sanitization Utility
 *
 * SECURITY: This module provides XSS protection for user-generated and AI-generated content.
 * All HTML content displayed via dangerouslySetInnerHTML should be sanitized using these utilities.
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify with safe defaults
const createSanitizer = () => {
  // Allow only safe HTML tags
  const ALLOWED_TAGS = [
    // Text formatting
    'p', 'br', 'span', 'div',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'sub', 'sup', 'mark',

    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

    // Lists
    'ul', 'ol', 'li',

    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',

    // Other semantic elements
    'blockquote', 'pre', 'code', 'hr',

    // Media (with restricted attributes)
    'img', 'figure', 'figcaption',

    // Links (href will be validated)
    'a',
  ];

  // Allow only safe attributes
  const ALLOWED_ATTR = [
    // Global attributes
    'class', 'id', 'dir', 'lang', 'title',

    // Styling (limited)
    'style',

    // Links
    'href', 'target', 'rel',

    // Images
    'src', 'alt', 'width', 'height', 'loading',

    // Tables
    'colspan', 'rowspan', 'scope',

    // Accessibility
    'aria-label', 'aria-describedby', 'role',
  ];

  // Allowed URL schemes for href and src
  const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

  return {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false, // Disable data-* attributes by default
    KEEP_CONTENT: true, // Keep text content even if tags are removed
  };
};

const SANITIZER_CONFIG = createSanitizer();

/**
 * Sanitize HTML content for safe rendering
 *
 * @param dirty - Potentially unsafe HTML string
 * @param options - Optional override options
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 * ```
 */
export function sanitizeHtml(dirty: string | undefined | null, options?: Partial<typeof SANITIZER_CONFIG>): string {
  if (!dirty) return '';

  const config = {
    ...SANITIZER_CONFIG,
    ...options,
  };

  // Sanitize the HTML
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: config.ALLOWED_TAGS,
    ALLOWED_ATTR: config.ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: config.ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: config.ALLOW_DATA_ATTR,
    KEEP_CONTENT: config.KEEP_CONTENT,
    // Additional security options
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  });

  return clean;
}

/**
 * Sanitize HTML with stricter settings (for user-generated content)
 * Removes all formatting except basic text
 */
export function sanitizeStrictHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span'],
    ALLOWED_ATTR: ['class', 'dir'],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize and extract plain text (removes all HTML)
 */
export function sanitizeToText(dirty: string | undefined | null): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize HTML content that may contain math notation
 * Allows LaTeX-style math delimiters while removing dangerous content
 */
export function sanitizeMathHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';

  // First, protect math expressions by encoding them
  const mathProtected = dirty
    .replace(/\$\$(.*?)\$\$/gs, (_, math) => `%%MATH_BLOCK%%${encodeURIComponent(math)}%%END_MATH%%`)
    .replace(/\$(.*?)\$/g, (_, math) => `%%MATH_INLINE%%${encodeURIComponent(math)}%%END_MATH%%`);

  // Sanitize HTML
  const sanitized = sanitizeHtml(mathProtected);

  // Restore math expressions
  return sanitized
    .replace(/%%MATH_BLOCK%%(.*?)%%END_MATH%%/g, (_, math) => `$$${decodeURIComponent(math)}$$`)
    .replace(/%%MATH_INLINE%%(.*?)%%END_MATH%%/g, (_, math) => `$${decodeURIComponent(math)}$`);
}

/**
 * Check if a URL is safe (for dynamic URL handling)
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url, window.location.origin);

    // Only allow http, https, mailto, tel protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!safeProtocols.includes(parsed.protocol)) {
      return false;
    }

    // Block javascript: and data: URLs that might bypass URL parsing
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL, returning empty string if unsafe
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  return isSafeUrl(url) ? url : '';
}

// Set up DOMPurify hooks for additional security
if (typeof window !== 'undefined') {
  // Remove any remaining event handlers
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Remove any attribute starting with 'on' (event handlers)
    const attrs = node.attributes;
    if (attrs) {
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attrName = attrs[i].name.toLowerCase();
        if (attrName.startsWith('on')) {
          node.removeAttribute(attrs[i].name);
        }
      }
    }

    // Ensure links open safely
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href && !isSafeUrl(href)) {
        node.removeAttribute('href');
      }
      // Add security attributes to external links
      if (href && !href.startsWith('/') && !href.startsWith('#')) {
        node.setAttribute('rel', 'noopener noreferrer');
        node.setAttribute('target', '_blank');
      }
    }

    // Validate image sources
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src');
      if (src && !isSafeUrl(src) && !src.startsWith('data:image/')) {
        node.removeAttribute('src');
        node.setAttribute('alt', '[Image removed for security]');
      }
    }
  });
}

/**
 * Convert Markdown formatting to HTML
 * Handles bold (**text**), italic (*text*), and line breaks
 *
 * @param text - Text with markdown formatting
 * @returns HTML string with proper formatting tags
 */
export function markdownToHtml(text: string | undefined | null): string {
  if (!text) return '';

  let formatted = text;

  // 1. Convert bold markdown (**text**) to <strong>
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 2. Convert italic markdown (*text*) to <em> - but not if it's a bullet point
  // Only match *text* that has content and is not at the start of a line (bullet)
  formatted = formatted.replace(/(?<!\n|^)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // 3. Convert bullet points (* at start of line) to proper list items
  // First, identify if we have bullet points
  if (/(?:^|\n)\s*\*\s+/.test(formatted)) {
    // Replace bullet point lines with list items
    formatted = formatted.replace(/(?:^|\n)\s*\*\s+([^\n]+)/g, '\n<li>$1</li>');
    // Wrap consecutive <li> items in <ul>
    formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul dir="rtl">$&</ul>');
  }

  // 4. Normalize arrows for consistent display
  formatted = formatted.replace(/->/g, '→');
  formatted = formatted.replace(/<-/g, '←');

  // 5. Convert double newlines to paragraph breaks
  formatted = formatted.replace(/\n{2,}/g, '</p><p>');

  // 6. Convert single newlines to line breaks (except inside lists)
  formatted = formatted.replace(/(?<!<\/li>)\n(?!<)/g, '<br>');

  // 7. Wrap in paragraph if not already wrapped
  if (!formatted.startsWith('<p>') && !formatted.startsWith('<ul')) {
    formatted = '<p>' + formatted + '</p>';
  }

  // 8. Clean up empty paragraphs and extra breaks
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');
  formatted = formatted.replace(/<br>\s*<br>/g, '<br>');
  formatted = formatted.replace(/^<br>|<br>$/g, '');

  return formatted;
}

/**
 * Sanitize HTML with Markdown conversion
 * First converts any Markdown syntax to HTML, then sanitizes the result
 *
 * @param dirty - HTML or Markdown string
 * @returns Sanitized HTML string
 */
export function sanitizeWithMarkdown(dirty: string | undefined | null): string {
  if (!dirty) return '';

  // Check if content has markdown patterns (asterisks for bold/italic)
  const hasMarkdown = /\*\*[^*]+\*\*|\*[^*]+\*/.test(dirty);

  if (hasMarkdown) {
    const converted = markdownToHtml(dirty);
    return sanitizeHtml(converted);
  }

  return sanitizeHtml(dirty);
}

/**
 * Format teacher content (model_answer, teacher_notes) for clean display
 *
 * Transforms raw AI-generated text with asterisks and messy formatting
 * into clean, structured HTML suitable for display.
 *
 * @param text - Raw text that may contain asterisks, arrows, etc.
 * @returns Formatted HTML string
 *
 * @example
 * Input: "* תיאור התהליך: מים -> אדים * הסיבה: חום"
 * Output: "<strong>תיאור התהליך:</strong> מים → אדים<br><br><strong>הסיבה:</strong> חום"
 */
export function formatTeacherContent(text: string | undefined | null): string {
  if (!text) return '';

  // 0. First, strip ALL existing HTML tags to get plain text
  // This handles cases where AI sends content with HTML like <p style="...">
  let formatted = sanitizeToText(text);

  // 1. Remove asterisks used as bullet points (* at start of line or after newline)
  formatted = formatted.replace(/(?:^|\n)\s*\*\s*/g, '\n');

  // 2. Remove asterisks used for bold (**text** or *text*)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
  formatted = formatted.replace(/\*([^*]+)\*/g, '$1');

  // 3. Identify and bold section headers (Hebrew text followed by colon)
  // Matches patterns like "תיאור התהליך:" or "הסיבה להמשך השימוש:"
  formatted = formatted.replace(
    /(?:^|\n)([א-ת\s]{2,30}:)/g,
    '\n<strong>$1</strong>'
  );

  // 4. Normalize arrows for consistent display
  formatted = formatted.replace(/->/g, '→');
  formatted = formatted.replace(/<-/g, '←');

  // 5. Convert newlines to HTML breaks
  formatted = formatted.replace(/\n{2,}/g, '<br><br>'); // Double newline = paragraph break
  formatted = formatted.replace(/\n/g, '<br>'); // Single newline = line break

  // 6. Clean up extra whitespace
  formatted = formatted.replace(/^\s+|\s+$/g, ''); // Trim
  formatted = formatted.replace(/<br>\s*<br>\s*<br>/g, '<br><br>'); // Max 2 breaks
  formatted = formatted.replace(/^<br>|<br>$/g, ''); // Remove leading/trailing breaks

  // 7. Sanitize the result for safety
  return sanitizeHtml(formatted);
}

/**
 * Format teacher content and wrap in a styled container
 * Returns HTML with proper RTL styling for Hebrew content
 */
export function formatTeacherContentStyled(text: string | undefined | null): string {
  const content = formatTeacherContent(text);
  if (!content) return '';

  return `<div dir="rtl" style="text-align: right; line-height: 1.8;">${content}</div>`;
}

export default {
  sanitizeHtml,
  sanitizeStrictHtml,
  sanitizeToText,
  sanitizeMathHtml,
  isSafeUrl,
  sanitizeUrl,
  formatTeacherContent,
  formatTeacherContentStyled,
  markdownToHtml,
  sanitizeWithMarkdown,
};
