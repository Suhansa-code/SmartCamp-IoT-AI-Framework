import * as checkinService from '../../services/resource/checkin.js';

export async function checkin(req, res) {
  try {
    const { person_id } = req.body;
    if (!person_id) return res.status(400).json({ error: 'person_id required' });

    const result = await checkinService.checkinPerson(person_id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
