import type { Request, Response, NextFunction } from 'express';
import { estimateService } from '../services/estimate.service';
import { BadRequestError, NotFoundError } from '../utils/error.util';

export class PublicEstimateController {
  /**
   * Patient clicks Approve or Decline link from email. No auth. Returns HTML.
   */
  async respondToEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const token = (req.query.token as string)?.trim();
      const action = (req.query.action as string)?.toLowerCase();
      if (!token || !action) {
        res.status(400).send(this.htmlPage('Invalid link', 'This link is invalid. Please use the link from your estimate email.'));
        return;
      }
      if (action !== 'approve' && action !== 'decline') {
        res.status(400).send(this.htmlPage('Invalid action', 'Please use the Approve or Decline link from your estimate email.'));
        return;
      }
      const result = await estimateService.recordPatientResponse(token, action as 'approve' | 'decline');
      const title = action === 'approve' ? 'Estimate Approved' : 'Estimate Declined';
      const message =
        action === 'approve'
          ? `Thank you. You have approved the cost estimate ${result.estimateNumber}. The practice will be notified and may follow up with next steps.`
          : `You have declined the cost estimate ${result.estimateNumber}. If you have questions, please contact the practice.`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(this.htmlPage(title, message));
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(error instanceof NotFoundError ? 404 : 400).send(this.htmlPage('Unable to record response', (error as Error).message));
        return;
      }
      next(error);
    }
  }

  private htmlPage(title: string, message: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - MedFlow</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 40px auto; padding: 20px; }
    h1 { color: #1976d2; }
    .box { background: #f5f5f5; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="box">
    <p>${message}</p>
    <p>— MedFlow</p>
  </div>
</body>
</html>`.trim();
  }
}

export const publicEstimateController = new PublicEstimateController();
