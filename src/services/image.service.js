import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

class ImageService {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
    }

    async uploadImage(file) {
        try {
            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'departments',
                resource_type: 'auto'
            });

            // Delete the temporary file
            fs.unlinkSync(file.path);

            return result;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error('Failed to upload image');
        }
    }

    async deleteImage(publicId) {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Error deleting image:', error);
            throw new Error('Failed to delete image');
        }
    }
}

export { ImageService }; 