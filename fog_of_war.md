# CleanStreak: "Fog of War" Visual Specifications

## 1. Concept Overview
The "Fog of War" replaces traditional progress bars. It uses CSS filters and overlays to represent the home's "perceived cleanliness" based on the **Three Pillars Methodology**. The UI starts in a "dimmed" or "foggy" state and becomes sharp and vibrant as the user completes daily tasks.

## 2. The Three-Layer Fog Stack
These layers are toggled or transitioned based on the user's progress through the **Rotation** (Room-to-Room).

### Layer 1: The "Smudge" (Pillar 1 - Glass Clear)
* **Visual Logic:** Represents windows and mirrors. When active, the UI feels out of focus.
* **Implementation:** * `backdrop-filter: blur(4px);`
    * An SVG "streak" mask overlay with `opacity: 0.4;`.
* **Clearing Trigger:** Transition `blur` to `0px` and `opacity` to `0` over 1.2s when the Pillar 1 task is marked "Done".

### Layer 2: The "Dust" (Pillar 2 - Surfaces Wiped)
* **Visual Logic:** Represents visual clutter and dust. The UI looks muted and "flat".
* **Implementation:** * `filter: grayscale(80%) brightness(0.9);`
    * A fine-grain "noise" texture overlay (SVG or PNG) set to `mix-blend-mode: overlay;`.
* **Clearing Trigger:** Transition `grayscale` to `0%` and `brightness` to `1.0`. Remove the noise texture.

### Layer 3: The "Grit" (Pillar 3 - Floors Finished)
* **Visual Logic:** Represents the anchor of the room. The "mess" is concentrated at the bottom of the screen.
* **Implementation:** * A linear-gradient overlay (e.g., charcoal to transparent) starting from the bottom 25% of the viewport.
    * `mix-blend-mode: multiply;`.
* **Clearing Trigger:** Animate the gradient position: `transform: translateY(100%);` to simulate the floor being swept clean.

## 3. Behavior & State Management

### The "No Logic" Interaction Flow
1.  **State Calculation:** Upon app load, the system checks the user's position in the rotation (e.g., Kitchen -> Pillar 2).
2.  **Visual Render:** The app applies all fog layers *except* those already cleared in the current room rotation.
3.  **Active Focus:** The current task's fog layer should have a subtle "pulse" or animation to draw the eye.
4.  **Definition of Done:** When "Done" is pressed, the specific layer clears visually before the app serves the next room or task.

### Forgiveness Integration
* **No Accumulation:** If a user misses days, the fog state remains identical to the last active session.
* **Pick Up:** The UI does not "reset" to full mess; it stays exactly where the user left off, honoring the "pick up where you left off" philosophy.

## 4. CSS Variable Implementation
To enable Antigravity to code this efficiently, use the following CSS variables:

```css
:root {
  --glass-blur: 4px;
  --surface-grayscale: 80%;
  --floor-grit-opacity: 0.5;
  --spirit-vibrance: 0.6;
}

/* Clear States */
.state-glass-clear { --glass-blur: 0px; }
.state-surfaces-clear { --surface-grayscale: 0%; }
.state-floors-clear { --floor-grit-opacity: 0; }