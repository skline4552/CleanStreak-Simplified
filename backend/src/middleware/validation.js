const {
  validateEmail,
  validateUsername,
  validatePassword,
  validateTaskName,
  validateDate,
  validateStreakCount,
  sanitizeString,
  sanitizeInput
} = require('../utils/validation');

/**
 * Advanced Input Validation Middleware
 *
 * Provides comprehensive input validation, sanitization, and security checks
 * for all API endpoints with detailed error reporting
 */

/**
 * Create validation middleware with custom rules
 * @param {Object} schema - Validation schema
 * @returns {Function} Express validation middleware
 */
const createValidator = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const sanitized = {};

    // Validate and sanitize each field according to schema
    for (const [field, rules] of Object.entries(schema)) {
      const value = getNestedValue(req, field);

      try {
        // Apply validation rules
        const validationResult = applyValidationRules(value, rules, field);

        if (validationResult.isValid) {
          // Store sanitized value
          setNestedValue(sanitized, field, validationResult.sanitizedValue);
        } else {
          errors.push(...validationResult.errors);
        }
      } catch (error) {
        errors.push({
          field,
          message: `Validation error: ${error.message}`,
          code: 'VALIDATION_ERROR'
        });
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation Failed',
        code: 'VALIDATION_ERRORS',
        message: 'One or more fields failed validation',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    // Add sanitized data to request
    req.sanitized = sanitized;
    req.validated = true;

    next();
  };
};

/**
 * Apply validation rules to a value
 * @param {*} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Field name for error reporting
 * @returns {Object} Validation result
 */
