# Frontend State Management Design

**Phase**: 2.1 Frontend Architecture Enhancement
**Step**: 21
**Status**: Design Complete

## Executive Summary

This document defines the enhanced state management system that will support both anonymous and authenticated users while preserving the existing zero-friction UX. The design prioritizes:
1. **Backward Compatibility**: Anonymous mode behaves identically to current version
2. **Progressive Disclosure**: Authentication features remain hidden until contextually appropriate
3. **Offline-First**: Full functionality without server dependency
4. **Seamless Transitions**: State preservation when upgrading from anonymous to authenticated

## Current vs. Enhanced State

### Current State (In-Memory Only)
```javascript
let currentStreak = 0;
let lastCompletedDate = null;
```

**Problems**:
- Lost on page refresh
- No user identification
- Cannot sync across devices
- No historical data

### Enhanced State Structure
```javascript
const AppState = {
    // ============================================
    // CORE STATE (Existing + Enhanced)
    // ============================================
    streak: {
        current: 0,                     // Current streak count
        lastCompletedDate: null,        // ISO date string of last completion
        bestStreak: 0,                  // All-time best streak
        history: []                     // Array of completion dates (last 90 days)
    },

    task: {
        text: "",                       // Today's task text
        date: null,                     // Task date (ISO string)
        completed: false                // Completion status for today
    },

    // ============================================
    // USER STATE (New)
    // ============================================
    user: {
        isAuthenticated: false,         // Authentication status
        profile: null,                  // User profile object or null
        // profile structure when authenticated:
        // {
        //     id: string,
        //     email: string,
        //     createdAt: string,
        //     preferences: object
        // }
    },

    // ============================================
    // SYNC STATE (New)
    // ============================================
    sync: {
        status: 'idle',                 // 'idle' | 'syncing' | 'error'
        lastSyncTime: null,             // ISO timestamp of last successful sync
        error: null,                    // Last error object or null
        pendingChanges: false,          // Has unsaved local changes
        offlineQueue: []                // Queue of actions to sync when online
        // offlineQueue item structure:
        // {
        //     action: 'COMPLETE_TASK' | 'UPDATE_PROFILE',
        //     payload: object,
        //     timestamp: string,
        //     retryCount: number
        // }
    },

    // ============================================
    // NETWORK STATE (New)
    // ============================================
    network: {
        isOnline: true,                 // Online/offline status
        apiBaseUrl: 'http://localhost:3000/api',  // API endpoint
        requestTimeout: 10000           // Request timeout in ms
    },

    // ============================================
    // UI STATE (New)
    // ============================================
    ui: {
        authModalVisible: false,        // Show/hide auth modal
        authModalMode: 'login',         // 'login' | 'register'
        loadingVisible: false,          // Show/hide loading spinner
        notificationVisible: false,     // Show/hide notification
        notificationMessage: '',        // Notification text
        notificationType: 'info'        // 'info' | 'success' | 'error'
    },

    // ============================================
    // ENGAGEMENT TRACKING (New)
    // ============================================
    engagement: {
        totalCompletions: 0,            // All-time completion count
        consecutiveDays: 0,             // Days completed in current streak
        firstVisit: null,               // ISO timestamp of first visit
        lastVisit: null,                // ISO timestamp of last visit
        visitCount: 0,                  // Total number of visits
        hasSeenAuthPrompt: false,       // Auth prompt shown flag
        dismissedAuthPromptCount: 0     // Times user dismissed auth prompt
    }
};
```

## State Persistence Strategy

### Dual-Mode Persistence

#### Anonymous Mode (localStorage)
```javascript
// Storage Key: 'cleanStreak_anonymous_state'
const anonymousState = {
    streak: AppState.streak,
    engagement: AppState.engagement,
    lastSyncTime: Date.now()
};
localStorage.setItem('cleanStreak_anonymous_state', JSON.stringify(anonymousState));
```

**Advantages**:
- Works offline
- No registration required
- Instant persistence
- Same device continuity

**Limitations**:
- Single device only
- Lost if browser data cleared
- No cross-browser sync

#### Authenticated Mode (API + localStorage Cache)
```javascript
// Storage Key: 'cleanStreak_authenticated_state'
const authenticatedState = {
    user: AppState.user,
    streak: AppState.streak,
    engagement: AppState.engagement,
    lastSyncTime: Date.now(),
    sessionToken: 'jwt_token_here'  // Stored separately in httpOnly cookie
};
localStorage.setItem('cleanStreak_authenticated_state', JSON.stringify(authenticatedState));
```

**Primary Source**: Backend API
**Cache**: localStorage (for offline access and faster initial load)
**Sync Trigger**: On load, after completion, every 5 minutes (if changes)

