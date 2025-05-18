import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN } from '../httpStatusCode.js';
import { prisma } from '../database/connect.js';
import { 
  verifyAccessToken, 
  verifyCookieValue, 
  generateGuestToken 
} from '../utils/tokenGenerator.js';

/**
 * Authentication middleware
 * Verifies JWT token and sets user in request
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
    }

    // If token comes from a cookie, verify the cookie signature
    if (req.cookies?.accessToken) {
      const verifiedValue = verifyCookieValue(req.cookies.accessToken);
      if (!verifiedValue) {
        throw new ApiError(HTTP_UNAUTHORIZED, 'Invalid cookie signature');
      }
      token = verifiedValue;
    }

    // Verify token using the token generator utility
    const decoded = verifyAccessToken(token);
    console.log('Token decoded payload:', decoded);

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

    console.log('User from database:', {
      id: user.id,
      role: user.role,
      status: user.status
    });

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
    console.log('Authorization check:', {
      userRole: req.user?.role,
      requiredRoles: roles,
      hasAccess: req.user && roles.includes(req.user.role)
    });

    if (!req.user) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
    }

    // Case-insensitive role check
    const userRole = req.user.role.toUpperCase();
    const normalizedRoles = roles.map(role => role.toUpperCase());
    
    if (!normalizedRoles.includes(userRole)) {
      throw new ApiError(
        HTTP_FORBIDDEN, 
        `Access denied. Required role: ${roles.join(' or ')}, User role: ${req.user.role}`
      );
    }

    next();
  };
};

/**
 * Admin authorization middleware
 * Checks if authenticated user has ADMIN role
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
  console.log('Admin check:', {
    userRole: req.user?.role,
    hasAccess: req.user && req.user.role.toUpperCase() === 'ADMIN'
  });

  if (!req.user) {
    throw new ApiError(HTTP_UNAUTHORIZED, 'Authentication required');
  }

  if (req.user.role.toUpperCase() !== 'ADMIN') {
    throw new ApiError(
      HTTP_FORBIDDEN, 
      `Admin access required. Current role: ${req.user.role}`
    );
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
      try {
        const decoded = verifyAccessToken(guestToken);
        req.guestId = decoded.guestId;
      } catch (error) {
        // If token is invalid, create a new one
        const newGuestToken = generateGuestToken();
        req.guestId = newGuestToken.split('.')[0];
        
        // Set cookie for guest token
        res.cookie('guestToken', newGuestToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
    } else {
      // Create new guest token
      const newGuestToken = generateGuestToken();
      req.guestId = newGuestToken.split('.')[0];
      
      // Set cookie for guest token
      res.cookie('guestToken', newGuestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      // Also send in header for non-browser clients
      res.setHeader('X-Guest-Token', newGuestToken);
    }
    
    next();
  } catch (error) {
    // If there's any issue with the guest token, create a new one
    const newGuestToken = generateGuestToken();
    req.guestId = newGuestToken.split('.')[0];
    
    res.cookie('guestToken', newGuestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    
    res.setHeader('X-Guest-Token', newGuestToken);
    next();
  }
});
