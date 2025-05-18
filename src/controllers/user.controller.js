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
import mongoose from "mongoose";
import sendVerificationCode from "../services/sendVerificationCode.service.js";
import { UserService } from "../services/user.service.js";
import { EmailService } from "../services/email.service.js";
import { OtpService } from "../services/otp.service.js";
import { AuthService } from "../services/auth.service.js";
import { prisma } from "../database/connect.js";

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

const registerUser = asyncHandler(async (req, res) => {
    const { email, phoneNumber, password, firstName, lastName } = req.body;
    const { guestCartId } = req.cookies;
    
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
        if (guestCartId) {
            try {
                // Find guest cart
                const guestCart = await prisma.cart.findUnique({
                    where: { id: guestCartId }
                });
                
                if (guestCart) {
                    // Get items from guest cart
                    const cartItems = await prisma.cartItem.findMany({
                        where: { cartId: guestCartId }
                    });
                    
                    // Find user cart
                    const userCart = await prisma.cart.findFirst({
                        where: { userId: user.id }
                    });
                    
                    // Transfer items to user cart
                    if (userCart && cartItems.length > 0) {
                        for (const item of cartItems) {
                            await prisma.cartItem.create({
                                data: {
                                    cartId: userCart.id,
                                    productId: item.productId,
                                    variantId: item.variantId,
                                    quantity: item.quantity,
                                    price: item.price,
                                    totalPrice: item.totalPrice
                                }
                            });
                        }
                        
                        // Update cart totals
                        await prisma.cart.update({
                            where: { id: userCart.id },
                            data: {
                                subtotal: guestCart.subtotal,
                                total: guestCart.total,
                                itemCount: guestCart.itemCount,
                                discountTotal: guestCart.discountTotal,
                            }
                        });
                        
                        // Delete guest cart items
                        await prisma.cartItem.deleteMany({
                            where: { cartId: guestCartId }
                        });
                        
                        // Delete guest cart
                        await prisma.cart.delete({
                            where: { id: guestCartId }
                        });
                    }
                }
                
                // Clear guest cart cookie
                res.clearCookie("guestCartId", options);
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
    const userId = req.user._id;

    if (!userId) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            "User not authenticated"
        );
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, "User not found");
    }

    const { phone } = user;

    if (!phone) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            "Phone number not available"
        );
    }

    try {
        const response = await sendVerificationCode(phone);

        if (!response) {
            throw new ApiError(
                HTTP_INTERNAL_SERVER_ERROR,
                "Error sending verification code"
            );
        }

        return res
            .status(HTTP_OK)
            .json(
                new ApiResponse(
                    HTTP_OK,
                    "Verification code sent successfully",
                    response
                )
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        throw new ApiError(
            HTTP_BAD_REQUEST,
            "Please provide all required fields"
        );
    }

    if (newPassword !== confirmNewPassword) {
        throw new ApiError(HTTP_BAD_REQUEST, "Passwords do not match");
    }

    try {
        const user = req.user;
        const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

        if (!isPasswordCorrect) {
            throw new ApiError(HTTP_FORBIDDEN, "Incorrect Old password");
        }

        user.password = newPassword;
        await user.save({ validateBeforeSave: false });

        return res
            .status(HTTP_OK)
            .json(
                new ApiResponse(HTTP_OK, "Password changed successfully", null)
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
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

    if (!username) {
        throw new ApiError(
            HTTP_BAD_REQUEST,
            "Please provide all required fields"
        );
    }

    const userId = req.user._id;

    try {
        const existingUser = await User.findOne({
            $or: [
                { username }, // Check if the username exists
                { _id: userId }, // Fetch the user by ID to update
            ],
        });

        if (existingUser && existingUser._id.toString() !== userId.toString()) {
            throw new ApiError(HTTP_BAD_REQUEST, "Username already exists");
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            throw new ApiError(
                HTTP_UNAUTHORIZED,
                "Not authorized to update user"
            );
        }

        const resUser = cleanUserObject(updatedUser);

        return res
            .status(HTTP_OK)
            .json(
                new ApiResponse(
                    HTTP_OK,
                    "Username updated successfully",
                    resUser
                )
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
    }
});

const updateUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { addressId } = req.params;
    const { 
        fullName, 
        line1, 
        line2, 
        city, 
        state, 
        postalCode, 
        country, 
        phoneNumber,
        isDefault,
        addressType,
        isShipping,
        isBilling
    } = req.body;

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    if (!fullName || !line1 || !city || !state || !postalCode || !country) {
        throw new ApiError(HTTP_BAD_REQUEST, "Required address fields are missing");
    }

    try {
        const address = await userService.updateUserAddress(userId, addressId, {
            fullName, 
            line1, 
            line2, 
            city, 
            state, 
            postalCode, 
            country, 
            phoneNumber,
            isDefault,
            addressType,
            isShipping,
            isBilling
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Address updated successfully", address));
    } catch (error) {
        if (error.message.includes('Address not found or unauthorized')) {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating address"
        );
    }
});

const getUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!userId) {
        throw new ApiError(
            HTTP_UNAUTHORIZED,
            "You are not authorized to get user address"
        );
    }

    try {
        const userAddress = await Address.find({ userId });

        if (!userAddress) {
            throw new ApiError(HTTP_NOT_FOUND, "User address not found");
        }

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "User address", userAddress));
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
    }
});

const deleteUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!userId) {
        throw new ApiError(
            HTTP_UNAUTHORIZED,
            "You are not authorized to delete user address"
        );
    }

    const { addressId } = req.params;

    const id = new mongoose.Types.ObjectId(addressId);

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    try {
        const address = await Address.findOneAndDelete({
            _id: id,
            userId: userId,
        });

        if (!address) {
            throw new ApiError(
                HTTP_NOT_FOUND,
                "Address not found or unauthorized to delete address"
            );
        }

        return res
            .status(HTTP_OK)
            .json(
                new ApiResponse(HTTP_OK, "Address deleted successfully", null)
            );
    } catch (error) {
        throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, error.message);
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
    updateUserAddress,
    verifyEmail,
    resendVerificationEmail,
    getUserAddress,
    deleteUserAddress,
};
