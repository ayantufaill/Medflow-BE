import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapRoomToApi } from '../utils/opendental-mappers.util';

export class RoomService {
  /**
   * Get all rooms with pagination and search
   */
  async getAllRooms(page = 1, limit = 10, search?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      const decodedSearch = decodeURIComponent(search.replace(/\+/g, ' '));
      where.OR = [
        { OpName: { contains: decodedSearch } },
        { Abbrev: { contains: decodedSearch } },
      ];
    }

    if (isActive !== undefined) {
      where.IsHidden = isActive ? 0 : 1;
    }

    const [rows, total] = await Promise.all([
      prisma.operatory.findMany({
        where,
        orderBy: { OpName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.operatory.count({ where }),
    ]);

    return {
      rooms: rows.map(mapRoomToApi),
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
    const room = await prisma.operatory.findUnique({
      where: { OperatoryNum: BigInt(roomId) },
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    return mapRoomToApi(room);
  }

  /**
   * Create new room
   */
  async createRoom(
    data: {
      name: string;
      itemOrder?: number;
    },
    createdBy: string
  ) {
    // Check if name already exists
    const existing = await prisma.operatory.findFirst({
      where: {
        OR: [{ OpName: data.name }, { Abbrev: data.name }],
      },
    });
    if (existing) {
      throw new ConflictError('Room with this name already exists');
    }

    const nextId = await getNextId('operatory', 'OperatoryNum');
    
    // Get max item order if not provided
    let itemOrder = data.itemOrder;
    if (itemOrder === undefined) {
      const maxOrder = await prisma.operatory.aggregate({
        _max: { ItemOrder: true }
      });
      itemOrder = (maxOrder._max.ItemOrder ?? 0) + 1;
    }

    // Create room
    const room = await prisma.operatory.create({
      data: {
        OperatoryNum: nextId,
        OpName: data.name,
        Abbrev: data.name,
        ItemOrder: itemOrder,
        IsHidden: 0,
      },
    });

    const apiRoom = mapRoomToApi(room);
    // ... log activity (omitted for brevity in instruction but keep in actual file)
    await logActivity(
      createdBy,
      'created',
      'rooms',
      apiRoom._id,
      undefined,
      apiRoom,
      undefined,
      undefined,
      'low'
    );

    return apiRoom;
  }

  /**
   * Update room
   */
  async updateRoom(
    roomId: string,
    updates: {
      name?: string;
      isActive?: boolean;
      itemOrder?: number;
    },
    updatedBy: string
  ) {
    const room = await prisma.operatory.findUnique({
      where: { OperatoryNum: BigInt(roomId) },
    });
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // Check if name is already in use by another room
    if (updates.name && updates.name !== (room.OpName ?? room.Abbrev ?? '')) {
      const existing = await prisma.operatory.findFirst({
        where: {
          OperatoryNum: { not: BigInt(roomId) },
          OR: [{ OpName: updates.name }, { Abbrev: updates.name }],
        },
      });
      if (existing) {
        throw new ConflictError('Room with this name already exists');
      }
    }

    const oldData = mapRoomToApi(room);

    const updated = await prisma.operatory.update({
      where: { OperatoryNum: BigInt(roomId) },
      data: {
        OpName: updates.name ?? undefined,
        Abbrev: updates.name ?? undefined,
        ItemOrder: updates.itemOrder ?? undefined,
        IsHidden:
          updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    const apiRoom = mapRoomToApi(updated);

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'rooms',
      roomId,
      oldData,
      apiRoom,
      undefined,
      undefined,
      'low'
    );

    return apiRoom;
  }

  /**
   * Delete room (hard delete)
   */
  async deleteRoom(roomId: string, deletedBy: string) {
    const room = await prisma.operatory.findUnique({
      where: { OperatoryNum: BigInt(roomId) },
    });
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const oldData = mapRoomToApi(room);

    // Hard delete - remove from database
    await prisma.operatory.delete({
      where: { OperatoryNum: BigInt(roomId) },
    });

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