**Advantages**:
- Cross-device sync
- Persistent across browser data clears
- Historical data preservation
- Account recovery

## State Transition Flows

### 1. Anonymous to Authenticated (Registration/Login)

```javascript
// Before: Anonymous user with local streak of 7 days
AppState = {
    streak: { current: 7, lastCompletedDate: '2025-10-01', history: [...] },
    user: { isAuthenticated: false, profile: null }
};

// User registers/logs in
await registerOrLogin(email, password);

// After: Authenticated user with migrated data
AppState = {
    streak: {
        current: 7,              // Preserved from anonymous state
        lastCompletedDate: '2025-10-01',
        history: [...]           // Merged with any existing server data
    },
    user: {
        isAuthenticated: true,
        profile: { id: 'user123', email: 'user@example.com', ... }
    }
};

// Server receives migration request
POST /api/user/migrate-anonymous-data
Body: { anonymousState: { streak: {...}, engagement: {...} } }

// Server merges data intelligently:
// - Keeps higher streak value
// - Merges completion history (no duplicates)
// - Updates engagement metrics
```

### 2. Page Load State Hydration

```javascript
async function initializeApp() {
    // 1. Check authentication status (check session cookie)
    const isAuthenticated = await checkAuthStatus();

    if (isAuthenticated) {
        // 2a. Authenticated: Load from API (with localStorage fallback)
        try {
            const serverState = await api.user.getProfile();
            AppState.streak = serverState.streak;
            AppState.user = serverState.user;

            // Cache in localStorage
            localStorage.setItem('cleanStreak_authenticated_state', JSON.stringify(AppState));
        } catch (error) {
            // Offline or API error: Load from localStorage cache
            const cachedState = localStorage.getItem('cleanStreak_authenticated_state');
            if (cachedState) {
                Object.assign(AppState, JSON.parse(cachedState));
                AppState.sync.status = 'error';
                AppState.sync.error = error;
            }
        }
    } else {
        // 2b. Anonymous: Load from localStorage only
        const anonymousState = localStorage.getItem('cleanStreak_anonymous_state');
        if (anonymousState) {
            Object.assign(AppState, JSON.parse(anonymousState));
        }
        // else: first visit, use default state
    }

    // 3. Update UI based on loaded state
    updateDisplay();
}
```

### 3. Task Completion Flow

```javascript
async function completeTask() {
    const todayString = getTodayString();

    // 1. Update local state immediately (optimistic update)
    updateLocalStreakState(todayString);
    updateDisplay();  // UI reflects change instantly

    // 2. Persist locally
    saveStateToLocalStorage();

    // 3. Sync with server (if authenticated and online)
    if (AppState.user.isAuthenticated && AppState.network.isOnline) {
        try {
            await api.tasks.complete({
                date: todayString,
                taskText: AppState.task.text
            });
            AppState.sync.lastSyncTime = new Date().toISOString();
        } catch (error) {
            // 4. Queue for later sync if API call fails
            AppState.sync.offlineQueue.push({
                action: 'COMPLETE_TASK',
                payload: { date: todayString, taskText: AppState.task.text },
                timestamp: new Date().toISOString(),
                retryCount: 0
            });
            AppState.sync.pendingChanges = true;
        }
    }
}
```

### 4. Conflict Resolution

When local and server state diverge (e.g., user completes task on Device A, then opens Device B before sync):

```javascript
async function resolveConflict(localState, serverState) {
    const resolved = {
        streak: {},
        engagement: {}
    };

    // Rule 1: Server wins for historical data (source of truth)
    resolved.streak.history = serverState.streak.history;

    // Rule 2: Higher streak value wins
    resolved.streak.current = Math.max(
        localState.streak.current,
        serverState.streak.current
    );

    // Rule 3: Most recent completion date wins
    const localDate = new Date(localState.streak.lastCompletedDate);
    const serverDate = new Date(serverState.streak.lastCompletedDate);
    resolved.streak.lastCompletedDate = localDate > serverDate
        ? localState.streak.lastCompletedDate
        : serverState.streak.lastCompletedDate;

    // Rule 4: Merge engagement metrics (sum totals)
    resolved.engagement.totalCompletions =
        localState.engagement.totalCompletions +
        serverState.engagement.totalCompletions;

    // Rule 5: Keep earliest first visit
    const localFirst = new Date(localState.engagement.firstVisit);
    const serverFirst = new Date(serverState.engagement.firstVisit);
    resolved.engagement.firstVisit = localFirst < serverFirst
        ? localState.engagement.firstVisit
        : serverState.engagement.firstVisit;

    return resolved;
}
```

## State Update Functions

### Core State Mutators

