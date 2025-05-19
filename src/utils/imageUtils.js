import cloudinaryService from '../services/cloudinary.service.js';

/**
 * Transform product data to include generated image URLs
 * @param {Object} product - Product data from database
 * @returns {Object} - Transformed product with generated image URLs
 */
export const transformProductImages = (product) => {
  if (!product) return null;

  const transformedProduct = { ...product };

  // Transform featured image
  if (product.featuredImageId) {
    transformedProduct.featuredImageUrl = cloudinaryService.generateImageUrl(product.featuredImageId, {
      width: 800,
      height: 800,
      crop: 'fill'
    });
  }

  // Transform product images array
  if (Array.isArray(product.images)) {
    transformedProduct.images = product.images.map(image => {
      if (typeof image === 'string') {
        // If it's already a URL, return as is
        return image;
      }
      // If it's an object with public_id, generate URL
      return cloudinaryService.generateImageUrl(image.public_id, {
        width: 800,
        height: 800,
        crop: 'fill'
      });
    });
  }

  // Transform variant images if they exist
  if (Array.isArray(product.variants)) {
    transformedProduct.variants = product.variants.map(variant => {
      if (variant.imageId) {
        return {
          ...variant,
          imageUrl: cloudinaryService.generateImageUrl(variant.imageId, {
            width: 400,
            height: 400,
            crop: 'fill'
          })
        };
      }
      return variant;
    });
  }

  return transformedProduct;
};

/**
 * Transform an array of products to include generated image URLs
 * @param {Array<Object>} products - Array of product data from database
 * @returns {Array<Object>} - Transformed products with generated image URLs
 */
export const transformProductsImages = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(product => transformProductImages(product));
};

/**
 * Extract public IDs from image data
 * @param {Array<string|Object>} images - Array of image URLs or objects with public_id
 * @returns {Array<string>} - Array of public IDs
 */
export const extractPublicIds = (images) => {
  if (!Array.isArray(images)) return [];
  
  return images.map(image => {
    if (typeof image === 'string') {
      // If it's a URL, try to extract public_id
      const matches = image.match(/\/v\d+\/([^/]+)\./);
      return matches ? matches[1] : null;
    }
    // If it's an object with public_id
    return image.public_id || null;
  }).filter(Boolean);
}; 