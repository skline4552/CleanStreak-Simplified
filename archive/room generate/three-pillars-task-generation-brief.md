# Task List Generation Brief: Three Pillars Cleaning System

## Core Philosophy

Every room in the home is cleaned using three pillars, executed top-to-bottom:

1. **Glass clear** - Windows, mirrors, glass surfaces
2. **Surfaces clear and wiped** - Declutter and wipe countertops, tables, shelves
3. **Floor vacuumed** - Vacuum or sweep the floor

## Home Setup Configuration

### Room Inventory

The app should collect:

- **Room types** (e.g., Living Room, Kitchen, Master Bedroom, Guest Bedroom, Master Bathroom, Guest Bathroom, Office, etc.)
- **Quantity of each room type** (e.g., 2 bedrooms, 1.5 bathrooms)

### Glass Presence Detection

For each room, ask: **"Does this room have mirrors or windows?"**

- If **YES**: Include all three pillars (Glass → Surfaces → Floor)
- If **NO**: Skip glass pillar, only include Surfaces → Floor

This ensures the app doesn't generate irrelevant tasks like "Clean bedroom mirror" when the room has no mirrors or windows.

## Task Rotation Logic

### Room-by-Room Progression

- Complete all applicable pillars for one room before moving to the next room
- This ensures each space feels "complete" and properly maintained
- Order: Glass (if applicable) → Surfaces → Floor (top-to-bottom cleaning methodology)

### Keystone Tasks (High-Frequency Hygiene Points)

Between completing room pillar cycles, insert keystone tasks that require more frequent attention:

- Master toilet
- Guest/hall toilet
- Kitchen sink
- Master bathroom sink
- Guest bathroom sink
- Stovetop
- Shower/tub
- Microwave interior

**Keystone Frequency**: Rotate through keystone tasks every 3-5 days to ensure each is touched at least once monthly

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

## Task Specifications

- Each task should be achievable in 5-10 minutes
- Tasks should be room-specific (e.g., "Wipe kitchen countertops" not "Wipe all countertops")
- Break large jobs into manageable chunks per room
- Use clear, action-oriented language
