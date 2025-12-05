# Room Customization & Three-Pillars Task Generation System

**Project Start Date:** 2025-11-10
**Branch:** feature/room-customization
**Status:** Planning Complete - Ready for Implementation

---

## Project Overview

Transform the CleanStreak app from a hardcoded 50-task rotation system to a personalized, room-based task generation system using the "three pillars" cleaning methodology: Glass → Surfaces → Floor, with keystone tasks interspersed for high-frequency hygiene points.

---

## Core Requirements

### Three-Pillars Methodology

Every room cleaned using three pillars (top-to-bottom):
1. **Glass clear** - Windows, mirrors, glass surfaces
2. **Surfaces clear and wiped** - Declutter and wipe countertops, tables, shelves
3. **Floor vacuumed** - Vacuum or sweep

### User Configuration

1. **Room Inventory:**
   - Room type (Living Room, Kitchen, Bedroom, Bathroom, Office, etc.)
   - Custom naming (e.g., "Master Bedroom", "Guest Bathroom")
   - Glass presence flag (has mirrors/windows?)
   - Sort order for rotation sequence

2. **Keystone Tasks:**
   - High-frequency hygiene points (toilets, sinks, stovetop, etc.)
   - Enable/disable per keystone
   - Optional custom naming
   - Inserted every 3-5 tasks in rotation

3. **Configuration Access:**
   - Initial setup during onboarding (post-registration)
   - Editable anytime via settings page

---

## Key Design Decisions

Based on stakeholder feedback:

1. **Rotation End Behavior:** Regenerate with shuffled keystones
   - When user completes all tasks, create new rotation
   - Same room order, but randomized keystone insertion positions
   - Provides variety without disrupting room sequence

2. **Task Descriptions:** Smart templates with room-type awareness
   - Different templates for different room types
   - Kitchen: "countertops", Bedroom: "dresser tops"
   - Templates stored in TaskTemplateService
   - More sophisticated than hardcoding, simpler than user-editable

3. **Streak Tracking:** Overall app streak only
   - Keep simple - one daily streak for completing the task
   - Maintains current UX and doesn't complicate UI
   - Preserves existing StreakService functionality

4. **Mid-Cycle Configuration Changes:** Complete current cycle first
   - If user edits rooms, changes are "staged"
   - Applied when current rotation cycle completes
   - More predictable UX, less jarring than immediate regeneration

---

## Current System Analysis

### Database Schema (SQLite + Prisma)

**Location:** `backend/prisma/schema.prisma`

**Existing Models:**
- `users` - User accounts
- `user_streaks` - Streak tracking per task
- `completion_history` - Historical completions
- `user_sessions` - JWT refresh tokens
- `analytics` - Metrics tracking

**Key Observations:**
- Task tracking based on free-form `task_name` strings
- No room or task type categorization exists
- No concept of task rotation or sequencing
- Streaks tracked per unique task_name

### Backend Architecture

**Tech Stack:** Node.js + Express + Prisma

**Existing Services:**
- `StreakService` - Task completion, streak calculation, stats
- `AccountService` - Account management, summary aggregation

**Key API Endpoints:**
- `POST /api/user/complete` - Complete task (rate limited: 30/15min)
- `POST /api/user/bulk-complete` - Batch completions (5/15min)
- `GET /api/user/streaks` - Get all streaks
- `GET /api/user/history` - Completion history with pagination
- `GET /api/user/stats` - Streak statistics

### Frontend Architecture

**Location:** `index.html` (single-page application)

**Current Task System:**
- Hardcoded array of 50 cleaning tasks (lines 736-787)
- Task selection: `cleaningTasks[(dayOfMonth - 1) % cleaningTasks.length]`
- No personalization or room configuration
- Offline-first with localStorage caching

**State Management:**
```javascript
AppState = {
    user: { isAuthenticated, profile },
    streak: { current, bestStreak, lastCompletedDate },
    engagement: { totalCompletions, consecutiveDays },
    sync: { lastSync, offlineQueue, isSyncing },
    network: { isOnline, lastOnline }
}
```

---

## Technical Implementation Plan

### Phase 1: Database Schema & Migration

#### New Tables

**1. user_rooms**
```prisma
model user_rooms {
  id           String   @id @default(uuid())
  user_id      String
  room_type    String   // "living_room", "bedroom", "kitchen", "bathroom", "office"
  custom_name  String   // User's custom name, e.g., "Master Bedroom"
  has_glass    Boolean  @default(true)
  sort_order   Int      // Determines rotation sequence
  is_active    Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  users        users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([user_id, sort_order])
}
```

**2. user_keystone_tasks**
```prisma
model user_keystone_tasks {
  id           String   @id @default(uuid())
  user_id      String
  task_type    String   // "master_toilet", "kitchen_sink", "stovetop", etc.
  custom_name  String?  // Optional custom name override
  is_active    Boolean  @default(true)
  sort_order   Int      // Rotation sequence within keystones
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  users        users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, task_type])
  @@index([user_id])
}
```

**3. task_rotation**
```prisma
model task_rotation {
  id                String    @id @default(uuid())
  user_id           String
  task_type         String    // "pillar" or "keystone"
  task_description  String    // Generated task text
  room_id           String?   // Null for keystone tasks
  pillar_type       String?   // "glass", "surfaces", "floor" (null for keystones)
  keystone_type     String?   // Type if keystone task
  sequence_position Int       // Position in rotation (1, 2, 3...)
  rotation_version  Int       // Increment on regeneration
  created_at        DateTime  @default(now())

  users             users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, rotation_version, sequence_position])
  @@index([user_id, rotation_version, sequence_position])
}
```

**4. user_task_progress**
```prisma
model user_task_progress {
  id                         String    @id @default(uuid())
  user_id                    String    @unique
  current_task_index         Int       @default(1)
  current_rotation_version   Int       @default(1)
  last_completed_task_id     String?
  rotation_generated_at      DateTime  @default(now())
  has_pending_config_changes Boolean   @default(false)  // Staged changes flag
  updated_at                 DateTime  @updatedAt

  users                      users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
}
```

**5. pending_room_configs** (for staged changes)
```prisma
model pending_room_configs {
  id           String   @id @default(uuid())
  user_id      String
  config_data  String   // JSON: rooms array, keystone settings
  created_at   DateTime @default(now())

  users        users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id])
}
```

#### Enhanced Existing Table

**completion_history** - Add optional metadata fields:
```prisma
// Add to existing completion_history model:
room_id       String?   // Link to room if from rotation
pillar_type   String?   // "glass", "surfaces", "floor", or null
task_type     String?   // "pillar" or "keystone"
rotation_id   String?   // Link to task_rotation entry
```

#### Migration Strategy

1. Create migration script for new tables
2. Add optional fields to completion_history (non-breaking)
3. Seed default keystone task types
4. No changes to existing data (backward compatible)

---

### Phase 2: Backend Services

#### 1. TaskTemplateService

**File:** `backend/src/services/taskTemplateService.js`

**Purpose:** Room-type-aware task description generation

**Methods:**
- `generateTaskDescription(roomType, roomName, pillarType)` → String
- `getTemplateForRoom(roomType, pillarType)` → String template
- `getKeystoneDescription(keystoneType, customName?)` → String

