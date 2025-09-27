# Claude Code Prompt: Simple Daily Cleaning Task App

Create a minimal daily cleaning task app that eliminates decision fatigue around household maintenance. The app solves the "I know I should clean something, but what?" problem by providing one specific task each day, ensuring both regular maintenance and easily-forgotten areas get attention.

## Core Features

### 1. Daily Task Display
- Show one specific cleaning task per day from a pre-defined list
- Use smart frequency rotation to ensure both daily maintenance and periodic deep-clean tasks
- Break larger cleaning jobs into room-specific, manageable chunks (e.g., "clean baseboards in kitchen" not "clean all baseboards")
- Tasks should always be achievable in 5-10 minutes to avoid the "oh shit, I don't feel like doing that" reaction

### 2. Streak Tracking
- Track consecutive days completed for dopamine-driven engagement
- If user completes today's task: increment streak
- If user skipped yesterday: gently reset streak to 1 with encouraging messaging
- If user already completed today: show "Already completed!" message

### 3. Simple Interface
- Display today's task prominently
- Show current streak count
- One large "Done!" button
- Add satisfying visual feedback when task is completed (color change, animation, etc.)

## Technical Requirements

- **Mobile-friendly responsive design**
- **Simple data persistence** (no complex database setup needed)
- **Clean, minimal UI** focused on the daily habit
- **30-50 pre-defined cleaning tasks** covering common household items

## Sample Cleaning Tasks

Include a comprehensive variety of tasks that cover both regular maintenance and easily-forgotten areas:

**Daily/Weekly Maintenance:**
- "Wipe down kitchen counters"
- "Make your bed"
- "Clean bathroom mirror"
- "Vacuum entryway"
- "Tidy up couch cushions"

**Periodic/Blind Spot Tasks:**
- "Wipe down light switches in living room"
- "Clean door handles throughout house"
- "Dust TV stand"
- "Organize one kitchen drawer"
- "Clean microwave interior"
- "Wipe baseboards in bathroom"

Each task should be:
- Achievable in 5-10 minutes
- Specific and actionable (room-specific when needed)
- Cover different frequencies (daily, weekly, monthly, quarterly)
- Include both obvious and easily-forgotten cleaning areas
- Require minimal supplies

## User Experience

The app targets people who already clean but want to be more consistent. The complete flow should be:
1. User opens the app wondering "what should I clean today?"
2. Sees today's specific task and current streak
3. Completes the 5-10 minute cleaning task (decision fatigue eliminated)
4. Clicks "Done!" button
5. Gets visual feedback and sees updated streak (dopamine hit)
6. Returns tomorrow curious about the next task

## Success Metrics
Success comes from two sources:
- **Immediate gratification**: Dopamine hit from maintaining and growing streaks
- **Tangible results**: Living in a consistently cleaner, better-maintained home

Keep it extremely simple - no setup, no customization, no complex features. The goal is to create the smallest possible version that eliminates cleaning decision fatigue while ensuring comprehensive home maintenance through smart task rotation and streak-based motivation.