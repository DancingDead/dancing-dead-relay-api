/**
 * Passenger-compatible entry point
 * This file exports the Express app for Phusion Passenger
 */

require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const cron = require("node-cron");

// Sous-chemin configurable
let subPath = (process.env.SUBPATH || "").trim();
if (subPath && !subPath.startsWith("/")) subPath = "/" + subPath;
if (subPath.endsWith("/")) subPath = subPath.slice(0, -1);

function withBase(route) {
  if (!route.startsWith("/")) route = "/" + route;
  return (subPath || "") + route;
}

// Import routes
const naeleckreleases = require("./naeleckreleases");
const naeleckshows = require("./naeleckshows");
const dancingdeadplaylist = require("./dancingdeadplaylist");
const styxplaylist = require("./styxplaylist");
const denhakuplaylist = require("./denhakuplaylist");
const dancingdeadartists = require("./dancingdeadartists");
const denhakuartists = require("./denhakuartists");
const generaldownloaddancingdead = require("./generaldownloaddancingdead");
const generaldownloaddenhaku = require("./generaldownloaddenhaku");
const generaldownloadstyx = require("./generaldownloadstyx");
const dancingdeadshows = require("./dancingdeadshows");
const ai = require("./ai");
const apiArtists = require("./api/artists");

// Middleware
app.use(express.json({ limit: '50mb' }));

// CORS configuration
const allowedOrigins = [
  'https://dancingdeadrecords.com',
  'https://www.dancingdeadrecords.com',
  'https://denhakurecords.com',
  'https://www.denhakurecords.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Routes
app.use(withBase("/naeleckreleases"), naeleckreleases);
app.use(withBase("/naeleckshows"), naeleckshows);
app.use(withBase("/dancingdeadplaylist"), dancingdeadplaylist);
app.use(withBase("/styxplaylist"), styxplaylist);
app.use(withBase("/denhakuplaylist"), denhakuplaylist);
app.use(withBase("/dancingdeadartists"), dancingdeadartists);
app.use(withBase("/denhakuartists"), denhakuartists);
app.use(withBase("/generaldownloaddancingdead"), generaldownloaddancingdead);
app.use(withBase("/generaldownloaddenhaku"), generaldownloaddenhaku);
app.use(withBase("/generaldownloadstyx"), generaldownloadstyx);
app.use(withBase("/dancingdeadshows"), dancingdeadshows);
app.use(withBase("/ai"), ai);
app.use(withBase("/api/artists"), apiArtists);

// Health check endpoint
app.get(withBase("/"), (req, res) => {
  res.json({
    status: "ok",
    message: "Dancing Dead Relay API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development"
  });
});

// Cron job configuration (only in production)
if (process.env.NODE_ENV === 'production' && process.env.SCHEDULE_NIGHTLY !== 'false') {
  console.log('🕐 Setting up cron job for Friday 2:00 AM (Europe/Paris)');

  cron.schedule('0 2 * * 5', async () => {
    console.log('🔄 Running scheduled artist research update...');

    try {
      const ResearchQueueService = require('./services/ResearchQueueService');
      const queueService = new ResearchQueueService();
      const result = await queueService.addArtistsToQueue();

      if (result.added > 0) {
        console.log(`✅ Added ${result.added} artists to research queue`);
      } else {
        console.log('✅ No new artists found - queue is up to date');
      }
    } catch (error) {
      console.error('❌ Research queue update failed:', error.message);
    }
  }, {
    timezone: "Europe/Paris"
  });
}

// Export the app for Passenger
module.exports = app;

// Start server only if not running under Passenger
if (typeof(PhusionPassenger) === 'undefined') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Base path: ${subPath || '/'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}
