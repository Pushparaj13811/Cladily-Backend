import { prisma } from "../database/connect.js";
import cloudinaryService from './cloudinary.service.js';

/**
 * Service for managing product reviews
 */
export class ReviewService {
  /**
   * Create a new product review
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @param {Object} reviewData - Review data (rating, comment, title)
   * @param {Array} imageFiles - Image files to upload
   * @returns {Object} Created review
   */
  async createReview(userId, productId, reviewData, imageFiles = []) {
    const { rating, comment, title } = reviewData;

    if (!productId) {
      throw new Error("Product ID is required");
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error("Product not found");
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        productId
      }
    });

    if (existingReview) {
      throw new Error("You have already reviewed this product");
    }

    // Verify if user has purchased the product
    const hasPurchased = await this.verifyPurchase(userId, productId);

    // Create new review and upload images in a transaction
    return await prisma.$transaction(async (prisma) => {
      // Create review
      const review = await prisma.review.create({
        data: {
          userId,
          productId,
          rating,
          comment,
          title,
          isVerifiedPurchase: hasPurchased,
          status: "PENDING" // Reviews require approval before being visible
        }
      });

      // Upload images if provided
      const reviewImages = [];
      if (imageFiles && imageFiles.length > 0) {
        for (const file of imageFiles) {
          const result = await cloudinaryService.uploadImage(file.path);
          if (result && result.secure_url) {
            const image = await prisma.reviewImage.create({
              data: {
                reviewId: review.id,
                url: result.secure_url
              }
            });
            reviewImages.push(image);
          }
        }
      }

      // Update product rating
      await this.updateProductRating(productId);

      // Return review with images
      return {
        ...review,
        images: reviewImages
      };
    });
  }

  /**
   * Get product reviews with pagination
   * @param {String} productId - Product ID
   * @param {Object} options - Pagination options
   * @returns {Object} Paginated reviews
   */
  async getProductReviews(productId, options = {}) {
    const { page = 1, limit = 10, status = "APPROVED" } = options;
    const skip = (page - 1) * limit;

    if (!productId) {
      throw new Error("Product ID is required");
    }

    // Build the where clause
    const where = {
      productId,
      status,
      deletedAt: null
    };

    // Get reviews with pagination
    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          },
          images: true
        }
      }),
      prisma.review.count({ where })
    ]);

    return {
      reviews,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Get review by ID
   * @param {String} reviewId - Review ID
   * @returns {Object} Review details
   */
  async getReviewById(reviewId) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        images: true,
        product: {
          select: {
            id: true, 
            name: true,
            slug: true
          }
        }
      }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    return review;
  }

  /**
   * Update a review
   * @param {String} reviewId - Review ID
   * @param {String} userId - User ID (for authorization)
   * @param {Object} updateData - Updated review data
   * @param {Array} newImageFiles - New image files to upload
   * @param {Array} deleteImageIds - IDs of images to delete
   * @returns {Object} Updated review
   */
  async updateReview(reviewId, userId, updateData, newImageFiles = [], deleteImageIds = []) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    // Find the review and check ownership
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { images: true }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    if (review.userId !== userId) {
      throw new Error("You are not authorized to update this review");
    }

    // Handle data validation
    const { rating, comment, title } = updateData;
    const updatedFields = {};

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      updatedFields.rating = rating;
    }

    if (comment !== undefined) {
      updatedFields.comment = comment;
    }

    if (title !== undefined) {
      updatedFields.title = title;
    }

    // Set status back to pending if the review is being changed
    if (Object.keys(updatedFields).length > 0) {
      updatedFields.status = "PENDING";
    }

    // Update review and handle images in a transaction
    return await prisma.$transaction(async (prisma) => {
      // Update review
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: updatedFields
      });

      // Delete images if requested
      if (deleteImageIds && deleteImageIds.length > 0) {
        const imagesToDelete = review.images.filter(img => deleteImageIds.includes(img.id));
        
        // Delete from Cloudinary
        for (const image of imagesToDelete) {
          // Extract public ID from URL
          const publicId = image.url.split('/').pop().split('.')[0];
          await cloudinaryService.deleteImage(publicId);
        }
        
        // Delete from database
        await prisma.reviewImage.deleteMany({
          where: {
            id: { in: deleteImageIds },
            reviewId
          }
        });
      }

      // Upload new images if provided
      if (newImageFiles && newImageFiles.length > 0) {
        for (const file of newImageFiles) {
          const result = await cloudinaryService.uploadImage(file.path);
          if (result && result.secure_url) {
            await prisma.reviewImage.create({
              data: {
                reviewId,
                url: result.secure_url
              }
            });
          }
        }
      }

      // Update product rating
      await this.updateProductRating(review.productId);

      // Return updated review with images
      return await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          images: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });
  }

  /**
   * Delete a review
   * @param {String} reviewId - Review ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Boolean} Success status
   */
  async deleteReview(reviewId, userId, isAdmin = false) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    // Find the review and check ownership
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { images: true }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    // Only allow owner or admin to delete
    if (!isAdmin && review.userId !== userId) {
      throw new Error("You are not authorized to delete this review");
    }

    // Soft delete the review and handle images
    return await prisma.$transaction(async (prisma) => {
      // Soft delete review
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          deletedAt: new Date(),
          status: "REJECTED"
        }
      });

      // Delete images from Cloudinary (but keep the database records)
      for (const image of review.images) {
        // Extract public ID from URL
        const publicId = image.url.split('/').pop().split('.')[0];
        await cloudinaryService.deleteImage(publicId);
      }

      // Update product rating
      await this.updateProductRating(review.productId);

      return true;
    });
  }

  /**
   * Mark a review as helpful
   * @param {String} reviewId - Review ID
   * @returns {Object} Updated helpful count
   */
  async markReviewAsHelpful(reviewId) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        helpfulCount: { increment: 1 }
      }
    });

    return {
      helpfulCount: updatedReview.helpfulCount
    };
  }

  /**
   * Report a review
   * @param {String} reviewId - Review ID
   * @param {String} reason - Report reason
   * @returns {Object} Updated report count
   */
  async reportReview(reviewId, reason) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    if (!reason) {
      throw new Error("Report reason is required");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        reportCount: { increment: 1 }
      }
    });

    // If report count exceeds threshold, mark for moderation
    if (updatedReview.reportCount >= 3) {
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: "PENDING"
        }
      });
    }

    return {
      reportCount: updatedReview.reportCount
    };
  }

  /**
   * Update review status (admin only)
   * @param {String} reviewId - Review ID
   * @param {String} status - New status (APPROVED, REJECTED)
   * @returns {Object} Updated review
   */
  async updateReviewStatus(reviewId, status) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      throw new Error("Invalid status value");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { status }
    });

    // If changing status, update product rating
    if (review.status !== status) {
      await this.updateProductRating(review.productId);
    }

    return updatedReview;
  }

  /**
   * Add admin reply to a review
   * @param {String} reviewId - Review ID
   * @param {String} adminId - Admin user ID
   * @param {String} reply - Reply text
   * @returns {Object} Updated review with reply
   */
  async addReviewReply(reviewId, adminId, reply) {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    if (!reply) {
      throw new Error("Reply text is required");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new Error("Review not found");
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        reply,
        repliedAt: new Date(),
        repliedByUserId: adminId
      }
    });

    return updatedReview;
  }

  /**
   * Get stats for product reviews
   * @param {String} productId - Product ID
   * @returns {Object} Review statistics
   */
  async getProductReviewStats(productId) {
    if (!productId) {
      throw new Error("Product ID is required");
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error("Product not found");
    }

    // Get approved reviews only
    const reviews = await prisma.review.findMany({
      where: {
        productId,
        status: "APPROVED",
        deletedAt: null
      },
      select: {
        rating: true
      }
    });

    // Calculate statistics
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // Count by rating
    const ratingCounts = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };

    reviews.forEach(review => {
      ratingCounts[review.rating]++;
    });

    // Calculate percentages
    const ratingPercentages = {};
    Object.keys(ratingCounts).forEach(rating => {
      ratingPercentages[rating] = totalReviews > 0
        ? (ratingCounts[rating] / totalReviews) * 100
        : 0;
    });

    return {
      totalReviews,
      averageRating: avgRating,
      ratingCounts,
      ratingPercentages
    };
  }

  /**
   * Check if a user has purchased a product
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Boolean} True if user has purchased the product
   * @private
   */
  async verifyPurchase(userId, productId) {
    // Check if user has ordered this product and received it
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          userId,
          status: "DELIVERED" // Only count completed orders
        }
      }
    });

    return orderItems.length > 0;
  }

  /**
   * Update product rating based on approved reviews
   * @param {String} productId - Product ID
   * @returns {Object} Updated rating info
   * @private
   */
  async updateProductRating(productId) {
    // Get all approved reviews for the product
    const reviews = await prisma.review.findMany({
      where: {
        productId,
        status: "APPROVED",
        deletedAt: null
      },
      select: {
        rating: true
      }
    });

    // Calculate average rating
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // Update product with new rating information
    await prisma.product.update({
      where: { id: productId },
      data: {
        rating: avgRating,
        reviewCount: totalReviews
      }
    });

    return {
      rating: avgRating,
      reviewCount: totalReviews
    };
  }
} 