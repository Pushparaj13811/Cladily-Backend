import ApiError from "../utils/apiError.js";
import { HTTP_FORBIDDEN } from "../httpStatusCode.js";
import { prisma } from "../database/connect.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Middleware to check if user has admin role
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
  // Check if user exists in request (should be set by authenticate middleware)
  if (!req.user || !req.user.id) {
    throw new ApiError(HTTP_FORBIDDEN, "Access denied: User not authenticated");
  }

  // Get user with role from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true }
  });

  // Check if user exists and has admin role
  if (!user || user.role !== 'ADMIN') {
    throw new ApiError(HTTP_FORBIDDEN, "Access denied: Admin privileges required");
  }

  next();
});

/**
 * Middleware to check if user has seller role
 */
export const isSeller = asyncHandler(async (req, res, next) => {
  // Check if user exists in request
  if (!req.user || !req.user.id) {
    throw new ApiError(HTTP_FORBIDDEN, "Access denied: User not authenticated");
  }

  // Get user with role from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true }
  });

  // Check if user exists and has seller or admin role
  if (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN')) {
    throw new ApiError(HTTP_FORBIDDEN, "Access denied: Seller privileges required");
  }

  next();
});

/**
 * Middleware factory to check for specific roles
 * @param {Array} roles - Array of allowed roles
 */
export const hasRole = (roles) => {
  return asyncHandler(async (req, res, next) => {
    // Check if user exists in request
    if (!req.user || !req.user.id) {
      throw new ApiError(HTTP_FORBIDDEN, "Access denied: User not authenticated");
    }

    // Get user with role from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });

    // Check if user exists and has one of the specified roles
    if (!user || !roles.includes(user.role)) {
      throw new ApiError(HTTP_FORBIDDEN, `Access denied: Required role not found`);
    }

    next();
  });
}; 