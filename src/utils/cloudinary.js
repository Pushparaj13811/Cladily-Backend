import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file to Cloudinary
 * @param {String} filePath - Path to the file to upload
 * @param {Object} options - Upload options (folder, etc.)
 * @returns {Promise<Object>} Upload result
 */
export const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    // Default options
    const defaultOptions = {
      folder: 'cladily',
      resource_type: 'auto',
      ...options
    };

    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, defaultOptions);

    // Remove temporary file if exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    
    // Clean up file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

/**
 * Delete a file from Cloudinary
 * @param {String} publicId - Public ID of the file to delete
 * @param {Object} options - Delete options
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    // Default options
    const defaultOptions = {
      resource_type: 'image',
      ...options
    };

    // Delete file from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, defaultOptions);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

/**
 * Generate a Cloudinary URL with transformations
 * @param {String} publicId - Public ID of the image
 * @param {Object} transformations - Transformations to apply
 * @returns {String} Transformed image URL
 */
export const getCloudinaryUrl = (publicId, transformations = {}) => {
  try {
    return cloudinary.url(publicId, transformations);
  } catch (error) {
    console.error("Error generating Cloudinary URL:", error);
    throw new Error(`Failed to generate Cloudinary URL: ${error.message}`);
  }
}; 