**Template Structure:**
```javascript
const templates = {
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
  }
};

const keystoneTemplates = {
  master_toilet: "Scrub and disinfect master toilet",
  guest_toilet: "Scrub and disinfect guest/hall toilet",
  kitchen_sink: "Scrub kitchen sink and faucet",
  master_bath_sink: "Clean master bathroom sink",
  guest_bath_sink: "Clean guest bathroom sink",
  stovetop: "Wipe down stovetop and burners",
  shower_tub: "Scrub shower/tub",
  microwave: "Clean microwave interior"
};
```

#### 2. RoomService

**File:** `backend/src/services/roomService.js`

**Purpose:** CRUD operations for user room configurations

**Methods:**
- `createRoom(userId, { roomType, customName, hasGlass })` → Room object
- `getUserRooms(userId, includeInactive?)` → Array of rooms (sorted by sort_order)
- `getRoomById(roomId, userId)` → Room object
- `updateRoom(roomId, userId, updates)` → Updated room object
- `deleteRoom(roomId, userId)` → Success boolean
- `reorderRooms(userId, roomIdArray)` → Success boolean
- `validateRoomType(roomType)` → Boolean
- `hasConfiguredRooms(userId)` → Boolean

**Validation:**
- Room types: living_room, bedroom, kitchen, bathroom, office, dining_room, laundry, garage
- Custom name: 1-50 characters
- Sort order: Auto-assigned, adjustable via reorder

**Side Effects:**
- Create/update/delete marks user as having pending config changes
- Triggers staging for regeneration after cycle completes

#### 3. KeystoneService

**File:** `backend/src/services/keystoneService.js`

**Purpose:** Manage keystone task configurations

**Methods:**
- `initializeDefaultKeystones(userId)` → Array of keystone objects
- `getUserKeystones(userId, activeOnly?)` → Array of keystones
- `updateKeystone(keystoneId, userId, { customName?, isActive?, sortOrder? })` → Updated keystone
- `getActiveKeystonesForRotation(userId)` → Sorted array of active keystones

**Default Keystones:**
- master_toilet, guest_toilet, kitchen_sink, master_bath_sink, guest_bath_sink
- stovetop, shower_tub, microwave

**Behavior:**
- Created automatically when user configures first room
- isActive toggles whether keystone appears in rotation
- customName overrides default description

#### 4. TaskGenerationService

**File:** `backend/src/services/taskGenerationService.js`

**Purpose:** Generate task rotation using three-pillars methodology

**Methods:**
- `generateRotation(userId, shouldShuffleKeystones = false)` → Rotation object
- `buildRotationSequence(rooms, keystones)` → Array of task objects
- `insertKeystonesRandomly(pillarTasks, keystones)` → Combined array
- `saveRotation(userId, taskArray, version)` → Success boolean
- `clearRotation(userId, version)` → Success boolean

**Algorithm:**
```javascript
async function generateRotation(userId, shouldShuffleKeystones = false) {
  // 1. Fetch user's rooms (sorted by sort_order)
  const rooms = await RoomService.getUserRooms(userId);

  // 2. Fetch active keystones
  let keystones = await KeystoneService.getActiveKeystonesForRotation(userId);

  // 3. Shuffle keystones if regenerating (for variety)
  if (shouldShuffleKeystones) {
    keystones = shuffleArray(keystones);  // Fisher-Yates shuffle
  }

  // 4. Build pillar tasks for all rooms
  const pillarTasks = [];
  for (const room of rooms) {
    // Glass pillar (conditional)
    if (room.has_glass) {
      pillarTasks.push({
        type: 'pillar',
        roomId: room.id,
        pillarType: 'glass',
        description: TaskTemplateService.generateTaskDescription(
          room.room_type, room.custom_name, 'glass'
        )
      });
    }

    // Surfaces pillar (always)
    pillarTasks.push({
      type: 'pillar',
      roomId: room.id,
      pillarType: 'surfaces',
      description: TaskTemplateService.generateTaskDescription(
        room.room_type, room.custom_name, 'surfaces'
      )
    });

    // Floor pillar (always)
    pillarTasks.push({
      type: 'pillar',
      roomId: room.id,
      pillarType: 'floor',
      description: TaskTemplateService.generateTaskDescription(
        room.room_type, room.custom_name, 'floor'
      )
    });
  }

  // 5. Insert keystones every 3-5 tasks
  const rotation = insertKeystonesRandomly(pillarTasks, keystones);

  // 6. Assign sequence positions
  rotation.forEach((task, index) => {
    task.sequence_position = index + 1;
  });

  // 7. Increment rotation version
  const currentProgress = await TaskProgressService.getProgress(userId);
  const newVersion = (currentProgress?.current_rotation_version || 0) + 1;

  // 8. Clear old rotation and save new
  await clearRotation(userId, newVersion - 1);
  await saveRotation(userId, rotation, newVersion);

  return {
    version: newVersion,
    total_tasks: rotation.length,
    generated_at: new Date()
  };
}

function insertKeystonesRandomly(pillarTasks, keystones) {
  const result = [];
  const keystoneInterval = { min: 3, max: 5 };
  let tasksSinceLastKeystone = 0;
  let keystoneIndex = 0;

  for (const task of pillarTasks) {
    result.push(task);
    tasksSinceLastKeystone++;

    // Insert keystone at random interval (3-5 tasks)
    const shouldInsert = tasksSinceLastKeystone >= getRandomInt(
      keystoneInterval.min,
      keystoneInterval.max
    );

    if (shouldInsert && keystoneIndex < keystones.length) {
      result.push({
        type: 'keystone',
        keystoneType: keystones[keystoneIndex].task_type,
        description: TaskTemplateService.getKeystoneDescription(
          keystones[keystoneIndex].task_type,
          keystones[keystoneIndex].custom_name
        )
      });
      keystoneIndex++;
      tasksSinceLastKeystone = 0;
    }
  }

  // Insert remaining keystones at end
  while (keystoneIndex < keystones.length) {
    result.push({
      type: 'keystone',
      keystoneType: keystones[keystoneIndex].task_type,
      description: TaskTemplateService.getKeystoneDescription(
        keystones[keystoneIndex].task_type,
        keystones[keystoneIndex].custom_name
      )
    });
    keystoneIndex++;
  }

  return result;
}
```

#### 5. TaskProgressService

**File:** `backend/src/services/taskProgressService.js`

**Purpose:** Track user's current position in rotation

**Methods:**
- `getProgress(userId)` → Progress object
- `getCurrentTask(userId)` → Task object from rotation
- `advanceToNextTask(userId)` → Next task object
- `detectCycleCompletion(userId)` → Boolean
- `handleCycleCompletion(userId)` → New rotation object
- `applyPendingConfigChanges(userId)` → Success boolean
- `stagePendingChanges(userId, configData)` → Success boolean

