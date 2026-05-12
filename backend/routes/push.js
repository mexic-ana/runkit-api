const express = require('express');
const webpush = require('web-push');
const { query } = require('../lib/db');

const router = express.Router();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Save push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    await query(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        subscription JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    );
    await query(
      `INSERT INTO push_subscriptions (endpoint, subscription)
       VALUES ($1, $2)
       ON CONFLICT (endpoint) DO UPDATE SET subscription = $2`,
      [subscription.endpoint, JSON.stringify(subscription)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Send a test notification
router.post('/test', async (req, res) => {
  try {
    const result = await query('SELECT subscription FROM push_subscriptions');
    const payload = JSON.stringify({
      title: 'Run Kit',
      body: 'Push notifications are working! 🏃‍♀️',
      url: '/'
    });
    await Promise.all(
      result.rows.map(row =>
        webpush.sendNotification(row.subscription, payload)
      )
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;