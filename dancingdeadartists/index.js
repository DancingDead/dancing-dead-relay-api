const express = require("express");

const router = express.Router();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const DATA_FILE_PATH = path.join(__dirname, 'data.json'); // Chemin vers le fichier JSON contenant les données

const API_KEYS = [
    { clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET },
    { clientId: process.env.SPOTIFY_CLIENT_ID_2, clientSecret: process.env.SPOTIFY_CLIENT_SECRET_2 }
];

let currentKeyIndex = 0;

function getCurrentApiKey() {
    return API_KEYS[currentKeyIndex];
}

function rotateApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readDataFromFile() {
    try {
        if (fs.existsSync(DATA_FILE_PATH)) {
            const rawdata = fs.readFileSync(DATA_FILE_PATH, 'utf8');
            return rawdata ? JSON.parse(rawdata) : {};
        } else {
            return {};
        }
    } catch (error) {
        console.error("Error reading data from file:", error);
        return {};
    }
}

function writeDataToFile(data) {
    try {
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing data to file:", error);
    }
}

async function getToken() {
    const { clientId, clientSecret } = getCurrentApiKey();
    const requestBody = new URLSearchParams();
    requestBody.append("grant_type", "client_credentials");
    requestBody.append("client_id", clientId);
    requestBody.append("client_secret", clientSecret);

    let response;
    let retries = 5;
    let waitTime = 1000;

    while (retries > 0) {
        response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: requestBody,
        });

        if (response.ok) break;

        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            waitTime = retryAfter ? parseInt(retryAfter) * 1000 : waitTime * 2;
            console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
            await wait(waitTime);
            retries--;
        } else {
            rotateApiKey(); // Changer de clé en cas d'erreur
        }
    }

    const data = await response.json();
    return data.access_token;
}

async function getAllTracksFromPlaylist(playlistId, token) {
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
                console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
                await wait(waitTime);
                continue;
            } else {
                rotateApiKey(); // Changer de clé en cas d'erreur
            }
        }

        const data = await response.json();
        allTracks = allTracks.concat(data.items);
        nextUrl = data.next;

        await wait(3000); // Délai augmenté pour éviter les rate limits
    }

    return allTracks;
}

async function getLatestPlaylist(playlistId, token) {
    const tracks = await getAllTracksFromPlaylist(playlistId, token);
    return tracks.map(trackItem => ({
        name: trackItem.track.name,
        artists: trackItem.track.artists.map(artist => ({
            name: artist.name,
            id: artist.id,
        })),
    }));
}

