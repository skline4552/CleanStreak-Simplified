# Room Customization & Three-Pillars Task Generation - Research Document

**Date**: 2025-11-10
**Purpose**: Research findings for implementing house customization and intelligent task generation based on the three-pillars cleaning methodology

---

## Executive Summary

The app currently uses a hardcoded array of 50 cleaning tasks that rotate based on the day of the month. The goal is to transform this into a personalized, room-based task generation system using the "three pillars" methodology: Glass → Surfaces → Floor, with keystone tasks interspersed for high-frequency hygiene points.

---

## Current System Architecture

### Database Schema (SQLite + Prisma)

**Location**: `backend/prisma/schema.prisma`

**Existing Models**:
1. **users** - User accounts (id, email, password_hash, created_at, updated_at, last_login, email_verified)
2. **user_streaks** - Streak tracking per task (id, user_id, task_name, current_streak, best_streak, last_completed, created_at, updated_at)
3. **completion_history** - Historical completions (id, user_id, task_name, completed_date, streak_day, created_at, completion_time, notes)
4. **user_sessions** - JWT refresh tokens (id, user_id, refresh_token, device_info, ip_address, created_at, last_accessed, expires_at, is_active)
5. **analytics** - Metrics tracking (id, metric_name, metric_value, date, metadata)

**Key Observations**:
- Task tracking is currently based on free-form `task_name` strings
- No room or task type categorization exists
- No concept of task rotation or sequencing in the database
- Streaks are tracked per unique task_name

### Backend Architecture

**Tech Stack**: Node.js + Express + Prisma

**Key Services**:

1. **StreakService** (`backend/src/services/streakService.js`)
   - `completeTask(userId, taskName, completionDate, notes)` - Core completion logic
   - `getUserStreak(userId, taskName)` - Get specific task streak
   - `getUserStreaks(userId)` - Get all user streaks
   - `getStreakStats(userId)` - Calculate statistics
   - Handles streak calculation, gap detection (>24h = broken streak)

2. **AccountService** (`backend/src/services/accountService.js`)
   - `getAccountSummary(userId)` - Aggregates user data including streak stats
   - Account management operations

**Key Controllers**:

1. **UserController** (`backend/src/controllers/userController.js`)
   - `completeTask(req, res)` - POST /api/user/complete
     - Accepts: `{ taskName, completionDate, notes }`
     - Validates completion date (no future dates)
     - Calls StreakService.completeTask()
     - Returns: `{ success: true, streak: {...} }`
   - `getStreaks()`, `getStreak()`, `getHistory()`, `getStats()` - Data retrieval endpoints
   - `bulkCompleteTask()` - POST /api/user/bulk-complete (for batch operations)

**API Routes** (`backend/src/routes/user.js`):
- GET `/api/user/streaks` - Get all streaks
- GET `/api/user/streak/:taskName` - Get specific task streak
- POST `/api/user/complete` - Complete single task (rate limited: 30/15min)
- POST `/api/user/bulk-complete` - Complete multiple tasks (rate limited: 5/15min)
- GET `/api/user/history` - Completion history with pagination
- GET `/api/user/stats` - Streak statistics
- GET `/api/user/profile` - User profile
- GET `/api/user/account` - Account summary
- GET `/api/user/export` - Export user data
- DELETE `/api/user/account` - Delete account
- DELETE `/api/user/completion/:completionId` - Undo completion

**Authentication**:
- JWT-based (access + refresh tokens)
- Middleware: `authenticate` (validates JWT)
- Rate limiting applied per endpoint

### Frontend Architecture

**Location**: `index.html` (single-page application)

**Current Task System**:

```javascript
// Line 736-787: Hardcoded task array
const cleaningTasks = [
    "Make your bed",
    "Wipe down kitchen counters",
    "Clean bathroom mirror",
    // ... 50 total tasks
];

// Line 1906-1910: Task selection logic
function getTodaysTask() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    return cleaningTasks[(dayOfMonth - 1) % cleaningTasks.length];
}
```

**Key Finding**: Tasks rotate based on day of month (1-31), cycling through the 50-task array. No personalization or room configuration exists.

**Task Completion Flow** (Lines 1938-2004):
1. User clicks "Done" button
2. `completeTask()` function executes:
   - Updates local streak state
   - Saves to localStorage
   - If authenticated: calls `UserAPI.completeTask(taskText)`
   - If offline: queues action for later sync
3. UI updates to show completion

