const fetch = require("node-fetch");
const fs = require("fs");

// --- Helpers ---

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// --- Spotify Token with Retry + 429 Handling ---

async function getToken(logger) {
    let retries = 5;
    let waitTime = 1000;

    while (retries > 0) {
        const requestBody = new URLSearchParams();
        requestBody.append("grant_type", "client_credentials");
        requestBody.append("client_id", process.env.SPOTIFY_CLIENT_ID);
        requestBody.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);

        let response;
        try {
            response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: requestBody,
            });
        } catch (error) {
            if (logger) logger.error("Network error fetching token", { error: error.message });
            retries--;
            await wait(waitTime);
            waitTime *= 2;
            continue;
        }

        if (response.ok) {
            const data = await response.json();
            return data.access_token;
        }

        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            waitTime = retryAfter ? parseInt(retryAfter) * 1000 : waitTime * 2;
            if (logger) logger.warn(`Rate limited on token fetch. Waiting ${waitTime}ms...`);
            await wait(waitTime);
            retries--;
        } else {
            if (logger) logger.warn(`Token fetch failed with status ${response.status}`);
            retries--;
            await wait(waitTime);
            waitTime *= 2;
        }
    }

    throw new Error("Failed to fetch Spotify token after all retries");
}

// --- Paginated Playlist Fetch with 429 Handling + 3s Delay ---

async function getAllTracksFromPlaylist(playlistId, token, logger) {
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    let pageCount = 0;

    while (nextUrl) {
        let response;
        try {
            response = await fetch(nextUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (error) {
            if (logger) logger.error("Network error fetching playlist tracks", { error: error.message, page: pageCount + 1 });
            throw error;
        }

        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const retryWait = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
                if (logger) logger.warn(`Rate limited on playlist fetch. Waiting ${retryWait}ms...`);
                await wait(retryWait);
                continue; // Retry same URL
            }
            throw new Error("Playlist fetch error: " + response.status);
        }

        const data = await response.json();
        allTracks = allTracks.concat(data.items);
        nextUrl = data.next;
        pageCount++;

        if (logger) logger.info(`Fetched page ${pageCount} (${allTracks.length} tracks total)`);

        if (nextUrl) {
            await wait(3000); // 3s delay between pages
        }
    }

    return allTracks;
}

module.exports = {
    wait,
    readDataFromFile,
    writeDataToFile,
    isCacheStale,
    getToken,
    getAllTracksFromPlaylist,
    CACHE_TTL_MS,
};
