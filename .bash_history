npm install inquirer
node addShow.js
cd
ls
node addShow.js
npm install inquirer@7
node addShow.js
node addShow.js
node addShow.js
cd naeleckshows
nano data.json
nano data.json
node addShow.js
cd ../
node addShow.js
node addShow.js
node addShow.js
"Concerts Près De Chez Vous, Montaigu, France, 2024-07-27, http://example.com; Tous Les Concerts Et Diffusions Live, Paris, France, 2024-06-29, http://example.com; Tous Les Concerts Et Diffusions Live, Paris, France, 2024-06-30, http://example.com; XNV BEACH FESTIVAL 2024, Excenevex, France, 2024-07-18, http://example.com; XNV BEACH FESTIVAL 2024, Excenevex, France, 2024-07-21, http://example.com; Les Plages Electroniques – Cannes 2024, Cannes, France, 2024-08-16, http://example.com; Les Plages Electroniques – Cannes 2024, Cannes, France, 2024-08-17, http://example.com"
node addShow.js
node addShow.js
node addShow.js
node appShow.js
node addShow.js
node addShow.js
node addShow.js
node addShow.js
node addShow.js
node addShow.js
node addShow.js
node addShow.js
npm install redis
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const redis = require('redis');
const client = redis.createClient();
// Fonction pour récupérer le token d'accès
async function getToken() {
    // Construction du corps de la requête
    const requestBody = new URLSearchParams();
    requestBody.append("grant_type", "client_credentials");
    requestBody.append("client_id", process.env.SPOTIFY_CLIENT_ID);
    requestBody.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);
  
    // Envoi de la requête POST
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
    return data.access_token; // Récupération du token d'accès depuis la réponse
}
// Fonction pour récupérer les dernières sorties de l'artiste Naeleck
async function getLatestPlaylist(playlistId, token) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error("Erreur lors de la requête : " + response.status);
    }

    const data = await response.json(); // Convertir la réponse en JSON
    // Parcours des albums et récupération des informations sur les pistes
    const latestReleasesOfPlaylist = [];

    data.tracks.items.forEach((trackItem) => {
        const track = {
            name: trackItem.track.name,
            artists: trackItem.track.artists.map((artist) => artist.name).join(", "),
            cover_url: trackItem.track.album.images.length > 0 ? trackItem.track.album.images[0].url : null, // URL de la première image de la couverture
            external_urls: trackItem.track.external_urls,
            tracks: [],
        };
        latestReleasesOfPlaylist.push(track);
    });
    return latestReleasesOfPlaylist;
}

