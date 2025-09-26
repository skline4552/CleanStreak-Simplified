# Claude Code Prompt: Simple Daily Cleaning Task App

Create a minimal daily cleaning habit tracker as a single HTML file. The app should be extremely simple with just the core functionality needed to build a daily cleaning habit.

## Core Features

### 1. Daily Task Display
- Show one cleaning task per day from a pre-defined list
- Use the current date to automatically rotate through tasks (e.g., `taskArray[dayOfMonth % arrayLength]`)
- Tasks should be simple, 5-10 minute cleaning activities

### 2. Streak Tracking
- Track consecutive days completed using two JavaScript variables:
  - `currentStreak` - number of consecutive days
  - `lastCompletedDate` - date when user last completed a task
- If user completes today's task and hasn't already: increment streak
- If user skipped yesterday: reset streak to 1
- If user already completed today: show "Already completed!" message

### 3. Simple Interface
- Display today's task prominently
- Show current streak count
- One large "Done!" button
- Add satisfying visual feedback when task is completed (color change, animation, etc.)

## Technical Requirements

- **Single HTML file** with embedded CSS and JavaScript
- **Mobile-friendly responsive design**
- **Use JavaScript variables only** for data persistence (no localStorage)
- **Clean, minimal UI** focused on the daily habit
- **30-50 pre-defined cleaning tasks** covering common household items

## Sample Cleaning Tasks

Include a variety of quick cleaning tasks such as:
- "Wipe down kitchen counters"
- "Make your bed"
- "Clean bathroom mirror"
- "Dust living room TV"
- "Organize one drawer"
- "Vacuum entryway"
- "Wipe down light switches"
- "Clean coffee table"
- "Tidy up couch cushions"
- "Wipe down door handles"

Each task should be:
- Achievable in 5-10 minutes
- Specific and actionable
- Cover different areas of the home
- Require minimal supplies

## User Experience

The complete flow should be:
1. User opens the app
2. Sees today's task and current streak
3. Completes the cleaning task
4. Clicks "Done!" button
5. Gets visual feedback and sees updated streak
6. Comes back tomorrow for next task

Keep it extremely simple - no setup, no customization, no complex features. The goal is to create the smallest possible version that still motivates daily cleaning habits through task rotation and streak counting.

## Example Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Daily Clean</title>
    <!-- Mobile-friendly meta tags and embedded CSS -->
</head>
<body>
    <div class="container">
        <h1>Today's Task</h1>
        <div class="task-card">
            <!-- Display current task -->
        </div>
        <div class="streak-counter">
            <!-- Show current streak -->
        </div>
        <button class="done-button">
            Done!
        </button>
    </div>
    
    <script>
        // Embedded JavaScript with task array and streak logic
    </script>
</body>
</html>
```

The entire app should fit in one file and work immediately when opened in any browser.