**Behavior:**
```javascript
async function advanceToNextTask(userId) {
  const progress = await getProgress(userId);
  const currentVersion = progress.current_rotation_version;

  // Get total tasks in current rotation
  const totalTasks = await prisma.task_rotation.count({
    where: { user_id: userId, rotation_version: currentVersion }
  });

  // Increment index
  const nextIndex = progress.current_task_index + 1;

  // Check for cycle completion
  if (nextIndex > totalTasks) {
    // Cycle complete - trigger regeneration
    return handleCycleCompletion(userId);
  }

  // Update progress
  await prisma.user_task_progress.update({
    where: { user_id: userId },
    data: { current_task_index: nextIndex }
  });

  return getCurrentTask(userId);
}

async function handleCycleCompletion(userId) {
  // 1. Check for pending config changes
  const hasPending = await prisma.user_task_progress.findUnique({
    where: { user_id: userId },
    select: { has_pending_config_changes: true }
  });

  if (hasPending?.has_pending_config_changes) {
    // Apply staged changes
    await applyPendingConfigChanges(userId);
  }

  // 2. Regenerate rotation with shuffled keystones
  const newRotation = await TaskGenerationService.generateRotation(
    userId,
    true  // shouldShuffleKeystones = true
  );

  // 3. Reset progress to task 1 of new rotation
  await prisma.user_task_progress.update({
    where: { user_id: userId },
    data: {
      current_task_index: 1,
      current_rotation_version: newRotation.version,
      has_pending_config_changes: false,
      rotation_generated_at: newRotation.generated_at
    }
  });

  return getCurrentTask(userId);
}

async function applyPendingConfigChanges(userId) {
  // Retrieve staged changes from pending_room_configs
  const pending = await prisma.pending_room_configs.findUnique({
    where: { user_id: userId }
  });

  if (!pending) return false;

  const configData = JSON.parse(pending.config_data);

  // Apply room updates
  // (Implementation: delete removed rooms, update existing, create new)
  // Apply keystone updates

  // Clear pending config
  await prisma.pending_room_configs.delete({
    where: { user_id: userId }
  });

  return true;
}
```

---

### Phase 3: Backend API Endpoints

#### Room Management Routes

**File:** `backend/src/routes/rooms.js`

```javascript
const express = require('express');
const router = express.Router();
const RoomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticate);

// CRUD operations
router.post('/', rateLimiter.roomConfig, RoomController.createRoom);
router.get('/', RoomController.getUserRooms);
router.get('/:id', RoomController.getRoomById);
router.put('/:id', rateLimiter.roomConfig, RoomController.updateRoom);
router.delete('/:id', rateLimiter.roomConfig, RoomController.deleteRoom);

// Bulk reorder
router.put('/reorder', rateLimiter.roomConfig, RoomController.reorderRooms);

module.exports = router;
```

**Rate Limits:**
- Room config operations: 20 requests / 15 minutes

#### Keystone Management Routes

**File:** `backend/src/routes/keystones.js`

```javascript
const express = require('express');
const router = express.Router();
const KeystoneController = require('../controllers/keystoneController');
const { authenticate } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

router.get('/', KeystoneController.getUserKeystones);
router.put('/:id', rateLimiter.roomConfig, KeystoneController.updateKeystone);

module.exports = router;
```

#### Task Rotation Routes

**File:** `backend/src/routes/tasks.js`

```javascript
const express = require('express');
const router = express.Router();
const TaskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

// Get current task
router.get('/current', TaskController.getCurrentTask);

// Preview upcoming tasks
router.get('/preview', TaskController.previewTasks);

// Force regeneration (admin/debug)
router.post('/regenerate', rateLimiter.roomConfig, TaskController.regenerateRotation);

module.exports = router;
```

#### Modified User Routes

**File:** `backend/src/routes/user.js` (existing file)

**Changes to completeTask endpoint:**
```javascript
// POST /api/user/complete
router.post('/complete', rateLimiter.taskCompletion, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskName, completionDate, notes, task_rotation_id } = req.body;

    // Complete task via StreakService (unchanged)
    const streak = await StreakService.completeTask(
      userId,
      taskName,
      completionDate,
      notes
    );

    // If from rotation, advance progress
    let nextTask = null;
    if (task_rotation_id) {
      nextTask = await TaskProgressService.advanceToNextTask(userId);
    }

    res.status(201).json({
      success: true,
      streak,
      next_task: nextTask  // New field
    });
  } catch (error) {
    // Error handling...
  }
});
```

#### Controllers

**1. RoomController** (`backend/src/controllers/roomController.js`)
- createRoom, getUserRooms, getRoomById, updateRoom, deleteRoom, reorderRooms

**2. KeystoneController** (`backend/src/controllers/keystoneController.js`)
- getUserKeystones, updateKeystone

**3. TaskController** (`backend/src/controllers/taskController.js`)
- getCurrentTask, previewTasks, regenerateRotation

---

### Phase 4: Frontend Onboarding Flow

#### UI Components (in `index.html`)

**1. Onboarding Wizard Modal**

**Trigger:** After successful registration (in registration success handler)

**HTML Structure:**
```html
<!-- Add after existing modals -->
<div id="onboardingModal" class="modal" style="display: none;">
  <div class="modal-content large">
    <h2>Welcome! Let's Set Up Your Home</h2>
    <p>Configure your rooms to get personalized cleaning tasks.</p>

    <div id="roomConfigSection">
      <!-- Room list display -->
      <div id="configuredRoomsList">
        <h3>Your Rooms</h3>
        <div id="roomsContainer">
          <!-- Dynamic room cards will be inserted here -->
        </div>
      </div>

      <!-- Add room form -->
      <div id="addRoomForm">
        <h3>Add a Room</h3>
        <form id="roomForm">
          <div class="form-group">
            <label>Room Type</label>
            <select id="roomType" required>
              <option value="">Select room type...</option>
              <option value="living_room">Living Room</option>
              <option value="bedroom">Bedroom</option>
              <option value="kitchen">Kitchen</option>
              <option value="bathroom">Bathroom</option>
              <option value="office">Office</option>
              <option value="dining_room">Dining Room</option>
              <option value="laundry">Laundry Room</option>
              <option value="garage">Garage</option>
            </select>
          </div>

          <div class="form-group">
            <label>Custom Name</label>
            <input type="text" id="customRoomName"
                   placeholder="e.g., Master Bedroom"
                   maxlength="50" required>
          </div>

          <div class="form-group checkbox">
            <label>
              <input type="checkbox" id="hasGlass" checked>
              This room has mirrors or windows
            </label>
          </div>

          <button type="submit" class="btn-primary">Add Room</button>
        </form>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="modal-actions">
      <button id="finishOnboarding" class="btn-primary large"
              disabled>Generate My Tasks</button>
      <button id="skipOnboarding" class="btn-secondary">Skip for Now</button>
    </div>
  </div>
</div>
```

**2. Room Card Component**

```html
<div class="room-card" data-room-id="{roomId}">
  <div class="room-header">
    <span class="room-icon">{roomTypeIcon}</span>
    <span class="room-name">{customName}</span>
    <span class="room-type-badge">{roomType}</span>
  </div>
  <div class="room-details">
    <span class="glass-indicator">{hasGlass ? '🪟 Has glass' : 'No glass'}</span>
  </div>
  <div class="room-actions">
    <button class="edit-room-btn" data-room-id="{roomId}">Edit</button>
    <button class="delete-room-btn" data-room-id="{roomId}">Delete</button>
  </div>
</div>
```

