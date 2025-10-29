const express = require('express');
const router = express.Router();
const ArtistAutomationService = require('../../services/ArtistAutomationService');

// Instance du service
const artistService = new ArtistAutomationService();

// Variable pour stocker le statut de la dernière synchronisation
let lastSyncStatus = {
  lastRun: null,
  status: 'never_run',
  results: null
};

/**
 * POST /api/artists/sync
 * Déclenche manuellement la synchronisation des artistes
 * Body (optionnel):
 *   - { "limit": 3 } pour limiter le nombre d'artistes (test)
 *   - { "skipSpotifyUpdate": true } pour utiliser le cache Spotify (rapide)
 */
router.post('/sync', async (req, res) => {
  try {
    const limit = req.body?.limit || null;
    const skipSpotifyUpdate = req.body?.skipSpotifyUpdate || false;

    if (limit) {
      console.log(`\n🧪 Manual TEST sync triggered via API (limit: ${limit} artists)`);
    } else {
      console.log('\n🚀 Manual artist sync triggered via API');
    }

    if (skipSpotifyUpdate) {
      console.log('   Using cached Spotify data (skipSpotifyUpdate: true)');
    }

    // Vérifier si ANTHROPIC_API_KEY est configurée
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'ANTHROPIC_API_KEY not configured in environment variables'
      });
    }

    // Lancer la synchronisation avec limite optionnelle et option de skip
    const result = await artistService.syncArtists(limit, skipSpotifyUpdate);

    // Mettre à jour le statut
    lastSyncStatus = {
      lastRun: new Date().toISOString(),
      status: result.status,
      results: result.results
    };

    res.json({
      success: true,
      message: 'Artist synchronization completed',
      ...result
    });

  } catch (error) {
    console.error('❌ Sync error:', error);

    lastSyncStatus = {
      lastRun: new Date().toISOString(),
      status: 'error',
      error: error.message
    };

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/artists/status
 * Obtient le statut de la synchronisation
 */
router.get('/status', async (req, res) => {
  try {
    // Obtenir le prochain vendredi à 2h
    const nextFriday = getNextFriday();

    // Compter les artistes en attente
    const missingArtists = await artistService.findMissingArtists();

    res.json({
      lastSync: lastSyncStatus,
      nextScheduledSync: nextFriday,
      pendingArtists: missingArtists.length,
      apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
    });

  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/artists/missing
 * Liste tous les artistes qui n'ont pas de page WordPress
 */
router.get('/missing', async (req, res) => {
  try {
    const missingArtists = await artistService.findMissingArtists();

    res.json({
      success: true,
      count: missingArtists.length,
      artists: missingArtists.map(artist => ({
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        spotifyUrl: artist.external_urls?.spotify
      }))
    });

  } catch (error) {
    console.error('Error getting missing artists:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/artists/prepare-research
 * Peuple la queue de recherche avec tous les artistes manquants
 * Cela permet de préparer les artistes pour la recherche web via Claude Code
 */
router.post('/prepare-research', async (req, res) => {
  try {
    console.log('\n📋 Preparing research queue via API...');

    const result = await artistService.populateResearchQueue();

    res.json({
      success: true,
      message: 'Research queue populated successfully',
      ...result
    });

  } catch (error) {
    console.error('❌ Error preparing research queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/artists/research-status
 * Obtient le statut de la queue de recherche
 */
router.get('/research-status', async (req, res) => {
  try {
    const stats = artistService.researchQueue.getStats();
    const pending = artistService.researchQueue.getPendingArtists();

    res.json({
      success: true,
      stats,
      pendingArtists: pending.slice(0, 20).map(artist => ({
        name: artist.name,
        status: artist.status,
        addedAt: artist.addedAt,
        genres: artist.genres
      })),
      hasMore: pending.length > 20
    });

  } catch (error) {
    console.error('Error getting research status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Calcule la date du prochain vendredi à 2h du matin
 */
function getNextFriday() {
  const now = new Date();
  const nextFriday = new Date(now);

  // Trouver le prochain vendredi (5 = vendredi)
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
  nextFriday.setDate(now.getDate() + daysUntilFriday);

  // Définir l'heure à 2h00
  nextFriday.setHours(2, 0, 0, 0);

  // Si on est vendredi après 2h, aller au vendredi suivant
  if (now.getDay() === 5 && now.getHours() >= 2) {
    nextFriday.setDate(nextFriday.getDate() + 7);
  }

  return nextFriday.toISOString();
}

module.exports = router;
