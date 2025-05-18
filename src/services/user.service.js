import { prisma } from '../database/connect.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * User Service
 * Handles all business logic related to user management
 */
export class UserService {
  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Object} - User object without sensitive information
   */
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profileImage: true,
        phoneVerified: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} userData - User data to update
   * @returns {Object} - Updated user object
   */
  async updateUserProfile(userId, userData) {
    const { firstName, lastName, phoneNumber, profileImage, dateOfBirth } = userData;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phoneNumber,
        profileImage,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profileImage: true,
        phoneVerified: true,
        emailVerified: true,
        dateOfBirth: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found or update failed');
    }

    return user;
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} - Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password) {
      throw new Error('User does not have a password set');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return true;
  }

  /**
   * Generate reset token for password reset
   * @param {string} email - User email
   * @returns {string} - Reset token
   */
  async generateResetToken(email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token expiry (10 minutes)
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setMinutes(resetTokenExpiry.getMinutes() + 10);

    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: {
          ...user.metadata,
          resetTokenHash,
          resetTokenExpiry: resetTokenExpiry.toISOString(),
        },
      },
    });

    return resetToken;
  }

  /**
   * Reset password using token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {boolean} - Success status
   */
  async resetPassword(resetToken, newPassword) {
    // Hash the provided reset token
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Find user with the reset token hash
    const users = await prisma.user.findMany({
      where: {
        metadata: {
          path: ['resetTokenHash'],
          equals: resetTokenHash,
        },
      },
    });

    if (users.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const user = users[0];
    const metadata = user.metadata || {};
    
    // Check if token is expired
    if (!metadata.resetTokenExpiry) {
      throw new Error('Invalid reset token');
    }
    
    const resetTokenExpiry = new Date(metadata.resetTokenExpiry);
    if (resetTokenExpiry < new Date()) {
      throw new Error('Reset token has expired');
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        metadata: {
          ...metadata,
          resetTokenHash: null,
          resetTokenExpiry: null,
        },
      },
    });
    
    return true;
  }

  /**
   * Get user addresses
   * @param {string} userId - User ID
   * @returns {Array} - User addresses
   */
  async getUserAddresses(userId) {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    return addresses;
  }

  /**
   * Add user address
   * @param {string} userId - User ID
   * @param {Object} addressData - Address data
   * @returns {Object} - Created address
   */
  async addUserAddress(userId, addressData) {
    const { 
      fullName, 
      line1, 
      line2, 
      city, 
      state, 
      postalCode, 
      country, 
      phoneNumber,
      isDefault,
      addressType,
      isShipping,
      isBilling
    } = addressData;

    // If this is the default address, unset any existing default
    if (isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    // Create address
    const address = await prisma.address.create({
      data: {
        userId,
        fullName,
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
        phoneNumber,
        isDefault: isDefault || false,
        addressType: addressType || 'HOME',
        isShipping: isShipping ?? true,
        isBilling: isBilling ?? true,
      },
    });

    return address;
  }

  /**
   * Update user address
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID
   * @param {Object} addressData - Address data
   * @returns {Object} - Updated address
   */
  async updateUserAddress(userId, addressId, addressData) {
    // Check if address exists and belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== userId) {
      throw new Error('Address not found or unauthorized');
    }

    const { 
      fullName, 
      line1, 
      line2, 
      city, 
      state, 
      postalCode, 
      country, 
      phoneNumber,
      isDefault,
      addressType,
      isShipping,
      isBilling
    } = addressData;

    // If making this the default address, unset any existing default
    if (isDefault && !existingAddress.isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId,
          isDefault: true,
          id: { not: addressId }
        },
        data: { isDefault: false }
      });
    }

    // Update address
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: {
        fullName,
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
        phoneNumber,
        isDefault: isDefault ?? existingAddress.isDefault,
        addressType: addressType ?? existingAddress.addressType,
        isShipping: isShipping ?? existingAddress.isShipping,
        isBilling: isBilling ?? existingAddress.isBilling,
      },
    });

    return updatedAddress;
  }

  /**
   * Delete user address
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID
   * @returns {boolean} - Success status
   */
  async deleteUserAddress(userId, addressId) {
    // Check if address exists and belongs to user
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new Error('Address not found or unauthorized');
    }

    // Delete address
    await prisma.address.delete({
      where: { id: addressId },
    });

    // If this was the default address, set a new default if any address remains
    if (address.isDefault) {
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      if (addresses.length > 0) {
        await prisma.address.update({
          where: { id: addresses[0].id },
          data: { isDefault: true },
        });
      }
    }

    return true;
  }

  /**
   * Generate email verification token
   * @param {string} userId - User ID
   * @returns {string} - Verification token
   */
  async generateEmailVerificationToken(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Set token expiry (24 hours)
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    // Save verification token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: {
          ...user.metadata,
          emailVerificationTokenHash: verificationTokenHash,
          emailVerificationTokenExpiry: verificationTokenExpiry.toISOString(),
        },
      },
    });

    return verificationToken;
  }

  /**
   * Verify email using token
   * @param {string} verificationToken - Verification token
   * @returns {Object} - User object
   */
  async verifyEmail(verificationToken) {
    // Hash the provided verification token
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Find user with the verification token hash
    const users = await prisma.user.findMany({
      where: {
        metadata: {
          path: ['emailVerificationTokenHash'],
          equals: verificationTokenHash,
        },
      },
    });

    if (users.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const user = users[0];
    const metadata = user.metadata || {};
    
    // Check if token is expired
    if (!metadata.emailVerificationTokenExpiry) {
      throw new Error('Invalid verification token');
    }
    
    const verificationTokenExpiry = new Date(metadata.emailVerificationTokenExpiry);
    if (verificationTokenExpiry < new Date()) {
      throw new Error('Verification token has expired');
    }
    
    // Update email verified status and clear verification token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: user.status === 'PENDING_VERIFICATION' && user.phoneVerified 
          ? 'ACTIVE' 
          : user.status,
        metadata: {
          ...metadata,
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiry: null,
        },
      },
    });
    
    return updatedUser;
  }
} 