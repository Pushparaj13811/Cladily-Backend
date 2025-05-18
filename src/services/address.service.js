import { prisma } from '../database/connect.js';

/**
 * Address Service
 * Handles all business logic related to user addresses
 */
export class AddressService {
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
   * Get address by ID
   * @param {string} addressId - Address ID
   * @returns {Object} - Address object
   */
  async getAddressById(addressId) {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

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

    if (!existingAddress) {
      throw new Error('Address not found');
    }

    if (existingAddress.userId !== userId) {
      throw new Error('You are not authorized to update this address');
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

    if (!address) {
      throw new Error('Address not found');
    }

    if (address.userId !== userId) {
      throw new Error('You are not authorized to delete this address');
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
   * Set an address as default
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID
   * @returns {Object} - Updated address
   */
  async setAddressAsDefault(userId, addressId) {
    // Check if address exists and belongs to user
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    if (address.userId !== userId) {
      throw new Error('You are not authorized to update this address');
    }

    // Already default, no need to update
    if (address.isDefault) {
      return address;
    }

    // Unset any existing default address
    await prisma.address.updateMany({
      where: { 
        userId,
        isDefault: true
      },
      data: { isDefault: false }
    });

    // Set this address as default
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return updatedAddress;
  }
} 