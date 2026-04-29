const express = require('express');
const { getActivities, getActivityById } = require('../lib/strava');

const router = express.Router();

// Get paginated activities
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    
    const activities = await getActivities(page, perPage);
    
    // Map to only what the frontend needs
    const mapped = activities.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      distance: (a.distance / 1609.34).toFixed(1) + ' mi',
      duration: formatDuration(a.moving_time),
      date: formatDate(a.start_date_local),
      start_date: a.start_date,
      start_latlng: a.start_latlng,
      city: a.location_city || null
    }));

    res.json({ activities: mapped, page, per_page: perPage });
  } catch (err) {
    console.error('Activities error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get single activity by ID
router.get('/:id', async (req, res) => {
  try {
    const activity = await getActivityById(req.params.id);
    res.json(activity);
  } catch (err) {
    console.error('Activity error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

module.exports = router;