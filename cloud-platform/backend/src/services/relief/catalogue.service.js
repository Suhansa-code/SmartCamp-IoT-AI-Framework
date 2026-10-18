/**
 * Catalogue service — merges live partner feeds with the sandbox catalogue.
 *
 * Rules (acceptance criteria):
 *  - Never fabricate live availability: LIVE_API rows only appear when a
 *    partner adapter actually returns them.
 *  - A partner without API access serves the sandbox sample catalogue with
 *    availability_source = 'SANDBOX', which the API and UI surface verbatim.
 *  - When a partner goes live, its live rows take precedence and the sandbox
 *    rows for that partner are hidden.
 */
import * as repository from '../../data/relief/relief.repository.js';
import { keells, cargills, arpico, spar } from './providers/supermarkets/partners.js';
import { sandboxProductsFor } from './providers/supermarkets/sandboxCatalogue.js';

const PARTNERS = {
  KEELLS: { code: 'KEELLS', name: 'Keells', adapter: keells },
  CARGILLS: { code: 'CARGILLS', name: 'Cargills Food City', adapter: cargills },
  ARPICO: { code: 'ARPICO', name: 'Arpico Supercentre', adapter: arpico },
  SPAR: { code: 'SPAR', name: 'SPAR Sri Lanka', adapter: spar },
};

export const PARTNER_LIST = Object.values(PARTNERS).map(({ code, name, adapter }) => ({
  code, name, live: adapter.isConfigured(),
}));

/**
 * Returns partner catalogues. Live adapter data (when configured) is upserted
 * into relief_products with availability_source LIVE_API; sandbox rows are
 * served (and persisted) for partners whose live API is unavailable, clearly
 * labelled as sample data.
 */
export async function getCatalogues({ partnerCode, category } = {}) {
  const codes = partnerCode ? [partnerCode.toUpperCase()] : Object.keys(PARTNERS);
  const catalogues = [];
  for (const code of codes) {
    const partner = PARTNERS[code];
    if (!partner) {
      throw Object.assign(new Error(`Unknown partner: ${code}`), { status: 400 });
    }
    let live;
    try {
      live = await partner.adapter.getCatalogue();
    } catch {
      live = { partnerCode: code, live: false, products: [], reason: 'Partner adapter failed' };
    }

    let products;
    let source;
    if (live.live && live.products.length) {
      for (const product of live.products) {
        await repository.upsertProduct({ partner_code: code, ...product, availability_source: 'LIVE_API' });
      }
      source = 'LIVE_API';
    } else {
      for (const product of sandboxProductsFor(code)) {
        await repository.upsertProduct({ partner_code: code, ...product, availability_source: 'SANDBOX' });
      }
      source = 'SANDBOX';
    }

    const stored = await repository.listProducts({ partnerCode: code, category });
    // Hide sandbox rows once the partner feed is live.
    products = source === 'LIVE_API'
      ? stored.filter((p) => p.availability_source === 'LIVE_API')
      : stored.filter((p) => p.availability_source !== 'LIVE_API');

    catalogues.push({
      partner_code: code,
      partner_name: partner.name,
      availability_source: source,
      is_live: source === 'LIVE_API',
      notice: source === 'LIVE_API'
        ? null
        : `Live ${partner.name} API access is not configured — showing a clearly-labelled sample catalogue. Prices and stock are not live partner data.`,
      reason: live.reason || null,
      products: products.map(formatProduct),
    });
  }
  return catalogues;
}

function formatProduct(row) {
  return {
    id: row.id,
    partner_code: row.partner_code,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    unit_price_lkr: Number(row.unit_price_lkr),
    currency: row.currency,
    stock_quantity: row.stock_quantity == null ? null : Number(row.stock_quantity),
    stock_status: row.stock_status,
    availability_source: row.availability_source,
    is_orderable: row.stock_status !== 'OUT_OF_STOCK',
  };
}

export function getPartnerOrThrow(partnerCode) {
  const partner = PARTNERS[String(partnerCode || '').toUpperCase()];
  if (!partner) throw Object.assign(new Error(`Unknown partner: ${partnerCode}`), { status: 400 });
  return partner;
}
