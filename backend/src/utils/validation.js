/**
 * Input validation utilities for CleanStreak authentication system
 * Provides comprehensive validation for user inputs, authentication data, and API requests
 */

/**
 * Email validation using RFC 5322 compliant regex
 * Requires at least one dot in domain (TLD requirement)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Username validation: alphanumeric, underscores, hyphens, 3-30 characters
 */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Task name validation: alphanumeric, spaces, common punctuation, 1-100 characters
 */
const TASK_NAME_REGEX = /^[a-zA-Z0-9\s\-_.,!?()]{1,100}$/;

/**
 * Validate email address
 * @param {string} email - The email address to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email must be a non-empty string'
    };
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail.length === 0) {
    return {
      isValid: false,
      error: 'Email cannot be empty'
    };
  }

  if (trimmedEmail.length > 254) {
    return {
      isValid: false,
      error: 'Email is too long (maximum 254 characters)'
    };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Invalid email format'
    };
  }

  // Additional validation for consecutive dots (not allowed in email addresses)
  if (trimmedEmail.includes('..')) {
    return {
      isValid: false,
      error: 'Invalid email format'
    };
  }

  // Check for common disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'throwaway.email'
  ];

  const domain = trimmedEmail.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return {
      isValid: false,
      error: 'Disposable email addresses are not allowed'
    };
  }

  return {
    isValid: true,
    normalizedEmail: trimmedEmail
  };
}

/**
 * Validate username
 * @param {string} username - The username to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return {
      isValid: false,
      error: 'Username must be a non-empty string'
    };
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length === 0) {
    return {
      isValid: false,
      error: 'Username cannot be empty'
    };
  }

  if (!USERNAME_REGEX.test(trimmedUsername)) {
    return {
      isValid: false,
      error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens'
    };
  }

  // Check for reserved usernames
  const reservedUsernames = [
    'admin', 'administrator', 'root', 'system', 'api', 'www',
    'mail', 'email', 'support', 'help', 'info', 'contact',
    'user', 'guest', 'anonymous', 'null', 'undefined',
    'cleanstreak', 'streak', 'habit', 'task'
  ];

  if (reservedUsernames.includes(trimmedUsername.toLowerCase())) {
    return {
      isValid: false,
      error: 'This username is reserved and cannot be used'
    };
  }

  return {
    isValid: true,
    normalizedUsername: trimmedUsername
  };
}

/**
 * Validate task name
 * @param {string} taskName - The task name to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateTaskName(taskName) {
  if (!taskName || typeof taskName !== 'string') {
    return {
      isValid: false,
      error: 'Task name must be a non-empty string'
    };
  }

  const trimmedTaskName = taskName.trim();

  if (trimmedTaskName.length === 0) {
    return {
      isValid: false,
      error: 'Task name cannot be empty'
    };
  }

  if (trimmedTaskName.length > 100) {
    return {
      isValid: false,
      error: 'Task name is too long (maximum 100 characters)'
    };
  }

  if (!TASK_NAME_REGEX.test(trimmedTaskName)) {
    return {
      isValid: false,
      error: 'Task name contains invalid characters'
    };
  }

  // Check for profanity or inappropriate content
  const inappropriateWords = [
    'spam', 'test123', 'placeholder', 'example', 'dummy'
  ];

  const lowerTaskName = trimmedTaskName.toLowerCase();
  for (const word of inappropriateWords) {
    if (lowerTaskName.includes(word)) {
      return {
        isValid: false,
        error: 'Task name contains inappropriate content'
      };
    }
  }

  return {
    isValid: true,
    normalizedTaskName: trimmedTaskName
  };
}

/**
 * Validate date string (ISO format)
 * @param {string} dateString - The date string to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return {
      isValid: false,
      error: 'Date must be a non-empty string'
    };
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: 'Invalid date format'
    };
  }

  // Check if date is not too far in the future (1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    return {
      isValid: false,
      error: 'Date cannot be more than one year in the future'
    };
  }

  // Check if date is not too far in the past (10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  if (date < tenYearsAgo) {
    return {
      isValid: false,
      error: 'Date cannot be more than ten years in the past'
    };
  }

  return {
    isValid: true,
    normalizedDate: date.toISOString()
  };
}

/**
 * Validate streak count
 * @param {number} count - The streak count to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateStreakCount(count) {
  if (typeof count !== 'number') {
    // Try to parse as number
    const parsedCount = parseInt(count, 10);
    if (isNaN(parsedCount)) {
      return {
        isValid: false,
        error: 'Streak count must be a number'
      };
    }
    count = parsedCount;
  }

  if (!Number.isInteger(count)) {
    return {
      isValid: false,
      error: 'Streak count must be an integer'
    };
  }

  if (count < 0) {
    return {
      isValid: false,
      error: 'Streak count cannot be negative'
    };
  }

  if (count > 10000) {
    return {
      isValid: false,
      error: 'Streak count cannot exceed 10,000 days'
    };
  }

  return {
    isValid: true,
    normalizedCount: count
  };
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 * @param {string} input - The string to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    // Remove dangerous protocols and functions
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/data:application\/x-javascript/gi, '')
    .replace(/eval\s*\(/gi, 'eval_blocked(')
    .replace(/function\s*\(/gi, 'function_blocked(')
    .replace(/on\w+\s*=/gi, 'on_event_blocked=')
    // Sanitize HTML entities
    .replace(/[<>'"&]/g, (match) => {
      const htmlEntities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return htmlEntities[match];
    })
    .substring(0, 1000); // Limit length to prevent memory issues
}

/**
 * Validate request body structure for registration
 * @param {Object} body - The request body to validate
 * @returns {Object} Validation result with isValid boolean and error messages
 */
