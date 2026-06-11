import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class PaymentTerminalService {
  async listTerminals() {
    const list = await prisma.paymentterminal.findMany({
      where: { IsActive: true },
    });
    return list.map((item) => ({
      id: item.TerminalNum.toString(),
      type: item.Type,
      serialNum: item.SerialNum,
      accountToken: item.AccountToken || undefined,
      name: item.Name || undefined,
      merchantId: item.MerchantId || undefined,
      model: item.Model || undefined,
      deviceId: item.DeviceId || undefined,
      terminalId: item.TerminalId || undefined,
      laneId: item.LaneId || undefined,
    }));
  }

  async createTerminal(data: {
    Type: string;
    SerialNum: string;
    AccountToken?: string;
    Name?: string;
    MerchantId?: string;
    Model?: string;
    DeviceId?: string;
    TerminalId?: string;
    LaneId?: string;
  }) {
    const terminal = await prisma.paymentterminal.create({
      data: {
        Type: data.Type,
        SerialNum: data.SerialNum,
        AccountToken: data.AccountToken || null,
        Name: data.Name || null,
        MerchantId: data.MerchantId || null,
        Model: data.Model || null,
        DeviceId: data.DeviceId || null,
        TerminalId: data.TerminalId || null,
        LaneId: data.LaneId || null,
        IsActive: true,
      },
    });

    return {
      id: terminal.TerminalNum.toString(),
      type: terminal.Type,
      serialNum: terminal.SerialNum,
      accountToken: terminal.AccountToken || undefined,
      name: terminal.Name || undefined,
      merchantId: terminal.MerchantId || undefined,
      model: terminal.Model || undefined,
      deviceId: terminal.DeviceId || undefined,
      terminalId: terminal.TerminalId || undefined,
      laneId: terminal.LaneId || undefined,
    };
  }

  async deleteTerminal(id: string) {
    const terminalIdBigInt = BigInt(id);
    const existing = await prisma.paymentterminal.findUnique({
      where: { TerminalNum: terminalIdBigInt },
    });

    if (!existing || !existing.IsActive) {
      throw new NotFoundError('Payment terminal not found');
    }

    await prisma.paymentterminal.update({
      where: { TerminalNum: terminalIdBigInt },
      data: { IsActive: false },
    });

    return { success: true };
  }
}

export const paymentTerminalService = new PaymentTerminalService();
