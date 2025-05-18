import { v4 as uuidv4 } from 'uuid';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Middleware to ensure a guest ID exists
 * If the user is authenticated, this is skipped
 * If the user is not authenticated and doesn't have a guest ID cookie, one is created
 */
export const createGuestId = asyncHandler(async (req, res, next) => {
  // Skip if user is authenticated
  if (req.user && req.user.id) {
    return next();
  }
  
  // Check if guest ID cookie exists
  if (!req.cookies.guestId) {
    // Create a new guest ID
    const guestId = uuidv4();
    
    // Set cookie that expires in 30 days
    res.cookie('guestId', guestId, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    
    // Add to request
    req.cookies.guestId = guestId;
  }
  
  next();
}); 