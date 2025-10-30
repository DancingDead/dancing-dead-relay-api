const express = require('express');
const router = express.Router();
const {
  askClaude,
  generateEventDescription,
  generateArtistBio,
  generatePlaylistDescription,
} = require('../utils/claudeService');

/**
 * POST /ai/generate-event-description
 * Generate an AI description for an event
 *
 * Body: { type, location, date }
 */
router.post('/generate-event-description', async (req, res) => {
  try {
    const { type, location, date } = req.body;

    if (!type && !location && !date) {
      return res.status(400).json({
        error: 'Please provide at least one field: type, location, or date',
      });
    }

    const result = await generateEventDescription({ type, location, date });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      description: result.text,
      usage: result.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/generate-artist-bio
 * Generate an AI bio for an artist
 *
 * Body: { name, genres, popularity }
 */
router.post('/generate-artist-bio', async (req, res) => {
  try {
    const { name, genres, popularity } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    const result = await generateArtistBio({ name, genres, popularity });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      bio: result.text,
      usage: result.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/generate-playlist-description
 * Generate an AI description for a playlist
 *
 * Body: { name, trackCount, artists }
 */
router.post('/generate-playlist-description', async (req, res) => {
  try {
    const { name, trackCount, artists } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    const result = await generatePlaylistDescription({
      name,
      trackCount,
      artists,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      description: result.text,
      usage: result.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/ask
 * Ask Claude a custom question with project context
 *
 * Body: { prompt, includeContext }
 */
router.post('/ask', async (req, res) => {
  try {
    const { prompt, includeContext = true } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await askClaude(prompt, { includeContext });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      response: result.text,
      usage: result.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
