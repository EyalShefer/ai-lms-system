/**
 * Input Validation Utilities
 *
 * SECURITY: Comprehensive input validation for all API endpoints.
 * Prevents injection attacks, data corruption, and abuse.
 */

// Common validation patterns
const PATTERNS = {
  // Firebase-style document IDs (alphanumeric + common chars)
  DOCUMENT_ID: /^[a-zA-Z0-9_-]{1,128}$/,

  // Email validation (RFC 5322 simplified)
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // URL validation
  URL: /^https?:\/\/[^\s<>\"{}|\\^`[\]]+$/,

  // Safe string (no script tags, no dangerous chars)
  SAFE_STRING: /^[^<>]*$/,

  // Hebrew + English + common punctuation
  TEXT_CONTENT: /^[\u0590-\u05FF\u0600-\u06FFa-zA-Z0-9\s.,!?;:'"()\-\n\r]+$/,

  // Locale codes
  LOCALE: /^(he|ar|en)$/,

  // ISO date format
  ISO_DATE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
};

// Maximum lengths for different field types
const MAX_LENGTHS = {
  DOCUMENT_ID: 128,
  SHORT_TEXT: 255,
  MEDIUM_TEXT: 1000,
  LONG_TEXT: 10000,
  CONTENT: 50000,
  ARRAY_ITEMS: 100,
  NESTED_DEPTH: 5,
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

/**
 * Validate a Firebase document ID
 */
export function validateDocumentId(id: any, fieldName = 'id'): ValidationResult {
  const errors: string[] = [];

  if (id === undefined || id === null) {
    return { isValid: false, errors: [`${fieldName} is required`] };
  }

  if (typeof id !== 'string') {
    return { isValid: false, errors: [`${fieldName} must be a string`] };
  }

  if (id.length === 0) {
    errors.push(`${fieldName} cannot be empty`);
  }

  if (id.length > MAX_LENGTHS.DOCUMENT_ID) {
    errors.push(`${fieldName} exceeds maximum length of ${MAX_LENGTHS.DOCUMENT_ID}`);
  }

  if (!PATTERNS.DOCUMENT_ID.test(id)) {
    errors.push(`${fieldName} contains invalid characters (only alphanumeric, underscore, hyphen allowed)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: id.trim(),
  };
}

/**
 * Validate a string field
 */
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  } = {}
): ValidationResult {
  const { required = false, minLength = 0, maxLength = MAX_LENGTHS.MEDIUM_TEXT, pattern, allowEmpty = false } = options;
  const errors: string[] = [];

  if (value === undefined || value === null) {
    if (required) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  if (typeof value !== 'string') {
    return { isValid: false, errors: [`${fieldName} must be a string`] };
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length === 0 && required) {
    errors.push(`${fieldName} cannot be empty`);
  }

  if (trimmed.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters`);
  }

  if (trimmed.length > maxLength) {
    errors.push(`${fieldName} exceeds maximum length of ${maxLength}`);
  }

  if (pattern && !pattern.test(trimmed)) {
    errors.push(`${fieldName} contains invalid characters`);
  }

  // Check for potential injection attempts
  if (trimmed.includes('<script') || trimmed.includes('javascript:')) {
    errors.push(`${fieldName} contains potentially dangerous content`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: trimmed,
  };
}

/**
 * Validate an email address
 */
export function validateEmail(email: any, fieldName = 'email', required = false): ValidationResult {
  if (!email && !required) {
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  const stringResult = validateString(email, fieldName, { required, maxLength: 254 });
  if (!stringResult.isValid) {
    return stringResult;
  }

  const errors: string[] = [];
  const normalizedEmail = email.toLowerCase().trim();

  if (!PATTERNS.EMAIL.test(normalizedEmail)) {
    errors.push(`${fieldName} is not a valid email address`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: normalizedEmail,
  };
}

/**
 * Validate a URL
 */
export function validateUrl(url: any, fieldName = 'url', required = false): ValidationResult {
  if (!url && !required) {
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  const stringResult = validateString(url, fieldName, { required, maxLength: 2048 });
  if (!stringResult.isValid) {
    return stringResult;
  }

  const errors: string[] = [];

  if (!PATTERNS.URL.test(url)) {
    errors.push(`${fieldName} is not a valid URL`);
  }

  // Block potentially dangerous URLs
  if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
    errors.push(`${fieldName} contains a dangerous URL scheme`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: url,
  };
}

/**
 * Validate a number
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationResult {
  const { required = false, min, max, integer = false } = options;
  const errors: string[] = [];

  if (value === undefined || value === null) {
    if (required) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return { isValid: false, errors: [`${fieldName} must be a valid number`] };
  }

  if (!isFinite(num)) {
    return { isValid: false, errors: [`${fieldName} must be a finite number`] };
  }

  if (integer && !Number.isInteger(num)) {
    errors.push(`${fieldName} must be an integer`);
  }

  if (min !== undefined && num < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    errors.push(`${fieldName} must be at most ${max}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: num,
  };
}

/**
 * Validate a boolean
 */
export function validateBoolean(value: any, fieldName: string, required = false): ValidationResult {
  if (value === undefined || value === null) {
    if (required) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  if (typeof value !== 'boolean') {
    return { isValid: false, errors: [`${fieldName} must be a boolean`] };
  }

  return { isValid: true, errors: [], sanitizedValue: value };
}

/**
 * Validate a date
 */
export function validateDate(value: any, fieldName: string, required = false): ValidationResult {
  if (value === undefined || value === null) {
    if (required) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  const errors: string[] = [];
  let date: Date;

  if (typeof value === 'string') {
    if (!PATTERNS.ISO_DATE.test(value)) {
      return { isValid: false, errors: [`${fieldName} must be a valid ISO date string`] };
    }
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return { isValid: false, errors: [`${fieldName} must be a date string or Date object`] };
  }

  if (isNaN(date.getTime())) {
    errors.push(`${fieldName} is not a valid date`);
  }

  // Sanity check: date should be reasonable (between year 2000 and 2100)
  const year = date.getFullYear();
  if (year < 2000 || year > 2100) {
    errors.push(`${fieldName} is outside the valid date range`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: date,
  };
}

/**
 * Validate an array
 */
export function validateArray<T>(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    minItems?: number;
    maxItems?: number;
    itemValidator?: (item: any, index: number) => ValidationResult;
  } = {}
): ValidationResult {
  const { required = false, minItems = 0, maxItems = MAX_LENGTHS.ARRAY_ITEMS, itemValidator } = options;
  const errors: string[] = [];
  const sanitizedItems: T[] = [];

  if (value === undefined || value === null) {
    if (required) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    return { isValid: true, errors: [], sanitizedValue: undefined };
  }

  if (!Array.isArray(value)) {
    return { isValid: false, errors: [`${fieldName} must be an array`] };
  }

  if (value.length < minItems) {
    errors.push(`${fieldName} must have at least ${minItems} items`);
  }

  if (value.length > maxItems) {
    errors.push(`${fieldName} exceeds maximum of ${maxItems} items`);
  }

  if (itemValidator) {
    for (let i = 0; i < value.length && i < maxItems; i++) {
      const itemResult = itemValidator(value[i], i);
      if (!itemResult.isValid) {
        errors.push(...itemResult.errors.map((e) => `${fieldName}[${i}]: ${e}`));
      } else {
        sanitizedItems.push(itemResult.sanitizedValue);
      }
    }
  } else {
    sanitizedItems.push(...value.slice(0, maxItems));
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedItems,
  };
}

/**
 * Validate locale
 */
export function validateLocale(locale: any, required = false): ValidationResult {
  if (!locale && !required) {
    return { isValid: true, errors: [], sanitizedValue: 'he' }; // Default to Hebrew
  }

  if (typeof locale !== 'string' || !PATTERNS.LOCALE.test(locale)) {
    return { isValid: false, errors: ['locale must be one of: he, ar, en'] };
  }

  return { isValid: true, errors: [], sanitizedValue: locale };
}

/**
 * Validate Wizdi login request
 */
export function validateWizdiLoginRequest(body: any): ValidationResult {
  const errors: string[] = [];

  // Required fields
  const uidResult = validateDocumentId(body.uid, 'uid');
  if (!uidResult.isValid) errors.push(...uidResult.errors);

  const schoolIdResult = validateDocumentId(body.schoolId, 'schoolId');
  if (!schoolIdResult.isValid) errors.push(...schoolIdResult.errors);

  const schoolNameResult = validateString(body.schoolName, 'schoolName', { required: true, maxLength: 255 });
  if (!schoolNameResult.isValid) errors.push(...schoolNameResult.errors);

  const apiKeyResult = validateString(body.apiKey, 'apiKey', { required: true, maxLength: 100 });
  if (!apiKeyResult.isValid) errors.push(...apiKeyResult.errors);

  const apiSecretResult = validateString(body.apiSecret, 'apiSecret', { required: true, maxLength: 100 });
  if (!apiSecretResult.isValid) errors.push(...apiSecretResult.errors);

  const isTeacherResult = validateBoolean(body.isTeacher, 'isTeacher', true);
  if (!isTeacherResult.isValid) errors.push(...isTeacherResult.errors);

  const localeResult = validateLocale(body.locale);
  if (!localeResult.isValid) errors.push(...localeResult.errors);

  // Classes array validation
  const classesResult = validateArray(body.classes, 'classes', {
    required: true,
    minItems: 1,
    maxItems: 50,
    itemValidator: (item) => {
      const classErrors: string[] = [];
      const idResult = validateDocumentId(item?.id, 'class.id');
      if (!idResult.isValid) classErrors.push(...idResult.errors);
      const nameResult = validateString(item?.name, 'class.name', { required: true, maxLength: 255 });
      if (!nameResult.isValid) classErrors.push(...nameResult.errors);
      return {
        isValid: classErrors.length === 0,
        errors: classErrors,
        sanitizedValue: { id: item?.id, name: item?.name },
      };
    },
  });
  if (!classesResult.isValid) errors.push(...classesResult.errors);

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: {
      uid: uidResult.sanitizedValue,
      schoolId: schoolIdResult.sanitizedValue,
      schoolName: schoolNameResult.sanitizedValue,
      apiKey: apiKeyResult.sanitizedValue,
      apiSecret: apiSecretResult.sanitizedValue,
      isTeacher: isTeacherResult.sanitizedValue,
      locale: localeResult.sanitizedValue,
      classes: classesResult.sanitizedValue,
      groups: body.groups || [],
    },
  };
}

/**
 * Validate API request with credentials
 */
export function validateApiCredentials(body: any): ValidationResult {
  const errors: string[] = [];

  const apiKeyResult = validateString(body.apiKey, 'apiKey', { required: true, maxLength: 100 });
  if (!apiKeyResult.isValid) errors.push(...apiKeyResult.errors);

  const apiSecretResult = validateString(body.apiSecret, 'apiSecret', { required: true, maxLength: 100 });
  if (!apiSecretResult.isValid) errors.push(...apiSecretResult.errors);

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: {
      apiKey: apiKeyResult.sanitizedValue,
      apiSecret: apiSecretResult.sanitizedValue,
    },
  };
}

/**
 * Validate date range for queries
 */
export function validateDateRange(
  dateFrom: any,
  dateTo: any
): ValidationResult {
  const errors: string[] = [];
  let sanitizedFrom: Date | undefined;
  let sanitizedTo: Date | undefined;

  if (dateFrom) {
    const fromResult = validateDate(dateFrom, 'dateFrom');
    if (!fromResult.isValid) {
      errors.push(...fromResult.errors);
    } else {
      sanitizedFrom = fromResult.sanitizedValue;
    }
  }

  if (dateTo) {
    const toResult = validateDate(dateTo, 'dateTo');
    if (!toResult.isValid) {
      errors.push(...toResult.errors);
    } else {
      sanitizedTo = toResult.sanitizedValue;
    }
  }

  // Validate range makes sense
  if (sanitizedFrom && sanitizedTo && sanitizedFrom > sanitizedTo) {
    errors.push('dateFrom must be before dateTo');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: { dateFrom: sanitizedFrom, dateTo: sanitizedTo },
  };
}

export default {
  validateDocumentId,
  validateString,
  validateEmail,
  validateUrl,
  validateNumber,
  validateBoolean,
  validateDate,
  validateArray,
  validateLocale,
  validateWizdiLoginRequest,
  validateApiCredentials,
  validateDateRange,
  PATTERNS,
  MAX_LENGTHS,
};
