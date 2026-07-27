import QRCode from 'qrcode';
import logger from '../../utils/logger.js';

export async function generateChildQRCode(childId) {
  try {
    const qrData = JSON.stringify({
      type: 'child',
      child_id: childId,
      timestamp: new Date().toISOString(),
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    logger.info(`[QR] Generated QR code for child: ${childId}`);
    return qrCodeDataUrl;
  } catch (err) {
    logger.error(`[QR] Generation failed for child ${childId}: ${err.message}`);
    throw err;
  }
}