```javascript
// 1. Update streak state (existing logic + enhancements)
function updateLocalStreakState(todayString) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();

    // Existing logic
    if (AppState.streak.lastCompletedDate === yesterdayString ||
        AppState.streak.current === 0) {
        AppState.streak.current++;
    } else {
        AppState.streak.current = 1;
    }

    // New: Update history
    if (!AppState.streak.history.includes(todayString)) {
        AppState.streak.history.push(todayString);
    }

    // New: Update best streak
    if (AppState.streak.current > AppState.streak.bestStreak) {
        AppState.streak.bestStreak = AppState.streak.current;
    }

    AppState.streak.lastCompletedDate = todayString;
    AppState.engagement.totalCompletions++;
}

// 2. Save state to localStorage
function saveStateToLocalStorage() {
    const storageKey = AppState.user.isAuthenticated
        ? 'cleanStreak_authenticated_state'
        : 'cleanStreak_anonymous_state';

    const stateToSave = AppState.user.isAuthenticated
        ? {
            user: AppState.user,
            streak: AppState.streak,
            engagement: AppState.engagement,
            lastSyncTime: new Date().toISOString()
          }
        : {
            streak: AppState.streak,
            engagement: AppState.engagement,
            lastSyncTime: new Date().toISOString()
          };

    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
}

// 3. Load state from localStorage
function loadStateFromLocalStorage() {
    // Try authenticated state first
    let cachedState = localStorage.getItem('cleanStreak_authenticated_state');
    let isAuthenticated = false;

    if (!cachedState) {
        // Fall back to anonymous state
        cachedState = localStorage.getItem('cleanStreak_anonymous_state');
    } else {
        isAuthenticated = true;
    }

    if (cachedState) {
        try {
            const parsed = JSON.parse(cachedState);

            // Deep merge to avoid overwriting nested objects
            if (parsed.streak) Object.assign(AppState.streak, parsed.streak);
            if (parsed.engagement) Object.assign(AppState.engagement, parsed.engagement);
            if (parsed.user) Object.assign(AppState.user, parsed.user);

            return true;
        } catch (error) {
            console.error('Failed to parse cached state:', error);
            return false;
        }
    }

    return false;
}

// 4. Clear state (logout)
function clearState() {
    // Clear authenticated state
    localStorage.removeItem('cleanStreak_authenticated_state');

    // Reset to default state
    AppState.user = { isAuthenticated: false, profile: null };
    AppState.sync = {
        status: 'idle',
        lastSyncTime: null,
        error: null,
        pendingChanges: false,
        offlineQueue: []
    };

    // Keep anonymous streak data (don't clear anonymous_state key)
    // User can continue as anonymous after logout
}
```

## Progressive Disclosure Rules

### When to Show Authentication Prompts

```javascript
function shouldShowAuthPrompt() {
    // Never show if already authenticated
    if (AppState.user.isAuthenticated) return false;

    // Never show if user has dismissed 3+ times
    if (AppState.engagement.dismissedAuthPromptCount >= 3) return false;

    // Show after 3 completions
    if (AppState.engagement.totalCompletions >= 3 &&
        !AppState.engagement.hasSeenAuthPrompt) {
        return true;
    }

    // Show after 7-day streak
    if (AppState.streak.current >= 7 &&
        !AppState.engagement.hasSeenAuthPrompt) {
        return true;
    }

    // Show after 30 days of usage
    const daysSinceFirst = calculateDaysSince(AppState.engagement.firstVisit);
    if (daysSinceFirst >= 30 &&
        !AppState.engagement.hasSeenAuthPrompt) {
        return true;
    }

    return false;
}

// Check engagement after task completion
function checkEngagementAndPrompt() {
    if (shouldShowAuthPrompt()) {
        // Show non-intrusive prompt
        showAuthPrompt({
            title: "Save your progress!",
            message: "You've built a great streak! Create an account to sync across devices.",
            primaryAction: "Create Account",
            secondaryAction: "Maybe Later",
            onDismiss: () => {
                AppState.engagement.dismissedAuthPromptCount++;
                AppState.engagement.hasSeenAuthPrompt = true;
                saveStateToLocalStorage();
            }
        });
    }
}
```

## Sync Strategy

### Background Sync Schedule

