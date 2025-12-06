# End-to-End Testing Checklist

**Phase 2 Testing Suite**
**Date Created**: 2025-10-18
**Test Environment**:
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:8000/index.html`
- Browser: Chrome/Firefox/Safari (recommend Chrome DevTools for network inspection)

---

## Testing Environment Status

### Backend API Test Results
- **Total Tests**: 174
- **Passed**: 140 (80%)
- **Failed**: 34 (20%)
- **Test Suites**: 6 total (2 passed, 4 failed)
- **Status**: ⚠️ **Requires Investigation** - Some test failures need review

### Servers Running
- [x] Backend API Server (Port 3000)
- [x] Python HTTP Server (Port 8000)
- [x] Database Connection (SQLite - dev.db)

---

## Phase 2.6: Frontend Testing and Validation

## Step 34: Anonymous User Experience Testing

**Objective**: Verify all existing functionality works without authentication (100% feature parity with original application)

### Pre-Test Setup
- [ ] Open browser in **Incognito/Private mode** (clean slate)
- [ ] Open DevTools (F12):
  - Network tab (monitor API calls)
  - Console tab (check for errors)
  - Application > Local Storage (monitor state)
- [ ] Navigate to `http://localhost:8000/index.html`

### 34.1: Initial Page Load (Anonymous Mode)
- [ ] Page loads in <500ms
- [ ] No JavaScript errors in console
- [ ] Header shows "Guest" status badge
- [ ] "Sign In" button visible in header
- [ ] No authentication modal shown (progressive disclosure)
- [ ] Today's cleaning task displayed
- [ ] Streak counter shows 0 (initial state)
- [ ] "Complete Today's Task" button visible and enabled

**localStorage Check**:
```javascript
localStorage.getItem('cleanStreak_appState')
// Should return null or contain anonymous state only
```

### 34.2: Task Completion (Anonymous)
- [ ] Click "Complete Today's Task" button
- [ ] Celebration animation appears (confetti/visual feedback)
- [ ] Streak counter increments to 1
- [ ] New task appears for tomorrow
- [ ] Button changes to show tomorrow's date
- [ ] Completion notification appears (if implemented)

**localStorage Check**:
```javascript
JSON.parse(localStorage.getItem('cleanStreak_appState'))
// Should show:
// - streak.current: 1
// - streak.lastCompletedDate: today's date
// - task.completed: true
```

**Network Tab Check**:
- [ ] NO API calls to backend (anonymous mode is fully client-side)
- [ ] State persists only in localStorage

### 34.3: Page Refresh Persistence (Anonymous)
- [ ] Refresh the page (F5 or Cmd+R)
- [ ] Streak counter still shows 1
- [ ] Completed status preserved
- [ ] No data loss
- [ ] localStorage state intact

**Verify**:
```javascript
JSON.parse(localStorage.getItem('cleanStreak_appState')).streak.current === 1
```

### 34.4: Multiple Day Simulation (Anonymous)
**Manual Date Manipulation**:
```javascript
// In console, simulate passage of time
let state = JSON.parse(localStorage.getItem('cleanStreak_appState'));
state.streak.lastCompletedDate = '2025-10-17'; // Yesterday
localStorage.setItem('cleanStreak_appState', JSON.stringify(state));
location.reload();
```

- [ ] After setting date to yesterday, button becomes enabled
- [ ] Click "Complete Today's Task"
- [ ] Streak increments to 2
- [ ] No API calls made

**Streak Break Simulation**:
```javascript
// Simulate 2-day gap (streak should break)
let state = JSON.parse(localStorage.getItem('cleanStreak_appState'));
state.streak.lastCompletedDate = '2025-10-15'; // 3 days ago
localStorage.setItem('cleanStreak_appState', JSON.stringify(state));
location.reload();
```

- [ ] Streak resets to 0
- [ ] Can complete task again
- [ ] New streak starts from 1

### 34.5: Progressive Disclosure Rules (Anonymous)
**Test engagement-based auth prompts** (if Step 31 is complete):

After 3 completions:
- [ ] Complete task 3 times (use date manipulation)
- [ ] Check if subtle auth prompt appears
- [ ] Prompt should be non-intrusive
- [ ] App remains fully functional without signing in