**3. JavaScript Logic**

```javascript
// Onboarding state
const OnboardingState = {
  rooms: [],
  isConfiguring: false
};

// Show onboarding modal after registration
function showOnboardingModal() {
  const modal = document.getElementById('onboardingModal');
  modal.style.display = 'block';

  // Load any existing rooms (in case user partially configured)
  loadUserRooms();
}

// Room form submission
document.getElementById('roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const roomData = {
    roomType: document.getElementById('roomType').value,
    customName: document.getElementById('customRoomName').value,
    hasGlass: document.getElementById('hasGlass').checked
  };

  try {
    const response = await RoomAPI.createRoom(roomData);

    if (response.success) {
      // Add to UI
      addRoomCard(response.room);
      OnboardingState.rooms.push(response.room);

      // Enable finish button
      document.getElementById('finishOnboarding').disabled = false;

      // Reset form
      e.target.reset();

      showMessage('Room added successfully!', 'success');
    }
  } catch (error) {
    showMessage('Failed to add room. Please try again.', 'error');
  }
});

// Finish onboarding - generate rotation
document.getElementById('finishOnboarding').addEventListener('click', async () => {
  if (OnboardingState.rooms.length === 0) {
    showMessage('Please add at least one room first.', 'warning');
    return;
  }

  try {
    showLoadingState('Generating your task rotation...');

    // Trigger rotation generation
    const rotation = await TaskAPI.regenerateRotation();

    if (rotation.success) {
      // Close onboarding modal
      document.getElementById('onboardingModal').style.display = 'none';

      // Show success message
      showMessage(`${rotation.total_tasks} tasks generated! Let's get started.`, 'success');

      // Load first task
      await loadCurrentTask();

      // Update app state
      AppState.user.hasConfiguredRooms = true;
    }
  } catch (error) {
    showMessage('Failed to generate tasks. Please try again.', 'error');
  } finally {
    hideLoadingState();
  }
});

// Skip onboarding
document.getElementById('skipOnboarding').addEventListener('click', () => {
  // Show confirmation
  if (confirm('You can configure your rooms anytime in Settings. Continue?')) {
    document.getElementById('onboardingModal').style.display = 'none';

    // User will see legacy task system
    AppState.user.hasConfiguredRooms = false;
  }
});
```

---

### Phase 5: Frontend Settings Page

#### Settings Modal Structure

```html
<!-- Settings Modal -->
<div id="settingsModal" class="modal" style="display: none;">
  <div class="modal-content extra-large">
    <div class="modal-header">
      <h2>Settings</h2>
      <button class="close-btn" onclick="closeSettingsModal()">×</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="rooms">My Rooms</button>
      <button class="tab-btn" data-tab="keystones">Keystone Tasks</button>
      <button class="tab-btn" data-tab="preview">Task Preview</button>
      <button class="tab-btn" data-tab="account">Account</button>
    </div>

    <!-- Tab Contents -->
    <div class="tab-content">
      <!-- My Rooms Tab -->
      <div id="roomsTab" class="tab-pane active">
        <div id="settingsRoomsList">
          <!-- Room cards with drag handles, edit/delete -->
        </div>

        <button id="addRoomSettingsBtn" class="btn-primary">
          + Add Room
        </button>

        <!-- Pending changes notice -->
        <div id="pendingChangesNotice" style="display: none;">
          <p class="notice-warning">
            ⚠️ Your changes will be applied after you complete the current rotation cycle.
          </p>
        </div>
      </div>

      <!-- Keystone Tasks Tab -->
      <div id="keystonesTab" class="tab-pane">
        <h3>High-Frequency Hygiene Points</h3>
        <p>Enable/disable keystone tasks and customize their names.</p>

        <div id="keystonesList">
          <!-- Keystone toggle items -->
        </div>
      </div>

      <!-- Task Preview Tab -->
      <div id="previewTab" class="tab-pane">
        <h3>Your Next 20 Tasks</h3>
        <div id="taskPreviewList">
          <!-- Ordered list of upcoming tasks -->
        </div>

        <div class="preview-legend">
          <span class="legend-item">
            <span class="badge pillar">Pillar Task</span>
            <span class="badge keystone">Keystone</span>
          </span>
          <p>Current position: <strong id="currentPosition">5</strong> / <strong id="totalTasks">28</strong></p>
        </div>
      </div>

      <!-- Account Tab (existing content) -->
      <div id="accountTab" class="tab-pane">
        <!-- Existing account settings -->
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-actions">
      <button id="saveSettingsBtn" class="btn-primary">Save Changes</button>
      <button class="btn-secondary" onclick="closeSettingsModal()">Cancel</button>
    </div>
  </div>
</div>
```

#### Keystone Task Item Component

```html
<div class="keystone-item" data-keystone-id="{keystoneId}">
  <div class="keystone-toggle">
    <label class="switch">
      <input type="checkbox" class="keystone-active-toggle"
             data-keystone-id="{keystoneId}"
             {isActive ? 'checked' : ''}>
      <span class="slider"></span>
    </label>
  </div>

  <div class="keystone-info">
    <div class="keystone-default-name">{defaultName}</div>
    <input type="text" class="keystone-custom-name"
           placeholder="Custom name (optional)"
           value="{customName || ''}"
           data-keystone-id="{keystoneId}">
  </div>
</div>
```

#### Task Preview Item

```html
<div class="preview-task-item {current ? 'current' : ''}"
     data-position="{position}">
  <div class="task-number">{position}</div>
  <div class="task-description">{description}</div>
  <div class="task-meta">
    {taskType === 'pillar' ?
      `<span class="badge pillar">${roomName} - ${pillarType}</span>` :
      `<span class="badge keystone">Keystone</span>`
    }
  </div>
</div>
```

#### Settings JavaScript Logic

```javascript
// Settings state
const SettingsState = {
  rooms: [],
  keystones: [],
  hasUnsavedChanges: false,
  isPendingCycleCompletion: false
};

// Open settings modal
function openSettingsModal() {
  document.getElementById('settingsModal').style.display = 'block';

  // Load current configuration
  loadSettingsData();
}

async function loadSettingsData() {
  try {
    // Load rooms
    const roomsResponse = await RoomAPI.getUserRooms();
    SettingsState.rooms = roomsResponse.rooms;
    renderRoomsList();

    // Load keystones
    const keystonesResponse = await KeystoneAPI.getUserKeystones();
    SettingsState.keystones = keystonesResponse.keystone_tasks;
    renderKeystonesList();

    // Load task preview
    const previewResponse = await TaskAPI.previewTasks(20);
    renderTaskPreview(previewResponse.tasks, previewResponse.current_position);

  } catch (error) {
    showMessage('Failed to load settings', 'error');
  }
}

