import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  verifyEmailValidator,
  resendCodeValidator,
  requestPasswordResetValidator,
  verifyPasswordResetValidator,
  resetPasswordValidator,
  setupPasswordValidator,
} from '../validators/auth.validator';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { loginRateLimiter } from '../middleware/loginRateLimit.middleware';

const router = Router();

// Registration with email verification link
// Backward compatibility: redirect old /register to /register/initiate
router.post('/register', authRateLimiter, validate(registerValidator), authController.initiateRegistration.bind(authController));
router.post('/register/initiate', authRateLimiter, validate(registerValidator), authController.initiateRegistration.bind(authController));
router.post('/register/verify', authRateLimiter, validate(verifyEmailValidator), authController.verifyEmailAndRegister.bind(authController));
router.post('/register/resend-link', authRateLimiter, validate(resendCodeValidator), authController.resendVerificationCode.bind(authController));

router.post('/login', loginRateLimiter, validate(loginValidator), authController.login.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/refresh-token', validate(refreshTokenValidator), authController.refreshToken.bind(authController));
router.get('/profile', authenticate, authController.getProfile.bind(authController));

// Password Reset
router.post('/forgot-password', authRateLimiter, validate(requestPasswordResetValidator), authController.requestPasswordReset.bind(authController));
router.post('/forgot-password/verify', authRateLimiter, validate(verifyPasswordResetValidator), authController.verifyPasswordResetCode.bind(authController));
router.post('/forgot-password/reset', authRateLimiter, validate(resetPasswordValidator), authController.resetPassword.bind(authController));
router.post('/forgot-password/resend-code', authRateLimiter, validate(resendCodeValidator), authController.resendPasswordResetCode.bind(authController));

// Verify token and set password (for admin-created users)
router.post('/setup-password', authRateLimiter, validate(setupPasswordValidator), authController.verifyTokenAndSetPassword.bind(authController));

export default router;

