/**
 * Relief portal seed — run `npm run db:seed:relief` after `npm run db:init`.
 * Creates the initial staff accounts, the active campaign, and the sandbox
 * catalogue for all four partner supermarkets.
 *
 * The default admin password comes from RELIEF_ADMIN_PASSWORD (see
 * .env.example). CHANGE IT before any shared deployment.
 */
import { testConnection, closeDatabase } from '../config/database.js';
import * as repository from '../data/relief/relief.repository.js';
import { hashPassword, bootstrapPassword } from '../services/relief/auth.service.js';
import { getCatalogues } from '../services/relief/catalogue.service.js';

async function main() {
  try {
    const ok = await testConnection();
    if (!ok) {
      console.error('[db:seed:relief] Connection test failed');
      process.exit(1);
    }

    const staff = [
      { email: 'admin@smartcamp.lk', displayName: 'Relief Administrator', role: 'ADMIN', orgCode: null },
      { email: 'partner.keells@smartcamp.lk', displayName: 'Keells Partner Desk', role: 'PARTNER', orgCode: 'KEELLS' },
      { email: 'partner.cargills@smartcamp.lk', displayName: 'Cargills Partner Desk', role: 'PARTNER', orgCode: 'CARGILLS' },
      { email: 'partner.arpico@smartcamp.lk', displayName: 'Arpico Partner Desk', role: 'PARTNER', orgCode: 'ARPICO' },
      { email: 'partner.spar@smartcamp.lk', displayName: 'SPAR Partner Desk', role: 'PARTNER', orgCode: 'SPAR' },
      { email: 'centre.kolonnawa@smartcamp.lk', displayName: 'Kolonnawa Collection Centre', role: 'COLLECTION_CENTRE', orgCode: 'CC-KLN' },
      { email: 'camp.unit01@smartcamp.lk', displayName: 'Camp Unit 01 Manager', role: 'CAMP_MANAGER', orgCode: 'SCB-UNIT-01' },
    ];
    const password = hashPassword(bootstrapPassword());
    for (const member of staff) {
      const existing = await repository.getStaffUserByEmail(member.email);
      if (existing) {
        console.log(`[db:seed:relief] Staff ${member.email} already exists — skipping`);
        continue;
      }
      await repository.createStaffUser({ ...member, passwordHash: password });
      console.log(`[db:seed:relief] Created staff ${member.email} (${member.role})`);
    }

    await repository.upsertCampaign({
      slug: 'flood-relief-2026',
      title: '2026 Flood Relief Campaign',
      description: 'Fund emergency food, water, medicine, and hygiene supplies for flood-affected camps across Sri Lanka. '
        + 'Every rupee is tracked from verified payment to camp receipt.',
      goal_amount_lkr: 5_000_000,
    });
    console.log('[db:seed:relief] Campaign ensured');

    const catalogues = await getCatalogues();
    for (const catalogue of catalogues) {
      console.log(`[db:seed:relief] ${catalogue.partner_code}: ${catalogue.products.length} products (${catalogue.availability_source})`);
    }

    console.log('[db:seed:relief] Done');
    process.exit(0);
  } catch (error) {
    console.error('[db:seed:relief] Failed:', error.message);
    await closeDatabase();
    process.exit(1);
  }
}

main();
