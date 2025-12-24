import { logSecurityEvent } from './loggerService';

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

// Regex Patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\b05\d-?\d{7}\b)|(\b0[23489]-?\d{7}\b)/; // Basic Israeli mobile/landline
const ISRAELI_ID_REGEX = /\b\d{9}\b/;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[- ]?){3}\d{4}\b/;

// Safety / Distress Keywords (Hebrew)
// This is a basic heuristic list. In production, this should be more comprehensive or AI-based.
const DISTRESS_PATTERN = /(רוצה למות|להתאבד|להרוג|סכין|דכאון|דיכאון|מרביצים לי|אלימות|מצוקה|עזרה דחופה|פוגעים בי|דם|רצח|אונס|הטרדה|מפחיד לי)/i;

export const checkForDistress = (text: string): boolean => {
    if (!text) return false;
    return DISTRESS_PATTERN.test(text);
};

export const validateInput = (text: string): ValidationResult => {
    if (!text) return { isValid: true };

    // Check for Email
    if (EMAIL_REGEX.test(text)) {
        logSecurityEvent('PII_ATTEMPT', { type: 'EMAIL', textLength: text.length });
        return {
            isValid: false,
            reason: "ההודעה מכילה כתובת אימייל. למען פרטיותך, אין לשתף פרטי קשר."
        };
    }

    // Check for Phone
    if (PHONE_REGEX.test(text)) {
        logSecurityEvent('PII_ATTEMPT', { type: 'PHONE', textLength: text.length });
        return {
            isValid: false,
            reason: "ההודעה מכילה מספר טלפון. למען פרטיותך, אין לשתף פרטי קשר."
        };
    }

    // Check for Israeli ID
    // We can do a checksum validation if we want to be strict, but simple regex is good for now to avoid false positives on random numbers
    // Let's stick to simple 9 digit detection for now, maybe add checksum later if false positives are annoying.
    if (ISRAELI_ID_REGEX.test(text)) {
        logSecurityEvent('PII_ATTEMPT', { type: 'ISRAEL_ID', textLength: text.length });
        // Optional: Luhn algorithm or ID checksum could be here
        return {
            isValid: false,
            reason: "ההודעה מכילה רצף ספרות החשוד כתעודת זהות. למען פרטיותך, אין לשתף מספרים מזהים."
        };
    }

    // Check for Credit Card
    if (CREDIT_CARD_REGEX.test(text)) {
        logSecurityEvent('PII_ATTEMPT', { type: 'CREDIT_CARD', textLength: text.length });
        return {
            isValid: false,
            reason: "ההודעה מכילה רצף ספרות החשוד ככרטיס אשראי. אין לשתף פרטי תשלום."
        };
    }

    return { isValid: true };
};
