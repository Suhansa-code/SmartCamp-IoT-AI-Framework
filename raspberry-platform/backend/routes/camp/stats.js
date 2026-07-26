import express from 'express';
import { campDb as db } from '../../config/database.js';
import * as saamp from '../../services/saamp-mqtt.js';

const router = express.Router();

const DAILY_QTY = { breakfast: 0.5, lunch: 0.6, dinner: 0.5, water: 15 };
const PREGNANT_EXTRA = { breakfast: 0.2, lunch: 0.2, dinner: 0.2, water: 2 };

router.get('/overview', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM persons').get().c;
  const preReg = db.prepare('SELECT COUNT(*) as c FROM persons WHERE pre_registered = 1').get().c;
  const pregnant = db.prepare('SELECT COUNT(*) as c FROM persons WHERE is_pregnant = 1').get().c;
  const chronic = db.prepare('SELECT COUNT(*) as c FROM persons WHERE has_chronic_illness = 1').get().c;
  const families = db.prepare('SELECT COUNT(DISTINCT family_unit_id) as c FROM persons').get().c;
  const todayRegistered = db.prepare("SELECT COUNT(*) as c FROM persons WHERE DATE(created_at) = DATE('now') AND pre_registered = 0").get().c;
  const todayCheckins = db.prepare("SELECT COUNT(*) as c FROM camp_checkins WHERE DATE(checkin_time) = DATE('now')").get().c;

  const distRows = db.prepare(`
    SELECT resource_type, COUNT(DISTINCT wristband_barcode) as served
    FROM distributions WHERE DATE(distributed_at) = DATE('now') GROUP BY resource_type
  `).all();

  const servedMap = {};
  distRows.forEach(r => { servedMap[r.resource_type] = r.served; });

  const eligible = db.prepare('SELECT COUNT(DISTINCT person_id) as c FROM wristbands WHERE is_active = 1').get().c;

  const distribution_today = {};
  for (const type of ['breakfast', 'lunch', 'dinner', 'water']) {
    const served = servedMap[type] || 0;
    const pending = Math.max(0, eligible - served);
    distribution_today[type] = { served, pending, percent: eligible > 0 ? Math.round((served / eligible) * 100) : 0 };
  }

  const expected = Math.ceil(total * 1.10);
  const pred = {};
  for (const [type, qty] of Object.entries(DAILY_QTY)) {
    const base = expected * qty;
    const extra = pregnant * (PREGNANT_EXTRA[type] || 0);
    pred[type] = Math.round((base + extra) * 10) / 10;
  }

  const recent = db.prepare(`
    SELECT p.id, p.full_name, p.age, p.gender, p.is_pregnant, p.has_chronic_illness,
           p.created_at, p.pre_registered, w.barcode as wristband_barcode
    FROM persons p LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
    ORDER BY p.created_at DESC LIMIT 10
  `).all();

  const buffered = db.prepare('SELECT COUNT(*) as c FROM mqtt_buffer WHERE flushed = 0').get().c;

  res.json({
    population: { total, pre_registered: preReg, today_registered: todayRegistered, today_checkins: todayCheckins, families },
    vulnerable: { pregnant, chronic_illness: chronic, total_flagged: pregnant + chronic },
    distribution_today,
    eligible_for_distribution: eligible,
    prediction_tomorrow: {
      expected_persons: expected, breakfast_kg: pred.breakfast, lunch_kg: pred.lunch,
      dinner_kg: pred.dinner, water_litres: pred.water,
      note: pregnant > 0 ? `Includes ${pregnant} pregnant woman/women (+${PREGNANT_EXTRA.breakfast}kg/meal, +${PREGNANT_EXTRA.water}L water each)` : 'Standard rations',
    },
    mqtt: { network_state: saamp.getNetworkState(), buffered_messages: buffered },
    recent_registrations: recent,
  });
});

router.get('/distribution-history', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 30);
  const rows = db.prepare(`
    SELECT DATE(distributed_at) as date, resource_type, COUNT(DISTINCT wristband_barcode) as served
    FROM distributions WHERE distributed_at >= DATE('now', ? || ' days')
    GROUP BY DATE(distributed_at), resource_type ORDER BY date ASC
  `).all(`-${days}`);

  const byDate = {};
  rows.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date };
    byDate[r.date][r.resource_type] = r.served;
  });

  res.json({ days, history: Object.values(byDate) });
});

export default router;