After 7-day streak:
- [ ] Simulate 7-day streak
- [ ] Check for enhanced auth prompt
- [ ] Verify streak benefits messaging

### 34.6: Mobile Responsiveness (Anonymous)
- [ ] Resize browser to mobile width (375px)
- [ ] UI adapts to small screen
- [ ] All buttons remain accessible
- [ ] Text remains readable
- [ ] No horizontal scrolling

---

## Step 35: Authentication Flow Testing

**Objective**: Test registration, login, logout, and session management (<3 second completion)

### Pre-Test Cleanup
```javascript
// Clear all state
localStorage.clear();
sessionStorage.clear();
// Delete all cookies in Application > Cookies
location.reload();
```

### 35.1: Registration Flow
**Start Timer** ⏱️

- [ ] Click "Sign In" button in header
- [ ] Authentication modal appears with fade-in animation
- [ ] Modal shows "Login" tab by default
- [ ] Click "Create account" link to switch to register form

**Registration Form Validation**:
- [ ] Try submitting empty form → validation errors shown
- [ ] Enter invalid email → validation error
- [ ] Enter password <6 characters → validation error
- [ ] Enter mismatched password confirmation → validation error

**Valid Registration**:
- [ ] Email: `test-user-${Date.now()}@example.com`
- [ ] Password: `SecurePass123!`
- [ ] Password Confirm: `SecurePass123!`
- [ ] Submit form

**Network Tab** (watch for API calls):
- [ ] POST to `/api/auth/register` sent
- [ ] Request includes email and password
- [ ] Response status: 201 Created
- [ ] Response includes success message

**UI Updates**:
- [ ] Modal closes automatically
- [ ] Header updates to show "Authenticated" status
- [ ] User email displayed in header
- [ ] "Sign Out" button appears
- [ ] Success notification appears

**End Timer** ⏱️ - Should be <3 seconds from form submit

**Session Check**:
```javascript
// Check Application > Cookies
document.cookie // Should contain 'connect.sid' or auth cookie
```

### 35.2: Anonymous Data Migration
**Scenario**: User has anonymous streak, then registers

**Setup**:
```javascript
// Clear everything and create anonymous streak
localStorage.clear();
sessionStorage.clear();
location.reload();
// Complete task 3 times (use date manipulation)
// Verify streak = 3 in anonymous mode
```

**Register with Account**:
- [ ] Click "Sign In" → "Create account"
- [ ] Register with new email
- [ ] Submit registration

**Verify Migration**:
- [ ] Anonymous streak (3) is preserved
- [ ] POST to `/api/user/tasks/complete` includes current streak
- [ ] Server state updated with migrated data
- [ ] No data loss during transition

**Network Tab**:
- [ ] Check for `migrateAnonymousData()` related calls
- [ ] Verify sync happens after registration

### 35.3: Login Flow
**Logout First**:
- [ ] Click "Sign Out" button
- [ ] Confirmation prompt (if any)
- [ ] Header returns to "Guest" status
- [ ] Cookies cleared

**Login with Existing Account**:
- [ ] Click "Sign In"
- [ ] Enter registered email
- [ ] Enter password
- [ ] Submit form

**Network Tab**:
- [ ] POST to `/api/auth/login`
- [ ] Response status: 200 OK
- [ ] Auth cookie set

**UI Updates**:
- [ ] Modal closes
- [ ] Header shows "Authenticated"
- [ ] User email displayed
- [ ] Previous streak data loaded from server

### 35.4: Session Persistence
- [ ] Login successfully
- [ ] Refresh page (F5)
- [ ] User remains logged in
- [ ] Header shows authenticated state
- [ ] No login required

**Network Tab on Reload**:
- [ ] GET to `/api/auth/session` or session check endpoint
- [ ] Session restored from cookie

### 35.5: Login Error Handling
**Invalid Credentials**:
- [ ] Logout
- [ ] Try login with wrong password
- [ ] Error message displayed: "Invalid credentials"
- [ ] Modal remains open
- [ ] Form not cleared (user can retry)

**Network Issues** (simulate):
```javascript
// In DevTools: Network > Offline checkbox
```
- [ ] Enable offline mode
- [ ] Try to login
- [ ] Error message: "Network error" or similar
- [ ] User-friendly error handling

---

## Step 36: Data Synchronization Testing

