const express = require('express');
const fetch = require('node-fetch'); // Utilise node-fetch pour les requêtes HTTP
const NodeCache = require('node-cache');
const router = express.Router();

const cache = new NodeCache({ stdTTL: 3600 });
const API_KEY = '4f487c495d5d9d80b0ba34fd1cdf42e5';

router.get('/', async (req, res) => {
    const cacheKey = 'naeleck_shows';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await fetch(`https://rest.bandsintown.com/artists/Naeleck/events/?app_id=${API_KEY}`);
        const shows = await response.json();
        cache.set(cacheKey, shows);
        res.json(shows);
    } catch (error) {
        console.error('Erreur lors de la récupération des données Bandsintown:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

module.exports = router;