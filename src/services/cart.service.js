import { prisma } from '../database/connect.js';

/**
 * Shopping Cart Service
 * Handles all business logic related to shopping cart
 */
export class CartService {
  /**
   * Get or create a cart for a user or guest
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID for guest (optional)
   * @returns {Object} - Cart with items
   */
  async getCart(userId, sessionId) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    // Find existing cart or create a new one
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1
                }
              }
            },
            variant: true
          }
        },
        appliedCoupons: {
          include: {
            coupon: true
          }
        }
      }
    });

    if (!cart) {
      // Create new cart
      const newCart = await prisma.cart.create({
        data: {
          userId: userId || undefined,
          sessionId: sessionId || undefined
        }
      });
      
      return {
        ...newCart,
        items: [],
        appliedCoupons: []
      };
    }

    // Transform cart items to include necessary display information
    const transformedItems = cart.items.map(item => {
      const mainImage = item.product.images[0]?.url || null;
      
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        name: item.product.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        totalPrice: parseFloat(item.totalPrice),
        size: item.variant?.size || null,
        color: item.variant?.color || null,
        imageUrl: mainImage
      };
    });

    // Calculate totals
    const subtotal = transformedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountTotal = cart.appliedCoupons.reduce((sum, coupon) => 
      sum + parseFloat(coupon.discountAmount), 0);
    
    return {
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      subtotal,
      discountTotal,
      taxTotal: parseFloat(cart.taxTotal),
      shippingTotal: parseFloat(cart.shippingTotal),
      total: subtotal - discountTotal + parseFloat(cart.taxTotal) + parseFloat(cart.shippingTotal),
      itemCount: transformedItems.length,
      items: transformedItems,
      appliedCoupons: cart.appliedCoupons.map(coupon => ({
        id: coupon.id,
        code: coupon.coupon.code,
        discountAmount: parseFloat(coupon.discountAmount)
      }))
    };
  }

  /**
   * Add a product to the cart
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID for guest (optional)
   * @param {String} productId - Product ID
   * @param {String} variantId - Product variant ID (optional)
   * @param {Number} quantity - Quantity to add
   * @returns {Object} - Updated cart item
   */
  async addToCart(userId, sessionId, productId, variantId, quantity) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    if (!quantity || quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Check product exists
    const product = await prisma.product.findUnique({
      where: { id: productId, status: 'ACTIVE', deletedAt: null }
    });

    if (!product) {
      throw new Error('Product not found or inactive');
    }

    // Check variant if provided
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId }
      });

      if (!variant) {
        throw new Error('Product variant not found');
      }

      // Check stock availability
      if (variant.stockQuantity < quantity) {
        throw new Error(`Only ${variant.stockQuantity} units available in stock`);
      }
    }

    // Get or create cart
    const cart = await prisma.cart.upsert({
      where: {
        userId: userId || undefined,
        sessionId: sessionId || undefined
      },
      create: {
        userId: userId || undefined,
        sessionId: sessionId || undefined
      },
      update: {},
      select: { id: true }
    });

    // Get price from variant or product
    let price;
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { price: true }
      });
      price = variant.price;
    } else {
      price = product.price;
    }

    // Check for existing cart item
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null
      }
    });

    let cartItem;
    
    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.quantity + quantity;
      
      // Check max quantity limit (5 per item)
      if (newQuantity > 5) {
        throw new Error('Maximum quantity limit of 5 per item reached');
      }
      
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          totalPrice: { set: parseFloat(price) * newQuantity }
        },
        include: {
          product: {
            select: {
              name: true
            }
          },
          variant: {
            select: {
              size: true,
              color: true
            }
          }
        }
      });
    } else {
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          price,
          totalPrice: parseFloat(price) * quantity
        },
        include: {
          product: {
            select: {
              name: true
            }
          },
          variant: {
            select: {
              size: true,
              color: true
            }
          }
        }
      });
    }

    // Update cart totals
    await this.recalculateCartTotals(cart.id);

    return {
      id: cartItem.id,
      name: cartItem.product.name,
      quantity: cartItem.quantity,
      size: cartItem.variant?.size,
      color: cartItem.variant?.color,
      price: parseFloat(cartItem.price),
      totalPrice: parseFloat(cartItem.totalPrice)
    };
  }

  /**
   * Update cart item quantity
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (optional)
   * @param {String} productId - Product ID
   * @param {String} variantId - Variant ID (optional)
   * @param {Number} quantity - New quantity or delta (can be negative)
   * @param {Boolean} isAbsolute - If true, set quantity to value; if false, add/subtract
   * @returns {Object} - Updated cart info
   */
  async updateCartItem(userId, sessionId, productId, variantId, quantity, isAbsolute = false) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Find cart
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Find cart item
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null
      }
    });

    if (!cartItem) {
      throw new Error('Product not found in cart');
    }

    // Calculate new quantity
    let newQuantity;
    if (isAbsolute) {
      newQuantity = quantity;
    } else {
      newQuantity = cartItem.quantity + quantity;
    }

    // Remove item if quantity is 0 or negative
    if (newQuantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: cartItem.id }
      });
      
      // Update cart totals
      await this.recalculateCartTotals(cart.id);
      
      return {
        message: 'Item removed from cart',
        removed: true
      };
    }

    // Check max quantity limit (5 per item)
    if (newQuantity > 5) {
      throw new Error('Maximum quantity limit of 5 per item reached');
    }

    // Update cart item
    const updatedItem = await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: {
        quantity: newQuantity,
        totalPrice: { set: parseFloat(cartItem.price) * newQuantity }
      }
    });

    // Update cart totals
    await this.recalculateCartTotals(cart.id);

    return {
      id: updatedItem.id,
      quantity: updatedItem.quantity,
      totalPrice: parseFloat(updatedItem.totalPrice)
    };
  }

  /**
   * Remove item from cart
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (optional)
   * @param {String} productId - Product ID
   * @param {String} variantId - Variant ID (optional)
   * @returns {Boolean} - Success status
   */
  async removeFromCart(userId, sessionId, productId, variantId) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Find cart
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Find and delete cart item
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null
      }
    });

    if (!cartItem) {
      throw new Error('Product not found in cart');
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id }
    });

    // Update cart totals
    await this.recalculateCartTotals(cart.id);

    return true;
  }

  /**
   * Clear all items from cart
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (optional)
   * @returns {Boolean} - Success status
   */
  async clearCart(userId, sessionId) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    // Find cart
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Delete all items
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    // Update cart totals
    await this.recalculateCartTotals(cart.id);

    return true;
  }

  /**
   * Apply coupon to cart
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (optional)
   * @param {String} couponCode - Coupon code
   * @returns {Object} - Applied coupon details
   */
  async applyCoupon(userId, sessionId, couponCode) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    if (!couponCode) {
      throw new Error('Coupon code is required');
    }

    // Find cart with items
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      },
      include: {
        items: true,
        appliedCoupons: {
          include: {
            coupon: true
          }
        }
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Check if cart is empty
    if (cart.items.length === 0) {
      throw new Error('Cannot apply coupon to empty cart');
    }

    // Find coupon
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() } || null,
        deletedAt: null
      }
    });

    if (!coupon) {
      throw new Error('Invalid or expired coupon');
    }

    // Check if coupon is already applied
    const existingCoupon = cart.appliedCoupons.find(cp => cp.couponId === coupon.id);
    if (existingCoupon) {
      throw new Error('Coupon already applied to this cart');
    }

    // Calculate cart subtotal
    const subtotal = cart.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

    // Check minimum order amount
    if (coupon.minimumOrderAmount && parseFloat(coupon.minimumOrderAmount) > subtotal) {
      throw new Error(`This coupon requires a minimum order of ${coupon.minimumOrderAmount}`);
    }

    // Calculate discount
    let discountAmount = 0;
    switch (coupon.type) {
      case 'PERCENTAGE':
        discountAmount = (subtotal * parseFloat(coupon.value)) / 100;
        // Apply maximum discount if set
        if (coupon.maximumDiscountAmount && 
            discountAmount > parseFloat(coupon.maximumDiscountAmount)) {
          discountAmount = parseFloat(coupon.maximumDiscountAmount);
        }
        break;
      case 'FIXED_AMOUNT':
        discountAmount = parseFloat(coupon.value);
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }
        break;
      // For free shipping coupons, we'll apply it differently
      case 'FREE_SHIPPING':
        discountAmount = 0; // Handle shipping discount separately
        break;
      default:
        throw new Error('Invalid coupon type');
    }

    // Add coupon to cart
    const cartCoupon = await prisma.cartCoupon.create({
      data: {
        cartId: cart.id,
        couponId: coupon.id,
        discountAmount
      },
      include: {
        coupon: true
      }
    });

    // Update cart totals
    const updatedCart = await this.recalculateCartTotals(cart.id);

    return {
      code: cartCoupon.coupon.code,
      type: cartCoupon.coupon.type,
      discountAmount,
      cartTotal: parseFloat(updatedCart.total)
    };
  }

  /**
   * Remove coupon from cart
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID (optional)
   * @param {String} couponCode - Coupon code
   * @returns {Boolean} - Success status
   */
  async removeCoupon(userId, sessionId, couponCode) {
    if (!userId && !sessionId) {
      throw new Error('User ID or session ID is required');
    }

    if (!couponCode) {
      throw new Error('Coupon code is required');
    }

    // Find cart
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          { userId: userId || undefined },
          { sessionId: sessionId || undefined }
        ]
      },
      include: {
        appliedCoupons: {
          include: {
            coupon: true
          }
        }
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Find applied coupon
    const appliedCoupon = cart.appliedCoupons.find(cp => cp.coupon.code === couponCode);
    if (!appliedCoupon) {
      throw new Error('Coupon not applied to this cart');
    }

    // Remove coupon
    await prisma.cartCoupon.delete({
      where: { id: appliedCoupon.id }
    });

    // Update cart totals
    await this.recalculateCartTotals(cart.id);

    return true;
  }

  /**
   * Recalculate cart totals
   * @param {String} cartId - Cart ID
   * @returns {Object} - Updated cart with totals
   * @private
   */
  async recalculateCartTotals(cartId) {
    // Get cart with items and coupons
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: true,
        appliedCoupons: true
      }
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Calculate subtotal
    const subtotal = cart.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    
    // Calculate discount total
    const discountTotal = cart.appliedCoupons.reduce((sum, coupon) => 
      sum + parseFloat(coupon.discountAmount), 0);
    
    // Calculate total
    const total = subtotal - discountTotal + parseFloat(cart.taxTotal) + parseFloat(cart.shippingTotal);
    
    // Update cart
    const updatedCart = await prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        discountTotal,
        total,
        itemCount: cart.items.length
      }
    });

    return updatedCart;
  }

  /**
   * Merge guest cart into user cart
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Object} - Merged cart
   */
  async mergeGuestCart(userId, sessionId) {
    if (!userId || !sessionId) {
      throw new Error('Both user ID and session ID are required');
    }

    // Find guest cart
    const guestCart = await prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: true,
        appliedCoupons: true
      }
    });

    if (!guestCart || guestCart.items.length === 0) {
      // No guest cart or empty guest cart, nothing to merge
      return this.getCart(userId, null);
    }

    // Find or create user cart
    let userCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: true
      }
    });

    if (!userCart) {
      // Create user cart if it doesn't exist
      userCart = await prisma.cart.create({
        data: { userId },
        include: {
          items: true
        }
      });
    }

    // Transfer items from guest cart to user cart
    for (const item of guestCart.items) {
      // Check if item already exists in user cart
      const existingItem = userCart.items.find(i => 
        i.productId === item.productId && i.variantId === item.variantId
      );

      if (existingItem) {
        // Update existing item
        const newQuantity = Math.min(existingItem.quantity + item.quantity, 5); // Cap at 5
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            totalPrice: { set: parseFloat(existingItem.price) * newQuantity }
          }
        });
      } else {
        // Create new item in user cart
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
    }

    // Transfer coupons if applicable
    for (const coupon of guestCart.appliedCoupons) {
      // Check if coupon is already in user cart
      const existingCoupon = await prisma.cartCoupon.findFirst({
        where: {
          cartId: userCart.id,
          couponId: coupon.couponId
        }
      });

      if (!existingCoupon) {
        await prisma.cartCoupon.create({
          data: {
            cartId: userCart.id,
            couponId: coupon.couponId,
            discountAmount: coupon.discountAmount
          }
        });
      }
    }

    // Delete guest cart
    await prisma.cart.delete({
      where: { id: guestCart.id }
    });

    // Update user cart totals
    await this.recalculateCartTotals(userCart.id);

    // Return updated user cart
    return this.getCart(userId, null);
  }
}