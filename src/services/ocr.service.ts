import { ImageAnnotatorClient } from '@google-cloud/vision';

/**
 * OCR Service using Google Cloud Vision API
 */
export class OCRService {
  private client: ImageAnnotatorClient | null = null;

  constructor() {
    // Initialize Google Cloud Vision client
    // Credentials can be provided via:
    // 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON key file)
    // 2. GOOGLE_CLOUD_PROJECT_ID and GOOGLE_CLOUD_PRIVATE_KEY environment variables
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account key file
        this.client = new ImageAnnotatorClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
      } else if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
        // Use environment variables for credentials
        const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n');
        this.client = new ImageAnnotatorClient({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '',
            private_key: privateKey,
          },
        });
      } else {
        // Try default credentials (for GCP environments like Cloud Run, App Engine, etc.)
        try {
          this.client = new ImageAnnotatorClient();
        } catch (error) {
          console.warn('⚠️  Google Cloud Vision: No credentials found. OCR will not be available.');
          console.warn('   Please set GOOGLE_APPLICATION_CREDENTIALS or provide credentials via environment variables.');
          this.client = null;
        }
      }
      console.log('✅ Google Cloud Vision client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud Vision client:', error);
      this.client = null;
    }
  }

  /**
   * Extract text from image using Google Cloud Vision OCR
   * @param imageBuffer - Image file buffer
   * @returns Extracted text
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    if (!this.client) {
      throw new Error('Google Cloud Vision client is not initialized. Please check your credentials.');
    }

    try {
      const [result] = await this.client.textDetection({
        image: {
          content: imageBuffer,
        },
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return '';
      }

      // The first element contains the full text
      const fullText = detections[0]?.description || '';
      return fullText;
    } catch (error: any) {
      console.error('OCR Error:', error);
      throw new Error(
        `Failed to extract text from image: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Check if OCR service is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

// Export singleton instance
export const ocrService = new OCRService();

