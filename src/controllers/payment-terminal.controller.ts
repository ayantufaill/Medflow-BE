import type { Request, Response, NextFunction } from 'express';
import { paymentTerminalService } from '../services/payment-terminal.service';

export class PaymentTerminalController {
  async listTerminals(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await paymentTerminalService.listTerminals();
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }

  async createTerminal(req: Request, res: Response, next: NextFunction) {
    try {
      const { Type, SerialNum, AccountToken, Name, MerchantId, Model, DeviceId, TerminalId, LaneId } = req.body;
      const created = await paymentTerminalService.createTerminal({
        Type,
        SerialNum,
        AccountToken,
        Name,
        MerchantId,
        Model,
        DeviceId,
        TerminalId,
        LaneId,
      });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  async deleteTerminal(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await paymentTerminalService.deleteTerminal(id as string);
      res.status(200).json({ success: true, message: 'Payment terminal deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentTerminalController = new PaymentTerminalController();
