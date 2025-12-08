# New User Flow Redesign - Implementation Plan

## Project Overview

Redesign the new user experience to prioritize education and onboarding before presenting any cleaning tasks. New users should understand the app's philosophy, feel confident about what they're committing to, and intentionally build out their home before the task system activates.

**Target Audience**: People who feel overwhelmed by cleaning, are stuck in weekend marathon cleaning cycles, value a clean home but want a sustainable system.

---

## Design Decisions (From Clarifications)

1. **Landing Page Architecture**: Separate file (`landing.html`) as entry point, `index.html` for the app
2. **Affiliate Links**: Plain text list for now (implement affiliate structure later)
3. **Power Clean Feature**: Omit entirely from this phase
4. **Onboarding Enhancement**: Add "Setup Complete" celebration milestone
5. **Landing Copy**: Use prompt content as guidance, write cleaner/more concise copy
6. **Existing User Flow**: Smart redirect (authenticated users auto-redirect from landing to app)
7. **Landing Design**: Simple but effective (clean, readable, professional without complex animations)

---

## Git Workflow

### Branch Strategy

**All work for this feature must be done on a new branch:**

```bash
# Create and switch to new feature branch
git checkout -b feature/landing-page-onboarding-redesign

# Or if you prefer shorter naming
git checkout -b feature/landing-page
```

### Commit Strategy

Make incremental commits as you complete each phase:

1. **After Phase 1**: `git commit -m "feat: Create landing page with hero, philosophy, FAQ sections"`
2. **After Phase 2**: `git commit -m "feat: Add authentication redirect and Learn More link to index.html"`
3. **After Phase 3**: `git commit -m "feat: Add Setup Complete celebration milestone modal"`
4. **After testing fixes**: `git commit -m "fix: Resolve [specific issue] in [component]"`

### Pull Request Process

When implementation is complete:

1. Push the branch to GitHub:
   ```bash
   git push -u origin feature/landing-page-onboarding-redesign
   ```

2. Create a Pull Request:
   - **Title**: "New User Flow Redesign: Landing Page + Onboarding Milestone"
   - **Description**: Reference this plan.md and summarize the changes
   - **Base branch**: `main`
   - **Reviewers**: Tag yourself or team members

3. After review and approval, merge to main

**Do not work directly on the main branch for this feature.**

---

## Phase 1: Landing Page Creation

### File: `landing.html` (NEW)

#### 1.1 HTML Structure

**Hero Section**
- App title: "CleanStreak" (or your chosen name)
- Tagline: "5 Minutes a Day to a Cleaner Home"
- Subheading: Brief hook about breaking the weekend cleaning cycle
- Primary CTA button: "Get Started Free"

**The Philosophy Section**
- **Heading**: "How It Works: The Three Pillars Method"
- **Content**:
  - Explain Three Pillars (Glass → Surfaces → Floor)
  - Top-to-bottom room-by-room approach
  - Keystone Tasks concept (high-frequency hygiene points)
  - Visual: Simple icons or numbered list

**How It Works Section**
- **Heading**: "Your Daily Cleaning Routine, Simplified"
- **Bullet Points**:
  - One task per day, 5-10 minutes max
  - The app decides what to clean (no mental load)
  - Intelligent rotation ensures every area gets attention
  - Streak tracking keeps you motivated
  - No more 3-hour weekend marathons

**Starter Kit Section**
- **Heading**: "What You'll Need: The Essential Toolkit"
- **Intro**: "Gather your supplies before you start—most people already have these basics"
- **Categories**:
  - **Cleaners**: Glass cleaner, all-purpose surface cleaner, bathroom cleaner
  - **Tools**: Microfiber cloths, vacuum or broom, mop or Swiffer
  - **Specialty**: Toilet brush, scrub brush or sponges, optional duster
- Note: "You likely already own most of these items"

**FAQ Section**
- **Who is this app for?**
  - People overwhelmed by cleaning who want a sustainable system

- **How long does each task take?**
  - 5-10 minutes. Quick enough to do consistently.

- **What if I miss a day?**
  - No punishment. Just pick up where you left off. Life happens.

- **Can I skip or swap a task?**
  - Yes. Skip a task and move on. It'll cycle back around.

- **How does the task rotation work?**
  - Room by room, Three Pillars per room, with Keystone Tasks interspersed every 3-5 tasks.

- **What supplies do I need?**
  - See Starter Kit above. Basic cleaners, cloths, and a vacuum.

