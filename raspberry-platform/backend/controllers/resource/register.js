import * as registerService from '../../services/resource/register.js';

export async function register(req, res) {
  try {
    const { full_name, age } = req.body;
    if (!full_name || !age) return res.status(400).json({ error: 'Missing required fields' });

    const result = await registerService.registerPerson(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
