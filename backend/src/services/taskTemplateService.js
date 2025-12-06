/**
 * Task Template Service
 *
 * Provides room-type-aware task description generation for the three-pillars system.
 * Generates task descriptions based on room type, custom name, and pillar type.
 */

class TaskTemplateService {
  constructor() {
    // Room-specific templates for each pillar type
    this.templates = {
      kitchen: {
        glass: "Wipe down all mirrors and glass surfaces in {roomName}",
        surfaces: "Clear and wipe down {roomName} countertops and table",
        floor: "Sweep and mop the {roomName} floor"
      },
      bedroom: {
        glass: "Clean mirrors and windows in {roomName}",
        surfaces: "Clear and dust {roomName} dresser tops and nightstands",
        floor: "Vacuum the {roomName} carpet/floor"
      },
      bathroom: {
        glass: "Clean {roomName} mirror and glass shower door",
        surfaces: "Wipe down {roomName} counters and sink area",
        floor: "Scrub and mop the {roomName} floor"
      },
      living_room: {
        glass: "Clean windows and glass surfaces in {roomName}",
        surfaces: "Dust and wipe {roomName} coffee table and shelves",
        floor: "Vacuum the {roomName} floor"
      },
      office: {
        glass: "Clean windows in {roomName}",
        surfaces: "Organize and wipe down {roomName} desk",
        floor: "Vacuum {roomName} floor"
      },
      dining_room: {
        glass: "Clean windows and glass surfaces in {roomName}",
        surfaces: "Wipe down {roomName} dining table and chairs",
        floor: "Vacuum and mop the {roomName} floor"
      },
      laundry: {
        glass: "Clean windows in {roomName}",
        surfaces: "Wipe down {roomName} counters and folding area",
        floor: "Sweep and mop the {roomName} floor"
      },
      garage: {
        glass: "Clean windows in {roomName}",
        surfaces: "Organize and wipe down {roomName} workbench",
        floor: "Sweep the {roomName} floor"
      }
    };

    // Keystone task templates
    this.keystoneTemplates = {
      master_toilet: "Scrub and disinfect master toilet",
      guest_toilet: "Scrub and disinfect guest/hall toilet",
      kitchen_sink: "Scrub kitchen sink and faucet",
      master_bath_sink: "Clean master bathroom sink",
      guest_bath_sink: "Clean guest bathroom sink",
      stovetop: "Wipe down stovetop and burners",
      shower_tub: "Scrub shower/tub",
      microwave: "Clean microwave interior"
    };
  }

  /**
   * Generate task description for a room-based pillar task
   * @param {string} roomType - Type of room (kitchen, bedroom, etc.)
   * @param {string} roomName - Custom name for the room
   * @param {string} pillarType - Type of pillar (glass, surfaces, floor)
   * @returns {string} Generated task description
   */
  generateTaskDescription(roomType, roomName, pillarType) {
    const template = this.getTemplateForRoom(roomType, pillarType);
    if (!template) {
      throw new Error(`No template found for room type: ${roomType}, pillar: ${pillarType}`);
    }
    return template.replace('{roomName}', roomName);
  }

  /**
   * Get template for a specific room type and pillar
   * @param {string} roomType - Type of room
   * @param {string} pillarType - Type of pillar (glass, surfaces, floor)
   * @returns {string} Template string with {roomName} placeholder
   */
  getTemplateForRoom(roomType, pillarType) {
    const roomTemplates = this.templates[roomType];
    if (!roomTemplates) {
      return null;
    }
    return roomTemplates[pillarType] || null;
  }

  /**
   * Get description for a keystone task
   * @param {string} keystoneType - Type of keystone task
   * @param {string|null} customName - Optional custom name to override default
   * @returns {string} Keystone task description
   */
  getKeystoneDescription(keystoneType, customName = null) {
    // Use custom name if provided, otherwise use default template
    if (customName && customName.trim()) {
      return customName.trim();
    }

    const template = this.keystoneTemplates[keystoneType];
    if (!template) {
      throw new Error(`No template found for keystone type: ${keystoneType}`);
    }
    return template;
  }

  /**
   * Validate that a room type is supported
   * @param {string} roomType - Type of room to validate
   * @returns {boolean} True if room type is valid
   */
  isValidRoomType(roomType) {
    return this.templates.hasOwnProperty(roomType);
  }

  /**
   * Validate that a pillar type is supported
   * @param {string} pillarType - Type of pillar to validate
   * @returns {boolean} True if pillar type is valid
   */
  isValidPillarType(pillarType) {
    return ['glass', 'surfaces', 'floor'].includes(pillarType);
  }

  /**
   * Validate that a keystone type is supported
   * @param {string} keystoneType - Type of keystone to validate
   * @returns {boolean} True if keystone type is valid
   */
  isValidKeystoneType(keystoneType) {
    return this.keystoneTemplates.hasOwnProperty(keystoneType);
  }

  /**
   * Get all supported room types
   * @returns {string[]} Array of supported room types
   */
  getSupportedRoomTypes() {
    return Object.keys(this.templates);
  }

  /**
   * Get all supported keystone types
   * @returns {string[]} Array of supported keystone types
   */
  getSupportedKeystoneTypes() {
    return Object.keys(this.keystoneTemplates);
  }
}

module.exports = TaskTemplateService;
