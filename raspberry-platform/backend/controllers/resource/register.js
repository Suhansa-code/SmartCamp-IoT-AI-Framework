import * as registerService from '../../services/resource/register.js';

export async function register(req, res) {
  try {
    const { full_name, age } = req.body;
    if (!full_name || !age) return res.status(400).json({ error: 'Missing required fields' });

    const result = await registerService.registerPerson(req.body);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, fields: err.fields || undefined });
  }
}

export async function getAllPersons(req, res) {
  try {
    const { q, person_type, sort, order } = req.query;
    const result = registerService.getAllPersons({ q, person_type, sort, order });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPersonById(req, res) {
  try {
    const result = registerService.getPersonById(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function updatePerson(req, res) {
  try {
    const result = registerService.updatePerson(parseInt(req.params.id), req.body);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, fields: err.fields || undefined });
  }
}

export async function deactivatePerson(req, res) {
  try {
    const result = registerService.deactivatePerson(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function getCheckinsByPersonId(req, res) {
  try {
    const result = registerService.getCheckinsByPersonId(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function getPersonQr(req, res) {
  try {
    const result = await registerService.getPersonQrCode(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
