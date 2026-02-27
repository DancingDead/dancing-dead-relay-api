const express = require("express");
const router = express.Router();
const path = require("path");
const Logger = require("../utils/logger");
const deezer = require("../utils/deezer");

const logger = new Logger('naeleckreleases.log');
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const ARTIST_ID = "5171418"; // Naeleck on Deezer

async function fetchAndCache() {
    logger.info("Fetching fresh Naeleck releases from Deezer...");
    const startTime = Date.now();
    const albums = await deezer.getArtistAlbums(ARTIST_ID, logger, 10);

    const latestReleases = albums.map((album) => ({
        name: album.title,
        release_date: album.release_date || null,
        artists: "Naeleck",
        cover_url: album.cover_xl || album.cover_big || null,
        external_urls: {
            deezer: album.link,
            spotify: `https://open.spotify.com/search/${encodeURIComponent(album.title + ' Naeleck')}`
        },
        tracks: [],
    }));

    deezer.writeDataToFile(DATA_FILE_PATH, { latestReleases }, logger);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`Naeleck releases refreshed: ${latestReleases.length} releases in ${duration}s`);
    return latestReleases;
}

async function updateDataInBackground() {
    if (deezer.isRefreshing(ARTIST_ID)) {
        logger.info("Background refresh already in progress, skipping");
        return;
    }
    deezer.setRefreshing(ARTIST_ID, true);
    try {
        await fetchAndCache();
    } catch (error) {
        logger.error("Background update failed", { message: error.message, stack: error.stack });
    } finally {
        deezer.setRefreshing(ARTIST_ID, false);
    }
}

router.get("/", async (req, res) => {
    try {
        const cachedData = deezer.readDataFromFile(DATA_FILE_PATH, logger);
        const isStale = deezer.isCacheStale(cachedData);

        if (cachedData && cachedData.latestReleases) {
            res.json(cachedData.latestReleases);

            if (isStale && !deezer.isRefreshing(ARTIST_ID)) {
                logger.info("Cache is stale, triggering background refresh");
                setTimeout(() => updateDataInBackground(), 2000);
            }
        } else {
            logger.info("No cached data available. Fetching synchronously...");
            const data = await fetchAndCache();
            res.json(data);
        }
    } catch (error) {
        logger.error("GET / failed", { message: error.message, stack: error.stack });
        res.status(500).json({ error: "Failed to retrieve Naeleck releases" });
    }
});

router.post("/update", async (req, res) => {
    try {
        logger.info("=== FORCED UPDATE TRIGGERED ===", { ip: req.ip });
        const startTime = Date.now();
        const data = await fetchAndCache();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success("Forced update completed", { count: data.length, duration: `${duration}s` });
        res.status(200).json({
            message: "Data updated successfully",
            stats: { count: data.length, duration: `${duration}s` }
        });
    } catch (error) {
        logger.error("Forced update failed", { message: error.message, stack: error.stack });
        res.status(500).json({ error: "Update failed", details: error.message });
    }
});

module.exports = router;