const applyValidationRules = (value, rules, fieldName) => {
  const errors = [];
  let sanitizedValue = value;

  // Check if field is required
  if (rules.required && (value === undefined || value === null || value === '')) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} is required`,
        code: 'REQUIRED_FIELD_MISSING'
      }]
    };
  }

  // If field is optional and empty, skip further validation
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return {
      isValid: true,
      sanitizedValue: value
    };
  }

  // Type validation and conversion
  if (rules.type) {
    const typeResult = validateType(value, rules.type, fieldName);
    if (!typeResult.isValid) {
      return typeResult;
    }
    sanitizedValue = typeResult.convertedValue;
  }

  // String-specific validations
  if (typeof sanitizedValue === 'string') {
    // Sanitize string
    if (rules.sanitize !== false) {
      sanitizedValue = sanitizeString(sanitizedValue);
    }

    // Length validation
    if (rules.minLength && sanitizedValue.length < rules.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rules.minLength} characters long`,
        code: 'MIN_LENGTH_VIOLATION'
      });
    }

    if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be no more than ${rules.maxLength} characters long`,
        code: 'MAX_LENGTH_VIOLATION'
      });
    }

    // Pattern validation
    if (rules.pattern) {
      const pattern = new RegExp(rules.pattern);
      if (!pattern.test(sanitizedValue)) {
        errors.push({
          field: fieldName,
          message: rules.patternMessage || `${fieldName} format is invalid`,
          code: 'PATTERN_MISMATCH'
        });
      }
    }
  }

  // Number-specific validations
  if (typeof sanitizedValue === 'number') {
    if (rules.min !== undefined && sanitizedValue < rules.min) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rules.min}`,
        code: 'MIN_VALUE_VIOLATION'
      });
    }

    if (rules.max !== undefined && sanitizedValue > rules.max) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be no more than ${rules.max}`,
        code: 'MAX_VALUE_VIOLATION'
      });
    }
  }

  // Custom validation function
  if (rules.custom) {
    try {
      const customResult = rules.custom(sanitizedValue, fieldName);
      if (customResult && !customResult.isValid) {
        errors.push({
          field: fieldName,
          message: customResult.message || `${fieldName} failed custom validation`,
          code: customResult.code || 'CUSTOM_VALIDATION_FAILED'
        });
      }
    } catch (error) {
      errors.push({
        field: fieldName,
        message: `Custom validation error: ${error.message}`,
        code: 'CUSTOM_VALIDATION_ERROR'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue
  };
};

/**
 * Validate and convert value type
 * @param {*} value - Value to validate
 * @param {string} expectedType - Expected type
 * @param {string} fieldName - Field name for error reporting
 * @returns {Object} Type validation result
 */
const validateType = (value, expectedType, fieldName) => {
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          isValid: false,
          errors: [{
            field: fieldName,
            message: `${fieldName} must be a string`,
            code: 'INVALID_TYPE_STRING'
          }]
        };
      }
      break;

    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        return {
          isValid: false,
          errors: [{
            field: fieldName,
            message: `${fieldName} must be a valid number`,
            code: 'INVALID_TYPE_NUMBER'
          }]
        };
      }
      return { isValid: true, convertedValue: num };

    case 'integer':
      const int = parseInt(value, 10);
      if (isNaN(int) || int !== parseFloat(value)) {
        return {
          isValid: false,
          errors: [{
            field: fieldName,
            message: `${fieldName} must be a valid integer`,
            code: 'INVALID_TYPE_INTEGER'
          }]
        };
      }
      return { isValid: true, convertedValue: int };

    case 'boolean':
      if (typeof value === 'boolean') {
        return { isValid: true, convertedValue: value };
      }
      if (value === 'true' || value === '1') {
        return { isValid: true, convertedValue: true };
      }
      if (value === 'false' || value === '0') {
        return { isValid: true, convertedValue: false };
      }
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: `${fieldName} must be a valid boolean`,
          code: 'INVALID_TYPE_BOOLEAN'
        }]
      };

    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          isValid: false,
          errors: [{
            field: fieldName,
            message: `${fieldName} must be a valid date`,
            code: 'INVALID_TYPE_DATE'
          }]
        };
      }
      return { isValid: true, convertedValue: date };

    case 'email':
      if (!validateEmail(value).isValid) {
        return {
          isValid: false,
          errors: [{
            field: fieldName,
            message: `${fieldName} must be a valid email address`,
            code: 'INVALID_EMAIL_FORMAT'
          }]
        };
      }
      break;

    default:
      return { isValid: true, convertedValue: value };
  }

  return { isValid: true, convertedValue: value };
};

/**
 * Get nested value from request object
 * @param {Object} req - Express request object
 * @param {string} path - Path to the field (e.g., 'body.email', 'params.id')
 * @returns {*} Field value
 */
const getNestedValue = (req, path) => {
  const parts = path.split('.');
  let current = req;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
};

/**
 * Set nested value in object
 * @param {Object} obj - Object to set value in
 * @param {string} path - Path to the field
 * @param {*} value - Value to set
 */
const setNestedValue = (obj, path, value) => {
  const parts = path.split('.');
  const last = parts.pop();
  let current = obj;

  for (const part of parts) {
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[last] = value;
};

/**
 * Pre-defined validation schemas for common use cases
 */
const validationSchemas = {
  // User registration validation
  userRegistration: {
    'body.email': {
      required: true,
      type: 'email',
      maxLength: 255
    },
    'body.username': {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 30,
      pattern: '^[a-zA-Z0-9_-]+$',
      patternMessage: 'Username can only contain letters, numbers, underscores, and hyphens',
      custom: (value) => {
        const result = validateUsername(value);
        return { isValid: result.isValid, message: result.message };
      }
    },
    'body.password': {
      required: true,
      type: 'string',
      minLength: 8,
      maxLength: 128,
      custom: (value) => {
        const result = validatePassword(value);
        return { isValid: result.isValid, message: result.message };
      }
    }
  },

  // User login validation
  userLogin: {
    'body.email': {
      required: true,
      type: 'email'
    },
    'body.password': {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 128
    }
  },

  // Task completion validation
  taskCompletion: {
    'body.taskName': {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 100,
      custom: (value) => {
        const result = validateTaskName(value);
        return { isValid: result.isValid, message: result.message };
      }
    },
    'body.completedDate': {
      required: false,
      type: 'date',
      custom: (value) => {
        if (!value) return { isValid: true };
        const result = validateDate(value);
        return { isValid: result.isValid, message: result.message };
      }
    },
    'body.notes': {
      required: false,
      type: 'string',
      maxLength: 500,
      sanitize: true
    }
  },

  // History query validation
  historyQuery: {
    'query.limit': {
      required: false,
      type: 'integer',
      min: 1,
      max: 100
    },
    'query.offset': {
      required: false,
      type: 'integer',
      min: 0
    },
    'query.taskName': {
      required: false,
      type: 'string',
      maxLength: 100
    },
    'query.startDate': {
      required: false,
      type: 'date'
    },
    'query.endDate': {
      required: false,
      type: 'date'
    }
  },

  // Account deletion validation
  accountDeletion: {
    'body.email': {
      required: true,
      type: 'email'
    },
    'body.confirmationPhrase': {
      required: true,
      type: 'string',
      custom: (value) => {
        if (value !== 'DELETE MY ACCOUNT') {
          return {
            isValid: false,
            message: 'Confirmation phrase must be exactly "DELETE MY ACCOUNT"',
            code: 'INVALID_CONFIRMATION_PHRASE'
          };
        }
        return { isValid: true };
      }
    }
  }
};

/**
 * Middleware to sanitize all input data
 */
const sanitizeAllInput = (req, res, next) => {
  try {
    // Skip sanitization for simple GET requests to health and documentation endpoints
    if (req.method === 'GET' && (
      req.path === '/api/health' ||
      req.path.endsWith('/health') ||
      req.path.endsWith('/routes')
    )) {
      return next();
    }

    // Sanitize request body (only for requests that have body data)
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      req.body = sanitizeInput(req.body);
    }

    // Sanitize query parameters (only if they exist and have data)
    if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
      req.query = sanitizeInput(req.query);
    }

    // Sanitize URL parameters (only if they exist and have data)
    if (req.params && typeof req.params === 'object' && Object.keys(req.params).length > 0) {
      req.params = sanitizeInput(req.params);
    }

    next();
  } catch (error) {
    // Log the error for debugging
    console.warn('Input sanitization warning:', {
      error: error.message,
      path: req.path,
      method: req.method,
      hasBody: !!req.body,
      hasQuery: !!req.query,
      hasParams: !!req.params,
      stack: error.stack
    });

    // Only fail if there's actually malicious content
    if (error.message.includes('malicious') || error.message.includes('injection')) {
      return res.status(400).json({
        error: 'Input Sanitization Failed',
        code: 'SANITIZATION_ERROR',
        message: 'Failed to sanitize input data',
        timestamp: new Date().toISOString()
      });
    }

    // Otherwise, continue with a warning
    next();
  }
};

/**
 * Middleware to check for malicious content
 */
const checkMaliciousContent = (req, res, next) => {
  const maliciousPatterns = [
    // SQL injection patterns
    /(union.*select|select.*from|insert.*into|update.*set|delete.*from|drop.*table)/i,
    // XSS patterns
    /<script|javascript:|on\w+\s*=|eval\(|expression\(/i,
    // Command injection patterns
    /(\||;|&|`|\$\(|system\(|exec\(|shell_exec\()/i,
    // Path traversal patterns
    /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i
  ];

  const checkObject = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        for (const pattern of maliciousPatterns) {
          if (pattern.test(value)) {
            console.warn(`Malicious content detected at ${currentPath}: ${value}`);
            return true;
          }
        }
      } else if (typeof value === 'object') {
        if (checkObject(value, currentPath)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check all parts of the request
  const hasMaliciousContent =
    checkObject(req.body, 'body') ||
    checkObject(req.query, 'query') ||
    checkObject(req.params, 'params');

  if (hasMaliciousContent) {
    return res.status(400).json({
      error: 'Malicious Content Detected',
      code: 'MALICIOUS_CONTENT',
      message: 'Request contains potentially malicious content and has been blocked',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

module.exports = {
  createValidator,
  validationSchemas,
  sanitizeAllInput,
  checkMaliciousContent,
  applyValidationRules,
  validateType,
  getNestedValue,
  setNestedValue
};