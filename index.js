require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 3000;
const helmet = require("helmet");

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

// Endpoint de base
app.get("/", (req, res) => res.json({ success: "Hello World!" }));

// Ajout des routes existantes
app.use("/naeleckreleases", naeleckreleases);
app.use("/naeleckshows", naeleckshows);
app.use("/dancingdeadplaylist", dancingdeadplaylist);
app.use("/denhakuplaylist", denhakuplaylist);
app.use("/styxplaylist", styxplaylist);
app.use("/dancingdeadartists", dancingdeadartists);
app.use("/denhakuartists", denhakuartists);
app.use("/generaldownloaddancingdead", generaldownloaddancingdead);
app.use("/generaldownloaddenhaku", generaldownloaddenhaku);
app.use("/generaldownloadstyx", generaldownloadstyx);
app.use("/dancingdeadshows", dancingdeadshows);

// Nouveau chemin pour récupérer les données de landingpage.json
app.get("/storage/landingpage.json", (req, res) => {
  const filePath = path.join(__dirname, "storage/landingpage.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Erreur lors de la lecture du fichier.");
    } else {
      res.json(JSON.parse(data));
    }
  });
});

// Nouveau chemin pour sauvegarder les données dans landingpage.json
app.post("/storage/landingpage.json", (req, res) => {
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
app.listen(port, () => console.log(`Server running on port : ${port}`));