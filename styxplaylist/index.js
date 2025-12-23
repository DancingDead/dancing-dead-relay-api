const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const DATA_FILE_PATH = path.join(__dirname, 'data.json'); // Chemin vers le fichier JSON contenant le cache

// Fonction pour attendre un délai spécifié en millisecondes
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour lire les données depuis le fichier JSON
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

// Fonction pour écrire les données dans le fichier JSON
function writeDataToFile(data) {
    try {
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing data to file:", error);
    }
}

// Fonction pour récupérer le token d'accès depuis Spotify avec réessai en cas d'échec
async function getToken(retryCount = 3) {
    while (retryCount > 0) {
        try {
            const requestBody = new URLSearchParams();
            requestBody.append("grant_type", "client_credentials");
            requestBody.append("client_id", process.env.SPOTIFY_CLIENT_ID);
            requestBody.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);

            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
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
            if (retryCount > 0) {
                await wait(2000); // Attendre 2 secondes avant de réessayer
            } else {
                throw new Error("Failed to fetch token after retries");
            }
        }
    }
}



// Fonction pour récupérer toutes les pistes d'une playlist en paginant les résultats
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
            throw new Error("Erreur lors de la requête : " + response.status);
        }

        const data = await response.json();
        allTracks = allTracks.concat(data.items);
        nextUrl = data.next; // URL pour la prochaine page de résultats, null si c'est la dernière page
    }

    return allTracks;
}

// Fonction pour récupérer les dernières sorties de la playlist spécifiée
async function getLatestPlaylist(playlistId, token) {
    const tracks = await getAllTracksFromPlaylist(playlistId, token);

    // Utiliser un Set pour garder une trace des albums déjà ajoutés
    const seenAlbums = new Set();

    return tracks
        .map((trackItem) => {
            return {
                name: trackItem.track.name,
                artists: trackItem.track.artists.map((artist) => artist.name).join(", "),
                album: trackItem.track.album.name,
                release_date: trackItem.track.album.release_date,
                duration_ms: trackItem.track.duration_ms,
                popularity: trackItem.track.popularity,
                preview_url: trackItem.track.preview_url,
                cover_url: trackItem.track.album.images.length > 0 ? trackItem.track.album.images[0].url : null,
                external_urls: trackItem.track.external_urls,
            };
        })
        .filter((track) => {
            // Si l'album n'a pas encore été vu, on l'ajoute au Set et on garde la piste
            if (!seenAlbums.has(track.album)) {
                seenAlbums.add(track.album);
                return true;
            }
            // Sinon, on ignore cette piste
            return false;
        });
}

// Fonction pour mettre à jour les données en arrière-plan
async function updateDataInBackground(playlistId) {
    try {
        const token = await getToken();
        const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);

        // Écrire les données dans le fichier JSON pour le cache
        writeDataToFile({ latestReleasesOfPlaylist });
        console.log("Data updated in background.");
    } catch (error) {
        console.error("Error occurred during background update:", error.message);
    }
}

router.get("/", async (req, res) => {
    try {
        const playlistId = "6ZdsD65BwGtuRzvBl2OpqF"; // ID de la playlist
        const cachedData = readDataFromFile();

        // Utiliser les données en cache si elles existent
        if (cachedData && cachedData.latestReleasesOfPlaylist) {
            console.log("Using cached data");
            res.json(cachedData.latestReleasesOfPlaylist);
        } else {
            console.log("No cached data available. Fetching new data...");
            const token = await getToken();
            const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);

            // Écrire les données dans le fichier JSON pour le cache
            writeDataToFile({ latestReleasesOfPlaylist });

            res.json(latestReleasesOfPlaylist);
        }

        // Mettre à jour les données en arrière-plan après la réponse
        setTimeout(() => {
            console.log("Starting background data update...");
            updateDataInBackground(playlistId);
        }, 2000); // Délai de 2 secondes pour éviter les problèmes de performance

    } catch (error) {
        console.error("Une erreur est survenue :", error.message);
        res.status(500).json({ error: "Une erreur est survenue lors de la récupération des dernières sorties de la playlist spécifiée" });
    }
});

module.exports = router;