function validateRegistrationData(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid object']
    };
  }

  // Validate email
  const emailValidation = validateEmail(body.email);
  if (!emailValidation.isValid) {
    errors.push(`Email: ${emailValidation.error}`);
  }

  // Validate username (optional)
  if (body.username) {
    const usernameValidation = validateUsername(body.username);
    if (!usernameValidation.isValid) {
      errors.push(`Username: ${usernameValidation.error}`);
    }
  }

  // Validate password (basic validation - detailed validation in password.js)
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password: Password is required');
  } else if (body.password.length < 8) {
    errors.push('Password: Password must be at least 8 characters long');
  }

  // Validate password confirmation
  if (body.password !== body.confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      email: emailValidation.isValid ? emailValidation.normalizedEmail : body.email,
      username: body.username ? sanitizeString(body.username) : null,
      password: body.password // Will be hashed separately
    }
  };
}

/**
 * Validate request body structure for login
 * @param {Object} body - The request body to validate
 * @returns {Object} Validation result with isValid boolean and error messages
 */
function validateLoginData(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid object']
    };
  }

  // Validate email or username
  if (!body.email && !body.username) {
    errors.push('Either email or username is required');
  }

  if (body.email) {
    const emailValidation = validateEmail(body.email);
    if (!emailValidation.isValid) {
      errors.push(`Email: ${emailValidation.error}`);
    }
  }

  if (body.username) {
    const usernameValidation = validateUsername(body.username);
    if (!usernameValidation.isValid) {
      errors.push(`Username: ${usernameValidation.error}`);
    }
  }

  // Validate password
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      email: body.email ? sanitizeString(body.email).toLowerCase() : null,
      username: body.username ? sanitizeString(body.username) : null,
      password: body.password
    }
  };
}

/**
 * Validate streak completion data
 * @param {Object} body - The request body to validate
 * @returns {Object} Validation result with isValid boolean and error messages
 */
function validateCompletionData(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid object']
    };
  }

  // Validate task name
  const taskValidation = validateTaskName(body.taskName);
  if (!taskValidation.isValid) {
    errors.push(`Task name: ${taskValidation.error}`);
  }

  // Validate completion date (optional, defaults to now)
  if (body.completedDate) {
    const dateValidation = validateDate(body.completedDate);
    if (!dateValidation.isValid) {
      errors.push(`Completion date: ${dateValidation.error}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      taskName: taskValidation.isValid ? taskValidation.normalizedTaskName : body.taskName,
      completedDate: body.completedDate ? new Date(body.completedDate).toISOString() : new Date().toISOString()
    }
  };
}

/**
 * Validate pagination parameters
 * @param {Object} query - The query parameters to validate
 * @returns {Object} Validation result with normalized pagination data
 */
function validatePaginationParams(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;

  // Ensure reasonable limits
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(Math.max(1, limit), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: (normalizedPage - 1) * normalizedLimit
  };
}

/**
 * Check if string contains only safe characters (prevent injection)
 * @param {string} input - The string to check
 * @returns {boolean} True if string is safe, false otherwise
 */
function isSafeString(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check for common injection patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:text\/html/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize object input recursively
 * @param {*} input - The input to sanitize
 * @returns {*} Sanitized input
 */
function sanitizeInput(input) {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeInput(value);
    }
    return sanitized;
  }

  // For any other type, convert to string and sanitize
  return sanitizeString(String(input));
}

module.exports = {
  validateEmail,
  validateUsername,
  validateTaskName,
  validateDate,
  validateStreakCount,
  sanitizeString,
  sanitizeInput,
  validateRegistrationData,
  validateLoginData,
  validateCompletionData,
  validatePaginationParams,
  isSafeString,
  EMAIL_REGEX,
  USERNAME_REGEX,
  TASK_NAME_REGEX
};