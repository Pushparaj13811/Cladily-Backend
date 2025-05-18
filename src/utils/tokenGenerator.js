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
    throw error; // Rethrow to be handled by middleware
  }
};

/**
 * Generate a signed cookie value
 * @param {string} value - Value to store in cookie
 * @returns {string} Signed cookie value
 */
const signCookieValue = (value) => {
  const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET);
  hmac.update(value);
  const signature = hmac.digest('base64');
  return `${value}.${signature}`;
};

/**
 * Verify a signed cookie value
 * @param {string} signedValue - Signed cookie value
 * @returns {string|null} Original value if signature is valid, null otherwise
 */
const verifyCookieValue = (signedValue) => {
  const [value, signature] = signedValue.split('.');
  if (!value || !signature) return null;
  
  const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET);
  hmac.update(value);
  const expectedSignature = hmac.digest('base64');
  
  return signature === expectedSignature ? value : null;
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
