require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 3000;
const helmet = require("helmet");

// Sous-chemin configurable (ex: "/dancing-dead-relay-api")
// Défini dans cPanel via l'env SUBPATH ou dans .env : SUBPATH=/dancing-dead-relay-api
let subPath = (process.env.SUBPATH || "").trim();
if (subPath && !subPath.startsWith("/")) subPath = "/" + subPath;
if (subPath.endsWith("/")) subPath = subPath.slice(0, -1);

// Utilitaire pour préfixer les routes avec le subPath (gère subPath vide)
function withBase(route) {
  if (!route.startsWith("/")) route = "/" + route;
  return (subPath || "") + route;
}

const naeleckreleases = require("./naeleckreleases");
const naeleckshows = require("./naeleckshows");
const dancingdeadplaylist = require("./dancingdeadplaylist");
const styxplaylist = require("./styxplaylist");
const denhakuplaylist = require("./denhakuplaylist");
const dancingdeadartists = require("./dancingdeadartists");
const denhakuartists = require("./denhakuartists");
const generaldownloaddancingdead = require("./generaldownloaddancingdead");
const generaldownloaddenhaku = require("./generaldownloaddenhaku");
const generaldownloadstyx = require("./generaldownloadstyx");
const dancingdeadshows = require("./dancingdeadshows");

app.use(express.json({ limit: '50mb' })); // Increased size limit
app.use(cors());

app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"], // Autorise uniquement ton domaine
        scriptSrc: ["'self'"],  // Scripts locaux
        styleSrc: ["'self'", "https://fonts.googleapis.com"], // Styles externes (Google Fonts)
        fontSrc: ["'self'", "https://fonts.gstatic.com"],     // Fonts externes (Google Fonts)
        imgSrc: ["'self'", "data:"], // Images locales et base64
        connectSrc: ["'self'"],      // API / AJAX
      },
    })
);

// Endpoint de base (préfixé si nécessaire)
app.get(withBase('/'), (req, res) => res.json({ success: "Hello World!" }));

// Si l'utilisateur visite le subPath sans slash final, rediriger vers la bonne route
if (subPath) {
  app.get(subPath, (req, res) => res.redirect(301, withBase('/')));
}

// Ajout des routes existantes (préfixées si SUBPATH est défini)
app.use(withBase('/naeleckreleases'), naeleckreleases);
app.use(withBase('/naeleckshows'), naeleckshows);
app.use(withBase('/dancingdeadplaylist'), dancingdeadplaylist);
app.use(withBase('/denhakuplaylist'), denhakuplaylist);
app.use(withBase('/styxplaylist'), styxplaylist);
app.use(withBase('/dancingdeadartists'), dancingdeadartists);
app.use(withBase('/denhakuartists'), denhakuartists);
app.use(withBase('/generaldownloaddancingdead'), generaldownloaddancingdead);
app.use(withBase('/generaldownloaddenhaku'), generaldownloaddenhaku);
app.use(withBase('/generaldownloadstyx'), generaldownloadstyx);
app.use(withBase('/dancingdeadshows'), dancingdeadshows);

// Chemin pour récupérer les données de landingpage.json
app.get(withBase('/storage/landingpage.json'), (req, res) => {
  const filePath = path.join(__dirname, "storage/landingpage.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Erreur lors de la lecture du fichier.");
    } else {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).send("Fichier JSON invalide.");
      }
    }
  });
});

// Chemin pour sauvegarder les données dans landingpage.json
app.post(withBase('/storage/landingpage.json'), (req, res) => {
  const filePath = path.join(__dirname, "storage/landingpage.json");
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf8", (err) => {
    if (err) {
      res.status(500).send("Erreur lors de la sauvegarde des données.");
    } else {
      res.send("Données sauvegardées avec succès.");
    }
  });
});

// Lancement du serveur
app.listen(port, () => {
  const base = subPath || '/';
  console.log(`Server running on port : ${port}`);
  console.log(`Base path: ${base}`);
});