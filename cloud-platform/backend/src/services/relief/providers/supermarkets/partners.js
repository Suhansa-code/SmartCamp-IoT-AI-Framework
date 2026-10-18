/**
 * Partner supermarket adapters.
 *
 * Each adapter implements isConfigured() + getCatalogue(). Until an official
 * partner API agreement and credentials exist, live adapters report
 * live: false and return NO products — availability is never fabricated. A
 * clearly-labelled SANDBOX catalogue (relief.products.sandboxCatalogue.js) is
 * served instead so the donor journey can be demonstrated; the UI shows
 * "Sample catalogue — not live partner data" whenever availability_source is
 * not LIVE_API.
 */
import { env } from '../../../../config/env.js';

function makeAdapter(partnerCode, { envKey, baseUrlEnv, defaultBaseUrl, docsUrl }) {
  return {
    partnerCode,
    isConfigured() {
      return Boolean(env.relief[envKey]?.apiKey && env.relief[envKey]?.merchantId);
    },
    async getCatalogue() {
      if (!this.isConfigured()) {
        return { partnerCode, live: false, products: [], reason: 'Partner API credentials not configured' };
      }
      const baseUrl = env.relief[envKey][baseUrlEnv] || defaultBaseUrl;
      try {
        const response = await fetch(`${baseUrl}/products`, {
          headers: { authorization: `Bearer ${env.relief[envKey].apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          return { partnerCode, live: false, products: [], reason: `Partner API responded ${response.status}` };
        }
        const payload = await response.json();
        return {
          partnerCode,
          live: true,
          products: (Array.isArray(payload) ? payload : payload.products || []).map((p) => ({
            sku: String(p.sku || p.code || p.id),
            name: String(p.name || p.title),
            category: p.category || 'other',
            unit: p.unit || 'item',
            unit_price_lkr: Number(p.price_lkr ?? p.price ?? 0),
            stock_quantity: Number.isFinite(Number(p.stock)) ? Number(p.stock) : null,
            stock_status: p.stock_status || (Number(p.stock) === 0 ? 'OUT_OF_STOCK' : Number(p.stock) > 0 ? 'IN_STOCK' : 'UNKNOWN'),
            availability_source: 'LIVE_API',
          })),
        };
      } catch (error) {
        return { partnerCode, live: false, products: [], reason: `Partner API unreachable: ${error.message}` };
      }
    },
    docsUrl,
  };
}

export const keells = makeAdapter('KEELLS', {
  envKey: 'keells', baseUrlEnv: 'baseUrl',
  defaultBaseUrl: 'https://api.keells.com/v1',
  docsUrl: 'https://www.keells.com/developer',
});
export const cargills = makeAdapter('CARGILLS', {
  envKey: 'cargills', baseUrlEnv: 'baseUrl',
  defaultBaseUrl: 'https://api.cargillsfoodcity.com/v1',
  docsUrl: 'https://www.cargillsfoodcity.com',
});
export const arpico = makeAdapter('ARPICO', {
  envKey: 'arpico', baseUrlEnv: 'baseUrl',
  defaultBaseUrl: 'https://api.arpico.lk/v1',
  docsUrl: 'https://www.arpico.com',
});
export const spar = makeAdapter('SPAR', {
  envKey: 'spar', baseUrlEnv: 'baseUrl',
  defaultBaseUrl: 'https://api.spar.lk/v1',
  docsUrl: 'https://www.sparSL.com',
});
