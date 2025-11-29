const { prisma } = require('../config/prisma');
const TaskProgressService = require('../services/taskProgressService');
const TaskGenerationService = require('../services/taskGenerationService');
const RoomService = require('../services/roomService');

// Instantiate services
const taskGenerationService = new TaskGenerationService();
const taskProgressService = new TaskProgressService();
const roomService = new RoomService();

class TaskController {
  /**
   * Get the current task from rotation
   * GET /api/tasks/current
   */
  static async getCurrentTask(req, res) {
    try {
      const { userId } = req.user;

      // Check if user has configured rooms
      const hasRooms = await roomService.hasConfiguredRooms(userId);

      if (!hasRooms) {
        return res.status(200).json({
          task: null,
          hasConfiguredRooms: false,
          message: 'No rooms configured. Please configure your home to get personalized tasks.'
        });
      }

      // Get current task from rotation
      const task = await taskProgressService.getCurrentTask(userId);

      if (!task) {
        return res.status(200).json({
          task: null,
          hasConfiguredRooms: true,
          message: 'No task rotation found. Please configure your rooms.'
        });
      }

      // Get progress information
      const progress = await taskProgressService.getProgress(userId);

      // Get total tasks in current rotation
      const totalTasks = await prisma.task_rotation.count({
        where: {
          user_id: userId,
          rotation_version: progress.current_rotation_version
        }
      });

      // Get room information if it's a pillar task
      let roomInfo = null;
      if (task.room_id) {
        const room = await prisma.user_rooms.findUnique({
          where: { id: task.room_id },
          select: {
            id: true,
            custom_name: true,
            room_type: true
          }
        });
        roomInfo = room ? {
          id: room.id,
          name: room.custom_name,
          type: room.room_type
        } : null;
      }

      // Format response
      const response = {
        id: task.id,
        description: task.task_description,
        type: task.task_type,  // Use 'type' to match test expectations
        task_type: task.task_type,  // Keep for backward compatibility
        room: roomInfo,
        pillar: task.pillar_type,  // Use 'pillar' to match test expectations
        pillar_type: task.pillar_type,  // Keep for backward compatibility
        keystone_type: task.keystone_type,
        position: task.sequence_position,
        total_tasks: totalTasks
      };

      res.status(200).json({
        task: response,
        hasConfiguredRooms: true,
        progress: {
          current_position: task.sequence_position,
          total_tasks: totalTasks,
          rotation_version: progress.current_rotation_version,
          has_pending_changes: progress.has_pending_config_changes
        }
      });

    } catch (error) {
      console.error('Get current task error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve current task. Please try again.'
      });
    }
  }

  /**
   * Preview upcoming tasks in rotation
   * GET /api/tasks/preview?limit=20
   */
  static async previewTasks(req, res) {
    try {
      const { userId } = req.user;
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

      // Check if user has configured rooms
      const hasRooms = await roomService.hasConfiguredRooms(userId);

      if (!hasRooms) {
        return res.status(200).json({
          preview: [],
          current_position: 0,
          total_tasks: 0,
          message: 'No rooms configured'
        });
      }

      // Ensure rotation exists (auto-generate if needed)
      await taskProgressService.getCurrentTask(userId);

      // Get progress information
      const progress = await taskProgressService.getProgress(userId);

      if (!progress) {
        return res.status(200).json({
          preview: [],
          current_position: 0,
          total_tasks: 0,
          message: 'No rotation found'
        });
      }

      // Get upcoming tasks
      const tasks = await prisma.task_rotation.findMany({
        where: {
          user_id: userId,
          rotation_version: progress.current_rotation_version,
          sequence_position: {
            gte: progress.current_task_index
          }
        },
        orderBy: {
          sequence_position: 'asc'
        },
        take: limit
      });

      // Get total tasks count
      const totalTasks = await prisma.task_rotation.count({
        where: {
          user_id: userId,
          rotation_version: progress.current_rotation_version
        }
      });

      // Get unique room IDs to fetch room information
      const roomIds = [...new Set(tasks.filter(t => t.room_id).map(t => t.room_id))];
      const rooms = roomIds.length > 0 ? await prisma.user_rooms.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, custom_name: true, room_type: true }
      }) : [];

      // Create a room lookup map
      const roomMap = new Map(rooms.map(r => [r.id, r]));

      // Format tasks
      const formattedTasks = tasks.map(task => {
        const room = task.room_id ? roomMap.get(task.room_id) : null;
        return {
          description: task.task_description,
          task_type: task.task_type,
          room: room ? {
            id: room.id,
            name: room.custom_name,
            type: room.room_type
          } : null,
          pillar_type: task.pillar_type,
          keystone_type: task.keystone_type,
          position: task.sequence_position,
          is_current: task.sequence_position === progress.current_task_index
        };
      });

      res.status(200).json({
        preview: formattedTasks,
        current_position: progress.current_task_index,
        total_tasks: totalTasks
      });

    } catch (error) {
      console.error('Preview tasks error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to preview tasks. Please try again.'
      });
    }
  }

  /**
   * Force regeneration of task rotation (admin/debug)
   * POST /api/tasks/regenerate
   */
  static async regenerateRotation(req, res) {
    try {
      const { userId } = req.user;

      // Check if user has configured rooms
      const hasRooms = await roomService.hasConfiguredRooms(userId);

      if (!hasRooms) {
        return res.status(400).json({
          error: 'No rooms configured',
          message: 'Please configure at least one room before generating a task rotation.'
        });
      }

      // Generate new rotation
      const rotation = await taskGenerationService.generateRotation(userId, false);

      // Update progress to point to new rotation
      await prisma.user_task_progress.upsert({
        where: { user_id: userId },
        update: {
          current_task_index: 1,
          current_rotation_version: rotation.version,
          rotation_generated_at: rotation.generated_at,
          has_pending_config_changes: false
        },
        create: {
          id: require('@paralleldrive/cuid2').createId(),
          user_id: userId,
          current_task_index: 1,
          current_rotation_version: rotation.version,
          rotation_generated_at: rotation.generated_at,
          has_pending_config_changes: false
        }
      });

      res.status(200).json({
        success: true,
        rotation: {
          version: rotation.version,
          total_tasks: rotation.total_tasks,
          generated_at: rotation.generated_at
        },
        message: 'Task rotation regenerated successfully'
      });

    } catch (error) {
      console.error('Regenerate rotation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to regenerate rotation. Please try again.'
      });
    }
  }
}

module.exports = TaskController;
