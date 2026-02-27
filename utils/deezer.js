const fetch = require("node-fetch");
const fs = require("fs");

// --- Helpers ---

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Refresh lock to prevent concurrent background updates ---

const _refreshInProgress = new Set();

function isRefreshing(key) {
    return _refreshInProgress.has(key);
}

function setRefreshing(key, value) {
    if (value) _refreshInProgress.add(key);
    else _refreshInProgress.delete(key);
}

// --- Cache with TTL ---

const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function readDataFromFile(dataFilePath, logger) {
    try {
        if (fs.existsSync(dataFilePath)) {
            const rawdata = fs.readFileSync(dataFilePath, 'utf8');
            return rawdata ? JSON.parse(rawdata) : {};
        }
        return {};
    } catch (error) {
        if (logger) logger.error("Error reading cache file", { error: error.message, path: dataFilePath });
        return {};
    }
}

function writeDataToFile(dataFilePath, data, logger) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
        if (logger) logger.info("Cache file written", { path: dataFilePath });
    } catch (error) {
        if (logger) logger.error("Error writing cache file", { error: error.message, path: dataFilePath });
    }
}

function isCacheStale(cachedData) {
    if (!cachedData || !cachedData.lastUpdated) return true;
    const age = Date.now() - new Date(cachedData.lastUpdated).getTime();
    return age > CACHE_TTL_MS;
}

// --- Deezer API fetch with retry + quota error handling ---

async function deezerFetch(url, logger, retries = 3) {
    let waitTime = 2000;

    while (retries > 0) {
        let response;
        try {
            response = await fetch(url);
        } catch (error) {
            if (logger) logger.error("Network error", { error: error.message, url });
            retries--;
            await wait(waitTime);
            waitTime *= 2;
            continue;
        }

        if (!response.ok) {
            if (logger) logger.warn(`Deezer fetch failed with status ${response.status}`, { url });
            retries--;
            await wait(waitTime);
            waitTime *= 2;
            continue;
        }

        const data = await response.json();

        // Deezer returns error code 4 for quota exceeded
        if (data.error && data.error.code === 4) {
            if (logger) logger.warn(`Deezer quota exceeded. Waiting ${waitTime}ms...`, { url });
            await wait(waitTime);
            waitTime *= 2;
            retries--;
            continue;
        }

        return data;
    }

    throw new Error(`Failed to fetch from Deezer after all retries: ${url}`);
}

// --- Paginated Playlist Track Fetch ---

async function getAllTracksFromPlaylist(playlistId, logger) {
    let allTracks = [];
    let url = `https://api.deezer.com/playlist/${playlistId}/tracks?limit=100&index=0`;
    let pageCount = 0;

    while (url) {
        const data = await deezerFetch(url, logger);

        if (data.data) {
            allTracks = allTracks.concat(data.data);
        }

        url = data.next || null;
        pageCount++;

        if (logger) logger.info(`Fetched page ${pageCount} (${allTracks.length} tracks total)`);

        if (url) {
            await wait(2000); // 2s delay between pages
        }
    }

    return allTracks;
}

// --- Fetch album release dates in batch ---

async function getAlbumReleaseDates(albumIds, logger) {
    const dates = {};

    for (let i = 0; i < albumIds.length; i++) {
        const albumId = albumIds[i];
        try {
            const data = await deezerFetch(`https://api.deezer.com/album/${albumId}`, logger);
            dates[albumId] = data.release_date || null;
        } catch (error) {
            if (logger) logger.warn(`Failed to fetch album ${albumId} release date`, { error: error.message });
            dates[albumId] = null;
        }

        if (i < albumIds.length - 1) {
            await wait(500); // 500ms delay between album requests
        }

        if ((i + 1) % 20 === 0 && logger) {
            logger.info(`Album dates progress: ${i + 1}/${albumIds.length}`);
        }
    }

    return dates;
}

// --- Fetch artist albums ---

async function getArtistAlbums(artistId, logger, limit = 10) {
    const data = await deezerFetch(
        `https://api.deezer.com/artist/${artistId}/albums?limit=${limit}`,
        logger
    );
    return data.data || [];
}

module.exports = {
    wait,
    readDataFromFile,
    writeDataToFile,
    isCacheStale,
    deezerFetch,
    getAllTracksFromPlaylist,
    getAlbumReleaseDates,
    getArtistAlbums,
    isRefreshing,
    setRefreshing,
    CACHE_TTL_MS,
};
