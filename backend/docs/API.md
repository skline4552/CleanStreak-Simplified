# CleanStreak API Documentation

## Overview

This document provides comprehensive documentation for all CleanStreak API endpoints, including the new Room Customization and Task Rotation features. All endpoints require authentication unless otherwise specified.

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

See the main authentication documentation for login, registration, and token refresh endpoints.

---

## Table of Contents

1. [Room Management Endpoints](#room-management-endpoints)
2. [Keystone Task Endpoints](#keystone-task-endpoints)
3. [Task Rotation Endpoints](#task-rotation-endpoints)
4. [User Completion Endpoint](#user-completion-endpoint)

---

## Room Management Endpoints

### POST /api/rooms

Create a new room configuration for the authenticated user.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**Request Body:**
```json
{
  "roomType": "bedroom",
  "customName": "Master Bedroom",
  "hasGlass": true
}
```

**Request Parameters:**
- `roomType` (string, required): Type of room. Valid values:
  - `kitchen`
  - `bathroom`
  - `bedroom`
  - `living_room`
  - `dining_room`
  - `office`
  - `hallway`
  - `laundry`
- `customName` (string, optional): Custom display name for the room (max 50 characters)
- `hasGlass` (boolean, optional): Whether the room has glass surfaces requiring the glass pillar task (default: false)

**Response (201 Created):**
```json
{
  "success": true,
  "room": {
    "id": "clx1a2b3c4d5e6f7g8h9i0j1",
    "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
    "room_type": "bedroom",
    "custom_name": "Master Bedroom",
    "has_glass": true,
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request** - Invalid room type:
```json
{
  "error": "Bad request",
  "code": "INVALID_ROOM_TYPE",
  "message": "Invalid room type. Must be one of: kitchen, bathroom, bedroom, living_room, dining_room, office, hallway, laundry"
}
```

**400 Bad Request** - Custom name too long:
```json
{
  "error": "Bad request",
  "code": "VALIDATION_ERROR",
  "message": "Custom name must be 50 characters or less"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

---

### GET /api/rooms

Retrieve all room configurations for the authenticated user, sorted by sort_order.

**Authentication:** Required

**Rate Limit:** None (general API rate limit applies)

**Query Parameters:**
- `include_inactive` (boolean, optional): Include inactive (deleted) rooms in the response (default: false)

**Response (200 OK):**
```json
{
  "rooms": [
    {
      "id": "clx1a2b3c4d5e6f7g8h9i0j1",
      "room_type": "kitchen",
      "custom_name": "Kitchen",
      "has_glass": true,
      "sort_order": 1,
      "is_active": true,
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T12:00:00.000Z"
    },
    {
      "id": "clx2b3c4d5e6f7g8h9i0j1k2",
      "room_type": "bedroom",
      "custom_name": "Master Bedroom",
      "has_glass": false,
      "sort_order": 2,
      "is_active": true,
      "created_at": "2025-11-26T12:05:00.000Z",
      "updated_at": "2025-11-26T12:05:00.000Z"
    },
    {
      "id": "clx3c4d5e6f7g8h9i0j1k2l3",
      "room_type": "bathroom",
      "custom_name": "Main Bathroom",
      "has_glass": true,
      "sort_order": 3,
      "is_active": true,
      "created_at": "2025-11-26T12:10:00.000Z",
      "updated_at": "2025-11-26T12:10:00.000Z"
    }
  ]
}
```

**Error Responses:**

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

---

### GET /api/rooms/:id

Retrieve a specific room configuration by ID.

**Authentication:** Required

**Rate Limit:** None (general API rate limit applies)

**URL Parameters:**
- `id` (string, required): Room ID

**Response (200 OK):**
```json
{
  "room": {
    "id": "clx1a2b3c4d5e6f7g8h9i0j1",
    "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
    "room_type": "bedroom",
    "custom_name": "Master Bedroom",
    "has_glass": true,
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

**404 Not Found** - Room not found or doesn't belong to user:
```json
{
  "error": "Not found",
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

---

### PUT /api/rooms/:id

Update a room configuration. Changes are applied immediately for display purposes, but task rotation changes are deferred until the current cycle completes.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**URL Parameters:**
- `id` (string, required): Room ID

**Request Body:**
```json
{
  "customName": "Main Bedroom",
  "hasGlass": true,
  "isActive": true
}
```

**Request Parameters:**
- `customName` (string, optional): Updated custom name (max 50 characters)
- `hasGlass` (boolean, optional): Updated glass surface flag
- `isActive` (boolean, optional): Whether the room is active

**Note:** `roomType` cannot be changed after creation. Delete and recreate the room if needed.

**Response (200 OK):**
```json
{
  "success": true,
  "room": {
    "id": "clx1a2b3c4d5e6f7g8h9i0j1",
    "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
    "room_type": "bedroom",
    "custom_name": "Main Bedroom",
    "has_glass": true,
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T13:30:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "Bad request",
  "code": "VALIDATION_ERROR",
  "message": "Custom name must be 50 characters or less"
}
```

**404 Not Found** - Room not found:
```json
{
  "error": "Not found",
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

---

### DELETE /api/rooms/:id

Delete a room configuration. The room is marked as inactive, and changes take effect after the current task cycle completes.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**URL Parameters:**
- `id` (string, required): Room ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Room deleted. Changes will apply after completing current cycle."
}
```

**Error Responses:**

**404 Not Found** - Room not found:
```json
{
  "error": "Not found",
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

---

### PUT /api/rooms/reorder

Bulk reorder rooms by providing an array of room IDs in the desired order. Changes take effect immediately for display purposes.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**Request Body:**
```json
{
  "room_order": [
    "clx2b3c4d5e6f7g8h9i0j1k2",
    "clx1a2b3c4d5e6f7g8h9i0j1",
    "clx3c4d5e6f7g8h9i0j1k2l3"
  ]
}
```

**Request Parameters:**
- `room_order` (array of strings, required): Array of room IDs in the desired order

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Rooms reordered successfully"
}
```

**Error Responses:**

**400 Bad Request** - Invalid request format:
```json
{
  "error": "Bad request",
  "code": "INVALID_ROOM_ORDER",
  "message": "room_order must be an array of room IDs"
}
```

**400 Bad Request** - Mismatched room count:
```json
{
  "error": "Bad request",
  "code": "ROOM_COUNT_MISMATCH",
  "message": "Number of rooms in order does not match user's room count"
}
```

**400 Bad Request** - Room doesn't belong to user:
```json
{
  "error": "Bad request",
  "code": "INVALID_ROOM_ID",
  "message": "One or more room IDs do not belong to the user"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

---

## Keystone Task Endpoints

Keystone tasks are critical daily tasks (e.g., scrub master toilet, clean kitchen sink) that are inserted randomly into the task rotation.

### GET /api/keystone-tasks

Retrieve all keystone task configurations for the authenticated user.

**Authentication:** Required

**Rate Limit:** None (general API rate limit applies)

**Query Parameters:**
- `active_only` (boolean, optional): Return only active keystones (default: false)

**Response (200 OK):**
```json
{
  "keystone_tasks": [
    {
      "id": "clx4d5e6f7g8h9i0j1k2l3m4",
      "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
      "task_type": "master_toilet",
      "custom_name": null,
      "is_active": true,
      "sort_order": 1,
      "default_description": "Scrub and disinfect master toilet",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T12:00:00.000Z"
    },
    {
      "id": "clx5e6f7g8h9i0j1k2l3m4n5",
      "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
      "task_type": "kitchen_sink",
      "custom_name": "Clean main kitchen sink",
      "is_active": true,
      "sort_order": 2,
      "default_description": "Scrub kitchen sink and faucet",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T13:00:00.000Z"
    },
    {
      "id": "clx6f7g8h9i0j1k2l3m4n5o6",
      "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
      "task_type": "guest_toilet",
      "custom_name": null,
      "is_active": false,
      "sort_order": 3,
      "default_description": "Scrub and disinfect guest toilet",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T12:00:00.000Z"
    },
    {
      "id": "clx7g8h9i0j1k2l3m4n5o6p7",
      "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
      "task_type": "kitchen_counters",
      "custom_name": "Deep clean kitchen counters",
      "is_active": true,
      "sort_order": 4,
      "default_description": "Thoroughly clean and disinfect kitchen counters",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T14:00:00.000Z"
    }
  ]
}
```

**Default Keystone Task Types:**
- `master_toilet` - "Scrub and disinfect master toilet"
- `kitchen_sink` - "Scrub kitchen sink and faucet"
- `guest_toilet` - "Scrub and disinfect guest toilet"
- `kitchen_counters` - "Thoroughly clean and disinfect kitchen counters"
- `master_shower` - "Scrub and squeegee master shower"
- `bathroom_mirror` - "Clean bathroom mirror and sink"
- `stove_top` - "Deep clean stove top and burners"
- `entry_way` - "Sweep and organize entry way"

**Error Responses:**

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

---

### PUT /api/keystone-tasks/:id

Update a keystone task configuration. You can customize the name and toggle whether it's active.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**URL Parameters:**
- `id` (string, required): Keystone task ID

**Request Body:**
```json
{
  "customName": "Deep clean master bathroom toilet",
  "isActive": true,
  "sortOrder": 1
}
```

**Request Parameters:**
- `customName` (string, optional): Custom display name for the keystone task (max 100 characters). Set to null to use default description.
- `isActive` (boolean, optional): Whether the keystone is active and should be included in rotations
- `sortOrder` (number, optional): Sort order for display purposes

**Note:** `task_type` cannot be changed after creation. Changes to `isActive` take effect after the current cycle completes.

**Response (200 OK):**
```json
{
  "success": true,
  "task": {
    "id": "clx4d5e6f7g8h9i0j1k2l3m4",
    "user_id": "clx0z9y8x7w6v5u4t3s2r1q0",
    "task_type": "master_toilet",
    "custom_name": "Deep clean master bathroom toilet",
    "is_active": true,
    "sort_order": 1,
    "default_description": "Scrub and disinfect master toilet",
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T15:00:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "Bad request",
  "code": "VALIDATION_ERROR",
  "message": "Custom name must be 100 characters or less"
}
```

**404 Not Found** - Keystone not found:
```json
{
  "error": "Not found",
  "code": "KEYSTONE_NOT_FOUND",
  "message": "Keystone task not found"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

---

## Task Rotation Endpoints

The task rotation system generates a personalized sequence of cleaning tasks based on the user's room configurations and active keystone tasks.

### GET /api/tasks/current

Get the current task from the user's rotation. Automatically generates a new rotation if none exists or if the current rotation has been completed.

**Authentication:** Required

**Rate Limit:** None (general API rate limit applies)

**Response (200 OK) - With configured rooms:**
```json
{
  "task": {
    "id": "clx8h9i0j1k2l3m4n5o6p7q8",
    "description": "Wipe down Kitchen countertops and table",
    "task_type": "pillar",
    "room": {
      "id": "clx1a2b3c4d5e6f7g8h9i0j1",
      "name": "Kitchen",
      "type": "kitchen"
    },
    "pillar_type": "surfaces",
    "keystone_type": null,
    "position": 5,
    "total_tasks": 28
  }
}
```

**Response (200 OK) - Keystone task:**
```json
{
  "task": {
    "id": "clx9i0j1k2l3m4n5o6p7q8r9",
    "description": "Scrub and disinfect master toilet",
    "task_type": "keystone",
    "room": null,
    "pillar_type": null,
    "keystone_type": "master_toilet",
    "position": 7,
    "total_tasks": 28
  }
}
```

**Response (200 OK) - Glass pillar task:**
```json
{
  "task": {
    "id": "clxaj1k2l3m4n5o6p7q8r9s0",
    "description": "Clean windows and glass surfaces in Living Room",
    "task_type": "pillar",
    "room": {
      "id": "clx2b3c4d5e6f7g8h9i0j1k2",
      "name": "Living Room",
      "type": "living_room"
    },
    "pillar_type": "glass",
    "keystone_type": null,
    "position": 10,
    "total_tasks": 28
  }
}
```

**Response (200 OK) - No rooms configured:**
```json
{
  "task": null,
  "message": "No rooms configured. Please configure your home to get personalized tasks."
}
```

**Task Types:**
- `pillar` - Regular room-based task from one of the three pillars
- `keystone` - Critical daily task (e.g., toilet, sink)

**Pillar Types** (for pillar tasks):
- `surfaces` - Wipe down surfaces, counters, tables
- `floor` - Sweep, vacuum, or mop floors
- `glass` - Clean windows and glass surfaces (only for rooms with `has_glass: true`)

**Error Responses:**

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**500 Internal Server Error** - Task generation failed:
```json
{
  "error": "Internal server error",
  "code": "TASK_GENERATION_ERROR",
  "message": "Failed to generate task rotation"
}
```

---

### GET /api/tasks/preview

Preview upcoming tasks in the rotation. Useful for showing users what tasks are coming up.

**Authentication:** Required

**Rate Limit:** None (general API rate limit applies)

**Query Parameters:**
- `limit` (number, optional): Number of tasks to preview (default: 20, max: 50)

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "description": "Clean windows and glass surfaces in Living Room",
      "task_type": "pillar",
      "room": {
        "id": "clx2b3c4d5e6f7g8h9i0j1k2",
        "name": "Living Room",
        "type": "living_room"
      },
      "pillar_type": "glass",
      "keystone_type": null,
      "position": 5,
      "is_current": true
    },
    {
      "description": "Dust and wipe Living Room coffee table and shelves",
      "task_type": "pillar",
      "room": {
        "id": "clx2b3c4d5e6f7g8h9i0j1k2",
        "name": "Living Room",
        "type": "living_room"
      },
      "pillar_type": "surfaces",
      "keystone_type": null,
      "position": 6,
      "is_current": false
    },
    {
      "description": "Scrub and disinfect master toilet",
      "task_type": "keystone",
      "room": null,
      "pillar_type": null,
      "keystone_type": "master_toilet",
      "position": 7,
      "is_current": false
    },
    {
      "description": "Sweep and mop the Kitchen floor",
      "task_type": "pillar",
      "room": {
        "id": "clx1a2b3c4d5e6f7g8h9i0j1",
        "name": "Kitchen",
        "type": "kitchen"
      },
      "pillar_type": "floor",
      "keystone_type": null,
      "position": 8,
      "is_current": false
    }
  ],
  "current_position": 5,
  "total_tasks": 28
}
```

**Response (200 OK) - No rooms configured:**
```json
{
  "tasks": [],
  "current_position": 0,
  "total_tasks": 0,
  "message": "No rooms configured. Please configure your home to get personalized tasks."
}
```

**Error Responses:**

**400 Bad Request** - Invalid limit:
```json
{
  "error": "Bad request",
  "code": "INVALID_LIMIT",
  "message": "Limit must be between 1 and 50"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

---

### POST /api/tasks/regenerate

Force regeneration of the task rotation. This is useful for testing or when users want to start fresh with updated room configurations immediately instead of waiting for cycle completion.

**Authentication:** Required

**Rate Limit:** 20 requests per 15 minutes

**Request Body:** None required

**Response (200 OK):**
```json
{
  "success": true,
  "rotation": {
    "version": 2,
    "total_tasks": 28,
    "generated_at": "2025-11-26T16:00:00.000Z"
  },
  "message": "Task rotation regenerated successfully"
}
```

**Response (200 OK) - No rooms configured:**
```json
{
  "success": false,
  "message": "Cannot regenerate rotation without configured rooms"
}
```

**Error Responses:**

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many room configuration requests, please try again later.",
  "retryAfter": 900,
  "limit": 20,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

**500 Internal Server Error** - Generation failed:
```json
{
  "error": "Internal server error",
  "code": "ROTATION_GENERATION_ERROR",
  "message": "Failed to regenerate task rotation"
}
```

---

## User Completion Endpoint

### POST /api/user/complete

Complete a task and update the user's streak. When completing a task from the rotation (indicated by `task_rotation_id`), automatically advances to the next task and returns it in the response.

**Authentication:** Required

**Rate Limit:** 10 requests per minute

**Request Body:**
```json
{
  "taskName": "Wipe down Kitchen countertops and table",
  "completionDate": "2025-11-26",
  "notes": "Deep cleaned the island counter too",
  "task_rotation_id": "clx8h9i0j1k2l3m4n5o6p7q8"
}
```

**Request Parameters:**
- `taskName` (string, required): Name/description of the completed task
- `completionDate` (string, optional): Date of completion in ISO 8601 format (YYYY-MM-DD). Defaults to today. Cannot be a future date.
- `notes` (string, optional): Additional notes about the completion
- `task_rotation_id` (string, optional): ID of the task from the rotation being completed. If provided, the system will advance to the next task.

**Response (201 Created) - With rotation:**
```json
{
  "success": true,
  "streak": {
    "current_streak": 15,
    "longest_streak": 20,
    "task_name": "Wipe down Kitchen countertops and table",
    "last_completed": "2025-11-26T16:30:00.000Z"
  },
  "next_task": {
    "id": "clxbk2l3m4n5o6p7q8r9s0t1",
    "description": "Sweep and mop the Kitchen floor",
    "task_type": "pillar",
    "room": {
      "id": "clx1a2b3c4d5e6f7g8h9i0j1",
      "name": "Kitchen",
      "type": "kitchen"
    },
    "pillar_type": "floor",
    "keystone_type": null,
    "position": 6,
    "total_tasks": 28
  }
}
```

**Response (201 Created) - Without rotation:**
```json
{
  "success": true,
  "streak": {
    "current_streak": 5,
    "longest_streak": 10,
    "task_name": "Custom cleaning task",
    "last_completed": "2025-11-26T16:30:00.000Z"
  },
  "next_task": null
}
```

**Response (201 Created) - Rotation cycle completed:**
```json
{
  "success": true,
  "streak": {
    "current_streak": 28,
    "longest_streak": 30,
    "task_name": "Final task in rotation",
    "last_completed": "2025-11-26T16:30:00.000Z"
  },
  "next_task": {
    "id": "clxcl3m4n5o6p7q8r9s0t1u2",
    "description": "Wipe down Kitchen countertops and table",
    "task_type": "pillar",
    "room": {
      "id": "clx1a2b3c4d5e6f7g8h9i0j1",
      "name": "Kitchen",
      "type": "kitchen"
    },
    "pillar_type": "surfaces",
    "keystone_type": null,
    "position": 1,
    "total_tasks": 28,
    "is_new_cycle": true
  }
}
```

**Note:** When a rotation cycle is completed, any pending room configuration changes (deletions, has_glass updates) are applied, and a new rotation is automatically generated with the updated configuration.

**Error Responses:**

**400 Bad Request** - Missing task name:
```json
{
  "error": "Bad request",
  "code": "MISSING_TASK_NAME",
  "message": "Task name is required"
}
```

**400 Bad Request** - Invalid date format:
```json
{
  "error": "Bad request",
  "code": "INVALID_DATE",
  "message": "Invalid completion date format"
}
```

**400 Bad Request** - Future date:
```json
{
  "error": "Bad request",
  "code": "FUTURE_DATE",
  "message": "Completion date cannot be in the future"
}
```

**400 Bad Request** - Invalid task name:
```json
{
  "error": "Bad request",
  "code": "INVALID_TASK_NAME",
  "message": "Invalid task name format"
}
```

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many task completions, please slow down.",
  "retryAfter": 60,
  "limit": 10,
  "reset": "2025-11-26T16:31:00.000Z",
  "remaining": 0
}
```

**500 Internal Server Error** - Completion failed:
```json
{
  "error": "Internal server error",
  "code": "COMPLETION_ERROR",
  "message": "Failed to complete task"
}
```

---

## Task Rotation Logic

### Three Pillars Methodology

The task rotation system uses a "Three Pillars" approach to ensure comprehensive cleaning:

1. **Surfaces Pillar** - Wipe down countertops, tables, shelves, furniture
2. **Floor Pillar** - Sweep, vacuum, or mop floors
3. **Glass Pillar** - Clean windows and glass surfaces (only for rooms with `has_glass: true`)

### Rotation Generation

1. **Room-Based Tasks**: For each active room, one task is generated for each pillar the room supports (surfaces, floor, and optionally glass)
2. **Shuffling**: Tasks are shuffled to create variety and prevent predictable patterns
3. **Keystone Insertion**: Active keystone tasks are randomly inserted throughout the rotation to ensure critical tasks are completed regularly
4. **Cycle Completion**: When all tasks in a rotation are completed, a new rotation is automatically generated with the current room configuration

### Configuration Changes

- **Immediate Changes**: Updates to `customName`, `sortOrder`, and display-related fields take effect immediately
- **Deferred Changes**: Changes to `hasGlass`, `isActive`, room deletions, and keystone `isActive` status are stored as pending changes and applied when the current rotation cycle completes
- **Manual Regeneration**: Users can force immediate regeneration using the `/api/tasks/regenerate` endpoint

### Backward Compatibility

Users who haven't configured rooms will receive a `null` task from `/api/tasks/current` with a message prompting them to configure their home. The frontend can fall back to a legacy day-of-month rotation for these users.

---

## General Error Codes

All endpoints may return these common errors:

**401 Unauthorized** - Authentication required or invalid token:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required"
}
```

**401 Unauthorized** - Token expired:
```json
{
  "error": "Unauthorized",
  "code": "TOKEN_EXPIRED",
  "message": "Token has expired"
}
```

**403 Forbidden** - Access denied:
```json
{
  "error": "Forbidden",
  "code": "ACCESS_DENIED",
  "message": "Access denied"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later.",
  "retryAfter": 900,
  "limit": 100,
  "reset": "2025-11-26T12:15:00.000Z",
  "remaining": 0
}
```

**500 Internal Server Error** - Server error:
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

**503 Service Unavailable** - Service temporarily unavailable:
```json
{
  "error": "Service unavailable",
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service temporarily unavailable"
}
```

---

## Rate Limiting

Rate limits are applied per user (for authenticated requests) or per IP address (for public endpoints). Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit window resets

### Rate Limit Summary

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| General API | 1000 requests | 15 minutes |
| Room Configuration | 20 requests | 15 minutes |
| Task Completion | 10 requests | 1 minute |
| Data Export | 5 requests | 1 hour |
| Account Deletion | 2 requests | 1 hour |

---

## Changelog

### Version 2.0 (2025-11-26)
- Added Room Management endpoints
- Added Keystone Task endpoints
- Added Task Rotation endpoints
- Enhanced User Completion endpoint with rotation support
- Introduced Three Pillars task generation methodology

### Version 1.0 (Initial Release)
- Basic authentication and user management
- Simple day-of-month task rotation
- Streak tracking and completion history
