/**
 * Receipt service — authorised physical receipt of a delivery.
 *
 * Acceptance-critical rule: inventory NEVER moves on payment or booking.
 * Stock is only credited when staff with COLLECTION_CENTRE / CAMP_MANAGER /
 * ADMIN role confirm the goods arrived. Food and water lines are posted into
 * the existing resource_inventory_items / resource_inventory_movements ledger
 * for the receiving camp.
 */
import * as repository from '../../data/relief/relief.repository.js';
import * as inventory from '../../data/resources/inventory.repository.js';
import { env } from '../../config/env.js';
import { transitionStatus } from './order.service.js';
import { audit } from './audit.service.js';

const RECEIPT_ROLES = ['COLLECTION_CENTRE', 'CAMP_MANAGER', 'ADMIN'];

/**
 * Confirms receipt of a delivery. `lines` optionally lists per-item received
 * quantities: [{ sku, name, category, quantity, unit }]. When omitted, the
 * order items are taken as received intact.
 */
export async function confirmReceipt({ deliveryId, staff, condition = 'INTACT', lines, notes, req }) {
  if (!RECEIPT_ROLES.includes(staff.role)) {
    throw Object.assign(new Error('Receipt confirmation requires COLLECTION_CENTRE, CAMP_MANAGER, or ADMIN role'), { status: 403 });
  }
  const delivery = await repository.getDeliveryById(deliveryId);
  if (!delivery) throw Object.assign(new Error('Delivery not found'), { status: 404 });
  const existing = await repository.getReceiptByDelivery(deliveryId);
  if (existing) {
    return { receipt: existing, alreadyReceived: true, inventoryApplied: existing.inventory_applied };
  }
  const order = await repository.getOrderById(delivery.order_id);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (!['OUT_FOR_DELIVERY', 'DELIVERED', 'CONFIRMED_WITH_PARTNER'].includes(order.status)) {
    throw Object.assign(new Error(`Order status ${order.status} cannot be received`), { status: 409 });
  }

  const receivedLines = (lines && lines.length ? lines : (order.items || []).map((item) => ({
    sku: item.sku, name: item.name, category: item.category, quantity: item.quantity, unit: item.unit,
  }))).slice(0, 100);

  // Move the order to DELIVERED first if staff skipped that step, then RECEIVED.
  if (order.status !== 'DELIVERED') {
    if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'CONFIRMED_WITH_PARTNER') {
      if (order.status === 'CONFIRMED_WITH_PARTNER') {
        await transitionStatus(order.id, 'OUT_FOR_DELIVERY');
      }
      await transitionStatus(order.id, 'DELIVERED');
      await repository.updateDelivery(deliveryId, { status: 'DELIVERED', delivered_at: new Date().toISOString() });
    }
  }
  await transitionStatus(order.id, 'RECEIVED');

  let inventoryApplied = false;
  let inventoryNotes = [];
  const campId = order.destination_type === 'CAMP' ? order.destination_code : null;
  if (campId) {
    inventoryApplied = await applyToInventory({ campId, lines: receivedLines, orderReference: order.reference, staffEmail: staff.email });
    inventoryNotes.push(inventoryApplied ? 'inventory_updated' : 'no_matching_inventory_items');
  } else {
    inventoryNotes.push('collection_centre_receipt_no_camp_inventory');
  }

  const receipt = await repository.createReceipt({
    delivery_id: deliveryId,
    order_id: order.id,
    received_by: staff.email,
    received_role: staff.role,
    condition,
    item_count: receivedLines.length,
    notes: notes ? `${notes} [${inventoryNotes.join(',')}]` : inventoryNotes.join(','),
    inventoryApplied,
  });
  await audit(req, 'delivery.received', 'receipt', receipt.id, {
    order: order.reference, delivery: deliveryId, condition, inventory_applied: inventoryApplied,
  });
  return { receipt, alreadyReceived: false, inventoryApplied };
}

/**
 * Posts 'received' movements for order lines that match the camp's existing
 * food/water inventory items (matched on resource name, case-insensitive).
 * Items outside the food/water inventory schema are recorded on the receipt
 * but do not touch the ledger — the ledger only tracks kg/L commodities.
 */
async function applyToInventory({ campId, lines, orderReference, staffEmail }) {
  // The inventory ledger lives in PostgreSQL; skip (rather than crash) when
  // the backend is running with DB_ENABLED=false (tests / demo mode).
  if (!env.db.enabled) return false;
  let applied = false;
  for (const line of lines) {
    const category = line.category === 'food' || line.category === 'water' ? line.category : null;
    if (!category) continue;
    const { data } = await inventory.listItems({ campId, category, search: line.name, limit: 100 });
    const match = (data || []).find((item) => item.resource_name.trim().toLowerCase() === String(line.name).trim().toLowerCase());
    if (!match) continue;
    const unit = match.base_unit; // kg or L
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    await inventory.adjustItem(match.id, {
      quantityChange: quantity,
      recordedQuantityChange: quantity,
      recordedUnit: unit,
      movementType: 'received',
      reason: `Relief order ${orderReference}`,
      recordedBy: staffEmail,
    });
    applied = true;
  }
  return applied;
}