**State Management** (AppState object):
```javascript
AppState = {
    user: { isAuthenticated, profile: {id, email, preferences} },
    streak: { current, bestStreak, lastCompletedDate },
    engagement: { totalCompletions, consecutiveDays },
    sync: { lastSync, offlineQueue, isSyncing },
    network: { isOnline, lastOnline }
}
```

**API Communication** (`UserAPI` object, lines 917+):
- `completeTask(taskDescription)` - POST /api/user/complete with `{taskName: taskDescription}`
- `getStreaks()`, `getHistory()`, `getProfile()` - Data retrieval methods
- Offline-first: queues failed requests for later retry

---

## Three-Pillars Methodology Analysis

**Source**: `three-pillars-task-generation-brief.md`

### Core Cleaning Philosophy

Every room cleaned using three pillars (top-to-bottom):
1. **Glass clear** - Windows, mirrors, glass surfaces
2. **Surfaces clear and wiped** - Declutter and wipe countertops, tables, shelves
3. **Floor vacuumed** - Vacuum or sweep

### Room Configuration Requirements

**Room Inventory**:
- Room type (Living Room, Kitchen, Bedroom, Bathroom, Office, etc.)
- Custom naming (e.g., "Master Bedroom", "Guest Bathroom")
- Quantity of each type

**Glass Presence Detection**:
- Per-room question: "Does this room have mirrors or windows?"
- If YES: Include all three pillars (Glass → Surfaces → Floor)
- If NO: Skip glass pillar, only Surfaces → Floor

**Purpose**: Avoid irrelevant tasks like "Clean bedroom mirror" when room has no mirrors/windows

### Task Rotation Logic

**Room-by-Room Progression**:
- Complete all applicable pillars for one room before moving to next
- Order: Glass (if applicable) → Surfaces → Floor
- Ensures each space feels "complete"

**Keystone Tasks** (High-Frequency Hygiene Points):
- Inserted between room pillar cycles every 3-5 tasks
- Ensures each keystone touched at least once monthly
- Default keystones:
  - Master toilet
  - Guest/hall toilet
  - Kitchen sink
  - Master bathroom sink
  - Guest bathroom sink
  - Stovetop
  - Shower/tub
  - Microwave interior

### Example Task Sequence

*Assuming: Living room (has windows), Kitchen (has windows), Bedroom (no mirrors/windows)*

1. Living room - Glass
2. Living room - Surfaces
3. Living room - Floor
4. **Keystone: Clean master toilet**
5. Kitchen - Glass
6. Kitchen - Surfaces
7. **Keystone: Scrub kitchen sink**
8. Kitchen - Floor
9. **Keystone: Wipe down stovetop**
10. Bedroom - Surfaces *(glass pillar skipped)*
11. Bedroom - Floor
12. **Keystone: Clean master bathroom sink**
13. Continue pattern...

### Task Specifications

- 5-10 minutes per task
- Room-specific (e.g., "Wipe kitchen countertops" not "Wipe all countertops")
- Clear, action-oriented language
- Break large jobs into manageable chunks per room

---

## User Requirements Analysis

Based on user responses:

1. **Configuration Location**: Both onboarding + settings
   - Initial setup during registration
   - Editable anytime via settings page

2. **Room Naming**: Yes, custom names for each room
   - Users can name: "Master Bedroom", "Kids Room", "Guest Bath", etc.
   - Not just quantities

3. **Default Configurations**: No presets
   - Users build from scratch
   - Add rooms one by one

4. **Task Impact**: *(User selected "Other" - see brief for clarification)*
   - Based on brief: Room-based task generation using three-pillars methodology
   - Tasks tied to specific rooms and pillars
   - Rotation advances sequentially through configured rooms

---

## Gap Analysis: Current vs. Required State

### Database Gaps

**Missing Tables**:
1. Room configuration storage
   - Room type, custom name, has_glass flag, sort order
2. Task rotation/queue storage
   - Generated task list with sequence positions
   - Links to rooms and pillar types
3. Keystone task configuration
   - Which keystones are active
   - Custom names for keystones
4. Task progression tracking
   - Current position in rotation
   - Last generated rotation timestamp

**Schema Changes Needed**:
- New models for rooms, task rotation, keystone tasks, task progress
- Potentially modify `user_streaks` to include room_id and pillar_type for better analytics

### Backend Service Gaps

