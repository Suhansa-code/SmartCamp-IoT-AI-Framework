import express from 'express';
import * as ctrl from '../controllers/relief/relief.controller.js';
import { requireDonor } from '../services/donation/auth.service.js';
import { requireStaff, requireRole, requireDonorOrGuest } from '../services/relief/auth.service.js';

const router = express.Router();

// ── Public portal ──────────────────────────────────────────────────────────
router.get('/config', ctrl.getPublicConfig);
router.get('/catalogue', ctrl.getCatalogue);

// ── Donor (Google session, or guest when sandbox mode allows it) ────────────
router.get('/orders', requireDonor, ctrl.listMyOrders);
router.post('/orders', requireDonorOrGuest, ctrl.createOrder);
router.post('/orders/:orderId/payment', requireDonorOrGuest, ctrl.startPayment);
router.post('/orders/:orderId/sandbox/pay', requireDonorOrGuest, ctrl.sandboxSimulatePayment);
router.get('/orders/:reference', ctrl.getOrderPublic);

// ── Staff auth ─────────────────────────────────────────────────────────────
router.post('/auth/login', ctrl.staffLogin);
router.get('/auth/me', requireStaff, ctrl.staffMe);
router.post('/auth/logout', ctrl.staffLogout);

// ── Staff back-office ──────────────────────────────────────────────────────
router.get('/staff/dashboard', requireStaff, ctrl.staffDashboard);
router.get('/staff/orders', requireStaff, ctrl.staffListOrders);
router.patch('/staff/orders/:orderId/status', requireStaff, requireRole('ADMIN', 'PARTNER'), ctrl.staffUpdateOrderStatus);
router.get('/staff/payments', requireStaff, requireRole('ADMIN'), ctrl.staffListPayments);
router.post('/staff/payments/:paymentId/confirm', requireStaff, requireRole('ADMIN'), ctrl.staffConfirmPayment);
router.post('/staff/payments/:paymentId/reject', requireStaff, requireRole('ADMIN'), ctrl.staffRejectPayment);
router.post('/staff/deliveries/quote', requireStaff, requireRole('ADMIN', 'PARTNER', 'COLLECTION_CENTRE'), ctrl.staffQuoteDelivery);
router.post('/staff/deliveries', requireStaff, requireRole('ADMIN', 'PARTNER'), ctrl.staffBookDelivery);
router.get('/staff/deliveries', requireStaff, ctrl.staffListDeliveries);
router.patch('/staff/deliveries/:deliveryId/status', requireStaff, requireRole('ADMIN', 'PARTNER', 'COLLECTION_CENTRE'), ctrl.staffUpdateDeliveryStatus);
router.post('/staff/receipts', requireStaff, requireRole('ADMIN', 'COLLECTION_CENTRE', 'CAMP_MANAGER'), ctrl.staffConfirmReceipt);
router.get('/staff/audit', requireStaff, requireRole('ADMIN'), ctrl.staffAuditLog);

// ── Camp requests ──────────────────────────────────────────────────────────
router.post('/camp-requests', requireStaff, requireRole('CAMP_MANAGER', 'ADMIN'), ctrl.createCampRequest);
router.get('/camp-requests', requireStaff, ctrl.listCampRequests);
router.patch('/camp-requests/:requestId', requireStaff, requireRole('ADMIN'), ctrl.updateCampRequest);

export default router;
