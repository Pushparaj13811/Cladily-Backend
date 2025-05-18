import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id and role
 * @returns {string} Access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1h' }
  );
};

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object with id
 * @returns {string} Refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing access and refresh tokens
 */
const generateTokens = (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return { accessToken, refreshToken };
};

/**
 * Verify an access token
 * @param {string} token - The access token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    console.log(`Token verification error: ${error.message}`);
    throw error; // Rethrow to be handled by middleware
  }
};

/**
 * Verify a refresh token
 * @param {string} token - The refresh token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    console.log(`Refresh token verification error: ${error.message}`);
    throw error; // Rethrow to be handled by middleware
  }
};

/**
 * Generate a signed cookie value (DEPRECATED - KEPT FOR BACKWARDS COMPATIBILITY)
 * @param {string} value - Value to store in cookie
 * @returns {string} The value itself (no longer signed)
 */
const signCookieValue = (value) => {
  // Return the value as is - we no longer sign cookies
  return value;
};

/**
 * Verify a signed cookie value (DEPRECATED - KEPT FOR BACKWARDS COMPATIBILITY)
 * @param {string} signedValue - Value from cookie
 * @returns {string|null} The value itself if it looks like a JWT, null otherwise
 */
const verifyCookieValue = (signedValue) => {
  // Check if the value looks like a JWT (has two dots separating three base64 segments)
  if (typeof signedValue === 'string' && signedValue.split('.').length === 3) {
    // It looks like a JWT, return it directly
    return signedValue;
  }
  
  // For legacy signed cookies, attempt to extract the value
  const [value] = signedValue.split('.');
  if (value) return value;
  
  return null;
};

/**
 * Generate a guest token
 * @returns {string} Random token for guest users
 */
const generateGuestToken = () => {
  const guestId = `guest_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  
  return jwt.sign(
    { guestId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '30d' }
  );
};

export { 
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  signCookieValue,
  verifyCookieValue,
  generateGuestToken
};
