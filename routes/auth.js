const express = require('express');
const axios = require('axios');
const { setTokens, clearTokens } = require('../lib/redis');

const router = express.Router();

// Step 1: Redirect to Strava OAuth
router.get('/strava', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${process.env.API_URL}/auth/callback`,
    approval_prompt: 'force',
    scope: 'activity:read_all'
  });

  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// Step 2: Handle callback from Strava
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${process.env.FRONTEND_URL}?auth=error`);
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    });

    const tokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
      athlete: response.data.athlete
    };

    await setTokens(tokens);
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (err) {
    console.error('Strava auth error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error`);
  }
});

// Disconnect — clear tokens from Redis
router.get('/disconnect', async (req, res) => {
  try {
    await clearTokens();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Check auth status
router.get('/status', async (req, res) => {
  try {
    const { getTokens } = require('../lib/redis');
    const tokens = await getTokens();
    res.json({ connected: !!tokens, athlete: tokens?.athlete || null });
  } catch (err) {
    res.json({ connected: false });
  }
});

module.exports = router;