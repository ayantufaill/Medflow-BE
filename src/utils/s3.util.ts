import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MOCK_AWS_REGION = 'us-west-2';
const MOCK_AWS_BUCKET = 'medflow-placeholder-bucket';

// Validate AWS configuration
const validateAWSConfig = (): boolean => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  return Boolean(accessKeyId?.trim() && secretAccessKey?.trim() && bucketName?.trim());
};

const hasAWSConfig = (): boolean => {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_S3_BUCKET_NAME?.trim()
  );
};

// Initialize S3 client
const getS3Client = (): S3Client => {
  if (!validateAWSConfig()) {
    throw new Error('AWS S3 is not configured');
  }
  // console.log('AWS_REGION:', process.env.AWS_REGION);
  // console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);
  // console.log('AWS_S3_BASE_URL:', process.env.AWS_S3_BASE_URL);
  // console.log('AWS_S3_USE_ACL:', process.env.AWS_S3_USE_ACL);
  return new S3Client({
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
};

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const S3_BASE_URL = process.env.AWS_S3_BASE_URL || '';

/**
 * Upload file to S3
 * @param file - File buffer
 * @param fileName - Original file name
 * @param folder - Folder path in S3 (e.g., 'practice-logos')
 * @returns S3 URL of uploaded file
 */
export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string = 'practice-logos'
): Promise<string> => {
  try {
    // Validate file
    if (!file || !file.buffer) {
      throw new Error('Invalid file: file buffer is missing');
    }

    // Temporary fallback mode when AWS is not configured.
    if (!hasAWSConfig()) {
      const ext = file.originalname.split('.').pop() || 'bin';
      const uniqueFileName = `${crypto.randomUUID()}.${ext}`;
      const key = `${folder}/${uniqueFileName}`;
      
      // Save locally to uploads/s3-local
      const uploadPath = path.join(process.cwd(), 'uploads', 's3-local', folder);
      fs.mkdirSync(uploadPath, { recursive: true });
      const filePath = path.join(uploadPath, uniqueFileName);
      fs.writeFileSync(filePath, file.buffer);
      
      // Return absolute local URL so frontend router doesn't intercept it
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      return `${baseUrl}/uploads/s3-local/${key}`;
    }

    // Validate AWS configuration
    validateAWSConfig();

    // Generate unique file name
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    // Get S3 client
    const s3Client = getS3Client();

    // Prepare upload command
    // Note: ACL is removed as many modern S3 buckets have ACLs disabled
    // Use bucket policies instead for public access
    const commandParams: any = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
    };

    // Only add ACL if explicitly enabled (for buckets that support it)
    // Most modern buckets use bucket policies instead
    // if (process.env.AWS_S3_USE_ACL === 'true') {
    // commandParams.ACL = 'public-read';
    // }

    const command = new PutObjectCommand(commandParams);

    await s3Client.send(command);

    // Return S3 URL
    if (S3_BASE_URL) {
      return `${S3_BASE_URL}/${key}`;
    }
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${key}`;
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error uploading to S3:', {
      message: error.message,
      code: error.Code || error.code,
      name: error.name,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
    });

    // Provide more specific error messages
    if (error.message && error.message.includes('not configured')) {
      throw error; // Re-throw configuration errors as-is
    }

    if (error.Code === 'AccessDenied' || error.name === 'AccessDenied') {
      throw new Error('Access denied to S3 bucket. Please check your AWS credentials and bucket permissions.');
    }

    if (error.Code === 'NoSuchBucket' || error.name === 'NoSuchBucket') {
      throw new Error(`S3 bucket "${BUCKET_NAME}" does not exist. Please check your AWS_S3_BUCKET_NAME configuration.`);
    }

    if (error.Code === 'InvalidAccessKeyId' || error.name === 'InvalidAccessKeyId') {
      throw new Error('Invalid AWS Access Key ID. Please check your AWS_ACCESS_KEY_ID configuration.');
    }

    if (error.Code === 'SignatureDoesNotMatch' || error.name === 'SignatureDoesNotMatch') {
      throw new Error('Invalid AWS Secret Access Key. Please check your AWS_SECRET_ACCESS_KEY configuration.');
    }

    // Generic error with more context
    const errorMessage = error.message || 'Unknown error';
    throw new Error(`Failed to upload file to S3: ${errorMessage}`);
  }
};

/**
 * Delete file from S3
 * @param fileUrl - S3 URL of the file to delete
 */
export const deleteFromS3 = async (fileUrl: string): Promise<void> => {
  try {
    if (!hasAWSConfig()) {
      // If it's a local fallback URL, delete the local file
      if (fileUrl.startsWith('/uploads/s3-local/')) {
        const localPath = path.join('/app', fileUrl); // maps to /app/uploads/s3-local/...
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
      return;
    }

    // Validate AWS configuration
    validateAWSConfig();

    // Extract key from URL
    let key: string = fileUrl;
    if (fileUrl.includes('.amazonaws.com/')) {
      const parts = fileUrl.split('.amazonaws.com/');
      key = parts[1] || fileUrl;
    } else if (S3_BASE_URL && fileUrl.includes(S3_BASE_URL)) {
      key = fileUrl.replace(S3_BASE_URL + '/', '');
    }

    // Get S3 client
    const s3Client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error('Error deleting from S3:', {
      message: error.message,
      code: error.Code || error.code,
      fileUrl,
    });
    // Don't throw error - file might not exist or might have already been deleted
  }
};

/**
 * Validate file type (images only)
 * @param mimetype - File MIME type
 * @returns boolean
 */
export const isValidImageType = (mimetype: string): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(mimetype);
};

/**
 * Validate file size (max 5MB)
 * @param size - File size in bytes
 * @returns boolean
 */
export const isValidFileSize = (size: number): boolean => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return size <= maxSize;
};