**Objective**: Verify data sync works correctly in various network conditions (Phase 2.4 features)

### Pre-Test Setup
- [ ] Login with authenticated account
- [ ] Clear any existing sync queue
- [ ] Ensure backend server is running
- [ ] DevTools Console open (watch sync logs)

### 36.1: Initial Sync on Login
- [ ] Logout completely
- [ ] Login again
- [ ] Watch Network tab

**Expected Sync Calls**:
- [ ] GET `/api/user/profile`
- [ ] GET `/api/user/streaks`
- [ ] GET `/api/user/history`
- [ ] All complete within 2 seconds

**Console Logs**:
- [ ] `syncWithServer()` called
- [ ] `fetchServerData()` executed
- [ ] `mergeServerDataIntoLocalState()` completed

### 36.2: Task Completion Sync (Online)
- [ ] Complete today's task (if not already done)
- [ ] Watch Network tab

**Expected**:
- [ ] POST to `/api/user/tasks/complete`
- [ ] Request body includes task completion data
- [ ] Response status: 200 or 201
- [ ] localStorage updated
- [ ] Success notification shown

**State Consistency**:
```javascript
// Check both states match
let localState = JSON.parse(localStorage.getItem('cleanStreak_appState'));
// Compare with server response
```

### 36.3: Background Sync (Authenticated)
**Verify Background Sync Running**:
```javascript
// Check in console after login
// Should see sync interval started
```

- [ ] Login and wait 5 minutes
- [ ] Watch Network tab for periodic sync calls
- [ ] GET requests every ~5 minutes
- [ ] Sync happens in background without UI interruption

**Console Logs**:
- [ ] "Background sync started" message
- [ ] Periodic sync logs every 5 minutes

### 36.4: Offline Functionality Testing

#### Offline Detection
- [ ] Enable DevTools Offline mode (Network > Offline checkbox)
- [ ] Watch for UI changes

**Expected UI Updates**:
- [ ] Offline banner appears (top-right)
- [ ] Connection status badge shows "Offline" (red dot)
- [ ] Notification: "You are offline"

#### Offline Task Completion
- [ ] While offline, try to complete a task
- [ ] Watch console and localStorage

**Expected Behavior**:
- [ ] Task completion works locally
- [ ] Notification: "Task saved locally. Will sync when online."
- [ ] Action added to offline queue
- [ ] Sync queue indicator shows "1 action pending"

**Verify Queue**:
```javascript
let state = JSON.parse(localStorage.getItem('cleanStreak_appState'));
console.log(state.sync.offlineQueue);
// Should contain 1 COMPLETE_TASK action
```

#### Offline Reconnection
- [ ] Disable offline mode (Network > Online)
- [ ] Watch automatic sync process

**Expected Behavior**:
- [ ] `handleOnline()` triggered
- [ ] Offline banner disappears
- [ ] Connection status → "Online" (green dot)
- [ ] Automatic queue processing starts
- [ ] POST to `/api/user/tasks/complete` sent
- [ ] Success notification: "All changes synced successfully!"
- [ ] Sync queue indicator disappears

**Console Logs**:
- [ ] "Reconnected to server"
- [ ] "Processing offline queue"
- [ ] "Offline queue processed successfully"

### 36.5: Conflict Resolution Testing

**Scenario**: Local and server data differ

**Setup** (requires 2 browser windows/tabs):

**Window 1** (Desktop):
1. [ ] Login with account
2. [ ] Complete task (streak → 5)
3. [ ] Keep window open

**Window 2** (Mobile simulation):
1. [ ] Login with same account
2. [ ] Complete additional task (streak → 6 on server)
3. [ ] Close window

**Back to Window 1**:
- [ ] Wait for background sync (~5 minutes) OR manually trigger sync
- [ ] Watch console for conflict detection

**Expected Conflict Resolution**:
```javascript
// Console should show:
// "Conflict detected between local and server state"
// "Applying conflict resolution rules..."
```

**Resolution Rules** (from design):
- [ ] Server streak value (6) wins over local (5)
- [ ] localStorage updated to match server
- [ ] UI updates to show streak = 6
- [ ] Resolved state pushed back to server

**Verify**:
```javascript
JSON.parse(localStorage.getItem('cleanStreak_appState')).streak.current === 6
```

