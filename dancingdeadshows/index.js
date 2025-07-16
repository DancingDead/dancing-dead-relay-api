const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = process.env.MONDAY_BOARD_ID_EVENTS; // Remplace par ton ID de board

async function getEventsFromMonday() {
    const query = `
    query {
      boards(ids: [8750281084]) {
        id
        name
        items_page(limit: 300) {
          cursor
          items {
            id
            name
            column_values(ids: ["color_mkppp5y9", "location_mkpp2cvp", "date_mkpp6jpn", "link_mkpp2ea8", "file_mkppv0tt"]) {
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

    console.log("Requête GraphQL envoyée :", query); // Debugging log

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

        if (!response.ok) throw new Error("Erreur lors de la récupération des événements de Monday.com");

        const data = JSON.parse(responseText);

        const events = [];
        if (data && data.data && data.data.boards && data.data.boards.length > 0) {
            const board = data.data.boards[0];
            if (board.items_page && board.items_page.items) {
                board.items_page.items.forEach(item => {
                    let type = null,
                        location = null,
                        date = null,
                        link = null;

                    item.column_values.forEach(column => {
                        if (column.id === "color_mkppp5y9") type = column.text;
                        else if (column.id === "location_mkpp2cvp") location = column.text;
                        else if (column.id === "date_mkpp6jpn") date = column.text;
                        else if (column.id === "link_mkpp2ea8") link = column.text;
                    });

                    // Récupération des images (PIC)
                    const fileAssets = item.assets || [];
                    const picLinks = fileAssets.map(asset => asset.public_url).filter(url => url);

                    events.push({
                        Id: item.id,
                        Name: item.name,
                        Type: type,
                        Location: location,
                        Date: date,
                        Link: link,
                        PIC: picLinks.length > 0 ? picLinks[0] : null, // Prendre la première image si dispo
                    });
                });
            } else {
                console.error("Aucun événement trouvé dans la réponse.");
            }
        } else {
            console.error("Erreur: Impossible de récupérer les données du board.");
        }

        return events;
    } catch (error) {
        console.error("Erreur détaillée :", error);
        throw error;
    }
}


router.get("/", async (req, res) => {
    try {
        const events = await getEventsFromMonday();
        res.json(events);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des événements" });
    }
});

module.exports = router;