// Save settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  if (!SettingsState.hasUnsavedChanges) {
    closeSettingsModal();
    return;
  }

  try {
    showLoadingState('Saving settings...');

    // Note: Changes are staged, not immediately applied
    const response = await RoomAPI.stagePendingChanges({
      rooms: SettingsState.rooms,
      keystones: SettingsState.keystones
    });

    if (response.success) {
      // Show pending notice
      SettingsState.isPendingCycleCompletion = true;
      document.getElementById('pendingChangesNotice').style.display = 'block';

      showMessage('Settings saved! Changes will apply after completing current cycle.', 'success');

      SettingsState.hasUnsavedChanges = false;
    }
  } catch (error) {
    showMessage('Failed to save settings', 'error');
  } finally {
    hideLoadingState();
  }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const tabName = e.target.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(`${tabName}Tab`).classList.add('active');

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Room reordering (simple up/down arrows)
function moveRoomUp(roomId) {
  const index = SettingsState.rooms.findIndex(r => r.id === roomId);
  if (index > 0) {
    // Swap with previous
    [SettingsState.rooms[index], SettingsState.rooms[index - 1]] =
    [SettingsState.rooms[index - 1], SettingsState.rooms[index]];

    // Update sort_order
    SettingsState.rooms.forEach((room, i) => {
      room.sort_order = i + 1;
    });

    renderRoomsList();
    SettingsState.hasUnsavedChanges = true;
  }
}

function moveRoomDown(roomId) {
  const index = SettingsState.rooms.findIndex(r => r.id === roomId);
  if (index < SettingsState.rooms.length - 1) {
    // Swap with next
    [SettingsState.rooms[index], SettingsState.rooms[index + 1]] =
    [SettingsState.rooms[index + 1], SettingsState.rooms[index]];

    // Update sort_order
    SettingsState.rooms.forEach((room, i) => {
      room.sort_order = i + 1;
    });

    renderRoomsList();
    SettingsState.hasUnsavedChanges = true;
  }
}

// Keystone toggle
function toggleKeystone(keystoneId, isActive) {
  const keystone = SettingsState.keystones.find(k => k.id === keystoneId);
  if (keystone) {
    keystone.is_active = isActive;
    SettingsState.hasUnsavedChanges = true;
  }
}

function updateKeystoneCustomName(keystoneId, customName) {
  const keystone = SettingsState.keystones.find(k => k.id === keystoneId);
  if (keystone) {
    keystone.custom_name = customName || null;
    SettingsState.hasUnsavedChanges = true;
  }
}
```

---

### Phase 6: Frontend Task Display Updates

#### Modified Task Fetching Logic

**Replace hardcoded system:**

```javascript
// OLD CODE (to remove/deprecate):
const cleaningTasks = [/* 50 tasks */];
function getTodaysTask() {
  const today = new Date();
  const dayOfMonth = today.getDate();
  return cleaningTasks[(dayOfMonth - 1) % cleaningTasks.length];
}

// NEW CODE:
async function fetchCurrentTask() {
  try {
    // Check if user has configured rooms
    if (!AppState.user.hasConfiguredRooms) {
      // Fallback to legacy system
      return getLegacyTask();
    }

    // Fetch from rotation
    const response = await TaskAPI.getCurrentTask();

    if (response.task) {
      // Cache in AppState
      AppState.currentTask = {
        id: response.task.id,
        description: response.task.description,
        taskType: response.task.task_type,
        room: response.task.room,
        pillarType: response.task.pillar_type,
        keystoneType: response.task.keystone_type,
        position: response.task.position,
        totalTasks: response.task.total_tasks
      };

      return AppState.currentTask;
    }
  } catch (error) {
    console.error('Failed to fetch current task:', error);

    // Fallback to legacy
    return getLegacyTask();
  }
}

function getLegacyTask() {
  // Use old day-of-month rotation for unconfigured users
  const today = new Date();
  const dayOfMonth = today.getDate();
  const legacyTasks = [/* hardcoded 50 tasks */];

  return {
    description: legacyTasks[(dayOfMonth - 1) % legacyTasks.length],
    isLegacy: true
  };
}
```

#### Updated Task Display UI

```html
<!-- Enhanced task display -->
<div id="taskDisplay">
  <div id="taskHeader">
    <h2>Today's Task</h2>

    <!-- Progress indicator (only for configured users) -->
    <div id="taskProgress" style="display: none;">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {percentage}%"></div>
      </div>
      <p class="progress-text">
        Task <strong id="currentPosition">5</strong> of
        <strong id="totalTasks">28</strong>
      </p>
    </div>
  </div>

  <div id="taskContent">
    <!-- Task description -->
    <p id="taskDescription" class="task-text">
      <!-- Dynamic task description -->
    </p>

    <!-- Context badge (only for rotation tasks) -->
    <div id="taskContext" style="display: none;">
      <span id="taskBadge" class="badge">
        <!-- "Kitchen - Surfaces" or "Keystone Task" -->
      </span>
    </div>

    <!-- Legacy user prompt -->
    <div id="legacyPrompt" style="display: none;">
      <p class="info-box">
        💡 <strong>Personalize your tasks!</strong>
        <a href="#" onclick="openSettingsModal(); return false;">
          Configure your home
        </a> to get room-specific tasks.
      </p>
    </div>
  </div>

  <!-- Action button -->
  <button id="completeTaskBtn" class="btn-primary large">
    Mark as Complete
  </button>
</div>
```

#### Updated Task Completion Flow

```javascript
// Modified completeTask function
async function completeTask() {
  const task = AppState.currentTask;

  if (!task) {
    showMessage('No task to complete', 'error');
    return;
  }

  try {
    showLoadingState('Completing task...');

    const completionData = {
      taskName: task.description,
      completionDate: new Date().toISOString().split('T')[0],
      notes: '',
      task_rotation_id: task.isLegacy ? null : task.id
    };

    const response = await UserAPI.completeTask(completionData);

    if (response.success) {
      // Update streak display
      AppState.streak.current = response.streak.current_streak;
      AppState.streak.bestStreak = response.streak.longest_streak;
      updateStreakDisplay();

      // Show success animation
      showCompletionAnimation();

      // If rotation-based, load next task
      if (response.next_task) {
        AppState.currentTask = response.next_task;
        displayCurrentTask();

        showMessage(`Great job! Next: ${response.next_task.description}`, 'success');
      } else {
        // Legacy mode - will change tomorrow
        showMessage('Task completed! See you tomorrow.', 'success');
      }

      // Save to localStorage
      saveStateToLocalStorage();
    }
  } catch (error) {
    showMessage('Failed to complete task. Saved locally.', 'warning');

    // Queue for offline sync
    queueOfflineAction('completeTask', completionData);
  } finally {
    hideLoadingState();
  }
}

