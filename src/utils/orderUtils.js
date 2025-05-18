/**
 * Order related utility functions
 */

/**
 * Generate a unique order number with format CL-YYYYMMDD-XXXXX
 * Where XXXXX is a random 5-digit number
 * @returns {String} - Unique order number
 */
export const generateOrderNumber = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  // Generate random 5-digit number
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  
  return `CL-${year}${month}${day}-${randomDigits}`;
};

/**
 * Calculate estimated delivery date based on current date and processing time
 * @param {Number} processingDays - Number of days for processing
 * @returns {Date} - Estimated delivery date
 */
export const calculateEstimatedDelivery = (processingDays = 3) => {
  const today = new Date();
  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + processingDays);
  return deliveryDate;
};

/**
 * Format currency amount
 * @param {Number} amount - Amount to format
 * @param {String} currency - Currency code
 * @returns {String} - Formatted amount
 */
export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency
  }).format(amount);
}; 