- **How often will each room be cleaned?**
  - Depends on your home size. Keystones cycle every 3-5 days minimum.

**Footer CTA**
- **Heading**: "Ready to Break the Cleaning Cycle?"
- **Button**: "Create Your Free Account"

#### 1.2 CSS Styling (Simple but Effective)

**Design Principles**:
- Clean, modern sans-serif typography
- Subtle gradient background (similar to existing app: #667eea to #764ba2)
- White/light cards for content sections
- Generous whitespace and padding
- Mobile-responsive (stack on small screens)
- Professional color scheme
- Smooth scroll behavior
- Sticky navigation (optional)

**Key Styles**:
- Hero: Large centered text, gradient background, prominent CTA
- Sections: White cards with subtle shadows, max-width 1000px, centered
- Typography: Clear hierarchy (h1, h2, p), readable line-height (1.6)
- Buttons: Gradient background matching brand, hover effects
- FAQ: Accordion-style or simple expand/collapse
- Mobile: Single column, larger touch targets, readable font sizes (16px+)

#### 1.3 JavaScript Functionality

**Smart Redirect Logic**:
```javascript
// On page load
window.addEventListener('DOMContentLoaded', () => {
  // Check if ?preview=true (existing user viewing landing)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('preview') === 'true') {
    showPreviewMode(); // Show "Back to App" button
    return;
  }

  // Check if user is authenticated (check cookie/localStorage)
  if (isAuthenticated()) {
    // Redirect to app
    window.location.href = './index.html';
  }
});
```

**Registration Modal**:
- Overlay modal triggered by CTA buttons
- Registration form (email, password, confirm password)
- API call to `/api/auth/register`
- On success: redirect to `index.html?newUser=true`
- On error: show validation messages

**Login Option**:
- Small "Already have an account? Sign in" link below registration
- Opens login modal (or navigates to login page)

---

## Phase 2: Modify index.html

### File: `index.html` (MODIFY)

#### 2.1 Add Smart Redirect (Top of JavaScript)

```javascript
// Add near top of existing JavaScript, before app initialization
window.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  const token = localStorage.getItem('auth_token') || getCookie('auth_token');

  if (!token) {
    // Not authenticated - redirect to landing
    window.location.href = './landing.html';
    return;
  }

  // Check if coming from landing page (new user)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('newUser') === 'true') {
    // Clear parameter
    window.history.replaceState({}, '', './index.html');
    // Onboarding will trigger based on hasConfiguredRooms check
  }

  // Continue normal app initialization...
});
```

**Location**: Add after line ~2600 (before `initializeApp()` or similar)

#### 2.2 Add "Learn More" Link

**Location**: Settings panel or user menu
**Implementation**:
- Add button/link: "About CleanStreak" or "How It Works"
- Click handler: `window.open('./landing.html?preview=true', '_blank')`
- This opens landing page in new tab with preview mode

**Code**:
```html
<!-- Add to settings panel (around line 1550-1600) -->
<div class="settings-section">
  <h3>About</h3>
  <button class="settings-button" onclick="window.open('./landing.html?preview=true', '_blank')">
    How CleanStreak Works
  </button>
</div>
```

#### 2.3 Verify Onboarding Triggers

**Current Flow** (verify it still works):
1. User authenticates
2. `loadDashboard()` checks `hasConfiguredRooms`
3. If false → triggers room onboarding modal
4. After room onboarding → triggers keystone onboarding modal
5. After keystone onboarding → calls `loadDashboard()` again → shows first task

**No changes needed here**, just verify it works with new redirect flow.

---

## Phase 3: Setup Complete Milestone

### File: `index.html` (MODIFY)

#### 3.1 Create Celebration Modal HTML

**Location**: Add to modals section (after existing modals, around line 1900+)

```html
<!-- Setup Complete Milestone Modal -->
<div id="setupCompleteOverlay" class="modal-overlay" style="display: none;">
  <div class="modal-content celebration-modal">
    <div class="celebration-header">
      <div class="confetti">🎉</div>
      <h2>Your Home is Ready!</h2>
    </div>

    <div class="setup-summary">
      <div class="summary-stat">
        <div class="stat-number" id="roomCount">0</div>
        <div class="stat-label">Rooms Configured</div>
      </div>
      <div class="summary-stat">
        <div class="stat-number" id="keystoneCount">0</div>
        <div class="stat-label">Keystone Tasks Active</div>
      </div>
      <div class="summary-stat">
        <div class="stat-number" id="totalTaskCount">0</div>
        <div class="stat-label">Tasks in Rotation</div>
      </div>
    </div>

    <p class="celebration-message">
      Your personalized cleaning rotation is ready! Each task takes just 5-10 minutes.
      Consistency is key—small daily efforts add up to a cleaner home without the overwhelm.
    </p>

    <button id="startCleaningBtn" class="primary-button">
      See My First Task
    </button>
  </div>
</div>
```

**CSS** (add to existing styles):
```css
.celebration-modal {
  text-align: center;
  max-width: 500px;
}

.celebration-header {
  margin-bottom: 30px;
}

.confetti {
  font-size: 4rem;
  margin-bottom: 10px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.setup-summary {
  display: flex;
  justify-content: space-around;
  margin: 30px 0;
  gap: 20px;
}

.summary-stat {
  flex: 1;
  padding: 20px;
  background: #f8f9ff;
  border-radius: 12px;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 0.9rem;
  color: #6c757d;
}

.celebration-message {
  margin: 20px 0;
  line-height: 1.6;
  color: #495057;
}
```

#### 3.2 Update Keystone Onboarding Handler

**Location**: `handleSaveKeystonesOnboarding()` function (around line 4328)

**Current code**:
```javascript
async function handleSaveKeystonesOnboarding() {
  // ... save keystone logic ...

  // Close modal
  closeModal('keystoneOnboardingOverlay');

  // Load dashboard
  await loadDashboard();
}
```

**New code**:
```javascript
async function handleSaveKeystonesOnboarding() {
  // ... existing save keystone logic ...

  // Close keystone modal
  closeModal('keystoneOnboardingOverlay');

  // Check if this is first-time setup (not reconfiguration)
  const isFirstSetup = !localStorage.getItem('setup_milestone_shown');

  if (isFirstSetup) {
    // Show celebration milestone
    await showSetupCompleteMilestone();
    localStorage.setItem('setup_milestone_shown', 'true');
  } else {
    // Existing user reconfiguring - just reload dashboard
    await loadDashboard();
  }
}

async function showSetupCompleteMilestone() {
  try {
    // Fetch data for summary
    const roomsResponse = await RoomAPI.getUserRooms();
    const keystonesResponse = await KeystoneAPI.getUserKeystones();
    const rotationResponse = await TaskAPI.getCurrentRotation();

    // Populate stats
    document.getElementById('roomCount').textContent = roomsResponse.rooms?.length || 0;
    document.getElementById('keystoneCount').textContent =
      keystonesResponse.keystones?.filter(k => k.is_active)?.length || 0;
    document.getElementById('totalTaskCount').textContent =
      rotationResponse.rotation?.length || 0;

    // Show modal
    document.getElementById('setupCompleteOverlay').style.display = 'flex';

    // Wait for user to click "Start Cleaning"
    return new Promise((resolve) => {
      document.getElementById('startCleaningBtn').onclick = async () => {
        document.getElementById('setupCompleteOverlay').style.display = 'none';
        await loadDashboard();
        resolve();
      };
    });
  } catch (error) {
    console.error('Failed to show setup milestone:', error);
    // Fallback: just load dashboard
    await loadDashboard();
  }
}
```

---

## Phase 4: Content Creation

### Landing Page Copy (Clean & Concise)

**Hero Section**:
- **Title**: CleanStreak
- **Tagline**: 5 Minutes a Day to a Cleaner Home
- **Subheading**: "Break free from weekend cleaning marathons. Build a sustainable routine that actually works."

**Philosophy Section** (condensed):
> **The Three Pillars Method**: We clean each room systematically—glass surfaces first, then counters and shelves, then floors. This top-to-bottom approach ensures nothing gets missed and every room feels complete before moving on.
>
> **Keystone Tasks**: High-touch hygiene points like toilets, sinks, and stovetops rotate every 3-5 days because they can't wait for the full room cycle. These frequent touchpoints keep your home feeling fresh between deep cleans.

**FAQ Answers** (bullet format, concise):
- Keep answers to 2-3 sentences max
- Focus on removing objections and building confidence
- Friendly, encouraging tone

---

## Phase 5: Testing Checklist

### 5.1 New User Flow
- [ ] Load landing.html without authentication → Landing page displays correctly
- [ ] Click "Get Started" → Registration modal opens
- [ ] Complete registration → Redirects to index.html with `?newUser=true`
- [ ] index.html loads → Room onboarding modal appears
- [ ] Add rooms → Keystone onboarding modal appears
- [ ] Complete keystone setup → Celebration milestone appears with correct stats
- [ ] Click "See My First Task" → Dashboard loads with first task from rotation
- [ ] Verify first task is from actual rotation (not legacy task)

### 5.2 Existing User Flow
- [ ] Visit landing.html while authenticated → Auto-redirects to index.html
- [ ] Visit index.html directly → Loads normally (no redirect to landing)
- [ ] Open Settings → "How CleanStreak Works" link present
- [ ] Click "How CleanStreak Works" → Opens landing.html?preview=true in new tab
- [ ] Landing in preview mode → Shows "Back to App" button instead of registration
- [ ] Existing user completes onboarding again → No milestone shown (only on first setup)

### 5.3 Edge Cases
- [ ] Press back button during onboarding → Doesn't break flow
- [ ] Refresh page during onboarding → Resumes from correct step
- [ ] Network error during registration → Shows error message, doesn't crash
- [ ] Mobile device → Landing page responsive, readable, buttons tappable
- [ ] Desktop → Landing page readable, max-width applied, centered
- [ ] Logout from app → Redirects to landing.html
- [ ] Manually navigate to index.html without auth → Redirects to landing.html

### 5.4 Visual Polish
- [ ] Landing page sections have good spacing
- [ ] Typography is readable (proper font sizes, line height)
- [ ] CTA buttons are prominent and obvious
- [ ] Celebration modal stats are accurate
- [ ] Confetti/celebration animation works smoothly
- [ ] No layout shifts or visual glitches
- [ ] Colors match between landing and app

---

## File Changes Summary

### New Files
1. **landing.html** (~600-800 lines)
   - Complete standalone landing page
   - HTML structure (hero, philosophy, how-it-works, starter kit, FAQ, footer)
   - Embedded CSS styling
   - Smart redirect JavaScript
   - Registration modal logic

### Modified Files
1. **index.html**
   - Add authentication redirect at top (~10 lines)
   - Add "Learn More" link in settings (~5 lines HTML)
   - Add celebration milestone modal HTML (~40 lines)
   - Add celebration milestone CSS (~60 lines)
   - Modify `handleSaveKeystonesOnboarding()` (~30 lines)
   - Add `showSetupCompleteMilestone()` function (~40 lines)
   - **Total changes**: ~185 lines added/modified

### No Backend Changes
All functionality uses existing APIs:
- `/api/auth/register` (already exists)
- `/api/auth/login` (already exists)
- `/api/rooms` (already exists)
- `/api/keystone-tasks` (already exists)
- `/api/tasks/current` (already exists)

---

## Implementation Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| **Phase 1** | Create landing.html structure + CSS + JS | 2-3 hours |
| **Phase 2** | Modify index.html (redirect, learn more link) | 1 hour |
| **Phase 3** | Setup Complete milestone modal + handler | 1-2 hours |
| **Phase 4** | Polish copy and content | 30 minutes |
| **Phase 5** | Testing all flows | 1 hour |
| **Total** | | **5.5-7.5 hours** |

---

## Success Criteria

✅ **Education First**: New users understand the Three Pillars system before signing up
✅ **Intentional Setup**: Users actively build their home configuration (no pre-filled templates)
✅ **Satisfying Milestone**: Celebration screen provides clear transition to active use
✅ **Seamless Flow**: Landing → Registration → Onboarding → Milestone → First Task (no confusion)
✅ **Existing Users Unaffected**: Current users experience no disruption, can access app directly
✅ **Mobile Friendly**: All screens work on mobile devices
✅ **Professional Polish**: Clean design, good UX, no technical issues

---

## Future Enhancements (Out of Scope)

- Power Clean feature (30-minute bonus task)
- Affiliate link integration for Starter Kit
- Landing page animations and visual effects
- A/B testing for conversion optimization
- Email onboarding sequence
- Social proof (testimonials, user count)
- Video walkthrough of the app
- Blog/content section
- SEO optimization

---

## Notes

- **Design Philosophy**: Simple but effective—we're not building a complex marketing site, just a clear explanation of the app's value
- **User Psychology**: The landing page removes friction by answering objections upfront (time commitment, missing days, supply needs)
- **Onboarding Flow**: The milestone celebrates their commitment and creates a "fresh start" feeling
- **Technical Simplicity**: No backend changes, no complex state management, just smart routing and DOM manipulation