**Missing Services**:
1. **RoomService** - CRUD for room configurations
2. **TaskGenerationService** - Generate rotation from room config
   - Algorithm to interleave room tasks with keystones
   - Handle glass presence logic
   - Store generated queue
3. **KeystoneService** - Manage keystone task configs
4. **TaskProgressService** - Track current position, advance on completion

**API Endpoint Gaps**:
- Room management endpoints (POST/GET/PUT/DELETE /api/rooms)
- Task generation endpoints (GET /api/tasks/current, POST /api/tasks/regenerate)
- Keystone management endpoints

### Frontend Gaps

**Missing UI Components**:
1. **Onboarding Flow**:
   - Room configuration wizard post-registration
   - Form to add rooms with type, name, has_glass
   - Multi-room addition capability

2. **Settings Page**:
   - Room management (add/edit/delete/reorder)
   - Keystone task configuration
   - Task rotation preview

3. **Task Display Updates**:
   - Replace hardcoded task selection with API call
   - Show room context and pillar type
   - Display progress indicators

**Current Limitations**:
- No settings modal exists (only login/register modals)
- Task fetching is client-side only (no server call)
- No concept of task sequence or rotation

---

## Technical Considerations

### 1. Task Generation Algorithm

**Complexity**:
- Must handle variable room counts
- Insert keystones every 3-5 tasks (configurable interval)
- Skip glass pillar for rooms without mirrors/windows
- Maintain sequence integrity

**Example Pseudocode**:
```
rooms = getUserRooms(userId, orderBy: 'sort_order')
keystones = getActiveKeystoneTasks(userId)
rotation = []
keystoneIndex = 0
tasksSinceLastKeystone = 0

for each room in rooms:
    if room.has_glass:
        rotation.push({type: 'pillar', room: room, pillar: 'glass', description: generateGlassTask(room)})
        tasksSinceLastKeystone++

        if tasksSinceLastKeystone >= random(3,5) and keystoneIndex < keystones.length:
            rotation.push({type: 'keystone', task: keystones[keystoneIndex++]})
            tasksSinceLastKeystone = 0

    rotation.push({type: 'pillar', room: room, pillar: 'surfaces', description: generateSurfacesTask(room)})
    tasksSinceLastKeystone++

    if tasksSinceLastKeystone >= random(3,5) and keystoneIndex < keystones.length:
        rotation.push({type: 'keystone', task: keystones[keystoneIndex++]})
        tasksSinceLastKeystone = 0

    rotation.push({type: 'pillar', room: room, pillar: 'floor', description: generateFloorTask(room)})
    tasksSinceLastKeystone++

saveTaskRotation(userId, rotation)
```

### 2. Migration Strategy

**Existing Users**:
- Currently have streaks tracked by free-form task names
- Need to preserve existing streak data during migration
- Options:
  a) Prompt to configure rooms on next login
  b) Auto-generate default room config (1 living, 1 kitchen, 1 bed, 1 bath)
  c) Maintain backward compatibility (support both old and new task systems)

**Recommended**: Option (c) - Graceful migration
- If user has no rooms configured, continue using old task system
- Show "Configure your home" prompt/banner
- Once configured, switch to new task generation
- Map old task completions to "Legacy Tasks" category for historical data

### 3. Backward Compatibility

**API Changes**:
- Keep existing `POST /api/user/complete` accepting arbitrary taskName
- Add new `GET /api/tasks/current` for rotation-based tasks
- Frontend can use either flow during transition

**Data Integrity**:
- Don't break existing streak tracking
- Old completions remain in `completion_history` with original task_name
- New completions include room_id and pillar_type metadata (if from rotation)

### 4. Performance Considerations

**Task Rotation Generation**:
- Generate full rotation upfront and store (not on-the-fly)
- Regenerate only when room config changes
- Typical rotation size: ~15-30 tasks (3-5 rooms × 2-3 pillars + keystones)
- Minimal storage overhead

**Caching**:
- Cache current task in AppState to reduce API calls
- Prefetch next 3-5 tasks for offline capability

### 5. User Experience

**Onboarding Flow**:
1. User registers account
2. Success message → "Let's set up your home!"
3. Room configuration wizard:
   - "Add a room" button
   - Form: Room type dropdown, Custom name input, "Has mirrors/windows?" checkbox
   - Visual list of added rooms with edit/delete
   - "I'm done" button to finish
4. System generates initial rotation
5. User sees first task

