const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = process.env.MONDAY_BOARD_ID_EVENTS; // Remplace par ton ID de board

async function getEventsFromMonday() {
        const boardIdToUse = BOARD_ID || 18116092265;
        const query = `
        query {
    boards(ids: [${boardIdToUse}]) {
        id
        name
        items_page(limit: 300) {
            cursor
            items {
                id
                name
                column_values {
                    id
                    text
                    value
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
                    // default values
                    let type = null,
                        location = null,
                        date = null,
                        link = null;

                    // Heuristics: inspect column ids and text to find the right fields
                    (item.column_values || []).forEach(column => {
                        const cid = (column.id || '').toLowerCase();
                        const text = column.text ? String(column.text).trim() : '';
                        // helper: empty -> null
                        const valueOrNull = text === '' ? null : text;

                        // Date detection: id contains 'date' or text looks like a date
                        if (!date && (/date/.test(cid) || /\d{4}-\d{2}-\d{2}/.test(text) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) || !isNaN(Date.parse(text)))) {
                            if (valueOrNull) {
                                const parsed = new Date(text);
                                if (!isNaN(parsed.getTime())) date = parsed.toISOString();
                                else date = text;
                            }
                            return;
                        }

                        // Type/status detection - try to capture values like 'LABEL NIGHT' before they are claimed as location
                        if (!type && (/status|type|category|genre|color|kind|label|night/.test(cid) || (valueOrNull && valueOrNull.length < 80 && /[A-Za-z]/.test(valueOrNull) && /\b(night|label|show|tour|festival|party)\b/i.test(valueOrNull)))) {
                            type = valueOrNull;
                            return;
                        }

                        // Link detection
                        if (!link && (/link|url|website|site/.test(cid) || /https?:\/\//.test(text))) {
                            link = valueOrNull && /https?:\/\//.test(valueOrNull) ? valueOrNull : valueOrNull;
                            return;
                        }

                        // Location detection (stricter): require cid indicating location OR text looks like address/has digits/comma or known place words
                        if (!location && (/loc|location|place|venue|city|adresse|address/.test(cid) || /\d/.test(text) || /,/.test(text) || /\b(stadium|arena|club|hall|bar|theatre|theater|salle|cafe|caf[eé]|pub|venue)\b/i.test(text))) {
                            location = valueOrNull;
                            return;
                        }
                    });

                    // Récupération des images (PIC)
                    const fileAssets = item.assets || [];
                    const picLinks = fileAssets.map(asset => asset.public_url).filter(url => url);

                    // Normalize empty strings to null
                    if (type === '') type = null;
                    if (location === '') location = null;
                    if (link === '') link = null;

                    events.push({
                        Id: item.id,
                        Name: item.name,
                        Type: type || null,
                        Location: location || null,
                        Date: date || null,
                        Link: link || null,
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