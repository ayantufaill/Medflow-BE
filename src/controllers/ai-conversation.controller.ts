import type { Request, Response, NextFunction } from 'express';

export class AiConversationController {
  async getAiResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;
      if (!message || message.trim() === '') {
        res.status(400).json({ success: false, message: 'Message is required' });
        return;
      }

      // Predefined mock responses based on standard clinical conversation queries
      let responseText = "I'm here to help with your clinical queries. Could you please specify or elaborate on your patient case details?";
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes('periodontal') || lowerMsg.includes('perio')) {
        responseText = "Based on clinical findings, the patient shows localized Stage II Periodontitis with 3-4mm clinical attachment loss. Recommend scaling and root planing (SRP) for quadrants with active bleeding on probing (BOP) and recare scheduled at 3-month intervals.";
      } else if (lowerMsg.includes('biomechanical') || lowerMsg.includes('tooth structure')) {
        responseText = "Structural assessment reveals a longitudinal crack on the distal marginal ridge of tooth #19. There is no pulpal involvement indicated by thermal testing. Suggest a full-coverage crown to prevent further fracture.";
      } else if (lowerMsg.includes('fluoride') || lowerMsg.includes('caries')) {
        responseText = "The patient presents with high caries risk indicators (frequent sugar intake, dry mouth). Strongly recommend prescribing 5000 ppm fluoride toothpaste (Prevident) and application of fluoride varnish at each recall.";
      }

      res.status(200).json({
        success: true,
        data: {
          reply: responseText,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiConversationController = new AiConversationController();
