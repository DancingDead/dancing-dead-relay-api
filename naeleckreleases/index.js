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

// Fonction pour récupérer le token d'accès
async function getToken() {
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
        throw new Error("Erreur lors de la requête : " + response.status);
    }

    const data = await response.json();
    return data.access_token;
}

// Fonction pour récupérer les dernières sorties de l'artiste Naeleck
async function getLatestReleases(artistId, token) {
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=10`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error("Erreur lors de la requête : " + response.status);
    }

    const data = await response.json();
    const latestReleases = [];
    for (const album of data.items) {
        const release = {
            name: album.name,
            release_date: album.release_date,
            artists: album.artists.map((artist) => artist.name).join(", "),
            cover_url: album.images.length > 0 ? album.images[0].url : null,
            external_urls: album.external_urls,
            tracks: [],
        };
        if (album.tracks) {
            for (const track of album.tracks.items) {
                release.tracks.push({
                    name: track.name,
                    preview_url: track.preview_url,
                    external_urls: track.external_urls,
                });
                await wait(2000); // Délai de 2 secondes entre chaque requête
            }
        }
        latestReleases.push(release);
    }
    return latestReleases;
}

// Fonction pour mettre à jour les données en arrière-plan
async function updateDataInBackground() {
    try {
        const artistId = "2DYDFBqoaBP2i9XrTGpOgF";
        const token = await getToken();
        const latestReleases = await getLatestReleases(artistId, token);

        // Écrire les données dans le fichier JSON pour le cache
        writeDataToFile({ latestReleases });
        console.log("Data updated in background.");
    } catch (error) {
        console.error("Error occurred during background update:", error);
    }
}

router.get("/", async (req, res) => {
    try {
        const cachedData = readDataFromFile();

        // Utiliser les données en cache si elles existent
        if (cachedData && cachedData.latestReleases) {
            console.log("Using cached data");
            res.json(cachedData.latestReleases);
        } else {
            console.log("No cached data available. Fetching new data...");
            const artistId = "2DYDFBqoaBP2i9XrTGpOgF";
            const token = await getToken();
            const latestReleases = await getLatestReleases(artistId, token);

            // Écrire les données dans le fichier JSON pour le cache
            writeDataToFile({ latestReleases });

            res.json(latestReleases);
        }

        // Mettre à jour les données en arrière-plan après la réponse
        setTimeout(() => {
            console.log("Starting background data update...");
            updateDataInBackground();
        }, 0);

    } catch (error) {
        console.error("Une erreur est survenue :", error);
        res.status(500).json({ error: "Une erreur est survenue lors de la récupération des dernières sorties de l'artiste Naeleck" });
    }
});

module.exports = router;
