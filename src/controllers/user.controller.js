import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import redisClient from "../utils/redisClient.js";
import {
    HTTP_UNAUTHORIZED,
    HTTP_OK,
    HTTP_CREATED,
    HTTP_BAD_REQUEST,
    HTTP_FORBIDDEN,
    HTTP_NOT_FOUND,
    HTTP_INTERNAL_SERVER_ERROR,
} from "../httpStatusCode.js";
import ApiResponse from "../utils/apiResponse.js";
import { UserService } from "../services/user.service.js";
import { EmailService } from "../services/email.service.js";
import { OtpService } from "../services/otp.service.js";
import { AuthService } from "../services/auth.service.js";
import { prisma } from "../database/connect.js";
import { CartService } from "../services/cart.service.js";

const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
};

const cleanUserObject = (user) => {
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.usedCoupons;
    delete userObject.emailVerificationToken;
    delete userObject.emailVerificationTokenExpires;
    delete userObject.resetToken;
    delete userObject.resetTokenExpires;

    return userObject;
};

// Initialize services
const userService = new UserService();
const emailService = new EmailService();
const otpService = new OtpService();
const authService = new AuthService();
const cartService = new CartService();

const registerUser = asyncHandler(async (req, res) => {
    const { email, phoneNumber, password, firstName, lastName } = req.body;
    const sessionId = req.cookies?.guestId;
    
    if (!email || !password || !firstName || !lastName) {
        throw new ApiError(HTTP_BAD_REQUEST, "Please provide all required fields");
    }

    try {
        // Register the user through service
        const user = await authService.registerUser({
            email,
            phoneNumber,
            password,
            firstName,
            lastName,
        });

        // Transfer guest cart if it exists
        if (sessionId) {
            try {
                await cartService.mergeGuestCart(user.id, sessionId);
                // Clear the guest ID cookie
                res.clearCookie("guestId", options);
            } catch (cartError) {
                console.error("Error transferring guest cart:", cartError);
                // Don't throw error here, just log it - user registration succeeded
            }
        }

        // Generate verification token and send email
        const verificationToken = await userService.generateEmailVerificationToken(user.id);
        await emailService.sendVerificationEmail(user, verificationToken);
        
        // For phone verification
        if (user.phoneNumber) {
            try {
                const { otp } = await otpService.generateOTP(user.phoneNumber);
                await otpService.sendOtpSms(user.phoneNumber, otp);
            } catch (otpError) {
                console.error("Error sending OTP:", otpError);
                // Don't throw error here, just log it - user registration succeeded
            }
        }

        // Generate tokens for authentication
        const { accessToken, refreshToken } = authService.generateTokens(user);
        
        // Create session for the user
        await authService.createSession(user.id, refreshToken);
        
        // Set refresh token in cookie
        res.cookie('refreshToken', refreshToken, options);

        return res
            .status(HTTP_CREATED)
            .json(
                new ApiResponse(HTTP_CREATED, "User registered successfully", {
                    user,
                    accessToken
                })
            );
    } catch (error) {
        throw new ApiError(
            HTTP_BAD_REQUEST,
            error.message || "Error registering user"
        );
    }
});

const verifyEmail = asyncHandler(async (req, res) => {
    const token = req.params?.token || req.query?.token;

    if (!token) {
        throw new ApiError(HTTP_BAD_REQUEST, "Verification token is required");
    }

    try {
        const user = await userService.verifyEmail(token);
        
        // Send welcome email
        await emailService.sendWelcomeEmail(user);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Email verified successfully", null));
    } catch (error) {
        if (error.message.includes('Invalid or expired verification token')) {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error verifying email"
        );
    }
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        const verificationToken = await userService.generateEmailVerificationToken(userId);
        const user = await userService.getUserProfile(userId);
        
        await emailService.sendVerificationEmail(user, verificationToken);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Verification email sent successfully", null));
    } catch (error) {
        if (error.message === 'Email already verified') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error sending verification email"
        );
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(
            HTTP_BAD_REQUEST,
            "Please provide all required fields"
        );
    }
    try {
        const user = await User.findOne({ email });

        if (!user) {
            throw new ApiError(HTTP_NOT_FOUND, "User does not exist");
        }

        const isPasswordCorrect = await user.isPasswordCorrect(password);

        if (!isPasswordCorrect) {
            throw new ApiError(HTTP_UNAUTHORIZED, "Invalid credentials");
        }

        const cleanUser = cleanUserObject(user);

        const cacheKey = `user:${user._id}`;
        await redisClient.set(cacheKey, JSON.stringify(cleanUser));

        return res
            .status(HTTP_OK)
            .cookie("authToken", user.authToken, options)
            .json(
                new ApiResponse(HTTP_OK, "User logged in successfully", {
                    cleanUser,
                })
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
    }
});