function displayCurrentTask() {
  const task = AppState.currentTask;

  if (!task) return;

  // Update description
  document.getElementById('taskDescription').textContent = task.description;

  if (task.isLegacy) {
    // Legacy mode
    document.getElementById('taskProgress').style.display = 'none';
    document.getElementById('taskContext').style.display = 'none';
    document.getElementById('legacyPrompt').style.display = 'block';
  } else {
    // Rotation mode
    document.getElementById('taskProgress').style.display = 'block';
    document.getElementById('legacyPrompt').style.display = 'none';

    // Update progress
    const percentage = (task.position / task.totalTasks) * 100;
    document.querySelector('.progress-fill').style.width = `${percentage}%`;
    document.getElementById('currentPosition').textContent = task.position;
    document.getElementById('totalTasks').textContent = task.totalTasks;

    // Update context badge
    const badge = document.getElementById('taskBadge');
    if (task.taskType === 'pillar') {
      badge.textContent = `${task.room.name} - ${capitalizeFirst(task.pillarType)}`;
      badge.className = 'badge pillar';
    } else {
      badge.textContent = 'Keystone Task';
      badge.className = 'badge keystone';
    }
    document.getElementById('taskContext').style.display = 'block';
  }
}
```

---

### Phase 7: Migration & Backward Compatibility

#### Backend Migration Detection

**In TaskProgressService:**

```javascript
async function getCurrentTask(userId) {
  // Check if user has configured rooms
  const hasRooms = await RoomService.hasConfiguredRooms(userId);

  if (!hasRooms) {
    // User hasn't configured - return null (frontend uses legacy)
    return null;
  }

  // Check if rotation exists
  let progress = await getProgress(userId);

  if (!progress) {
    // First time - initialize progress tracker
    progress = await prisma.user_task_progress.create({
      data: {
        user_id: userId,
        current_task_index: 1,
        current_rotation_version: 0
      }
    });
  }

  // Check if rotation generated
  const rotationExists = await prisma.task_rotation.count({
    where: {
      user_id: userId,
      rotation_version: progress.current_rotation_version
    }
  });

  if (rotationExists === 0) {
    // Generate initial rotation
    const newRotation = await TaskGenerationService.generateRotation(userId, false);

    await prisma.user_task_progress.update({
      where: { user_id: userId },
      data: {
        current_rotation_version: newRotation.version,
        rotation_generated_at: newRotation.generated_at
      }
    });
  }

  // Fetch current task from rotation
  const task = await prisma.task_rotation.findFirst({
    where: {
      user_id: userId,
      rotation_version: progress.current_rotation_version,
      sequence_position: progress.current_task_index
    }
  });

  return task;
}
```

#### Frontend Migration Banner

```html
<!-- Add to main UI for existing users without rooms -->
<div id="migrationBanner" style="display: none;">
  <div class="banner info">
    <p>
      <strong>✨ New Feature!</strong>
      Get personalized cleaning tasks based on your home setup.
      <a href="#" onclick="openSettingsModal(); return false;">
        Configure your rooms now
      </a>
    </p>
    <button class="banner-close" onclick="dismissMigrationBanner()">×</button>
  </div>
</div>
```

```javascript
// Show banner for authenticated users without room config
async function checkMigrationStatus() {
  if (!AppState.user.isAuthenticated) return;

  try {
    const roomsResponse = await RoomAPI.getUserRooms();

    if (roomsResponse.rooms.length === 0) {
      // User has no rooms - show banner
      document.getElementById('migrationBanner').style.display = 'block';
      AppState.user.hasConfiguredRooms = false;
    } else {
      AppState.user.hasConfiguredRooms = true;
    }
  } catch (error) {
    console.error('Failed to check migration status:', error);
  }
}

