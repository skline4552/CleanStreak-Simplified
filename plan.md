# Plan: "Fog of War" Visual Feature

## Goal
Replace traditional progress bars in `app.html` with a "Fog of War" visual system that uses CSS filters and overlays to represent the home's cleanliness state. The UI will start "foggy/messy" and become sharp/vibrant as tasks are completed, visually reinforcing the **Three Pillars Methodology**.

---

## Phase 1: CSS Architecture

### 1.1 Define Variables
Add the specified CSS variables to `:root` to control the intensity of the effects.

```css
:root {
  --glass-blur: 4px;
  --glass-opacity: 0.4;
  --surface-grayscale: 80%;
  --surface-brightness: 0.9;
  --floor-grit-opacity: 0.5;
  --spirit-vibrance: 0.6;
  --transition-speed: 1.2s;
}
```

### 1.2 Create Layer Classes
Define the classes that control the visual state of the main container or body.

*   `.state-glass-clear`: Sets `--glass-blur: 0px` and `--glass-opacity: 0`.
*   `.state-surfaces-clear`: Sets `--surface-grayscale: 0%` and `--surface-brightness: 1.0`.
*   `.state-floors-clear`: Sets `--floor-grit-opacity: 0`.

### 1.3 Overlay Styling
Create the CSS for the three distinct visual layers. These will be fixed `div`s overlaying the app content (with `pointer-events: none` so they don't block clicks).

1.  **Glass Layer (`.fog-layer-glass`)**:
    *   `backdrop-filter: blur(var(--glass-blur))`
    *   Background: SVG streak pattern (optional, or just blur for MVP)
    *   Opacity: `var(--glass-opacity)`
    *   `z-index: 10`

2.  **Dust Layer (`.fog-layer-dust`)**:
    *   `filter: grayscale(var(--surface-grayscale)) brightness(var(--surface-brightness))` applied to the **APP CONTAINER**, not an overlay (per spec line 17: "The UI looks muted").
    *   *Correction from Spec:* The spec mentions an *overlay* for noise texture (`mix-blend-mode: overlay`).
    *   Implementation: A separate div `.fog-layer-noise` with a noise background image.

3.  **Grit Layer (`.fog-layer-grit`)**:
    *   Linear gradient (charcoal to transparent) starting from bottom 25%.
    *   `mix-blend-mode: multiply`
    *   Opacity: `var(--floor-grit-opacity)`
    *   Transform: Handled via class to slide down.

---

## Phase 2: HTML Integration in `app.html`

### 2.1 Add Overlay Elements
Inject the fog layer containers immediately inside the `<body>` but outside the main `.container`.

```html
<div id="fogLayerGlass" class="fog-layer fog-glass"></div>
<div id="fogLayerNoise" class="fog-layer fog-noise"></div>
<div id="fogLayerGrit" class="fog-layer fog-grit"></div>
```

---

## Phase 3: JavaScript State Logic

### 3.1 Map Tasks to Fog States
Update `displayCurrentTask` (or create `updateFogState(task)`) to determine which fog layers should be active based on the current room's progress.

**Logic Table:**
| Current Task Type | Glass Blur | Surface Dust | Floor Grit |
| :--- | :--- | :--- | :--- |
| **Pillar 1 (Glass)** | ACTIVE | ACTIVE | ACTIVE |
| **Pillar 2 (Surfaces)** | **CLEARED** | ACTIVE | ACTIVE |
| **Pillar 3 (Floors)** | CLEARED | **CLEARED** | ACTIVE |
| **Keystone / Other** | (Maintain state of current room) | | |

*Note:* When entering a **new room** (Task 1/3), all fogs reset to ACTIVE.

### 3.2 Animation Trigger
When `completeTask()` is called:
1.  identify the *next* state.
2.  Apply the "Clear" class (e.g., adding `.state-glass-clear`).
3.  Allow the CSS transition (`1.2s`) to play.
4.  *Then* fetch/display the next task (or simply update the task text while the visual clears around it).

---

## Phase 4: Implementation Steps

- [ ] **Step 1:** Add CSS variables and Fog specific styles to `app.html` `<style>` block.
- [ ] **Step 2:** Add Fog Overlay HTML elements to `app.html`.
- [ ] **Step 3:** Implement `updateFogState()` function in JS.
    - [ ] Needs to parse `task.pillarType` (glass/surface/floor).
- [ ] **Step 4:** Integrate `updateFogState` into `displayCurrentTask` loop.
- [ ] **Step 5:** Handle the "New Room Reset" (if moving from Floor task -> Glass task of next room, quick fade-in of fog?).

## Phase 5: Verification
- [ ] Verify Glass task shows blurry UI.
- [ ] Verify completing Glass task clears blur but leaves grayscale/grit.
- [ ] Verify completing Surface task restores color.
- [ ] Verify completing Floor task clears the bottom gradient.
- [ ] Verify next room resets the "Fog".