**Settings Flow**:
- Settings button in user header (near logout)
- Modal with tabs:
  - **My Rooms**: List of rooms with edit/delete, "Add Room" button, drag-to-reorder
  - **Keystone Tasks**: Checklist of keystones with enable/disable toggles, custom name inputs
  - **Task Preview**: "Your next 20 tasks" list showing upcoming rotation
- "Save Changes" button regenerates rotation

**Task Display**:
- Primary: Task description (e.g., "Wipe down kitchen countertops")
- Secondary: Context badge (e.g., "Kitchen - Surfaces" or "Keystone Task")
- Progress indicator: "2/3 pillars complete in Kitchen"

---

## Data Model Recommendations

### Proposed New Tables

#### 1. user_rooms
```prisma
model user_rooms {
  id           String   @id @default(uuid())
  user_id      String
  room_type    String   // "living_room", "bedroom", "kitchen", "bathroom", "office", etc.
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

#### 2. user_keystone_tasks
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

#### 3. task_rotation
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
  created_at        DateTime  @default(now())

  users             users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, sequence_position])
  @@index([user_id, sequence_position])
}
```

#### 4. user_task_progress
```prisma
model user_task_progress {
  id                         String    @id @default(uuid())
  user_id                    String    @unique
  current_task_index         Int       @default(1)
  last_completed_task_id     String?
  rotation_generated_at      DateTime  @default(now())
  rotation_version           Int       @default(1)  // Increment on regeneration
  updated_at                 DateTime  @updatedAt

  users                      users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
}
```

### Enhanced completion_history

**Option**: Add optional fields to existing model
```prisma
// Add to existing completion_history model:
room_id       String?   // Link to room if from rotation
pillar_type   String?   // "glass", "surfaces", "floor", or null
task_type     String?   // "pillar" or "keystone"
```

---

## API Design Recommendations

### Room Management Endpoints

```
POST   /api/rooms
  Body: { room_type, custom_name, has_glass }
  Returns: { room: {...} }

GET    /api/rooms
  Returns: { rooms: [{id, room_type, custom_name, has_glass, sort_order}] }

PUT    /api/rooms/:id
  Body: { custom_name?, has_glass?, sort_order? }
  Returns: { room: {...} }

DELETE /api/rooms/:id
  Returns: { success: true, message: "Room deleted" }
  Side effect: Regenerates task rotation

PUT    /api/rooms/reorder
  Body: { room_order: [roomId1, roomId2, ...] }
  Returns: { success: true }
  Side effect: Updates sort_order, regenerates rotation
```

### Keystone Task Endpoints

```
GET    /api/keystone-tasks
  Returns: { keystone_tasks: [{id, task_type, custom_name, is_active, sort_order}] }

PUT    /api/keystone-tasks/:id
  Body: { custom_name?, is_active?, sort_order? }
  Returns: { task: {...} }
  Side effect: May regenerate rotation if is_active changed
```

### Task Rotation Endpoints

```
GET    /api/tasks/current
  Returns: {
    task: {
      id,
      description,
      task_type,  // "pillar" or "keystone"
      room: {name, type},  // If pillar task
      pillar_type,  // If pillar task
      keystone_type,  // If keystone task
      position: 5,
      total_tasks: 28
    }
  }

POST   /api/tasks/regenerate
  Returns: {
    success: true,
    rotation: {total_tasks, version},
    message: "Task rotation regenerated"
  }

GET    /api/tasks/preview?limit=20
  Returns: {
    tasks: [{description, task_type, room, pillar_type, position}],
    current_position: 5
  }
```

### Modified Completion Endpoint

```
POST   /api/user/complete
  Body: {
    taskName,  // Keep for backward compatibility
    completionDate?,
    notes?,
    task_rotation_id?  // Optional: if completing from rotation
  }
  Returns: { success: true, streak: {...}, next_task: {...} }

  Behavior:
  - If task_rotation_id provided: advance rotation, return next task
  - If not: legacy completion (free-form taskName)
```

---

## Testing Requirements

### Backend Unit Tests

**RoomService**:
- Create/read/update/delete rooms
- Reorder rooms
- Validation (custom name length, room types)

**TaskGenerationService**:
- Generate rotation with various room configs
- Handle rooms without glass correctly
- Keystone insertion at proper intervals
- Edge cases:
  - Zero rooms → empty rotation or error
  - Single room
  - No active keystone tasks
  - All rooms without glass

**TaskProgressService**:
- Advance through rotation correctly
- Handle rotation end (cycle back to start)
- Handle rotation version changes (user edited rooms mid-rotation)

