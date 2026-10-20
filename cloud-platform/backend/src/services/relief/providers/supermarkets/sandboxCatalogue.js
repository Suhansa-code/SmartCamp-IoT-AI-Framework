/**
 * Sandbox catalogue — representative sample products for each partner
 * supermarket so the donor journey can be demonstrated before partner API
 * access exists. Every row is stored with availability_source = 'SANDBOX' and
 * the API/UI label it as sample data. These are NOT live prices or stock:
 * they are replaced automatically as soon as a partner adapter reports
 * live: true (see catalogue.service.js).
 */
export const SANDBOX_PRODUCTS = {
  KEELLS: [
    { sku: 'SBX-K-001', name: 'Nadu rice 5kg', category: 'food', unit: 'bag', unit_price_lkr: 890, stock_quantity: 250, stock_status: 'IN_STOCK' },
    { sku: 'SBX-K-002', name: 'Drinking water 1.5L (pack of 6)', category: 'water', unit: 'pack', unit_price_lkr: 660, stock_quantity: 180, stock_status: 'IN_STOCK' },
    { sku: 'SBX-K-003', name: 'Red lentils 1kg', category: 'food', unit: 'packet', unit_price_lkr: 420, stock_quantity: 90, stock_status: 'LOW_STOCK' },
    { sku: 'SBX-K-004', name: 'Canned fish 425g', category: 'food', unit: 'can', unit_price_lkr: 950, stock_quantity: 140, stock_status: 'IN_STOCK' },
    { sku: 'SBX-K-005', name: 'Bar soap 100g (pack of 3)', category: 'hygiene', unit: 'pack', unit_price_lkr: 240, stock_quantity: 0, stock_status: 'OUT_OF_STOCK' },
    { sku: 'SBX-K-006', name: 'Paracetamol 500mg (x100)', category: 'medicine', unit: 'box', unit_price_lkr: 350, stock_quantity: null, stock_status: 'UNKNOWN' },
  ],
  CARGILLS: [
    { sku: 'SBX-C-001', name: 'Samba rice 5kg', category: 'food', unit: 'bag', unit_price_lkr: 920, stock_quantity: 200, stock_status: 'IN_STOCK' },
    { sku: 'SBX-C-002', name: 'Bottled water 1L (pack of 12)', category: 'water', unit: 'pack', unit_price_lkr: 1080, stock_quantity: 120, stock_status: 'IN_STOCK' },
    { sku: 'SBX-C-003', name: 'Dhal 1kg', category: 'food', unit: 'packet', unit_price_lkr: 480, stock_quantity: 45, stock_status: 'LOW_STOCK' },
    { sku: 'SBX-C-004', name: 'Infant formula 400g', category: 'food', unit: 'tin', unit_price_lkr: 2150, stock_quantity: 30, stock_status: 'LOW_STOCK' },
    { sku: 'SBX-C-005', name: 'Toothpaste 100g', category: 'hygiene', unit: 'tube', unit_price_lkr: 320, stock_quantity: 210, stock_status: 'IN_STOCK' },
    { sku: 'SBX-C-006', name: 'ORS sachets (x20)', category: 'medicine', unit: 'box', unit_price_lkr: 400, stock_quantity: 60, stock_status: 'IN_STOCK' },
  ],
  ARPICO: [
    { sku: 'SBX-A-001', name: 'Nadu rice 25kg', category: 'food', unit: 'sack', unit_price_lkr: 8900, stock_quantity: 40, stock_status: 'IN_STOCK' },
    { sku: 'SBX-A-002', name: 'Water 5L jar', category: 'water', unit: 'jar', unit_price_lkr: 380, stock_quantity: 300, stock_status: 'IN_STOCK' },
    { sku: 'SBX-A-003', name: 'Full cream milk powder 1kg', category: 'food', unit: 'packet', unit_price_lkr: 2350, stock_quantity: 500, stock_status: 'IN_STOCK' },
    { sku: 'SBX-A-004', name: 'Mackerel can 125g', category: 'food', unit: 'can', unit_price_lkr: 310, stock_quantity: 160, stock_status: 'IN_STOCK' },
    { sku: 'SBX-A-005', name: 'Menstrual hygiene pack', category: 'hygiene', unit: 'pack', unit_price_lkr: 650, stock_quantity: 80, stock_status: 'LOW_STOCK' },
    { sku: 'SBX-A-006', name: 'Blanket (fleece)', category: 'shelter', unit: 'item', unit_price_lkr: 1900, stock_quantity: 55, stock_status: 'IN_STOCK' },
  ],
  SPAR: [
    { sku: 'SBX-S-001', name: 'Nadu rice 5kg', category: 'food', unit: 'bag', unit_price_lkr: 1450, stock_quantity: 70, stock_status: 'IN_STOCK' },
    { sku: 'SBX-S-002', name: 'Drinking water 1.5L (pack of 6)', category: 'water', unit: 'pack', unit_price_lkr: 540, stock_quantity: 90, stock_status: 'IN_STOCK' },
    { sku: 'SBX-S-003', name: 'High-energy biscuits (bulk pack)', category: 'food', unit: 'carton', unit_price_lkr: 1680, stock_quantity: 25, stock_status: 'LOW_STOCK' },
    { sku: 'SBX-S-004', name: 'Hand sanitiser 500ml', category: 'hygiene', unit: 'bottle', unit_price_lkr: 780, stock_quantity: 110, stock_status: 'IN_STOCK' },
    { sku: 'SBX-S-005', name: 'Gauze + tape first-aid kit', category: 'medicine', unit: 'kit', unit_price_lkr: 1250, stock_quantity: null, stock_status: 'UNKNOWN' },
    { sku: 'SBX-S-006', name: 'Tarpaulin 4m x 6m', category: 'shelter', unit: 'item', unit_price_lkr: 3200, stock_quantity: 0, stock_status: 'OUT_OF_STOCK' },
  ],
};

export function sandboxProductsFor(partnerCode) {
  return (SANDBOX_PRODUCTS[partnerCode] || []).map((product) => ({
    ...product,
    availability_source: 'SANDBOX',
  }));
}