function dismissMigrationBanner() {
  document.getElementById('migrationBanner').style.display = 'none';
  localStorage.setItem('migration_banner_dismissed', 'true');
}
```

#### Data Preservation

**Historical Completions:**
- Old completions (pre-migration) remain in completion_history with taskName only
- New completions include room_id, pillar_type, rotation_id metadata
- Both types displayed in history view
- Old streaks preserved in user_streaks table

**Streak Continuity:**
- Overall daily streak remains unaffected
- User's current streak continues regardless of migration
- StreakService logic unchanged (still based on taskName completion)

---

### Phase 8: Testing Strategy

#### Backend Unit Tests

**File:** `backend/tests/services/roomService.test.js`

```javascript
describe('RoomService', () => {
  test('should create room with valid data', async () => {
    const room = await RoomService.createRoom(userId, {
      roomType: 'bedroom',
      customName: 'Master Bedroom',
      hasGlass: true
    });

    expect(room).toHaveProperty('id');
    expect(room.custom_name).toBe('Master Bedroom');
    expect(room.sort_order).toBe(1); // First room
  });

  test('should validate room type', async () => {
    await expect(
      RoomService.createRoom(userId, {
        roomType: 'invalid_type',
        customName: 'Test',
        hasGlass: true
      })
    ).rejects.toThrow('Invalid room type');
  });

  test('should reorder rooms correctly', async () => {
    const room1 = await RoomService.createRoom(userId, {...});
    const room2 = await RoomService.createRoom(userId, {...});

    await RoomService.reorderRooms(userId, [room2.id, room1.id]);

    const rooms = await RoomService.getUserRooms(userId);
    expect(rooms[0].id).toBe(room2.id);
    expect(rooms[1].id).toBe(room1.id);
  });
});
```

**File:** `backend/tests/services/taskGenerationService.test.js`

```javascript
describe('TaskGenerationService', () => {
  test('should generate rotation with glass pillar when room has glass', async () => {
    // Setup: Create room with has_glass = true
    await RoomService.createRoom(userId, {
      roomType: 'bedroom',
      customName: 'Master Bedroom',
      hasGlass: true
    });

    const rotation = await TaskGenerationService.generateRotation(userId);

    const tasks = await prisma.task_rotation.findMany({
      where: { user_id: userId, rotation_version: rotation.version }
    });

    const glassTasks = tasks.filter(t => t.pillar_type === 'glass');
    expect(glassTasks.length).toBeGreaterThan(0);
  });

  test('should skip glass pillar when room has no glass', async () => {
    // Setup: Create room with has_glass = false
    await RoomService.createRoom(userId, {
      roomType: 'bedroom',
      customName: 'Guest Bedroom',
      hasGlass: false
    });

    const rotation = await TaskGenerationService.generateRotation(userId);

    const tasks = await prisma.task_rotation.findMany({
      where: { user_id: userId, rotation_version: rotation.version }
    });

    const glassTasks = tasks.filter(t => t.pillar_type === 'glass');
    expect(glassTasks.length).toBe(0);
  });

  test('should insert keystones every 3-5 tasks', async () => {
    // Setup: Create 3 rooms, initialize keystones
    await setupTestRooms(userId, 3);
    await KeystoneService.initializeDefaultKeystones(userId);

    const rotation = await TaskGenerationService.generateRotation(userId);

    const tasks = await prisma.task_rotation.findMany({
      where: { user_id: userId, rotation_version: rotation.version },
      orderBy: { sequence_position: 'asc' }
    });

    // Verify keystone distribution
    const keystonePositions = tasks
      .filter(t => t.task_type === 'keystone')
      .map(t => t.sequence_position);

    for (let i = 1; i < keystonePositions.length; i++) {
      const gap = keystonePositions[i] - keystonePositions[i-1];
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(5);
    }
  });

  test('should handle zero rooms gracefully', async () => {
    const rotation = await TaskGenerationService.generateRotation(userId);

    expect(rotation.total_tasks).toBe(0);
  });

  test('should handle single room', async () => {
    await RoomService.createRoom(userId, {
      roomType: 'kitchen',
      customName: 'Kitchen',
      hasGlass: true
    });

    const rotation = await TaskGenerationService.generateRotation(userId);

    const tasks = await prisma.task_rotation.findMany({
      where: { user_id: userId, rotation_version: rotation.version }
    });

    expect(tasks.length).toBeGreaterThan(0);

    // Should have all 3 pillars for single room
    const pillars = tasks.filter(t => t.task_type === 'pillar');
    expect(pillars.length).toBe(3); // glass, surfaces, floor
  });
});
```

**File:** `backend/tests/services/taskProgressService.test.js`

```javascript
describe('TaskProgressService', () => {
  test('should advance through rotation correctly', async () => {
    // Setup rotation
    await setupTestRooms(userId, 2);
    await TaskGenerationService.generateRotation(userId);

    const task1 = await TaskProgressService.getCurrentTask(userId);
    expect(task1.sequence_position).toBe(1);

    const task2 = await TaskProgressService.advanceToNextTask(userId);
    expect(task2.sequence_position).toBe(2);

    const task3 = await TaskProgressService.advanceToNextTask(userId);
    expect(task3.sequence_position).toBe(3);
  });

  test('should detect cycle completion and regenerate', async () => {
    // Setup small rotation (3 tasks total)
    await setupTestRooms(userId, 1, { hasGlass: false }); // 2 pillars
    await KeystoneService.initializeDefaultKeystones(userId);
    await KeystoneService.updateKeystone(keystoneId, userId, { is_active: true });

    const rotation = await TaskGenerationService.generateRotation(userId);
    expect(rotation.total_tasks).toBe(3); // surfaces + floor + 1 keystone

    // Advance to end
    await TaskProgressService.advanceToNextTask(userId); // task 2
    await TaskProgressService.advanceToNextTask(userId); // task 3

    // Next advance should trigger regeneration
    const newTask = await TaskProgressService.advanceToNextTask(userId);

    expect(newTask.sequence_position).toBe(1);
    expect(newTask.rotation_version).toBe(rotation.version + 1);
  });

  test('should apply pending config changes on cycle completion', async () => {
    // Setup initial rotation
    await setupTestRooms(userId, 1);
    await TaskGenerationService.generateRotation(userId);

    // Stage pending changes (add a room)
    await TaskProgressService.stagePendingChanges(userId, {
      rooms: [/* updated room list */]
    });

    const progress = await TaskProgressService.getProgress(userId);
    expect(progress.has_pending_config_changes).toBe(true);

    // Advance to end of cycle
    await advanceToEndOfCycle(userId);

    // Trigger cycle completion
    await TaskProgressService.advanceToNextTask(userId);

    // Verify pending changes applied
    const newProgress = await TaskProgressService.getProgress(userId);
    expect(newProgress.has_pending_config_changes).toBe(false);

    // Verify new room exists in rotation
    // (Implementation-specific assertions)
  });
});
```

#### Backend Integration Tests

**File:** `backend/tests/integration/roomConfigFlow.test.js`

```javascript
describe('Room Configuration Flow', () => {
  test('complete flow: configure rooms → generate rotation → complete tasks', async () => {
    // 1. User creates rooms
    const room1 = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomType: 'kitchen',
        customName: 'Kitchen',
        hasGlass: true
      });

    expect(room1.status).toBe(201);

    const room2 = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomType: 'bedroom',
        customName: 'Master Bedroom',
        hasGlass: false
      });

    expect(room2.status).toBe(201);

    // 2. System auto-generates rotation
    const currentTask = await request(app)
      .get('/api/tasks/current')
      .set('Authorization', `Bearer ${authToken}`);

    expect(currentTask.status).toBe(200);
    expect(currentTask.body.task).toBeDefined();
    expect(currentTask.body.task.position).toBe(1);

    // 3. User completes first task
    const completion = await request(app)
      .post('/api/user/complete')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskName: currentTask.body.task.description,
        task_rotation_id: currentTask.body.task.id
      });

    expect(completion.status).toBe(201);
    expect(completion.body.next_task).toBeDefined();
    expect(completion.body.next_task.position).toBe(2);

    // 4. Verify progression
    const nextTask = await request(app)
      .get('/api/tasks/current')
      .set('Authorization', `Bearer ${authToken}`);

    expect(nextTask.body.task.position).toBe(2);
  });
});
```

#### Frontend Tests (Manual/E2E)

**Onboarding Flow Test Cases:**
1. New user registers → sees onboarding modal
2. User adds 3 rooms with different configurations
3. User clicks "Generate My Tasks" → rotation created
4. First task displays with correct context
5. User skips onboarding → sees legacy mode + banner

**Settings Flow Test Cases:**
1. User opens settings → sees existing rooms
2. User adds new room → marked as pending
3. User reorders rooms → updates sort order
4. User toggles keystone → updates isActive
5. User saves → shows "pending changes" notice
6. User completes cycle → changes applied, new rotation generated

**Task Completion Flow Test Cases:**
1. User completes rotation task → advances to next
2. Progress bar updates correctly
3. Context badges show correct room/pillar info
4. Cycle completion triggers regeneration with shuffled keystones
5. Offline completion queues for sync

---

### Phase 9: API Documentation

#### Room Management Endpoints

##### POST /api/rooms
Create a new room configuration.

**Request:**
```json
{
  "roomType": "bedroom",
  "customName": "Master Bedroom",
  "hasGlass": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "room": {
    "id": "uuid",
    "user_id": "uuid",
    "room_type": "bedroom",
    "custom_name": "Master Bedroom",
    "has_glass": true,
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-11-10T12:00:00Z",
    "updated_at": "2025-11-10T12:00:00Z"
  }
}
```

**Errors:**
- 400: Invalid room type
- 400: Custom name too long (>50 chars)
- 401: Unauthorized
- 429: Rate limit exceeded

---

##### GET /api/rooms
Retrieve all user's room configurations.

**Response (200 OK):**
```json
{
  "rooms": [
    {
      "id": "uuid",
      "room_type": "kitchen",
      "custom_name": "Kitchen",
      "has_glass": true,
      "sort_order": 1
    },
    {
      "id": "uuid",
      "room_type": "bedroom",
      "custom_name": "Master Bedroom",
      "has_glass": false,
      "sort_order": 2
    }
  ]
}
```

---

##### PUT /api/rooms/:id
Update room configuration.

**Request:**
```json
{
  "customName": "Main Bedroom",
  "hasGlass": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "room": { /* updated room object */ }
}
```

---

##### DELETE /api/rooms/:id
Delete a room configuration.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Room deleted. Changes will apply after completing current cycle."
}
```

---

##### PUT /api/rooms/reorder
Bulk reorder rooms.

**Request:**
```json
{
  "room_order": ["uuid2", "uuid1", "uuid3"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Rooms reordered successfully"
}
```

---

#### Keystone Task Endpoints

##### GET /api/keystone-tasks
Retrieve all keystone task configurations.

**Response (200 OK):**
```json
{
  "keystone_tasks": [
    {
      "id": "uuid",
      "task_type": "master_toilet",
      "custom_name": null,
      "is_active": true,
      "sort_order": 1,
      "default_description": "Scrub and disinfect master toilet"
    },
    {
      "id": "uuid",
      "task_type": "kitchen_sink",
      "custom_name": "Clean main kitchen sink",
      "is_active": true,
      "sort_order": 2,
      "default_description": "Scrub kitchen sink and faucet"
    }
  ]
}
```