```javascript
// Sync triggers:
// 1. On page load (if authenticated)
// 2. After task completion (if authenticated)
// 3. Every 5 minutes (if authenticated and pendingChanges)
// 4. When coming back online (process offline queue)

let syncInterval = null;

function startBackgroundSync() {
    if (!AppState.user.isAuthenticated) return;

    // Sync every 5 minutes if there are pending changes
    syncInterval = setInterval(async () => {
        if (AppState.sync.pendingChanges && AppState.network.isOnline) {
            await syncWithServer();
        }
    }, 5 * 60 * 1000);  // 5 minutes
}

function stopBackgroundSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

async function syncWithServer() {
    if (!AppState.user.isAuthenticated || !AppState.network.isOnline) {
        return;
    }

    AppState.sync.status = 'syncing';

    try {
        // 1. Process offline queue first
        await processOfflineQueue();

        // 2. Get latest server state
        const serverState = await api.user.getProfile();

        // 3. Check for conflicts
        if (hasConflict(AppState, serverState)) {
            const resolved = await resolveConflict(AppState, serverState);
            Object.assign(AppState.streak, resolved.streak);
            Object.assign(AppState.engagement, resolved.engagement);

            // Push resolved state back to server
            await api.user.updateProfile({
                streak: AppState.streak,
                engagement: AppState.engagement
            });
        } else {
            // No conflict, use server state as source of truth
            Object.assign(AppState.streak, serverState.streak);
            Object.assign(AppState.engagement, serverState.engagement);
        }

        AppState.sync.status = 'idle';
        AppState.sync.lastSyncTime = new Date().toISOString();
        AppState.sync.pendingChanges = false;
        AppState.sync.error = null;

        // Update localStorage cache
        saveStateToLocalStorage();

    } catch (error) {
        AppState.sync.status = 'error';
        AppState.sync.error = error;
        console.error('Sync failed:', error);
    }
}

async function processOfflineQueue() {
    const queue = [...AppState.sync.offlineQueue];  // Copy to avoid mutation issues
    AppState.sync.offlineQueue = [];  // Clear queue

    for (const item of queue) {
        try {
            switch (item.action) {
                case 'COMPLETE_TASK':
                    await api.tasks.complete(item.payload);
                    break;
                case 'UPDATE_PROFILE':
                    await api.user.updateProfile(item.payload);
                    break;
                // Add other action types as needed
            }
        } catch (error) {
            // Re-queue if retry count < 3
            if (item.retryCount < 3) {
                AppState.sync.offlineQueue.push({
                    ...item,
                    retryCount: item.retryCount + 1
                });
            } else {
                console.error('Failed to sync action after 3 retries:', item);
            }
        }
    }
}
```

## Online/Offline Handling

```javascript
// Monitor network status
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

function handleOnline() {
    AppState.network.isOnline = true;

    // Immediately sync if authenticated and has pending changes
    if (AppState.user.isAuthenticated && AppState.sync.pendingChanges) {
        syncWithServer();
    }

    // Show notification
    showNotification('Back online! Syncing your data...', 'success');
}

function handleOffline() {
    AppState.network.isOnline = false;

    // Show notification
    showNotification('You\'re offline. Changes will sync when reconnected.', 'info');
}
```

## Implementation Checklist

### Phase 2.1 (Steps 19-21) - COMPLETED ✅
- [x] Backup original frontend
- [x] Analyze current structure
- [x] Design state management system

### Phase 2.2 (Steps 22-24) - HTML/CSS
- [ ] Add authentication modal HTML structure
- [ ] Style authentication components
- [ ] Add user header component

### Phase 2.3 (Steps 25-27) - JavaScript Core
- [ ] Implement API communication layer
- [ ] Refactor state management to use AppState object
- [ ] Add authentication logic (register, login, logout)

### Phase 2.4 (Steps 28-30) - Sync Layer
- [ ] Implement data sync functions
- [ ] Add conflict resolution logic
- [ ] Implement offline queue and background sync

### Phase 2.5 (Steps 31-33) - Progressive Disclosure
- [ ] Add engagement-based auth prompts
- [ ] Create smooth transition animations
- [ ] Preserve and test core task completion flow

### Phase 2.6 (Steps 34-36) - Testing
- [ ] Test anonymous user experience (feature parity)
- [ ] Test authentication flow (register, login, logout)
- [ ] Test data synchronization (online, offline, conflicts)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Anonymous UX Parity | 100% | All existing features work identically |
| Auth Prompt Intrusion | <5% | Auth prompt shown max once per 3 sessions |
| Login/Register Time | <3s | From click to authenticated state |
| Sync Time | <500ms | Background sync completion time |
| Offline Queue Size | <100 items | Max items before warning user |
| Conflict Rate | <1% | Conflicts per sync operation |
| State Loss Rate | 0% | Data loss on page refresh/logout |

## Next Steps

**Immediate**: Proceed to Step 22 - Create Authentication Modal HTML Structure
**Dependencies**: None (design complete)
**Estimated Time**: Steps 22-27 (~4-6 hours), Steps 28-36 (~6-8 hours)
