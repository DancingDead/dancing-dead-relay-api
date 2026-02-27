const express = require("express");
const router = express.Router();
const path = require("path");
const Logger = require("../utils/logger");
const deezer = require("../utils/deezer");

const logger = new Logger('dancingdeadplaylist.log');
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const PLAYLIST_ID = "15000557143";

async function processPlaylistTracks(tracks, logger) {
    const seenAlbums = new Set();
    const uniqueTracks = tracks.filter((track) => {
        const albumId = track.album.id;
        if (!seenAlbums.has(albumId)) {
            seenAlbums.add(albumId);
            return true;
        }
        return false;
    });

    // Fetch release dates for all unique albums
    const albumIds = uniqueTracks.map(t => t.album.id);
    logger.info(`Fetching release dates for ${albumIds.length} unique albums...`);
    const releaseDates = await deezer.getAlbumReleaseDates(albumIds, logger);

    return uniqueTracks.map((track) => ({
        name: track.title,
        artists: track.artist.name,
        album: track.album.title,
        release_date: releaseDates[track.album.id] || null,
        duration_ms: track.duration * 1000,
        popularity: track.rank,
        preview_url: track.preview || null,
        cover_url: track.album.cover_xl || track.album.cover_big || null,
        external_urls: {
            deezer: track.link
        },
    }));
}

async function fetchAndCache() {
    logger.info("Fetching fresh data from Deezer...");
    const startTime = Date.now();
    const tracks = await deezer.getAllTracksFromPlaylist(PLAYLIST_ID, logger);
    const latestReleasesOfPlaylist = await processPlaylistTracks(tracks, logger);
    deezer.writeDataToFile(DATA_FILE_PATH, { latestReleasesOfPlaylist }, logger);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`Data refreshed: ${latestReleasesOfPlaylist.length} releases in ${duration}s`);
    return latestReleasesOfPlaylist;
}

async function updateDataInBackground() {
    if (deezer.isRefreshing(PLAYLIST_ID)) {
        logger.info("Background refresh already in progress, skipping");
        return;
    }
    deezer.setRefreshing(PLAYLIST_ID, true);
    try {
        await fetchAndCache();
    } catch (error) {
        logger.error("Background update failed", { message: error.message, stack: error.stack });
    } finally {
        deezer.setRefreshing(PLAYLIST_ID, false);
    }
}

router.get("/", async (req, res) => {
    try {
        const cachedData = deezer.readDataFromFile(DATA_FILE_PATH, logger);
        const isStale = deezer.isCacheStale(cachedData);

        if (cachedData && cachedData.latestReleasesOfPlaylist) {
            res.json(cachedData.latestReleasesOfPlaylist);

            if (isStale && !deezer.isRefreshing(PLAYLIST_ID)) {
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
