import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  registerValidator, loginValidator, refreshTokenValidator,
  verifyEmailValidator, resendCodeValidator, requestPasswordResetValidator,
  verifyPasswordResetValidator, resetPasswordValidator, setupPasswordValidator,
} from '../validators/auth.validator';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { loginRateLimiter } from '../middleware/loginRateLimit.middleware';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Initiate registration (sends verification email)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       200: { description: Verification email sent }
 *       409: { description: Email already exists }
 */
router.post('/register', authRateLimiter, validate(registerValidator), authController.initiateRegistration.bind(authController));

/**
 * @swagger
 * /auth/register/initiate:
 *   post:
 *     summary: Initiate registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       200: { description: Verification email sent }
 *       409: { description: Email already exists }
 */
router.post('/register/initiate', authRateLimiter, validate(registerValidator), authController.initiateRegistration.bind(authController));

/**
 * @swagger
 * /auth/register/verify:
 *   post:
 *     summary: Verify email and complete registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200: { description: Account activated }
 *       400: { description: Invalid or expired token }
 */
router.post('/register/verify', authRateLimiter, validate(verifyEmailValidator), authController.verifyEmailAndRegister.bind(authController));

/**
 * @swagger
 * /auth/register/resend-link:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Verification email resent }
 *       404: { description: Email not found }
 */
router.post('/register/resend-link', authRateLimiter, validate(resendCodeValidator), authController.resendVerificationCode.bind(authController));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401: { description: Invalid credentials }
 *       429: { description: Too many attempts }
 */
router.post('/login', loginRateLimiter, validate(loginValidator), authController.login.bind(authController));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and invalidate token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Logout successful }
 *       401: { description: Unauthorized }
 */
router.post('/logout', authenticate, authController.logout.bind(authController));

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Get new access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New access token generated }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh-token', validate(refreshTokenValidator), authController.refreshToken.bind(authController));

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: User profile }
 *       401: { description: Unauthorized }
 */
router.get('/profile', authenticate, authController.getProfile.bind(authController));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset code sent }
 *       404: { description: Email not found }
 */
router.post('/forgot-password', authRateLimiter, validate(requestPasswordResetValidator), authController.requestPasswordReset.bind(authController));

/**
 * @swagger
 * /auth/forgot-password/verify:
 *   post:
 *     summary: Verify password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string }
 *     responses:
 *       200: { description: Code verified }
 *       400: { description: Invalid or expired code }
 */
router.post('/forgot-password/verify', authRateLimiter, validate(verifyPasswordResetValidator), authController.verifyPasswordResetCode.bind(authController));

/**
 * @swagger
 * /auth/forgot-password/reset:
 *   post:
 *     summary: Reset password with verified code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string }
 *               newPassword: { type: string, format: password }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Invalid or expired code }
 */
router.post('/forgot-password/reset', authRateLimiter, validate(resetPasswordValidator), authController.resetPassword.bind(authController));

/**
 * @swagger
 * /auth/forgot-password/resend-code:
 *   post:
 *     summary: Resend password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Code resent }
 */
router.post('/forgot-password/resend-code', authRateLimiter, validate(resendCodeValidator), authController.resendPasswordResetCode.bind(authController));

/**
 * @swagger
 * /auth/setup-password:
 *   post:
 *     summary: Set password for admin-created accounts
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Password set successfully }
 *       400: { description: Invalid or expired token }
 */
router.post('/setup-password', authRateLimiter, validate(setupPasswordValidator), authController.verifyTokenAndSetPassword.bind(authController));

export default router;