import crypto from 'crypto';

/**
 * Generates a signed query string for a given path.
 * The path should be the exact pathname of the URL (e.g. /uploads/patients/123/image.png)
 */
export function signUploadPath(path: string, expiresInMs = 15 * 60 * 1000): string {
  const secret = process.env.UPLOAD_SIGNING_SECRET;
  if (!secret) {
    console.warn('[WARN] UPLOAD_SIGNING_SECRET is not configured. Upload URLs will not be verifiable.');
    return '';
  }

  const expires = Date.now() + expiresInMs;
  const payload = `${path}:${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `expires=${expires}&signature=${signature}`;
}

/**
 * Verifies the signature of a signed URL path.
 */
export function verifyUploadSignature(path: string, expires: string, signature: string): boolean {
  const secret = process.env.UPLOAD_SIGNING_SECRET;
  if (!secret) {
    // Fail closed if not configured
    return false;
  }

  const expTime = parseInt(expires, 10);
  if (isNaN(expTime) || Date.now() > expTime) {
    return false; // Expired or invalid format
  }

  const payload = `${path}:${expires}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (signature.length !== expectedSignature.length) return false;
  
  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
}
