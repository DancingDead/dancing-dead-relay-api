const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = process.env.MONDAY_BOARD_ID_DH;
const PLAYLIST_API_URL = "https://amethyst-plume-reading.glitch.me/denhakuplaylist";

async function getPlaylistData() {
    try {
        const response = await fetch(PLAYLIST_API_URL);
        if (!response.ok) throw new Error("Erreur lors de la récupération de la playlist.");
        return await response.json();
    } catch (error) {
        console.error("Erreur de récupération de la playlist :", error);
        return [];
    }
}

async function getNamesFromMonday() {
    const query = `
    query {
      boards(ids: [${BOARD_ID}]) {
        id
        name
        items_page(limit: 300) {
          cursor
          items {
            id
            name
            column_values (ids: ["texte7","date4", "files", "files_mkmx865m", "color_mkp87sfs", "texte8"]) {
              id
              text
            }
            assets {
              id
              public_url
              name
            }
          }
        }
      }
    }`;

    try {
        const response = await fetch("https://api.monday.com/v2/", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });

        const responseText = await response.text();
        console.log("Réponse brute de l'API :", responseText);

        if (!response.ok) throw new Error("Erreur lors de la récupération des données de Monday.com");

        const data = JSON.parse(responseText);

        const items = [];
        if (
            data &&
            data.data &&
            data.data.boards &&
            data.data.boards[0] &&
            data.data.boards[0].items_page &&
            data.data.boards[0].items_page.items
        ) {
            data.data.boards[0].items_page.items.forEach(item => {
                const date = item.column_values.find(column => column.id === "date4");
                const artists = item.column_values.find(column => column.id === "texte7");
                const genreColumn = item.column_values.find(column => column.id === "texte8");
                const statusColumn = item.column_values.find(column => column.id === "color_mkp87sfs");

                const fileAssets = item.assets || [];
                const radioDownloadLinks = fileAssets.map(asset => asset.public_url).filter(url => url);
                
                if (statusColumn && statusColumn.text === "YES") {
                    items.push({
                        Id: item.id,
                        Name: item.name,
                        Dates: date ? date.text : null,
                        Artist: artists ? artists.text.split(",").map(link => link.trim()) : null,
                        RadioDownloadLinks: radioDownloadLinks.length > 0 ? radioDownloadLinks : null,
                        genre: genreColumn ? genreColumn.text.split(",").map(genre => genre.trim()) : null,
                        cover_url: null, // Placeholder pour la cover
                    });
                }
            });
        } else {
            console.error("Aucun élément trouvé dans la réponse.");
        }

        return items;
    } catch (error) {
        console.error("Erreur détaillée :", error);
        throw error;
    }
}

async function enrichWithCovers(items) {
    const playlistData = await getPlaylistData();

    return items.map(item => {
        // Normalisation des artistes de Monday
        const normalizedItemArtists = item.Artist
            ? item.Artist.map(artist => artist.toLowerCase().replace("&", ",").split(",").map(a => a.trim()))
            : [];

        // Recherche d'un morceau correspondant dans la playlist
        let matchingTrack = playlistData.find(track => {
            // Normalisation des artistes de la playlist
            const normalizedTrackArtists = Array.isArray(track.artists)
                ? track.artists.flatMap(artist => artist.toLowerCase().replace("&", ",").split(",").map(a => a.trim()))
                : track.artists.toLowerCase().replace("&", ",").split(",").map(a => a.trim());

            // Vérifier si **tous** les artistes du morceau `item` sont présents dans `track`
            const artistMatch = normalizedItemArtists.every(artistList =>
                artistList.some(artist => normalizedTrackArtists.includes(artist))
            );

            // Vérifier si le titre est le même (insensible à la casse)
            const titleMatch = track.name.toLowerCase().trim() === item.Name.toLowerCase().trim();

            return artistMatch && titleMatch;
        });

        // Si aucune correspondance exacte n'est trouvée, chercher la correspondance la plus probable
        if (!matchingTrack) {
            matchingTrack = playlistData.find(track => {
                const normalizedTrackArtists = Array.isArray(track.artists)
                    ? track.artists.flatMap(artist => artist.toLowerCase().replace("&", ",").split(",").map(a => a.trim()))
                    : track.artists.toLowerCase().replace("&", ",").split(",").map(a => a.trim());

                // Vérifier si au moins un artiste correspond
                const artistMatch = normalizedItemArtists.some(artistList =>
                    artistList.some(artist => normalizedTrackArtists.some(trackArtist => trackArtist.includes(artist)))
                );

                // Vérifier si le titre contient une partie du titre de l'item
                const titleMatch = track.name.toLowerCase().includes(item.Name.toLowerCase());

                return artistMatch || titleMatch; // Correspondance approximative
            });
        }

        // Ajouter la cover si une correspondance est trouvée
        return { ...item, cover_url: matchingTrack ? matchingTrack.cover_url : null };
    });
}

router.get("/", async (req, res) => {
    try {
        let items = await getNamesFromMonday();
        items = await enrichWithCovers(items);
        res.json(items);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des données" });
    }
});

module.exports = router;