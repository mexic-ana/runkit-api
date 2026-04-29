if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activities');
const weatherRoutes = require('./routes/weather');

const app = express();

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://mexic-ana.github.io'
  ],
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}));

app.use('/auth', authRoutes);
app.use('/activities', activityRoutes);
app.use('/weather', weatherRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'runkit-api' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`runkit-api running on port ${PORT}`);
});