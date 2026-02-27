const express = require("express");
const router = express.Router();
const path = require("path");
const Logger = require("../utils/logger");
const spotify = require("../utils/spotify");

const logger = new Logger('dancingdeadplaylist.log');
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const PLAYLIST_ID = "0yN1AKMSboq8tsgmjSL3ky";

function processPlaylistTracks(tracks) {
    const seenAlbums = new Set();
    return tracks
        .map((trackItem) => ({
            name: trackItem.track.name,
            artists: trackItem.track.artists.map((artist) => artist.name).join(", "),
            album: trackItem.track.album.name,
            release_date: trackItem.track.album.release_date,
            duration_ms: trackItem.track.duration_ms,
            popularity: trackItem.track.popularity,
            preview_url: trackItem.track.preview_url,
            cover_url: trackItem.track.album.images.length > 0 ? trackItem.track.album.images[0].url : null,
            external_urls: trackItem.track.external_urls,
        }))
        .filter((track) => {
            if (!seenAlbums.has(track.album)) {
                seenAlbums.add(track.album);
                return true;
            }
            return false;
        });
}

async function fetchAndCache() {
    logger.info("Fetching fresh data from Spotify...");
    const startTime = Date.now();
    const token = await spotify.getToken(logger);
    const tracks = await spotify.getAllTracksFromPlaylist(PLAYLIST_ID, token, logger);
    const latestReleasesOfPlaylist = processPlaylistTracks(tracks);
    spotify.writeDataToFile(DATA_FILE_PATH, { latestReleasesOfPlaylist }, logger);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`Data refreshed: ${latestReleasesOfPlaylist.length} releases in ${duration}s`);
    return latestReleasesOfPlaylist;
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

        if (cachedData && cachedData.latestReleasesOfPlaylist) {
            logger.info(`Using cached data (stale: ${isStale})`);
            res.json(cachedData.latestReleasesOfPlaylist);

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
        res.status(500).json({ error: "Failed to retrieve playlist releases" });
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
