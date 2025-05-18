import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN } from '../httpStatusCode.js';
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

/**
 * Admin authorization middleware
 * Checks if authenticated user has ADMIN role
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
  }

  if (req.user.role !== 'ADMIN') {
    throw new ApiError(HTTP_FORBIDDEN, 'Admin access required');
  }

  next();
});

/**
 * Guest middleware
 * Creates or retrieves a guest cart if no user is authenticated
 */
export const allowGuest = asyncHandler(async (req, res, next) => {
  // If user is authenticated, proceed
  if (req.user) {
    return next();
  }
  
  try {
    // Check for guest token
    const guestToken = req.cookies?.guestToken || req.header('X-Guest-Token');
    
    if (guestToken) {
      // Verify guest token
      const decoded = jwt.verify(guestToken, process.env.JWT_SECRET);
      req.guestId = decoded.guestId;
    } else {
      // Create new guest ID
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      req.guestId = guestId;
      
      // Create guest token
      const guestToken = jwt.sign(
        { guestId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Set cookie for guest token
      res.cookie('guestToken', guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      // Also send in header for non-browser clients
      res.setHeader('X-Guest-Token', guestToken);
    }
    
    next();
  } catch (error) {
    // If there's any issue with the guest token, create a new one
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    req.guestId = guestId;
    
    const guestToken = jwt.sign(
      { guestId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('guestToken', guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    
    res.setHeader('X-Guest-Token', guestToken);
    next();
  }
});
