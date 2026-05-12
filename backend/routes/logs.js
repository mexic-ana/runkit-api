const express = require('express');
const { query } = require('../lib/db');

const router = express.Router();

// Get all logs
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM logs ORDER BY created_at DESC'
    );
    const logs = result.rows.map(row => ({
      id: row.id,
      activityId: row.activity_id,
      activityName: row.activity_name,
      activityMeta: row.activity_meta,
      tempF: row.temp_f,
      feelsF: row.feels_f,
      condition: row.condition,
      humidity: row.humidity,
      dew_point_f: row.dew_point_f,
      city: row.city,
      worn: row.worn,
      workedWell: row.worked_well,
      wouldChange: row.would_change,
      notes: row.notes,
      date: row.date,
      created_at: row.created_at
    }));
    res.json(logs);
  } catch (err) {
    console.error('Get logs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Save a new log
router.post('/', async (req, res) => {
  try {
    const {
      id, activityId, activityName, activityMeta,
      tempF, feelsF, condition, humidity, dewPointF,
      city, worn, workedWell, wouldChange, notes, date
    } = req.body;

    await query(
      `INSERT INTO logs (
        id, activity_id, activity_name, activity_meta,
        temp_f, feels_f, condition, humidity, dew_point_f,
        city, worn, worked_well, would_change, notes, date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        worn = EXCLUDED.worn,
        worked_well = EXCLUDED.worked_well,
        would_change = EXCLUDED.would_change,
        notes = EXCLUDED.notes`,
      [id, activityId, activityName, activityMeta,
       tempF, feelsF, condition, humidity, dewPointF,
       city, worn, workedWell, wouldChange, notes, date]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Save log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete a log
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM logs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;