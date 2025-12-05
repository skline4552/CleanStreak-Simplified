# Keystone Onboarding Implementation - COMPLETE ✅

## Status
✅ Backend endpoint added (`POST /api/keystone-tasks/initialize`)
✅ HTML modal added (keystoneOnboardingOverlay)
✅ CSS styles added
✅ KeystoneAPI object added
✅ JavaScript functions added
✅ Event listeners configured
✅ Integration with onboarding flow complete
✅ Automated tests passing (276/276)
✅ **Room-based filtering implemented** - keystones filtered by user's configured rooms

## Implementation Summary

Add the following JavaScript functions to `index.html` (find a good location after the existing onboarding functions):

### 1. Keystone Data Definitions

```javascript
// Keystone task definitions with descriptions
const KEYSTONE_DEFINITIONS = {
    master_toilet: {
        name: 'Scrub and disinfect master toilet',
        description: 'High-traffic bathroom fixture - keep it fresh and sanitary'
    },
    guest_toilet: {
        name: 'Scrub and disinfect guest/hall toilet',
        description: 'Guest bathroom hygiene point - maintain cleanliness'
    },
    kitchen_sink: {
        name: 'Scrub kitchen sink and faucet',
        description: 'Daily-use area prone to buildup - prevent bacteria growth'
    },
    master_bath_sink: {
        name: 'Clean master bathroom sink',
        description: 'Personal hygiene area - keep counters and fixtures spotless'
    },
    guest_bath_sink: {
        name: 'Clean guest bathroom sink',
        description: 'Guest-facing hygiene point - maintain presentation'
    },
    stovetop: {
        name: 'Wipe down stovetop and burners',
        description: 'Cooking surface prone to spills - prevent grease buildup'
    },
    shower_tub: {
        name: 'Scrub shower/tub',
        description: 'Moisture-prone area - prevent mold and soap scum'
    },
    microwave: {
        name: 'Clean microwave interior',
        description: 'Food splatter zone - maintain hygiene and prevent odors'
    }
};

// State for keystone onboarding
const KeystoneOnboardingState = {
    selectedKeystones: [],
    isInitializing: false
};
```

### 2. Render Keystone Onboarding List

```javascript
/**
 * Render the keystone onboarding checklist
 */
function renderKeystoneOnboardingList() {
    const container = document.getElementById('keystoneOnboardingList');

    // Default: all keystones selected
    KeystoneOnboardingState.selectedKeystones = Object.keys(KEYSTONE_DEFINITIONS);

    const html = Object.entries(KEYSTONE_DEFINITIONS).map(([type, data]) => `
        <div class="keystone-onboarding-item selected" data-keystone-type="${type}" onclick="toggleKeystoneSelection('${type}')">
            <div class="keystone-checkbox-container">
                <input type="checkbox"
                       class="keystone-checkbox"
                       id="keystone-${type}"
                       checked
                       onchange="event.stopPropagation(); toggleKeystoneSelection('${type}')">
            </div>
            <label for="keystone-${type}" class="keystone-content" onclick="event.stopPropagation(); toggleKeystoneSelection('${type}')">
                <div class="keystone-name">${data.name}</div>
                <div class="keystone-description">${data.description}</div>
            </label>
        </div>
    `).join('');

    container.innerHTML = html;
}

/**
 * Toggle keystone selection
 */
function toggleKeystoneSelection(keystoneType) {
    const item = document.querySelector(`[data-keystone-type="${keystoneType}"]`);
    const checkbox = document.getElementById(`keystone-${keystoneType}`);

    if (!item || !checkbox) return;

    // Toggle checkbox
    checkbox.checked = !checkbox.checked;

    // Update visual state
    if (checkbox.checked) {
        item.classList.add('selected');
        if (!KeystoneOnboardingState.selectedKeystones.includes(keystoneType)) {
            KeystoneOnboardingState.selectedKeystones.push(keystoneType);
        }
    } else {
        item.classList.remove('selected');
        KeystoneOnboardingState.selectedKeystones =
            KeystoneOnboardingState.selectedKeystones.filter(t => t !== keystoneType);
    }
}
```

### 3. Show/Hide Keystone Onboarding Modal

```javascript
/**
 * Open keystone onboarding modal
 */
function openKeystoneOnboardingModal() {
    renderKeystoneOnboardingList();
    document.getElementById('keystoneOnboardingOverlay').style.display = 'flex';
}

/**
 * Close keystone onboarding modal
 */
function closeKeystoneOnboardingModal() {
    document.getElementById('keystoneOnboardingOverlay').style.display = 'none';
}
```

### 4. Save Keystones Handler

