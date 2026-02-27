const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const path = require("path");
const Logger = require("../utils/logger");
const spotify = require("../utils/spotify");

const logger = new Logger('naeleckreleases.log');
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const ARTIST_ID = "2DYDFBqoaBP2i9XrTGpOgF";

async function getLatestReleases(artistId, token) {
    let retries = 3;
    let waitTime = 2000;
    let response;

    while (retries > 0) {
        try {
            response = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=10`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            logger.error("Network error fetching artist albums", { error: error.message });
            retries--;
            await spotify.wait(waitTime);
            waitTime *= 2;
            continue;
        }

        if (response.ok) break;

        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
            logger.warn(`Rate limited on artist albums fetch. Waiting ${waitTime}ms...`);
            await spotify.wait(waitTime);
            retries--;
            continue;
        }

        logger.warn(`Artist albums fetch error: ${response.status}`);
        retries--;
        await spotify.wait(waitTime);
        waitTime *= 2;
    }

    if (!response || !response.ok) {
        throw new Error("Failed to fetch artist albums after retries");
    }

    const data = await response.json();
    return data.items.map((album) => ({
        name: album.name,
        release_date: album.release_date,
        artists: album.artists.map((artist) => artist.name).join(", "),
        cover_url: album.images.length > 0 ? album.images[0].url : null,
        external_urls: album.external_urls,
        tracks: [],
    }));
}

async function fetchAndCache() {
    logger.info("Fetching fresh Naeleck releases from Spotify...");
    const startTime = Date.now();
    const token = await spotify.getToken(logger);
    const latestReleases = await getLatestReleases(ARTIST_ID, token);
    spotify.writeDataToFile(DATA_FILE_PATH, { latestReleases }, logger);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`Naeleck releases refreshed: ${latestReleases.length} releases in ${duration}s`);
    return latestReleases;
}

async function updateDataInBackground() {
    try {
        await fetchAndCache();
    } catch (error) {
        logger.error("Background update failed", { message: error.message, stack: error.stack });
    }
}

router.get("/", async (req, res) => {
    try {
        const cachedData = spotify.readDataFromFile(DATA_FILE_PATH, logger);
        const isStale = spotify.isCacheStale(cachedData);

        if (cachedData && cachedData.latestReleases) {
            logger.info(`Using cached data (stale: ${isStale})`);
            res.json(cachedData.latestReleases);

            if (isStale) {
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