---

##### PUT /api/keystone-tasks/:id
Update keystone task configuration.

**Request:**
```json
{
  "customName": "Deep clean master bathroom toilet",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "task": { /* updated keystone object */ }
}
```

---

#### Task Rotation Endpoints

##### GET /api/tasks/current
Get the current task from rotation.

**Response (200 OK):**
```json
{
  "task": {
    "id": "uuid",
    "description": "Wipe down Kitchen countertops and table",
    "task_type": "pillar",
    "room": {
      "id": "uuid",
      "name": "Kitchen",
      "type": "kitchen"
    },
    "pillar_type": "surfaces",
    "keystone_type": null,
    "position": 5,
    "total_tasks": 28
  }
}
```

**Response (200 OK - No rooms configured):**
```json
{
  "task": null,
  "message": "No rooms configured. Please configure your home to get personalized tasks."
}
```

---

##### GET /api/tasks/preview?limit=20
Preview upcoming tasks in rotation.

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "description": "Clean windows and glass surfaces in Living Room",
      "task_type": "pillar",
      "room": { "name": "Living Room" },
      "pillar_type": "glass",
      "position": 5
    },
    {
      "description": "Dust and wipe Living Room coffee table and shelves",
      "task_type": "pillar",
      "room": { "name": "Living Room" },
      "pillar_type": "surfaces",
      "position": 6
    },
    {
      "description": "Scrub and disinfect master toilet",
      "task_type": "keystone",
      "keystone_type": "master_toilet",
      "position": 7
    }
  ],
  "current_position": 5,
  "total_tasks": 28
}
```

---

##### POST /api/tasks/regenerate
Force regeneration of task rotation (admin/debug).

**Response (200 OK):**
```json
{
  "success": true,
  "rotation": {
    "version": 2,
    "total_tasks": 28,
    "generated_at": "2025-11-10T12:00:00Z"
  },
  "message": "Task rotation regenerated successfully"
}
```

---

#### Modified User Completion Endpoint

##### POST /api/user/complete
Complete a task (enhanced with rotation support).

**Request:**
```json
{
  "taskName": "Wipe down Kitchen countertops and table",
  "completionDate": "2025-11-10",
  "notes": "",
  "task_rotation_id": "uuid"  // Optional: if from rotation
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "streak": {
    "current_streak": 15,
    "longest_streak": 20,
    "total_completions": 150
  },
  "next_task": {
    "id": "uuid",
    "description": "Sweep and mop the Kitchen floor",
    "task_type": "pillar",
    "room": { "name": "Kitchen" },
    "pillar_type": "floor",
    "position": 6,
    "total_tasks": 28
  }
}
```

---

## Implementation Sequence

### Recommended Order

**Week 1: Backend Foundation**
1. Day 1-2: Database schema + migration
2. Day 3: TaskTemplateService, RoomService
3. Day 4-5: TaskGenerationService, KeystoneService, TaskProgressService

**Week 2: Backend APIs + Frontend Onboarding**
1. Day 1-2: API endpoints + controllers
2. Day 3: Room management API testing
3. Day 4-5: Frontend onboarding wizard

**Week 3: Frontend Settings + Task Display**
1. Day 1-2: Settings modal with all tabs
2. Day 3-4: Updated task display + completion flow
3. Day 5: Migration banner + backward compatibility

**Week 4: Testing + Polish**
1. Day 1-2: Backend unit tests
2. Day 3: Backend integration tests
3. Day 4: Frontend E2E tests
4. Day 5: Bug fixes, polish, documentation

---

## Success Metrics

### Technical Metrics
- Task rotation generation time < 100ms for typical config (3-5 rooms)
- Zero data loss during migration
- API response times unchanged
- Test coverage >80%

### User Metrics
- % of users who complete room configuration during onboarding
- Average number of rooms configured per user
- Task completion rate before/after personalization
- User retention after implementing room customization

---

## Risk Assessment

### Low Risk
- Database schema additions (additive, non-breaking)
- New API endpoints (don't affect existing functionality)
- Backward compatibility (parallel systems)

### Medium Risk
- Task generation algorithm complexity
- User confusion during migration
- Settings UI complexity

### Mitigation Strategies
- Comprehensive testing for task generation edge cases
- Clear onboarding flow with examples
- Progressive disclosure in settings (hide advanced features)
- Graceful fallback to legacy system

---

## Files to Create/Modify

### Backend - New Files
- `backend/src/services/taskTemplateService.js`
- `backend/src/services/roomService.js`
- `backend/src/services/keystoneService.js`
- `backend/src/services/taskGenerationService.js`
- `backend/src/services/taskProgressService.js`
- `backend/src/controllers/roomController.js`
- `backend/src/controllers/keystoneController.js`
- `backend/src/controllers/taskController.js`
- `backend/src/routes/rooms.js`
- `backend/src/routes/keystones.js`
- `backend/src/routes/tasks.js`
- `backend/tests/services/roomService.test.js`
- `backend/tests/services/taskGenerationService.test.js`
- `backend/tests/services/taskProgressService.test.js`
- `backend/tests/integration/roomConfigFlow.test.js`

### Backend - Modified Files
- `backend/prisma/schema.prisma` (add 5 new models)
- `backend/src/routes/user.js` (enhance completeTask endpoint)
- `backend/src/controllers/userController.js` (modify completeTask method)
- `backend/src/middleware/rateLimiter.js` (add roomConfig rate limit)
- `backend/src/server.js` (register new routes)

### Frontend - Modified Files
- `index.html` (major changes: onboarding wizard, settings modal, task display updates)

---

## Environment Variables

No new environment variables required. Existing configuration sufficient.

---

## Database Migration Script

```bash
# Run migration
cd backend
npx prisma migrate dev --name add_room_customization

# Seed default keystones
npx prisma db seed
```

---

## Deployment Checklist

- [ ] Database migration applied
- [ ] Default keystone tasks seeded
- [ ] All backend tests passing (174/174)
- [ ] Frontend onboarding wizard functional
- [ ] Settings page fully implemented
- [ ] Task display supports both legacy and rotation modes
- [ ] Migration banner displays for existing users
- [ ] Backward compatibility verified
- [ ] API documentation updated
- [ ] User guide/help documentation created

---

## Open Questions (RESOLVED)

All design questions have been answered:

1. **Rotation End Behavior:** ✅ Regenerate with shuffled keystones
2. **Task Descriptions:** ✅ Smart templates with room-type awareness
3. **Streak Tracking:** ✅ Overall app streak only (simple)
4. **Mid-Cycle Changes:** ✅ Complete current cycle first (staged changes)

---

## Notes

- Maintain existing StreakService unchanged (streak logic remains same)
- Focus on graceful degradation - never break existing functionality
- Progressive enhancement - new features opt-in, not forced
- Clear user communication during migration
- Keep UI simple - advanced features in settings, not overwhelming onboarding

---

**End of Project Document**