async function getArtistsDetails(token, artists) {
    const artistsWithImages = [];
    const artistSet = new Set();
    const batchSize = 20;
    let retries = 5;
    let waitTime = 1000;

    const totalArtists = artists.length;
    let processedArtists = 0;

    for (let i = 0; i < totalArtists; i += batchSize) {
        const artistBatch = artists.slice(i, i + batchSize);
        const artistIds = artistBatch.map(artist => artist.id).join(',');

        let response;
        while (retries > 0) {
            response = await fetch(`https://api.spotify.com/v1/artists?ids=${artistIds}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) break;

            if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                waitTime = retryAfter ? parseInt(retryAfter) * 1000 : waitTime * 2;
                console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
                await wait(waitTime);
                retries--;
            } else {
                rotateApiKey(); // Changer de clé en cas d'erreur
            }
        }

        const data = await response.json();
        data.artists.forEach(artistInfo => {
            if (artistInfo && artistInfo.images.length > 0 && !artistSet.has(artistInfo.id)) {
                artistsWithImages.push({
                    id: artistInfo.id,
                    name: artistInfo.name,
                    image_url: artistInfo.images[0].url,
                    external_urls: artistInfo.external_urls.spotify,
                    genres: artistInfo.genres,
                    popularity: artistInfo.popularity,
                });
                artistSet.add(artistInfo.id);
            }
        });

        processedArtists += artistBatch.length;
        console.log(`Progress: ${processedArtists}/${totalArtists} artists processed`);

        await wait(3000); // Délai augmenté pour éviter les rate limits
    }

    return artistsWithImages;
}

function loadArtistDescriptions() {
    const rawdata = fs.readFileSync('dancingdeadartists/artistDescriptions.json', 'utf8');
    return JSON.parse(rawdata);
}

function mergeArtistDescriptions(artistsWithImages, artistDescriptions) {
    return artistsWithImages.map(artist => {
        const description = artistDescriptions[artist.name] || "Description not available";
        return { ...artist, description };
    });
}

// Ajout d'une blacklist
const blackList = ["Michael Parker", "Molly Johnston", "Gaz & Co", "Jon Howard", "Teresa Meads", "Cosmowave", "Gaz & Co", "ladycryface", "Gaz & Co", "TANKYU", "Nikita Afonso", "Agent Zed"]; // Liste noire d'artistes à exclure

// Filtrer les artistes pour exclure ceux dans la blacklist
function filterUniqueAndBlacklistedArtists(artistsWithImages) {
    const seen = new Set();
    return artistsWithImages.filter(artist => {
        const duplicate = seen.has(artist.name);
        seen.add(artist.name);
        return !duplicate && !blackList.includes(artist.name); // Exclure si dans la blacklist
    });
}

async function fetchAndCacheArtistsImages() {
    const playlistId = "0yN1AKMSboq8tsgmjSL3ky"; // Spotify playlist ID
    const token = await getToken();
    const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);

    const artistsWithImages = [];

    for (const release of latestReleasesOfPlaylist) {
        // Récupérer TOUS les artistes de la track (principal + collaborateurs)
        for (const artist of release.artists) {
            const artistDetails = await getArtistsDetails(token, [artist]);
            if (artistDetails && artistDetails.length > 0) {
                artistsWithImages.push(...artistDetails);
            }
        }
    }

    writeDataToFile({ latestReleasesOfPlaylist, artistsWithImages });
    return artistsWithImages;
}

router.get("/", async (req, res) => {
    try {
        let { latestReleasesOfPlaylist, artistsWithImages } = readDataFromFile();

        if (!artistsWithImages) {
            console.log("Fetching new artists images...");
            artistsWithImages = await fetchAndCacheArtistsImages();
        } else {
            console.log("Using cached artists images...");
        }

        artistsWithImages = filterUniqueAndBlacklistedArtists(artistsWithImages);

        const artistDescriptions = loadArtistDescriptions();
        const artistsWithDescriptions = mergeArtistDescriptions(artistsWithImages, artistDescriptions);

        res.json(artistsWithDescriptions);
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({ error: "An error occurred while retrieving artists" });
    }
});

// Nouvelle route pour forcer la mise à jour du cache
router.post("/update", async (req, res) => {
    try {
        console.log("Forcing data update...");
        const artistsWithImages = await fetchAndCacheArtistsImages(); // Met à jour les données manuellement
        res.status(200).json({ message: "Data updated successfully", artists: artistsWithImages });
    } catch (error) {
        console.error("Error during manual update:", error);
        res.status(500).json({ error: "An error occurred while updating data manually" });
    }
});

// Disabled when NODE_ENV === 'test' or when SCHEDULE_NIGHTLY is explicitly set to 'false'
const SCHEDULE_NIGHTLY = process.env.SCHEDULE_NIGHTLY !== 'false' && process.env.NODE_ENV !== 'test';
if (SCHEDULE_NIGHTLY) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    (function scheduleNextMidnight() {
        try {
            const now = new Date();
            const next = new Date(now);
            // Set to next midnight (start of next day)
            next.setHours(24, 0, 0, 0);
            const delay = next.getTime() - now.getTime();
            console.log(`[scheduler] Next nightly artists update scheduled in ${Math.round(delay/1000)}s at ${next.toISOString()}`);

            setTimeout(function run() {
                (async () => {
                    try {
                        console.log('[scheduler] Running nightly artists update...');
                        await fetchAndCacheArtistsImages();
                        console.log('[scheduler] Nightly artists update finished.');
                    } catch (err) {
                        console.error('[scheduler] Nightly update failed:', err);
                    } finally {
                        // schedule next run in 24h
                        setTimeout(run, MS_PER_DAY);
                    }
                })();
            }, delay);
        } catch (err) {
            console.error('[scheduler] Failed to schedule nightly update:', err);
        }
    })();
}

module.exports = router;
