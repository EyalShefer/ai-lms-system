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

export default {
  sanitizeHtml,
  sanitizeStrictHtml,
  sanitizeToText,
  sanitizeMathHtml,
  isSafeUrl,
  sanitizeUrl,
};
