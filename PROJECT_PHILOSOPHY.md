# CleanStreak: Project Philosophy & Context

## 1. Core Mission
**CleanStreak** is a cleaning app designed for people who feel overwhelmed by maintaining a home. It explicitly rejects the "weekend marathon" cleaning cycle in favor of a sustainable, forgiveness-based daily routine.

**The Goal:** A home that is "company ready" 95% of the time, achieved through 5-10 minutes of daily effort.

## 2. The "Three Pillars" Methodology
The system is built on a strict cleaning hierarchy called the **Three Pillars**. Every room is cleaned in this specific order to ensure efficiency (top-to-bottom) and visual impact.

1.  **Glass Clear (Pillar 1)**: Windows, mirrors, and glass surfaces.
    *   *Why:* Glass determines "perceived cleanliness." A room with shining mirrors feels clean even if it's imperfect elsewhere.
2.  **Surfaces Wiped (Pillar 2)**: Countertops, tables, shelves, dusting.
    *   *Why:* Removes visual clutter and dust. Done *after* glass (so spray doesn't settle on clean surfaces?) actually, usually top-down, but Glass is the "Light" entry.
3.  **Floors Finished (Pillar 3)**: Vacuuming, sweeping, or quick mopping.
    *   *Why:* The anchor of the room. Done last so dust from surfaces falls to the floor first.

## 3. Task Architecture

### Rotation vs. Keystone
The app distinguishes between two types of tasks:

1.  **Pillar Tasks (Rotation)**
    *   The app cycles through the user's rooms one by one.
    *   In each room, it assigns Pillar 1 → Pillar 2 → Pillar 3.
    *   Only *then* does it move to the next room.
    *   *Effect:* Deep maintenance that rotates slowly through the house.

2.  **Keystone Tasks (Interspersed)**
    *   **Definition:** High-frequency hygiene touchpoints that cannot wait for the full room rotation (e.g., Toilets, Kitchen Sink, Stovetop).
    *   **Frequency:** Inserted every 3-5 days into the queue.
    *   *Effect:* Sanity and sanitation. You might be working on the Guest Room floors, but today you *also* have to scrub the master toilet.

### The "No Logic" Rule
The user should never have to decide *what* to clean. Decision fatigue is the enemy. The app acts as the "Brain," the user is the "Hands."
*   User opens app → Sees **one** task.
*   User does task → Hits "Done".
*   User closes app.

## 4. User Experience Principles

### Education Before Action
*   **Anti-Pattern:** Dumping a new user into a dashboard populated with "Clean Living Room."
*   **CleanStreak Pattern:**
    1.  **Philosophy First:** The landing page sells the *method*, not the app.
    2.  **Intentional Setup:** The user must explicitly "build their home" (add rooms, toggle glass/mirrors) before receiving a single task. There are no default templates. This creates buy-in.
    3.  **Celebration:** The transition from Setup to Active Use is a celebrated milestone ("Your Home is Ready").

### Forgiveness
*   **Streak Philosophy:** While streaks are motivating, the system acknowledges "Life Happens."
*   **Missed Days:** Accessing the app after a missed day simply presents the task that was missed. The house doesn't "reset." The schedule doesn't "pile up." You just pick up where you left off.

## 5. Target Audience Profile
*   **Struggles with:** ADHD, executive dysfunction, busy schedules, or perfectionism-induced paralysis.
*   **Hates:** "Cleaning Day" (spending Saturday scrubbing).
*   **Needs:** To be told exactly what to do, for a short duration, with a clear "Definition of Done."

## 6. Technical/Data Model (Brief)
*   **User:** Has many Rooms.
*   **Room:** Has a Type (Kitchen, Bedroom) and Attributes (Has Glass?).
*   **Task Generation:** A dynamic queue (Rotation) mixed with periodic triggers (Keystones).
*   **State:** The "Current Task" is calculated based on position in the rotation. It is not a static list of dates.