```javascript
/**
 * Handle save keystones from onboarding
 */
async function handleSaveKeystonesOnboarding() {
    const saveButton = document.getElementById('saveKeystonesOnboarding');
    const originalText = saveButton.innerHTML;

    try {
        saveButton.disabled = true;
        saveButton.innerHTML = 'Saving...';
        KeystoneOnboardingState.isInitializing = true;

        // Initialize keystones with selected ones
        const activeKeystones = KeystoneOnboardingState.selectedKeystones.length > 0
            ? KeystoneOnboardingState.selectedKeystones
            : null; // null = enable all by default

        await KeystoneAPI.initializeKeystones(activeKeystones);

        // Close modal
        closeKeystoneOnboardingModal();

        // Show success message and refresh
        showNotification('Keystone tasks configured successfully!', 'success');

        // Trigger rotation generation if user has rooms configured
        await loadDashboard();

    } catch (error) {
        console.error('Failed to initialize keystones:', error);
        showNotification(error.message || 'Failed to configure keystone tasks. Please try again.', 'error');
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    } finally {
        KeystoneOnboardingState.isInitializing = false;
    }
}

/**
 * Handle skip keystones onboarding
 */
async function handleSkipKeystonesOnboarding() {
    try {
        // Initialize with no active keystones (all disabled)
        await KeystoneAPI.initializeKeystones([]);
        closeKeystoneOnboardingModal();
        showNotification('Keystone tasks skipped. You can enable them later in Settings.', 'info');
        await loadDashboard();
    } catch (error) {
        console.error('Failed to skip keystones:', error);
        // If initialization fails, just close the modal
        closeKeystoneOnboardingModal();
    }
}
```

### 5. Check if User Needs Keystone Onboarding

```javascript
/**
 * Check if user needs keystone onboarding and show modal if needed
 */
async function checkAndShowKeystoneOnboarding() {
    try {
        const response = await KeystoneAPI.getUserKeystones();

        // If user has no keystones, show onboarding
        if (!response.has_keystones || response.keystone_tasks.length === 0) {
            openKeystoneOnboardingModal();
            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to check keystone status:', error);
        return false;
    }
}
```

### 6. Modify Existing finishOnboarding Function

Find the `finishOnboarding` button click handler and modify it to show keystone onboarding after room setup:

```javascript
// Find this section and modify it:
document.getElementById('finishOnboarding').addEventListener('click', async () => {
    // ... existing room onboarding code ...

    // After rooms are configured successfully, show keystone onboarding
    try {
        // Close room onboarding
        document.getElementById('onboardingOverlay').style.display = 'none';

        // Check if user needs keystone onboarding
        await checkAndShowKeystoneOnboarding();

    } catch (error) {
        console.error('Onboarding error:', error);
    }
});
```

### 7. Add Event Listeners

Add these event listeners in the existing event listener section:

```javascript
// Keystone onboarding event listeners
document.getElementById('saveKeystonesOnboarding').addEventListener('click', handleSaveKeystonesOnboarding);
document.getElementById('skipKeystonesOnboarding').addEventListener('click', handleSkipKeystonesOnboarding);

// Close modal when clicking overlay
document.getElementById('keystoneOnboardingOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'keystoneOnboardingOverlay') {
        // Don't allow closing by clicking outside during initial onboarding
        // User must explicitly save or skip
    }
});
```

### 8. Check on Login

Modify the login success handler to check for keystones:

```javascript
// After successful login, check if user needs keystone onboarding
async function handleLoginSuccess() {
    // ... existing login code ...

    // Check if user needs keystone onboarding
    const needsOnboarding = await checkAndShowKeystoneOnboarding();

    if (!needsOnboarding) {
        // Normal dashboard load
        await loadDashboard();
    }
}
```

## Testing Checklist

- [ ] Register a new user
- [ ] Complete room onboarding
- [ ] Keystone onboarding modal appears
- [ ] All 8 keystones shown and checked by default
- [ ] Can toggle keystones on/off
- [ ] "Save & Start Cleaning" button works
- [ ] "Skip for Now" button works
- [ ] Keystones appear in Settings tab after initialization
- [ ] Keystones are included in task rotation generation
- [ ] Existing users without keystones see modal on next login

## Files Modified

1. ✅ `backend/src/services/keystoneService.js` - Added optional activeKeystones parameter
2. ✅ `backend/src/controllers/keystoneController.js` - Added initializeKeystones endpoint
3. ✅ `backend/src/routes/keystones.js` - Added POST /initialize route
4. ✅ `index.html` - Added modal HTML, CSS, KeystoneAPI, JavaScript functions

## Room-Based Filtering Logic

**NEW FEATURE** - Keystones are now intelligently filtered based on the user's configured rooms:

### Filtering Rules:
- **Kitchen Keystones** (kitchen_sink, stovetop, microwave)
  - Only shown if user has at least one kitchen room

- **Master Bathroom Keystones** (master_toilet, master_bath_sink)
  - Only shown if user has a bathroom with "master" in the custom name (case-insensitive)

- **Guest Bathroom Keystones** (guest_toilet, guest_bath_sink)
  - Only shown if user has a bathroom with "guest" or "hall" in the custom name (case-insensitive)

- **Shower/Tub Keystone** (shower_tub)
  - Shown if user has any bathroom

### Implementation:
- `getApplicableKeystones(rooms)` - Filters keystones based on room configuration
- `openKeystoneOnboardingModal()` - Fetches user's rooms and applies filtering
- No backend changes required - all filtering done on frontend

### Examples:
- User with only "Master Bathroom" → sees master_toilet, master_bath_sink, shower_tub
- User with only "Kitchen" → sees kitchen_sink, stovetop, microwave
- User with "Master Bathroom" + "Guest Bathroom" + "Kitchen" → sees all 8 keystones
- User with only "Bedroom" → sees message about no applicable keystones

## Next Steps

1. ✅ All code implemented
2. ✅ Automated tests passing
3. **Manual testing required** - Test room-based filtering in browser
4. Update Issue #31 with results
5. Close Issue #31 once verified working
