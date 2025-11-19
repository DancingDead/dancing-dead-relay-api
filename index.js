require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 3000;
const helmet = require("helmet");
const cron = require("node-cron");

// Sous-chemin configurable (ex: "/dancing-dead-relay-api")
// Défini dans cPanel via l'env SUBPATH ou dans .env : SUBPATH=/dancing-dead-relay-api
// NEW EDI
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
const ai = require("./ai");
const apiArtists = require("./api/artists");

app.use(express.json({ limit: '50mb' })); // Increased size limit
// Configure CORS explicitly to allow requests depuis le domaine avec et sans 'www'
const allowedOrigins = [
  'https://dancingdeadrecords.com',
  'https://www.dancingdeadrecords.com',
  'https://denhakurecords.com',
  'https://www.denhakurecords.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (curl, server-to-server) with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 204,
  preflightContinue: false
}));

// Ensure OPTIONS requests are handled for all routes (preflight)
app.options('*', cors());

app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"], // Autorise uniquement ton domaine
        scriptSrc: ["'self'"],  // Scripts locaux
        styleSrc: ["'self'", "https://fonts.googleapis.com"], // Styles externes (Google Fonts)
        fontSrc: ["'self'", "https://fonts.gstatic.com"],     // Fonts externes (Google Fonts)
        imgSrc: ["'self'", "data:"], // Images locales et base64
      connectSrc: ["'self'", "https://dancingdeadrecords.com", "https://www.dancingdeadrecords.com"],      // API / AJAX
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
app.use(withBase('/ai'), ai);
app.use(withBase('/api/artists'), apiArtists);

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

// ============================================
// CRON JOB - Artist Synchronization
// ============================================

// Synchronisation automatique des artistes tous les dimanches à 20h (8 PM)
// Expression cron: "0 20 * * 0" = minute 0, heure 20, tous les jours du mois, tous les mois, dimanche (0)
// WORKFLOW 2 (Optimisé): Ajoute les artistes manquants à la queue de recherche
cron.schedule('0 20 * * 0', async () => {
  console.log('\n⏰ [CRON] Scheduled artist research queue update - Sunday 8:00 PM');
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  try {
    const ArtistAutomationService = require('./services/ArtistAutomationService');
    const artistService = new ArtistAutomationService();

    // STEP 1: Populate research queue with missing artists
    const result = await artistService.populateResearchQueue();

    if (result.added > 0) {
      console.log(`\n✅ [CRON] Added ${result.added} artists to research queue`);
      console.log('━'.repeat(60));
      console.log('📋 NEXT STEPS:');
      console.log('━'.repeat(60));
      console.log('1. Run research worker: node research-worker.js');
      console.log('2. After research completes, run sync:');
      console.log('   curl -X POST http://localhost:3000/api/artists/sync');
      console.log('━'.repeat(60) + '\n');
    } else {
      console.log('✅ [CRON] No new artists found - queue is up to date\n');
    }

  } catch (error) {
    console.error('❌ [CRON] Research queue update failed:', error.message);
  }
}, {
  timezone: "Europe/Paris" // Ajustez selon votre fuseau horaire
});

console.log('🕐 Cron job configured: Artist sync every Sunday at 8:00 PM (Europe/Paris)');