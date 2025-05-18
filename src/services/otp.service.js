import { prisma } from '../database/connect.js';
import redisManager from '../utils/redisClient.js';
import { otpKeys } from '../utils/redisKeys.js';

/**
 * OTP Service
 * Handles all functionality related to One-Time Passwords
 */
export class OtpService {
  constructor() {
    this.OTP_EXPIRY = 10 * 60; // 10 minutes in seconds
    this.MAX_ATTEMPTS = 3;
  }

  /**
   * Generate a new OTP for phone verification
   * @param {string} phoneNumber - User's phone number
   * @returns {Object} - OTP info
   */
  async generateOTP(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY * 1000);

    try {
      // Store OTP in Redis with expiry
      const otpData = {
        otp,
        phoneNumber,
        attempts: 0,
        expiresAt: expiresAt.toISOString()
      };

      const cacheKey = otpKeys.phone(phoneNumber);
      await redisManager.set(cacheKey, otpData, this.OTP_EXPIRY);

      return {
        otp,
        expiresAt
      };
    } catch (error) {
      console.error('Error generating OTP:', error);
      throw new Error('Failed to generate OTP');
    }
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - User's phone number
   * @param {string} otp - OTP to send
   * @returns {boolean} - Success status
   */
  async sendOtpSms(phoneNumber, otp) {
    try {
      // In a real implementation, this would integrate with an SMS provider
      // For demonstration purposes, we'll just log the OTP
      console.log(`[SMS WOULD BE SENT] Phone: ${phoneNumber}, OTP: ${otp}`);
      
      // Return true to simulate successful sending
      return true;
    } catch (error) {
      console.error('Error sending OTP via SMS:', error);
      throw new Error('Failed to send OTP via SMS');
    }
  }

  /**
   * Verify OTP
   * @param {string} phoneNumber - User's phone number
   * @param {string} otp - OTP to verify
   * @returns {boolean} - Verification status
   */
  async verifyOTP(phoneNumber, otp) {
    if (!phoneNumber || !otp) {
      throw new Error('Phone number and OTP are required');
    }

    try {
      // Get OTP data from Redis
      const cacheKey = otpKeys.phone(phoneNumber);
      const otpData = await redisManager.get(cacheKey);

      if (!otpData) {
        throw new Error('OTP not found or expired');
      }

      // Check if OTP is expired
      const expiresAt = new Date(otpData.expiresAt);
      if (expiresAt < new Date()) {
        // Clean up expired OTP
        await redisManager.del(cacheKey);
        throw new Error('OTP expired');
      }

      // Check if max attempts exceeded
      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        await redisManager.del(cacheKey);
        throw new Error('Max verification attempts exceeded');
      }

      // Increment attempts
      otpData.attempts += 1;
      await redisManager.set(cacheKey, otpData, this.OTP_EXPIRY);

      // Verify OTP
      if (otpData.otp !== otp) {
        throw new Error('Invalid OTP');
      }

      // OTP verified - delete it to prevent reuse
      await redisManager.del(cacheKey);

      // Update user's phone verification status
      await prisma.user.updateMany({
        where: {
          phoneNumber,
        },
        data: {
          phoneVerified: true,
          status: {
            set: prisma.user.emailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION',
          },
        },
      });

      return true;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  }

  /**
   * Generate OTP for email verification
   * @param {string} email - User's email
   * @returns {Object} - OTP info
   */
  async generateEmailOTP(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY * 1000);

    try {
      // Store OTP in Redis with expiry
      const otpData = {
        otp,
        email,
        attempts: 0,
        expiresAt: expiresAt.toISOString()
      };

      const cacheKey = otpKeys.email(email);
      await redisManager.set(cacheKey, otpData, this.OTP_EXPIRY);

      return {
        otp,
        expiresAt
      };
    } catch (error) {
      console.error('Error generating email OTP:', error);
      throw new Error('Failed to generate email OTP');
    }
  }

  /**
   * Verify email OTP
   * @param {string} email - User's email
   * @param {string} otp - OTP to verify
   * @returns {boolean} - Verification status
   */
  async verifyEmailOTP(email, otp) {
    if (!email || !otp) {
      throw new Error('Email and OTP are required');
    }

    try {
      // Get OTP data from Redis
      const cacheKey = otpKeys.email(email);
      const otpData = await redisManager.get(cacheKey);

      if (!otpData) {
        throw new Error('OTP not found or expired');
      }

      // Check if OTP is expired
      const expiresAt = new Date(otpData.expiresAt);
      if (expiresAt < new Date()) {
        // Clean up expired OTP
        await redisManager.del(cacheKey);
        throw new Error('OTP expired');
      }

      // Check if max attempts exceeded
      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        await redisManager.del(cacheKey);
        throw new Error('Max verification attempts exceeded');
      }

      // Increment attempts
      otpData.attempts += 1;
      await redisManager.set(cacheKey, otpData, this.OTP_EXPIRY);

      // Verify OTP
      if (otpData.otp !== otp) {
        throw new Error('Invalid OTP');
      }

      // OTP verified - delete it to prevent reuse
      await redisManager.del(cacheKey);

      return true;
    } catch (error) {
      console.error('Error verifying email OTP:', error);
      throw error;
    }
  }
} 