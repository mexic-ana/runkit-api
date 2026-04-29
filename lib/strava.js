const axios = require('axios');

async function refreshTokenIfNeeded(tokens) {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at - now < 300) {
    console.log('Refreshing Strava token...');
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token
    });
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at
    };
  }
  return tokens;
}

async function getValidToken() {
  const response = await axios.get(`${process.env.AUTH_URL}/strava/tokens`);
  const tokens = response.data;
  return await refreshTokenIfNeeded(tokens);
}

async function getActivities(page = 1, perPage = 10) {
  const tokens = await getValidToken();
  const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    params: { page, per_page: perPage }
  });
  return response.data;
}

async function getActivityById(id) {
  const tokens = await getValidToken();
  const response = await axios.get(`https://www.strava.com/api/v3/activities/${id}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  return response.data;
}

module.exports = { getActivities, getActivityById, getValidToken };