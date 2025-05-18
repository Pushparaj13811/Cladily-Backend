import crypto from 'crypto';
import { prisma } from '../database/connect.js';

/**
 * OTP Service
 * Handles all functionality related to OTP generation, storage, and verification
 */
export class OtpService {
  constructor() {
    // Default OTP expiry time (10 minutes)
    this.otpExpiryMinutes = 10;
  }

  /**
   * Generate a new OTP for the given phone number
   * @param {string} phoneNumber - User's phone number
   * @returns {Object} - Generated OTP information
   */
  async generateOTP(phoneNumber) {
    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP for storage
    const otpHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
    
    // Calculate expiry time
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + this.otpExpiryMinutes);
    
    // Store OTP in database using Prisma
    // Note: We would typically store this in a dedicated OTP table
    // For this implementation, we'll use metadata in the User model
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: {
          ...user.metadata,
          otpHash,
          otpExpiry: expiryTime.toISOString(),
        },
      },
    });

    return {
      phoneNumber,
      otp, // This would be sent to the user and not returned in production
      expiryMinutes: this.otpExpiryMinutes,
    };
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - User's phone number
   * @param {string} otp - Generated OTP
   * @returns {boolean} - Success status
   */
  async sendOtpSms(phoneNumber, otp) {
    try {
      // In a real implementation, this would integrate with an SMS service
      // For demonstration, we'll log the OTP
      console.log(`SMS OTP sent to ${phoneNumber}: ${otp}`);
      
      // Example integration with SMS service:
      // const response = await smsService.send({
      //   to: phoneNumber,
      //   message: `Your verification code is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes.`,
      // });
      
      return true;
    } catch (error) {
      console.error('Failed to send OTP SMS:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Verify an OTP for the given phone number
   * @param {string} phoneNumber - User's phone number
   * @param {string} otp - OTP to verify
   * @returns {Object} - User object if verification successful
   */
  async verifyOTP(phoneNumber, otp) {
    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const metadata = user.metadata || {};
    
    // Check if OTP exists and is not expired
    if (!metadata.otpHash || !metadata.otpExpiry) {
      throw new Error('No OTP found for this user');
    }
    
    // Check if OTP is expired
    const otpExpiry = new Date(metadata.otpExpiry);
    if (otpExpiry < new Date()) {
      throw new Error('OTP has expired');
    }
    
    // Hash the provided OTP and compare
    const otpHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
    
    if (otpHash !== metadata.otpHash) {
      throw new Error('Invalid OTP');
    }
    
    // Clear OTP data after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
        metadata: {
          ...metadata,
          otpHash: null,
          otpExpiry: null,
        },
      },
    });
    
    return user;
  }

  /**
   * Request OTP login - generates OTP and sends it
   * @param {string} phoneNumber - User's phone number
   * @returns {Object} - Status information
   */
  async requestOtpLogin(phoneNumber) {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    // If user doesn't exist, create a new account
    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber,
          firstName: 'Guest', // Placeholder until user updates
          lastName: 'User',   // Placeholder until user updates
          role: 'CUSTOMER',
          status: 'PENDING_VERIFICATION',
        },
      });

      // Create empty cart and wishlist for the new user
      await prisma.cart.create({
        data: { userId: user.id, subtotal: 0, total: 0, itemCount: 0 }
      });
      
      await prisma.wishlist.create({
        data: { userId: user.id }
      });
    }

    // Generate and send OTP
    const { otp } = await this.generateOTP(phoneNumber);
    await this.sendOtpSms(phoneNumber, otp);

    return {
      message: 'OTP sent successfully',
      isNewUser: !user.phoneVerified,
      phoneNumber,
    };
  }

  /**
   * Verify OTP and complete login
   * @param {string} phoneNumber - User's phone number
   * @param {string} otp - OTP to verify
   * @returns {Object} - User and tokens if verification successful
   */
  async verifyOtpLogin(phoneNumber, otp) {
    // Verify OTP
    const user = await this.verifyOTP(phoneNumber, otp);
    
    // Import AuthService to generate tokens and create session
    const { AuthService } = await import('./auth.service.js');
    const authService = new AuthService();
    
    // Generate tokens
    const { accessToken, refreshToken } = authService.generateTokens(user);
    
    // Create session
    await authService.createSession(user.id, refreshToken);
    
    // Exclude sensitive info
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }
} 