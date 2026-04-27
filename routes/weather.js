const express = require('express');
const axios = require('axios');

const router = express.Router();

// Get historical weather for a specific location and time
router.get('/', async (req, res) => {
  try {
    const { lat, lng, date } = req.query;

    if (!lat || !lng || !date) {
      return res.status(400).json({ error: 'lat, lng, and date are required' });
    }

    const activityDate = new Date(date);
    const dateStr = activityDate.toISOString().split('T')[0];
    const hour = activityDate.getHours();

    // Open-Meteo historical API — free, no key needed
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude: lat,
        longitude: lng,
        start_date: dateStr,
        end_date: dateStr,
        hourly: 'temperature_2m,apparent_temperature,weathercode,windspeed_10m',
        temperature_unit: 'fahrenheit',
        windspeed_unit: 'mph',
        timezone: 'auto'
      }
    });

    const data = response.data;
    const hourlyTemp = data.hourly.temperature_2m[hour];
    const hourlyFeels = data.hourly.apparent_temperature[hour];
    const hourlyWind = data.hourly.windspeed_10m[hour];
    const hourlyCode = data.hourly.weathercode[hour];

    res.json({
      temp_f: Math.round(hourlyTemp),
      feels_like_f: Math.round(hourlyFeels),
      wind_mph: Math.round(hourlyWind),
      condition: getCondition(hourlyCode),
    });
  } catch (err) {
    console.error('Weather error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function getCondition(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rainy';
  if (code <= 79) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

module.exports = router;