### 36.6: Retry Logic and Error Handling

**Simulate Network Error**:
```javascript
// Stop the backend server temporarily
// Or use DevTools to throttle/block specific requests
```

- [ ] Complete a task
- [ ] Watch retry attempts in console

**Expected**:
- [ ] Action added to offline queue
- [ ] Retry attempts logged (max 3)
- [ ] Error notification shown
- [ ] Queue preserved for next reconnection

**Restart Backend**:
- [ ] Backend comes back online
- [ ] Automatic retry or manual sync trigger
- [ ] Queue successfully processed

### 36.7: Server Connectivity Monitoring

**Logged In Users Only**:
- [ ] Login to account
- [ ] Watch console for connectivity pings

**Expected**:
- [ ] GET `/api/health` every 30 seconds
- [ ] Console: "Server connectivity check"
- [ ] No UI interruption

**Simulate Server Unavailable**:
- [ ] Stop backend server
- [ ] Wait for next ping (30 seconds)
- [ ] Offline indicators appear
- [ ] App continues to function locally

---

## Additional Test Scenarios

### Edge Cases

#### Rapid Task Completion Spam
- [ ] Click task completion button rapidly 5+ times
- [ ] Only 1 completion should register
- [ ] No duplicate API calls
- [ ] Button disabled during processing

#### Long Session Duration
- [ ] Login and leave tab open for 1+ hour
- [ ] Verify session doesn't expire unexpectedly
- [ ] Background sync continues
- [ ] No memory leaks (DevTools Memory profiler)

#### Multiple Tabs/Windows
- [ ] Open app in 2+ tabs while logged in
- [ ] Complete task in Tab 1
- [ ] Switch to Tab 2
- [ ] Refresh Tab 2
- [ ] Both tabs show synchronized state

#### Storage Quota
```javascript
// Test localStorage limit handling
try {
  localStorage.setItem('cleanStreak_appState', 'x'.repeat(10000000));
} catch(e) {
  console.log('Storage limit error handled:', e);
}
```
- [ ] App handles storage quota errors gracefully
- [ ] Error notification shown
- [ ] App continues to function

### Performance Testing

#### Page Load Time
- [ ] Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] DevTools Performance tab recording
- [ ] Page interactive in <500ms
- [ ] All CSS/JS loaded

#### API Response Time
- [ ] Check Network tab waterfall
- [ ] All API calls <1 second
- [ ] Sync operations <2 seconds
- [ ] No bottlenecks

#### Memory Usage
- [ ] Open DevTools Memory profiler
- [ ] Take heap snapshot
- [ ] Use app for 10 minutes
- [ ] Take another snapshot
- [ ] Compare: no significant memory growth

---

## Browser Compatibility

### Chrome/Edge (Chromium)
- [ ] All features work
- [ ] Console clean (no errors)
- [ ] Animations smooth

### Firefox
- [ ] All features work
- [ ] Cookie handling correct
- [ ] localStorage works

### Safari
- [ ] All features work
- [ ] No CORS issues
- [ ] Cookie third-party restrictions handled

---

## Test Summary Template

### Test Results
**Date**: _______________
**Tester**: _______________
**Browser**: _______________

| Test Area | Total Checks | Passed | Failed | Notes |
|-----------|--------------|--------|--------|-------|
| Step 34: Anonymous UX | 20 | __ | __ | |
| Step 35: Authentication | 18 | __ | __ | |
| Step 36: Data Sync | 25 | __ | __ | |
| Edge Cases | 8 | __ | __ | |
| Performance | 4 | __ | __ | |
| Browser Compat | 3 | __ | __ | |
| **TOTAL** | **78** | __ | __ | |

### Issues Found
1.
2.
3.

### Backend Test Failures (Require Investigation)
- 34 test failures out of 174 total (80% pass rate)
- Need to review specific failing tests
- Potentially related to:
  - [ ] Authentication tests
  - [ ] User management tests
  - [ ] Streak calculation tests
  - [ ] Security tests

### Overall Assessment
- [ ] **PASS** - Ready for production
- [ ] **CONDITIONAL PASS** - Minor issues, can proceed with fixes
- [ ] **FAIL** - Major issues, requires rework

### Next Steps
1.
2.
3.