const logoutUser = asyncHandler(async (req, res) => {
    try {
        return res
            .clearCookie("authToken", options)
            .status(HTTP_OK)
            .json(
                new ApiResponse(HTTP_OK, "User logged out successfully", null)
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
    }
});

const resendVerificationCode = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new ApiError(HTTP_NOT_FOUND, "User not found");
        }

        if (!user.phoneNumber) {
            throw new ApiError(HTTP_BAD_REQUEST, "User doesn't have a phone number");
        }

        // Generate and send OTP
        const { otp } = await otpService.generateOTP(user.phoneNumber);
        await otpService.sendOtpSms(user.phoneNumber, otp);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Verification code sent successfully", null));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error sending verification code"
        );
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        throw new ApiError(HTTP_BAD_REQUEST, "Please provide all required fields");
    }

    if (newPassword !== confirmNewPassword) {
        throw new ApiError(HTTP_BAD_REQUEST, "Passwords do not match");
    }

    try {
        await userService.changePassword(userId, currentPassword, newPassword);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Password changed successfully", null));
    } catch (error) {
        if (error.message === 'Incorrect current password') {
            throw new ApiError(HTTP_FORBIDDEN, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error changing password"
        );
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(HTTP_BAD_REQUEST, "Email is required");
    }

    try {
        // Find user and generate reset token
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            // Don't reveal if email exists for security reasons
            return res
                .status(HTTP_OK)
                .json(new ApiResponse(HTTP_OK, "If your email is registered, you will receive a password reset link", null));
        }
        
        const resetToken = await userService.generateResetToken(email);
        
        // Send password reset email
        await emailService.sendResetPasswordEmail(user, resetToken);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "If your email is registered, you will receive a password reset link", null));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error processing password reset request"
        );
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword, confirmNewPassword } = req.body;

    if (!token || !newPassword || !confirmNewPassword) {
        throw new ApiError(HTTP_BAD_REQUEST, "All fields are required");
    }

    if (newPassword !== confirmNewPassword) {
        throw new ApiError(HTTP_BAD_REQUEST, "Passwords do not match");
    }

    try {
        await userService.resetPassword(token, newPassword);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Password reset successfully", null));
    } catch (error) {
        if (error.message.includes('Invalid or expired reset token')) {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error resetting password"
        );
    }
});

const getUserProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await userService.getUserProfile(userId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "User profile retrieved successfully", user));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving user profile"
        );
    }
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName, phoneNumber, profileImage, dateOfBirth } = req.body;

    if (!firstName || !lastName) {
        throw new ApiError(HTTP_BAD_REQUEST, "First name and last name are required");
    }

    try {
        const updatedUser = await userService.updateUserProfile(userId, {
            firstName,
            lastName,
            phoneNumber,
            profileImage,
            dateOfBirth,
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "User profile updated successfully", updatedUser));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating user profile"
        );
    }
});

const updateUsername = asyncHandler(async (req, res) => {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username) {
        throw new ApiError(HTTP_BAD_REQUEST, "Username is required");
    }

    try {
        const updatedUser = await userService.updateUsername(userId, username);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Username updated successfully", updatedUser));
    } catch (error) {
        if (error.message === 'Username already exists') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating username"
        );
    }
});

/**
 * Verify phone number with OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyPhone = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    const otpService = new OtpService();
    const verified = await otpService.verifyOTP(phoneNumber, otp);

    if (verified) {
      return res.status(200).json({
        success: true,
        message: 'Phone number verified successfully',
      });
    }
  } catch (error) {
    console.error('Error verifying phone:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify phone number',
    });
  }
};

/**
 * Activate a user account (for users stuck in PENDING_VERIFICATION)
 */
const activateUserAccount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current user status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
      },
    });
    
    if (!user) {
      throw new ApiError(HTTP_NOT_FOUND, "User not found");
    }
    
    // Only activate if in PENDING_VERIFICATION status
    if (user.status !== 'PENDING_VERIFICATION') {
      return res
        .status(HTTP_OK)
        .json(new ApiResponse(HTTP_OK, "User account is already active", { status: user.status }));
    }
    
    // Update user status to ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phoneVerified: true,
        emailVerified: true,
      },
    });
    
    return res
      .status(HTTP_OK)
      .json(new ApiResponse(HTTP_OK, "User account activated successfully", updatedUser));
  } catch (error) {
    throw new ApiError(
      HTTP_INTERNAL_SERVER_ERROR,
      error.message || "Error activating user account"
    );
  }
});

export {
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    forgotPassword,
    resetPassword,
    resendVerificationCode,
    getUserProfile,
    updateUserProfile,
    updateUsername,
    verifyEmail,
    resendVerificationEmail,
    verifyPhone,
    activateUserAccount
};