### Backend Integration Tests

- Complete flow: Create rooms → Generate rotation → Complete tasks → Advance → Verify sequence
- Regeneration triggers: Add/remove room, change glass setting, reorder
- Migration: User with old data configures rooms → rotation generated → old streaks preserved

### Frontend Tests

- Onboarding wizard flow
- Room configuration CRUD in settings
- Task fetching and display
- Offline handling for room configuration changes
- Migration prompt for existing users without rooms

---

## Open Questions & Decisions Needed

1. **Rotation Cycling**: When user completes all tasks in rotation, should it:
   - Loop back to start (infinite cycle)?
   - Regenerate with new keystone order for variety?
   - Prompt user to review room config?

2. **Dynamic Keystones**: Should keystone frequency be user-configurable (every 2-6 tasks)?

3. **Room Templates**: Despite user preferring no presets, should we offer optional quick-start templates (Studio, 1BR, 2BR, 3BR) for convenience?

4. **Task Descriptions**: Who writes the actual task text?
   - Hardcoded templates per pillar type? (e.g., "Wipe down {room} countertops")
   - AI-generated based on room type?
   - User-editable per room?

5. **Streak Tracking**: In new system, should streaks be:
   - Per room-pillar combo? (e.g., "Kitchen surfaces" streak)
   - Per room? (e.g., "Kitchen" streak)
   - Overall app streak only?
   - All of the above with different analytics?

6. **Multiple Rooms of Same Type**: User has 3 bedrooms - how to differentiate?
   - Rely on custom names ("Master Bedroom", "Guest Bedroom", "Kids Room")
   - Room numbering ("Bedroom 1", "Bedroom 2")?

7. **Rotation Regeneration UX**: When user changes rooms mid-rotation:
   - Immediate regeneration (current task changes)?
   - Complete current cycle first, then apply changes?
   - Prompt user to choose?

8. **Historical Data**: For completions before room config:
   - Display as "Legacy Tasks"?
   - Attempt to map to new rooms based on task name keywords?
   - Keep separate in UI?

---

## Technical Dependencies

### Backend
- Prisma migration tools (schema changes)
- UUID generation for IDs
- Existing StreakService (integrate with new task progression)

### Frontend
- No new external dependencies identified
- Can use existing modal/form patterns from auth UI
- Drag-and-drop library for room reordering (optional enhancement)

### DevOps
- Database migration scripts
- Seed data for default keystone tasks
- Backward compatibility testing harness

---

## Risk Assessment

### Low Risk
- Database schema additions (non-breaking, additive only)
- New API endpoints (don't affect existing functionality)
- Backward compatibility (can maintain both systems in parallel)

### Medium Risk
- Migration strategy complexity (ensuring no data loss)
- Task generation algorithm bugs (could produce poor rotation sequences)
- User confusion during transition (need clear onboarding)

### High Risk
- None identified (feature is additive, not replacing core functionality)

---

## Success Metrics

### Technical Metrics
- Task rotation generation time < 100ms for typical config (3-5 rooms)
- Zero data loss during migration
- API response times unchanged (room config cached in memory)

### User Metrics
- % of users who complete room configuration during onboarding
- Average number of rooms configured per user
- Reduction in "generic" task complaints (measure via feedback/support tickets)
- Task completion rate before/after personalization

---

## Recommended Next Steps

1. **Validate Open Questions** - Clarify decisions with stakeholder/user
2. **Finalize Database Schema** - Lock down table structures
3. **Create Migration Plan** - Document step-by-step migration for existing users
4. **Prototype Task Generation Algorithm** - Validate logic with sample data
5. **Design UI Mockups** - Visualize onboarding and settings flows
6. **Estimate Implementation** - Break into sprint-sized chunks
7. **Create Implementation Plan** - Sequence work (backend → API → frontend)

---

## Appendix: Code References

- **Database Schema**: `backend/prisma/schema.prisma`
- **Task Completion Logic**: `backend/src/controllers/userController.js:130-209` (completeTask method)
- **Streak Service**: `backend/src/services/streakService.js`
- **Frontend Task System**: `index.html:736-787` (cleaningTasks array), `index.html:1906-1910` (getTodaysTask)
- **Frontend Completion**: `index.html:1938-2004` (completeTask function)
- **API Routes**: `backend/src/routes/user.js`
- **Three-Pillars Brief**: `three-pillars-task-generation-brief.md`
