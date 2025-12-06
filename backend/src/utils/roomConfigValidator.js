/**
 * Room Configuration Validator
 *
 * Validates room configuration data for pending_room_configs table.
 * Ensures data integrity before storing in JSON format.
 */

/**
 * Validate room configuration data structure
 * @param {Object} configData - Configuration data to validate
 * @returns {Object} Validation result with { valid: boolean, errors: string[] }
 */
function validateRoomConfigData(configData) {
  const errors = [];

  // Check if configData is an object
  if (!configData || typeof configData !== 'object') {
    errors.push('Config data must be an object');
    return { valid: false, errors };
  }

  // Validate rooms array if present
  if (configData.hasOwnProperty('rooms')) {
    if (!Array.isArray(configData.rooms)) {
      errors.push('rooms must be an array');
    } else {
      configData.rooms.forEach((room, index) => {
        // Validate room structure
        if (typeof room !== 'object' || room === null) {
          errors.push(`rooms[${index}] must be an object`);
          return;
        }

        // Check required fields
        if (!room.hasOwnProperty('id') || typeof room.id !== 'string') {
          errors.push(`rooms[${index}].id must be a string`);
        }

        if (!room.hasOwnProperty('roomType') || typeof room.roomType !== 'string') {
          errors.push(`rooms[${index}].roomType must be a string`);
        }

        if (!room.hasOwnProperty('customName') || typeof room.customName !== 'string') {
          errors.push(`rooms[${index}].customName must be a string`);
        } else if (room.customName.trim().length < 1 || room.customName.trim().length > 50) {
          errors.push(`rooms[${index}].customName must be between 1 and 50 characters`);
        }

        if (!room.hasOwnProperty('hasGlass') || typeof room.hasGlass !== 'boolean') {
          errors.push(`rooms[${index}].hasGlass must be a boolean`);
        }

        if (!room.hasOwnProperty('sortOrder') || typeof room.sortOrder !== 'number') {
          errors.push(`rooms[${index}].sortOrder must be a number`);
        } else if (!Number.isInteger(room.sortOrder) || room.sortOrder < 1) {
          errors.push(`rooms[${index}].sortOrder must be a positive integer`);
        }

        if (!room.hasOwnProperty('isActive') || typeof room.isActive !== 'boolean') {
          errors.push(`rooms[${index}].isActive must be a boolean`);
        }
      });
    }
  }

  // Validate keystones array if present
  if (configData.hasOwnProperty('keystones')) {
    if (!Array.isArray(configData.keystones)) {
      errors.push('keystones must be an array');
    } else {
      configData.keystones.forEach((keystone, index) => {
        // Validate keystone structure
        if (typeof keystone !== 'object' || keystone === null) {
          errors.push(`keystones[${index}] must be an object`);
          return;
        }

        // Check required fields
        if (!keystone.hasOwnProperty('id') || typeof keystone.id !== 'string') {
          errors.push(`keystones[${index}].id must be a string`);
        }

        if (!keystone.hasOwnProperty('taskType') || typeof keystone.taskType !== 'string') {
          errors.push(`keystones[${index}].taskType must be a string`);
        }

        if (keystone.hasOwnProperty('customName') && keystone.customName !== null) {
          if (typeof keystone.customName !== 'string') {
            errors.push(`keystones[${index}].customName must be a string or null`);
          } else if (keystone.customName.trim().length > 100) {
            errors.push(`keystones[${index}].customName must be 100 characters or less`);
          }
        }

        if (!keystone.hasOwnProperty('isActive') || typeof keystone.isActive !== 'boolean') {
          errors.push(`keystones[${index}].isActive must be a boolean`);
        }

        if (!keystone.hasOwnProperty('sortOrder') || typeof keystone.sortOrder !== 'number') {
          errors.push(`keystones[${index}].sortOrder must be a number`);
        } else if (!Number.isInteger(keystone.sortOrder) || keystone.sortOrder < 1) {
          errors.push(`keystones[${index}].sortOrder must be a positive integer`);
        }
      });
    }
  }

  // Check that at least one of rooms or keystones is present
  if (!configData.hasOwnProperty('rooms') && !configData.hasOwnProperty('keystones')) {
    errors.push('Config data must contain at least one of: rooms, keystones');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize configuration data for safe storage
 * @param {Object} configData - Configuration data to sanitize
 * @returns {Object} Sanitized configuration data
 */
function sanitizeRoomConfigData(configData) {
  const sanitized = {};

  if (configData.rooms && Array.isArray(configData.rooms)) {
    sanitized.rooms = configData.rooms.map(room => ({
      id: String(room.id),
      roomType: String(room.roomType),
      customName: String(room.customName).trim(),
      hasGlass: Boolean(room.hasGlass),
      sortOrder: Number(room.sortOrder),
      isActive: Boolean(room.isActive)
    }));
  }

  if (configData.keystones && Array.isArray(configData.keystones)) {
    sanitized.keystones = configData.keystones.map(keystone => ({
      id: String(keystone.id),
      taskType: String(keystone.taskType),
      customName: keystone.customName ? String(keystone.customName).trim() : null,
      isActive: Boolean(keystone.isActive),
      sortOrder: Number(keystone.sortOrder)
    }));
  }

  return sanitized;
}

module.exports = {
  validateRoomConfigData,
  sanitizeRoomConfigData
};
