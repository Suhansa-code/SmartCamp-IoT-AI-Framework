import express from 'express';
import * as ctrl from '../controllers/childController.js';
import { validateEnrol } from '../middleware/validate.js';
import { db } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

const router = express.Router();

// POST /api/child/enrol
router.post('/enrol', validateEnrol, ctrl.enrolChild);

// POST - Turso Child ID Create and Retrieve Test - #Delete when implementing
router.post('/turso-child-test', ctrl.tursoChildIdTest);

// GET /api/child/:childId/qrcode - Get QR code for printing (more specific route first)
router.get('/:childId/qrcode', (req, res, next) => {
  try {
    const { childId } = req.params;
    const child = db.prepare(`
      SELECT child_id, qr_code_data FROM pages_children WHERE child_id = ?
    `).get(childId);

    if (!child) {
      return next(createError(404, `Child not found: ${childId}`));
    }

    if (!child.qr_code_data) {
      return next(createError(404, `QR code not available for child: ${childId}`));
    }

    // Return HTML page with QR code for printing
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Code - ${childId}</title>
        <style>
          body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: Arial, sans-serif; }
          .qr-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
          .qr-container img { max-width: 300px; height: auto; margin: 20px 0; }
          .child-info { font-size: 18px; font-weight: bold; margin-top: 20px; color: #333; }
          .print-btn { margin-top: 20px; padding: 10px 20px; background: #0D9488; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          .print-btn:hover { background: #0a7570; }
          @media print { body { background: white; padding: 0; } .print-btn { display: none; } }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <h1>PAGES Child QR Code</h1>
          <img src="${child.qr_code_data}" alt="QR Code for ${childId}">
          <div class="child-info">Child ID: ${childId}</div>
          <button class="print-btn" onclick="window.print()">Print QR Code</button>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /api/child/:childId - Get child profile
router.get('/:childId', ctrl.getChild);

export default router;