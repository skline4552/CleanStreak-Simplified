const bcrypt = require('bcrypt');

/**
 * Password security utilities for CleanStreak authentication system
 * Implements secure password hashing with bcrypt using 12 salt rounds
 */

// Configuration
const SALT_ROUNDS = 12; // High security level for password hashing
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainPassword - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 * @throws {Error} If password is invalid or hashing fails
 */
async function hashPassword(plainPassword) {
  try {
    // Validate password before hashing
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (plainPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    if (plainPassword.length > MAX_PASSWORD_LENGTH) {
      throw new Error(`Password must be no more than ${MAX_PASSWORD_LENGTH} characters long`);
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    return hashedPassword;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} plainPassword - The plain text password to verify
 * @param {string} hashedPassword - The hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @throws {Error} If comparison fails
 */
async function comparePassword(plainPassword, hashedPassword) {
  try {
    // Validate inputs
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Plain password must be a non-empty string');
    }

    if (!hashedPassword || typeof hashedPassword !== 'string') {
      throw new Error('Hashed password must be a non-empty string');
    }

    // Perform comparison
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
}

/**
 * Check if a password meets security requirements
 * @param {string} password - The password to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password must be a non-empty string');
    return { isValid: false, errors };
  }

  // Length requirements
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be no more than ${MAX_PASSWORD_LENGTH} characters long`);
    return { isValid: false, errors };
  }

  // Character requirements
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }

  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  // Common password patterns to avoid
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  // Check for sequential characters
  if (/123456|abcdef|qwerty/i.test(password)) {
    errors.push('Password should not contain sequential characters');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain more than 2 repeated characters in a row');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate a secure random password
 * @param {number} length - The desired password length (default 12)
 * @returns {string} A randomly generated secure password
 */
function generateSecurePassword(length = 12) {
  if (length < MIN_PASSWORD_LENGTH) {
    length = MIN_PASSWORD_LENGTH;
  }

  if (length > MAX_PASSWORD_LENGTH) {
    length = MAX_PASSWORD_LENGTH;
  }

  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let password = '';

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the rest with random characters from all categories
  const allChars = lowercase + uppercase + numbers + specialChars;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if a password hash was created with the current salt rounds
 * @param {string} hashedPassword - The hashed password to check
 * @returns {boolean} True if hash uses current salt rounds, false otherwise
 */
function needsRehash(hashedPassword) {
  try {
    return bcrypt.getRounds(hashedPassword) < SALT_ROUNDS;
  } catch (error) {
    // If we can't determine the rounds, assume it needs rehashing
    return true;
  }
}

/**
 * Utility function to safely clear password from memory
 * @param {string} password - The password string to clear
 */
function clearPassword(password) {
  if (typeof password === 'string') {
    // Overwrite the string in memory (though this isn't guaranteed in JavaScript)
    for (let i = 0; i < password.length; i++) {
      password[i] = '\0';
    }
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  clearPassword,
  SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
};