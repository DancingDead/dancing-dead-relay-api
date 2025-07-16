const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const DATA_FILE_PATH = path.join(__dirname, 'data2.json'); // Fichier spécifique pour cette playlist

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

async function getToken(retryCount = 3) {
    while (retryCount > 0) {
        try {
            const requestBody = new URLSearchParams();
            requestBody.append("grant_type", "client_credentials");
            requestBody.append("client_id", process.env.SPOTIFY_CLIENT_ID);
            requestBody.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);

            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: requestBody,
            });

            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error("Service unavailable, retrying...");
                }
                throw new Error("Erreur lors de la requête : " + response.status);
            }

            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error("Error fetching token:", error.message);
            retryCount--;
            if (retryCount > 0) await wait(2000);
            else throw new Error("Failed to fetch token after retries");
        }
    }
}

async function getAllTracksFromPlaylist(playlistId, token) {
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Erreur lors de la requête : " + response.status);

        const data = await response.json();
        allTracks = allTracks.concat(data.items);
        nextUrl = data.next;
    }

    return allTracks;
}

async function getLatestPlaylist(playlistId, token) {
    const tracks = await getAllTracksFromPlaylist(playlistId, token);
    const seenAlbums = new Set();

    return tracks.map(trackItem => ({
        name: trackItem.track.name,
        artists: trackItem.track.artists.map(artist => artist.name).join(", "),
        album: trackItem.track.album.name,
        release_date: trackItem.track.album.release_date,
        duration_ms: trackItem.track.duration_ms,
        popularity: trackItem.track.popularity,
        preview_url: trackItem.track.preview_url,
        cover_url: trackItem.track.album.images.length > 0 ? trackItem.track.album.images[0].url : null,
        external_urls: trackItem.track.external_urls,
    })).filter(track => {
        if (!seenAlbums.has(track.album)) {
            seenAlbums.add(track.album);
            return true;
        }
        return false;
    });
}

async function updateDataInBackground(playlistId) {
    try {
        const token = await getToken();
        const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);
        writeDataToFile({ latestReleasesOfPlaylist });
        console.log("Data updated in background.");
    } catch (error) {
        console.error("Error occurred during background update:", error.message);
    }
}

router.get("/", async (req, res) => {
    try {
        const playlistId = "0jJlwrVVQbx5Codew8Jwlk";
        const cachedData = readDataFromFile();

        if (cachedData && cachedData.latestReleasesOfPlaylist) {
            console.log("Using cached data");
            res.json(cachedData.latestReleasesOfPlaylist);
        } else {
            console.log("No cached data available. Fetching new data...");
            const token = await getToken();
            const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);
            writeDataToFile({ latestReleasesOfPlaylist });
            res.json(latestReleasesOfPlaylist);
        }

        setTimeout(() => {
            console.log("Starting background data update...");
            updateDataInBackground(playlistId);
        }, 2000);
    } catch (error) {
        console.error("Une erreur est survenue :", error.message);
        res.status(500).json({ error: "Une erreur est survenue lors de la récupération des dernières sorties de la playlist spécifiée" });
    }
});

module.exports = router;
