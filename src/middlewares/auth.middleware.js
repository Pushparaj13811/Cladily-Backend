import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_UNAUTHORIZED } from '../httpStatusCode.js';
import { prisma } from '../database/connect.js';

/**
 * Authentication middleware
 * Verifies JWT token and sets user in request
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
      },
    });

    if (!user) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Invalid authentication token');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new ApiError(HTTP_UNAUTHORIZED, 'User account is not active');
    }

    // Set user in request
    req.user = user;

    next();
  } catch (error) {
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Token expired');
    }

    // Pass other errors
    throw error;
  }
});

/**
 * Role-based authorization middleware
 * Checks if authenticated user has required role
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'You do not have permission to access this resource');
    }

    next();
  };
};
