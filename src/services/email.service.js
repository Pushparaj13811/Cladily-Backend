import nodemailer from 'nodemailer';

/**
 * Email Service
 * Handles all functionality related to sending emails to users
 */
export class EmailService {
  constructor() {
    // Initialize email transport
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @returns {boolean} - Success status
   */
  async sendEmail(options) {
    const { to, subject, text, html } = options;

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        text,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send verification email
   * @param {Object} user - User object
   * @param {string} verificationToken - Verification token
   * @returns {boolean} - Success status
   */
  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const subject = 'Verify Your Email Address';
    const text = `
      Hello ${user.firstName},
      
      Thank you for registering with Cladily! Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link is valid for 24 hours.
      
      If you didn't create an account, please ignore this email.
      
      Best regards,
      The Cladily Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Cladily!</h2>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for registering with Cladily! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
        </div>
        <p>This link is valid for 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
        <p>Best regards,<br>The Cladily Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send welcome email after verification
   * @param {Object} user - User object
   * @returns {boolean} - Success status
   */
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Cladily!';
    const text = `
      Hello ${user.firstName},
      
      Thank you for verifying your email address. Your account is now fully activated!
      
      You can now explore our wide range of products and enjoy shopping with us.
      
      Best regards,
      The Cladily Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Cladily!</h2>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for verifying your email address. Your account is now fully activated!</p>
        <p>You can now explore our wide range of products and enjoy shopping with us.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Start Shopping</a>
        </div>
        <p>Best regards,<br>The Cladily Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetToken - Reset token
   * @returns {boolean} - Success status
   */
  async sendResetPasswordEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const subject = 'Reset Your Password';
    const text = `
      Hello ${user.firstName},
      
      You recently requested to reset your password. Click the link below to reset it:
      
      ${resetUrl}
      
      This link is valid for 10 minutes.
      
      If you didn't request a password reset, please ignore this email.
      
      Best regards,
      The Cladily Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hello ${user.firstName},</p>
        <p>You recently requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>This link is valid for 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>Best regards,<br>The Cladily Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send order confirmation email
   * @param {Object} user - User object
   * @param {Object} order - Order object
   * @returns {boolean} - Success status
   */
  async sendOrderConfirmationEmail(user, order) {
    const orderUrl = `${process.env.FRONTEND_URL}/orders/${order.id}`;

    const subject = `Order Confirmation #${order.orderNumber}`;
    
    // Generate order items HTML
    let itemsHtml = '';
    let itemsText = '';
    
    order.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name} ${item.variant ? `(${item.variant.name})` : ''}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.totalPrice.toFixed(2)}</td>
        </tr>
      `;
      
      itemsText += `
        ${item.product.name} ${item.variant ? `(${item.variant.name})` : ''}
        Quantity: ${item.quantity}
        Price: ₹${item.price.toFixed(2)}
        Total: ₹${item.totalPrice.toFixed(2)}
      `;
    });
    
    const text = `
      Hello ${user.firstName},
      
      Thank you for your order! Your order #${order.orderNumber} has been received and is being processed.
      
      Order Details:
      Date: ${new Date(order.createdAt).toLocaleDateString()}
      Order Number: ${order.orderNumber}
      
      Items:
      ${itemsText}
      
      Order Summary:
      Subtotal: ₹${order.subtotal.toFixed(2)}
      Shipping: ₹${order.shippingTotal.toFixed(2)}
      Tax: ₹${order.taxTotal.toFixed(2)}
      Discount: -₹${order.discountTotal.toFixed(2)}
      Total: ₹${order.total.toFixed(2)}
      
      Shipping Address:
      ${order.shippingAddress.fullName}
      ${order.shippingAddress.line1}
      ${order.shippingAddress.line2 ? order.shippingAddress.line2 + '\n' : ''}
      ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}
      ${order.shippingAddress.country}
      
      You can view your order details at any time by visiting:
      ${orderUrl}
      
      Thank you for shopping with Cladily!
      
      Best regards,
      The Cladily Team
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmation</h2>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for your order! Your order #${order.orderNumber} has been received and is being processed.</p>
        
        <h3 style="margin-top: 30px;">Order Details:</h3>
        <p>
          <strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}<br>
          <strong>Order Number:</strong> ${order.orderNumber}
        </p>
        
        <h3>Items:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f8f8;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Quantity</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <h3>Order Summary:</h3>
        <table style="width: 100%; max-width: 300px; margin-left: auto;">
          <tr>
            <td style="padding: 5px;">Subtotal:</td>
            <td style="padding: 5px; text-align: right;">₹${order.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px;">Shipping:</td>
            <td style="padding: 5px; text-align: right;">₹${order.shippingTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px;">Tax:</td>
            <td style="padding: 5px; text-align: right;">₹${order.taxTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px;">Discount:</td>
            <td style="padding: 5px; text-align: right;">-₹${order.discountTotal.toFixed(2)}</td>
          </tr>
          <tr style="font-weight: bold; font-size: 16px;">
            <td style="padding: 10px 5px; border-top: 2px solid #eee;">Total:</td>
            <td style="padding: 10px 5px; text-align: right; border-top: 2px solid #eee;">₹${order.total.toFixed(2)}</td>
          </tr>
        </table>
        
        <h3 style="margin-top: 30px;">Shipping Address:</h3>
        <p>
          ${order.shippingAddress.fullName}<br>
          ${order.shippingAddress.line1}<br>
          ${order.shippingAddress.line2 ? order.shippingAddress.line2 + '<br>' : ''}
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
          ${order.shippingAddress.country}
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Order Details</a>
        </div>
        
        <p>Thank you for shopping with Cladily!</p>
        <p>Best regards,<br>The Cladily Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }
} 