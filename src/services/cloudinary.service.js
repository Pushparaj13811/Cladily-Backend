import { v2 as cloudinary } from 'cloudinary';
import ApiError from '../utils/apiError.js';
import { HTTP_INTERNAL_SERVER_ERROR } from '../httpStatusCode.js';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
  /**
   * Upload a single image to Cloudinary
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<{public_id: string, url: string}>}
   */
  async uploadImage(imagePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found at path: ${imagePath}`);
      }

      console.log(`Uploading image from path: ${imagePath}`);
      
      const result = await cloudinary.uploader.upload(imagePath, {
        folder: 'products',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      });
      
      console.log(`Successfully uploaded image: ${result.secure_url}`);

      // Delete the temporary file after upload
      try {
        fs.unlinkSync(imagePath);
        console.log(`Deleted temporary file: ${imagePath}`);
      } catch (error) {
        console.error(`Error deleting temporary file ${imagePath}:`, error);
      }
      
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new ApiError(
        HTTP_INTERNAL_SERVER_ERROR,
        `Failed to upload image to Cloudinary: ${error.message}`
      );
    }
  }

  /**
   * Upload multiple images to Cloudinary
   * @param {Array<string>} imagePaths - Array of image file paths
   * @returns {Promise<Array<{public_id: string, url: string}>>}
   */
  async uploadMultipleImages(imagePaths) {
    try {
      const uploadPromises = imagePaths.map(imagePath => this.uploadImage(imagePath));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw new ApiError(
        HTTP_INTERNAL_SERVER_ERROR,
        `Failed to upload multiple images: ${error.message}`
      );
    }
  }

  /**
   * Generate a Cloudinary URL from a public_id
   * @param {string} publicId - Cloudinary public_id
   * @param {Object} options - Optional transformation parameters
   * @returns {string} - Generated Cloudinary URL
   */
  generateImageUrl(publicId, options = {}) {
    if (!publicId) return null;
    
    const defaultOptions = {
      quality: 'auto',
      fetch_format: 'auto',
      ...options
    };

    return cloudinary.url(publicId, defaultOptions);
  }

  /**
   * Delete an image from Cloudinary
   * @param {string} publicId - Cloudinary public_id
   * @returns {Promise<void>}
   */
  async deleteImage(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`Successfully deleted image: ${publicId}`);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      throw new ApiError(
        HTTP_INTERNAL_SERVER_ERROR,
        `Failed to delete image from Cloudinary: ${error.message}`
      );
    }
  }

  /**
   * Delete multiple images from Cloudinary
   * @param {Array<string>} publicIds - Array of Cloudinary public_ids
   * @returns {Promise<void>}
   */
  async deleteMultipleImages(publicIds) {
    try {
      const deletePromises = publicIds.map(publicId => this.deleteImage(publicId));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting multiple images:', error);
      throw new ApiError(
        HTTP_INTERNAL_SERVER_ERROR,
        `Failed to delete multiple images: ${error.message}`
      );
    }
  }
}

export default new CloudinaryService(); 