// Fonction pour récupérer les informations sur un artiste depuis Spotify
async function getArtistInfo(token, artistName) {
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=10`;
    const response = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await response.json();

    if (data.artists.items.length > 0) {
        // Trier les artistes par popularité décroissante
        const sortedArtists = data.artists.items.sort((a, b) => b.popularity - a.popularity);
        return sortedArtists[0]; // Retourner l'artiste le plus populaire
    } else {
        return null;
    }
}
// Fonction pour récupérer l'URL de l'image d'un artiste à partir du cache Redis
async function getCachedArtistImageUrl(artistName) {
    return new Promise((resolve, reject) => {
        client.get(artistName, (err, reply) => {
            if (err) {
                reject(err);
            } else {
                resolve(reply); // Réponse trouvée dans le cache Redis
            }
        });
    });
}

// Fonction pour mettre en cache l'URL de l'image d'un artiste dans Redis
async function cacheArtistImageUrl(artistName, imageUrl) {
    client.set(artistName, imageUrl);
}
// Fonction pour obtenir l'URL de l'image d'un artiste à partir des informations de l'API Spotify
function getArtistImageUrl(artistInfo) {
    if (artistInfo && artistInfo.images.length > 0) {
        return artistInfo.images[0].url;  // Prend la première image
    } else {
        return 'default_image_url';  // URL d'une image par défaut si aucune image n'est disponible
    }
}
router.get("/", async (req, res) => {
    try {
        const playlistId = "0yN1AKMSboq8tsgmjSL3ky";
        const token = await getToken(); // Récupérer le token d'accès Spotify
        const latestReleasesOfPlaylist = await getLatestPlaylist(playlistId, token);
        const artistImages = [];
        const artists = [];
        // Parcourir les pistes récentes et récupérer les informations sur les artistes
        for (let i = 0; i < latestReleasesOfPlaylist.length; i++) {
            const artistNames = latestReleasesOfPlaylist[i].artists.split(", ");
            for (let j = 0; j < artistNames.length; j++) {
                const artistName = artistNames[j];
                let artistImageUrl = await getCachedArtistImageUrl(artistName);
                // Si l'URL de l'image n'est pas en cache, la récupérer depuis Spotify et la mettre en cache
                if (!artistImageUrl) {
                    const artistInfo = await getArtistInfo(token, artistName);
                    artistImageUrl = getArtistImageUrl(artistInfo);
                    await cacheArtistImageUrl(artistName, artistImageUrl);
                }

                // Ajouter l'artiste à la liste si l'image n'a pas déjà été ajoutée
                    artistImages.push(artistImageUrl);
                    artists.push({
                        name: artistName,
                        image_url: artistImageUrl,
                    });
                }
            }
        }
        res.json(artists);
    } catch (error) {
        console.error("Une erreur est survenue :", error);
        res.status(500).json({ error: "Une erreur est survenue lors de la récupération des dernières sorties de l'artiste Naeleck" });
    }
});
module.exports = router;
npm install node-fetch@2
npm install wikipedia
npm install axios
node --version
npm install axios wikipedia
npm install axios
cd
ls
mkdir lib
mkdir lib
touch lib/axios.js
npm install axios
ls
cd lib
ls
npm install axios rate-limiter-flexible node-cache express dotenv node-fetch node-cron wikipedia
npm install axios rate-limiter-flexible node-cache express dotenv node-fetch node-cron wikipedia
rm lib
rm -r lib
ls
npm install dotenv
internal/modules/cjs/loader.js:638
    throw err;
    ^
Error: Cannot find module 'express'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:636:15)
    at Function.Module._load (internal/modules/cjs/loader.js:562:25)
    at Module.require (internal/modules/cjs/loader.js:692:17)
    at require (internal/modules/cjs/helpers.js:25:18)
at Object.<anonymous> (/app/index.js:2:17)
    at Module._compile (internal/modules/cjs/loader.js:778:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:789:10)
    at Module.load (internal/modules/cjs/loader.js:653:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)
    at Function.Module._load (internal/modules/cjs/loader.js:585:3)npm install express
npm install express
npm install node-cache
npm install node-cron
cd dancingdeadartists
gedit data.json
cat data.json
less data.json
jq . data.json
python -m json.tool data.json
cd dancingdeadartists
cat data.json
cat data.json
ls dancingdeadartists
cd dancingdeadartists
cat data.json
node updateCache.js
node updateCache.js
node updateCache.js
node updateCache.js
node updateData.js
npm run update-data
npm run update-data
node updateCache.js
node updateCache.js
curl -X POST http://localhost:3000/update-cache
curl -X POST https://amethyst-plume-reading.glitch.me/update-cache
curl -X POST http://localhost:3000/update-cache
curl -X POST https://amethyst-plume-reading.glitch.me/update-cache
curl -X POST https://amethyst-plume-reading.glitch.me/update-cache
curl -X POST https://amethyst-plume-reading.glitch.me/update-cache
cd naeleckreleases
cat data.json
npm install ejs
npm install node-cache axios
cd naeleckshows
npm install node-cache axios
pnpm install axios
npm audit fix
curl -X POST "https://accounts.spotify.com/api/token"   -H "Content-Type: application/x-www-form-urlencoded"   -d "grant_type=client_credentials"   -d "client_id=YOUR_SPOTIFY_CLIENT_ID"   -d "client_secret=YOUR_SPOTIFY_CLIENT_SECRET"
app@amethyst-plume-reading:~ 14:45 
$ curl -X POST "https://accounts.spotify.com/api/token" >   -H "Content-Type: application/x-www-form-urlencoded" >   -d "grant_type=client_credentials" >   -d "client_id=YOUR_SPOTIFY_CLIENT_ID" >   -d "client_secret=YOUR_SPOTIFY_CLIENT_SECRET"
{"error":"invalid_client","error_description":"Invalid client"}
app@amethyst-plume-reading:~ 14:45 
$ curl -X POST "https://accounts.spotify.com/api/token" >   -H "Content-Type: application/x-www-form-urlencoded" >   -d "grant_type=client_credentials" >   -d "client_id=YOUR_SPOTIFY_CLIENT_ID" >   -d "client_secret=YOUR_SPOTIFY_CLIENT_SECRET"
curl -X POST "https://accounts.spotify.com/api/token"   -H "Content-Type: application/x-www-form-urlencoded"   -d "grant_type=client_credentials"   -d "client_id=YOUR_SPOTIFY_CLIENT_ID" \
node -v
curl -X POST "https://accounts.spotify.com/api/token"      -H "Content-Type: application/x-www-form-urlencoded"      -d "grant_type=authorization_code&code=AQDY1d6iv4E98Lj_yLWrDj_FwjdZqD7o-jtoiTtsbxEy7AZ77g8nx7lTSYuDkShfIgNhOzb4Hbzx5nw9mUltAh-l39VO0bIwd-kazwd266s_Q6a_lA_OapsFcqizyC595tvsS7Gl1wc6c7OufaCVT5TIqfPfU4V1UKn90xcBxMXKk2C1ML7nDLf9gtvKR6vnPssU4jzqGMyCXzuhUFyQ0xPh-F5lHnaXJVSA&redirect_uri=https://www.dancingdeadrecords.com/&client_id=620fb6a3fc36493ea876fc168baf03fa&client_secret=d6d9d1be092348dca8f5945567c6b872"
curl -X GET "https://api.spotify.com/v1/me" -H "Authorization: Bearer BQAW0mZg1JHQm5hH_Rwf_a7KaCGHsjackkKWGk9My_7HbrQUtlghLs72RF4mWi0BS2a6qirISu_XZhRdMPV41QbWyoqv21vU5RyofttxRTRkiA1FG_kj-qisgzxb8PWsPpEUBssru1L4RyWaatLluJGFKOKHMSIH9vEmdZIlRmUj3iMMZVcAUhjYvYuoTqbt-lLhYM1GC07lAcVDxDiE1sq_CmTk-We7nPC_IxtuR70qinKpprY5Ww"
curl -X GET "https://api.spotify.com/v1/audio-features/{track_id}" \
curl -X GET "https://api.spotify.com/v1/audio-features/1HnuyFokRiXuJtygnFCiZT?si=3f7e78d0154c47be"   -H "Authorization: Bearer BQAW0mZg1JHQm5hH_Rwf_a7KaCGHsjackkKWGk9My_7HbrQUtlghLs72RF4mWi0BS2a6qirISu_XZhRdMPV41QbWyoqv21vU5RyofttxRTRkiA1FG_kj-qisgzxb8PWsPpEUBssru1L4RyWaatLluJGFKOKHMSIH9vEmdZIlRmUj3iMMZVcAUhjYvYuoTqbt-lLhYM1GC07lAcVDxDiE1sq_CmTk-We7nPC_IxtuR70qinKpprY5Ww"
npm install essentia.js
npm install fluent-ffmpeg essentia.js node-fetch express
node -v
refresh
node -v
npm install music-metadata node-fetch child_process
npm audit fix
npm audit fix --force
node -v
node -v
npm fund
npm install node-fetch express dotenv meyda node-web-audio-api
nvm install 18
refresh
kill 1
node -v
npm install meyda
npm install node-fetch express dotenv meyda node-web-audio-api
rm -rf node_modules package-lock.json
npm install
npm install audiocontext
npm install fluent-ffmpeg
node -v
npm rebuild
npm install fluent-ffmpeg
npm install node-web-audio-api@latest
npm install -g node-gyp
npm install web-audio-api fluent-ffmpeg meyda node-fetch dotenv
node -v
refresh
node -v
node -v
node -v
node -v
cd storage/
ls landingpage.json 
ls landingpage.json 
LS landingpage.json 
ls landingpage.json 
cd storage/
ls landingpage.json 
chmir landingpage.json 
cd storage/
nano landingpage.json 
nano landingpage.json 
