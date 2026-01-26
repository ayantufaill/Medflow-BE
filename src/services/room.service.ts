import { RoomModel } from '../models/room.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

export class RoomService {
  /**
   * Get all rooms with pagination and search
   */
  async getAllRooms(page = 1, limit = 10, search?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const [rooms, total] = await Promise.all([
      RoomModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RoomModel.countDocuments(query),
    ]);

    return {
      rooms,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId: string) {
    const room = await RoomModel.findById(roomId).lean();

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    return room;
  }

  /**
   * Create new room
   */
  async createRoom(
    data: {
      name: string;
    },
    createdBy: string
  ) {
    // Check if name already exists
    const existing = await RoomModel.findOne({ name: data.name }).lean();
    if (existing) {
      throw new ConflictError('Room with this name already exists');
    }

    // Create room
    const room = await RoomModel.create({
      name: data.name,
      isActive: true,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'rooms',
      String(room._id),
      undefined,
      room.toObject(),
      undefined,
      undefined,
      'low'
    );

    return room;
  }

  /**
   * Update room
   */
  async updateRoom(
    roomId: string,
    updates: {
      name?: string;
      isActive?: boolean;
    },
    updatedBy: string
  ) {
    const room = await RoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // Check if name is already in use by another room
    if (updates.name && updates.name !== room.name) {
      const existing = await RoomModel.findOne({
        name: updates.name,
        _id: { $ne: roomId },
      }).lean();
      if (existing) {
        throw new ConflictError('Room with this name already exists');
      }
    }

    const oldData = room.toObject();

    // Update fields
    Object.assign(room, updates);

    await room.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'rooms',
      roomId,
      oldData,
      room.toObject(),
      undefined,
      undefined,
      'low'
    );

    return room;
  }

  /**
   * Delete room (hard delete)
   */
  async deleteRoom(roomId: string, deletedBy: string) {
    const room = await RoomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const oldData = room.toObject();

    // Hard delete - remove from database
    await RoomModel.deleteOne({ _id: roomId });

    // Log activity
    await logActivity(
      deletedBy,
      'deleted',
      'rooms',
      roomId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Room deleted successfully' };
  }
}

export const roomService = new RoomService();

