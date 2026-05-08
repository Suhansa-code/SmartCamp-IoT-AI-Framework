import QRCode from 'qrcode';
import logger from '../utils/logger.js';

/**
 * Generate QR code as data URL (base64 image)
 * @param {string} text - Text/data to encode in QR code (typically child_id)
 * @param {object} options - QR code generation options
 * @returns {Promise<string>} Base64 data URL for the QR code image
 */
async function generateQRCodeDataURL(text, options = {}) {
  try {
    const defaultOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      ...options
    };

    const qrCodeDataURL = await QRCode.toDataURL(text, defaultOptions);
    logger.info(`[QR] Generated QR code for: ${text}`);
    return qrCodeDataURL;
  } catch (err) {
    logger.error(`[QR] Failed to generate QR code: ${err.message}`);
    throw err;
  }
}

/**
 * Generate QR code as PNG buffer
 * @param {string} text - Text/data to encode in QR code
 * @param {object} options - QR code generation options
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQRCodeBuffer(text, options = {}) {
  try {
    const defaultOptions = {
      errorCorrectionLevel: 'H',
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      ...options
    };

    const buffer = await QRCode.toBuffer(text, defaultOptions);
    logger.info(`[QR] Generated QR code buffer for: ${text}`);
    return buffer;
  } catch (err) {
    logger.error(`[QR] Failed to generate QR code buffer: ${err.message}`);
    throw err;
  }
}

/**
 * Generate QR code for child enrollment
 * Contains child_id so scanning returns the correct child
 * @param {string} childId - The child's ID
 * @returns {Promise<string>} Base64 data URL for QR code
 */
async function generateChildQRCode(childId) {
  try {
    const qrData = await generateQRCodeDataURL(childId, {
      width: 250,
      margin: 3,
      errorCorrectionLevel: 'H'
    });
    return qrData;
  } catch (err) {
    logger.error(`[QR] Failed to generate child QR code for ${childId}: ${err.message}`);
    throw err;
  }
}

export {
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateChildQRCode
};
