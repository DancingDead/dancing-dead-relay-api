# Guide d'utilisation - Dancing Dead Relay API

## Vue d'ensemble

L'API Dancing Dead Relay est un serveur Node.js qui synchronise automatiquement les artistes d'une playlist Spotify avec un site WordPress bilingue (EN/FR). Il gère la création de pages d'artistes, l'extraction de liens sociaux, l'upload d'images et l'intégration avec Polylang pour le contenu multilingue.

## Fonctionnalités principales

- **Synchronisation Spotify** : Récupère tous les artistes (principaux + collaborateurs) d'une playlist Spotify
- **Création automatique de pages WordPress** : Génère des pages bilingues (EN/FR) avec Polylang
- **Extraction de liens sociaux** : Recherche automatique des profils Instagram, SoundCloud, Facebook, Twitter
- **Upload d'images** : Télécharge et assigne automatiquement les photos d'artistes depuis Spotify
- **Gestion des métadonnées** : Configure les champs ACF, Yoast SEO et autres métadonnées
- **Rate limiting intelligent** : Gère les limites de l'API Brave Search (1 req/sec)

## Installation

### Prérequis

- Node.js 14+ et npm
- Compte Spotify Developer (pour les API keys)
- Compte Brave Search API
- Site WordPress avec :
  - Plugin ACF (Advanced Custom Fields)
  - Plugin Polylang (multilingue)
  - Plugin Yoast SEO
  - MCP WordPress Server ou AI WordPress User plugin

### Installation des dépendances

```bash
npm install
```

### Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Spotify API (2 paires de clés pour rotation)
SPOTIFY_CLIENT_ID=votre_client_id_1
SPOTIFY_CLIENT_SECRET=votre_client_secret_1
SPOTIFY_CLIENT_ID_2=votre_client_id_2
SPOTIFY_CLIENT_SECRET_2=votre_client_secret_2

# Brave Search API
BRAVE_API_KEY=votre_brave_api_key

# Claude API (pour génération de contenu)
ANTHROPIC_API_KEY=votre_anthropic_api_key

# WordPress Configuration
WORDPRESS_URL=https://votresite.com
WORDPRESS_MCP_ENDPOINT=https://votresite.com/wp-json/mcp/v1
WORDPRESS_MCP_KEY=votre_mcp_api_key

# OU Alternative avec AI WordPress User
AIWU_API_KEY=votre_aiwu_api_key
AIWU_ENDPOINT=https://votresite.com/wp-json/aiwu/v1

# Configuration serveur
PORT=3000
NODE_ENV=production

# Désactiver les mises à jour nocturnes automatiques (optionnel)
SCHEDULE_NIGHTLY=false
```

### Démarrage du serveur

**Mode développement** (avec nodemon) :
```bash
npm run dev
```

**Mode production** :
```bash
npm start
```

Le serveur démarre sur `http://localhost:3000` (ou le port configuré dans `.env`)

## Endpoints de l'API

### 1. GET /dancingdeadartists

Récupère la liste complète des artistes depuis la playlist Spotify.

**URL** : `http://localhost:3000/dancingdeadartists`

**Méthode** : `GET`

**Paramètres** : Aucun

**Réponse** :
```json
[
  {
    "id": "7bXgB6FaV45o6B4L6Y2YFM",
    "name": "The Artist",
    "image_url": "https://i.scdn.co/image/...",
    "external_urls": "https://open.spotify.com/artist/...",
    "genres": ["techno", "electronic"],
    "popularity": 65,
    "description": "Description générée de l'artiste..."
  },
  ...
]
```

**Comportement** :
- Utilise un cache (fichier `dancingdeadartists/data.json`)
- Met à jour automatiquement le cache chaque nuit à minuit
- Filtre les artistes en blacklist
- Déduplique les artistes

**Exemple d'utilisation** :
```bash
curl http://localhost:3000/dancingdeadartists
```

### 2. POST /dancingdeadartists/update

Force la mise à jour manuelle de la liste d'artistes depuis Spotify.

**URL** : `http://localhost:3000/dancingdeadartists/update`

**Méthode** : `POST`

**Paramètres** : Aucun

**Réponse** :
```json
{
  "message": "Data updated successfully",
  "artists": [...]
}
```

**Utilisation** :
```bash
curl -X POST http://localhost:3000/dancingdeadartists/update
```

**Note** : Cette opération peut prendre plusieurs minutes selon le nombre d'artistes dans la playlist.

### 3. POST /api/artists/sync

Lance la synchronisation complète des artistes vers WordPress.

**URL** : `http://localhost:3000/api/artists/sync`

**Méthode** : `POST`

**Content-Type** : `application/json`

**Paramètres (optionnels)** :
```json
{
  "limit": 5,                    // Nombre max d'artistes à traiter (défaut: tous)
  "skipSpotifyUpdate": true,     // Skip la mise à jour Spotify (utilise le cache)
  "forceAll": false              // Force le traitement de tous les artistes même s'ils existent
}
```

**Réponse** :
```json
{
  "success": true,
  "processed": 5,
  "created": 3,
  "skipped": 2,
  "failed": 0,
  "duration": "45.23s",
  "errors": []
}
```

**Exemple d'utilisation** :

```bash
# Synchroniser tous les artistes manquants
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{}'

# Synchroniser seulement 10 artistes
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "skipSpotifyUpdate": true}'
```

**Processus de synchronisation** :

Pour chaque artiste :
1. **Vérification** : Vérifie si l'artiste existe déjà sur WordPress
2. **Recherche web** : Collecte d'informations supplémentaires via Brave Search
3. **Génération de contenu** : Création de descriptions bilingues (EN/FR) via Claude AI
4. **Extraction de liens sociaux** : Recherche des profils Instagram, SoundCloud, etc.
5. **Upload d'image** : Téléchargement de l'image Spotify vers WordPress
6. **Création de pages** : Génération des pages EN et FR avec tous les métadonnées
7. **Liaison Polylang** : Association des traductions EN/FR

**Logs en temps réel** :

Le serveur affiche des logs détaillés pendant la synchronisation :
```
🎯 Starting Artist Automation Sync
📊 Statistics: 189 total | 237 existing | 0 missing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 Artist [1/5]: The Artist
  ✓ Step 1: Artist found in Spotify data
  🔍 Step 2: Searching web for additional information...
  🤖 Step 3.1: Generating bilingual content with Claude AI...
  🔗 Step 3.2: Searching for social media links...
      🎵 SoundCloud: https://soundcloud.com/artist
      📸 Instagram: https://www.instagram.com/artist/
  📸 Step 4: Uploading artist image to WordPress...
  📝 Step 5: Creating WordPress pages via MCP...
  ✅ Artist pages created successfully!
  🌍 EN: https://votresite.com/artists/the-artist/
  🌍 FR: https://votresite.com/fr/artistes/the-artist/
```

## Flux de données

### 1. Récupération depuis Spotify

```
Playlist Spotify (ID: 0yN1AKMSboq8tsgmjSL3ky)
    ↓
getAllTracksFromPlaylist()
    ↓
Pour chaque track → Récupère TOUS les artistes (principal + collaborateurs)
    ↓
getArtistsDetails() → Batch de 20 artistes max
    ↓
Déduplication et filtrage blacklist
    ↓
Cache dans dancingdeadartists/data.json
```

### 2. Synchronisation vers WordPress

```
Liste d'artistes Spotify
    ↓
ArtistAutomationService.syncArtists()
    ↓
Pour chaque artiste:
    ├─ WebSearchService → Recherche d'infos complémentaires (Brave API)
    ├─ ClaudeService → Génération de contenu bilingue
    ├─ SocialLinksService → Extraction de liens sociaux (rate limited)
    ├─ ImageUploadService → Upload image Spotify vers WordPress
    └─ WordPressMCPService → Création pages bilingues + Polylang linking
```

## Services disponibles

### ArtistAutomationService
Orchestre l'ensemble du workflow d'automatisation.

**Méthodes principales** :
- `syncArtists(options)` : Lance la synchronisation complète
- `processArtist(artist)` : Traite un artiste individuel

### WebSearchService
Gère les recherches web via Brave Search API.

**Méthodes** :
- `search(query, count)` : Effectue une recherche et retourne les résultats
- Rate limit : 1 requête par seconde (géré automatiquement)

### SocialLinksService
Recherche les profils sociaux des artistes.

**Méthodes** :
- `findSocialLinks(artistName)` : Recherche tous les liens sociaux
- `findSoundCloudLink(artistName)` : Recherche spécifique SoundCloud
- `findInstagramLink(artistName)` : Recherche spécifique Instagram

**Important** : Délai de 1.5s entre les recherches pour respecter le rate limit de Brave API.

### ImageUploadService
Télécharge et upload les images d'artistes.

**Méthodes** :
- `uploadArtistImage(imageUrl, artistName)` : Télécharge depuis Spotify et upload vers WordPress
- Convertit automatiquement en base64
- Définit le titre et alt text

### WordPressMCPService
Interface avec WordPress via Model Context Protocol.

**Méthodes principales** :
- `createArtistPages(artistData, content)` : Crée les pages EN/FR
- `uploadMedia(params)` : Upload un fichier media
- `setFeaturedImage(postId, mediaId)` : Assigne l'image mise en avant
- `updateACFFields(postId, fields)` : Met à jour les champs ACF

**Champs ACF configurés** :
- `photo` : Image de l'artiste
- `spotify_link` : Lien Spotify
- `soundcloud_link` : Lien SoundCloud
- `instagram_link` / `instagram` : Lien Instagram (dual naming pour compatibilité)
- `tag1`, `tag2`, `tag3` : Genres musicaux
- `title`, `role`, `description` : Métadonnées bilingues

## Configuration WordPress requise

### Champs ACF personnalisés

Créez un groupe de champs ACF pour le post type "artist" :

```
- photo (Image)
- title (Text)
- role (Text)
- description (Textarea)
- spotify_link (URL)
- soundcloud_link (URL)
- instagram_link (URL)
- instagram (URL)  // Champ alternatif pour compatibilité
- tag1 (Text)
- tag2 (Text)
- tag3 (Text)
```

### Endpoints WordPress personnalisés

Ajoutez ces endpoints à votre thème WordPress (functions.php ou plugin) :

#### 1. Endpoint pour assigner l'image mise en avant

```php
add_action('rest_api_init', function () {
    register_rest_route('dd-api/v1', '/set-featured-image', array(
        'methods' => 'POST',
        'callback' => 'dd_set_featured_image',
        'permission_callback' => 'dd_check_api_key'
    ));
});

function dd_set_featured_image($request) {
    $post_id = $request->get_param('post_id');
    $media_id = $request->get_param('media_id');

    $result = set_post_thumbnail($post_id, $media_id);

    return array('success' => $result);
}
```

#### 2. Endpoint pour mettre à jour les champs ACF

```php
add_action('rest_api_init', function () {
    register_rest_route('dd-api/v1', '/update-acf', array(
        'methods' => 'POST',
        'callback' => 'dd_update_acf_fields',
        'permission_callback' => 'dd_check_api_key'
    ));
});

function dd_update_acf_fields($request) {
    $post_id = $request->get_param('post_id');
    $fields = $request->get_param('fields');

    foreach ($fields as $key => $value) {
        update_field($key, $value, $post_id);
    }

    return array('success' => true);
}
```

#### 3. Vérification de la clé API

```php
function dd_check_api_key($request) {
    $api_key = $request->get_header('X-API-Key');
    $valid_key = get_option('dd_api_key'); // Ou depuis une constante

    return $api_key === $valid_key;
}
```

### Configuration Polylang

1. Créez deux langues : EN (anglais) et FR (français)
2. Notez les term_id des langues (généralement 4 pour EN, 7 pour FR)
3. Activez Polylang pour le post type "artist"

## Blacklist d'artistes

Pour exclure certains artistes de la synchronisation, modifiez le tableau `blackList` dans `dancingdeadartists/index.js` :

```javascript
const blackList = [
    "Michael Parker",
    "Molly Johnston",
    "Gaz & Co",
    "Jon Howard",
    "Teresa Meads",
    "Cosmowave",
    "ladycryface",
    "TANKYU",
    "Nikita Afonso",
    "Agent Zed"
];
```

## Gestion des erreurs

### Rate Limiting (429 Too Many Requests)

L'API gère automatiquement les rate limits :
- **Spotify** : Retry avec backoff exponentiel
- **Brave Search** : 1 requête par seconde (délai de 1.5s entre les recherches)
- **WordPress** : Retry automatique en cas d'erreur temporaire

### Logs d'erreur

Les erreurs sont loggées dans `server.log` :
```bash
# Voir les logs en temps réel
tail -f server.log

# Voir seulement les erreurs
tail -f server.log | grep -E "❌|⚠️|Error"
```

### Cas d'erreur courants

1. **Instagram links not found** : Rate limit Brave API dépassé
   - Solution : Le système attend automatiquement 1.5s entre les recherches

2. **MCP connection error** : WordPress MCP server non disponible
   - Vérifiez que le plugin MCP est installé et actif
   - Vérifiez la clé API dans `.env`

3. **Image upload failed** : Image Spotify non accessible
   - L'artiste sera créé sans image
   - Vous pouvez assigner l'image manuellement plus tard

4. **Polylang linking skipped** : Tools MCP non disponibles
   - Les pages sont créées mais non liées comme traductions
   - Liez-les manuellement dans l'admin WordPress

## Monitoring et maintenance

### Mise à jour automatique nocturne

Par défaut, la liste d'artistes Spotify est mise à jour chaque nuit à minuit.

Pour désactiver :
```env
SCHEDULE_NIGHTLY=false
```

### Statistiques de synchronisation

L'endpoint `/api/artists/sync` retourne des statistiques détaillées :
```json
{
  "success": true,
  "processed": 189,
  "created": 150,
  "skipped": 39,
  "failed": 0,
  "duration": "2h 15m 30s",
  "errors": []
}
```

### Vérification de l'état

```bash
# Vérifier le nombre d'artistes dans la liste Spotify
curl http://localhost:3000/dancingdeadartists | python3 -c "import sys, json; print(len(json.load(sys.stdin)))"

# Vérifier les pages WordPress (via REST API)
curl https://votresite.com/wp-json/wp/v2/artist?per_page=1 \
  | python3 -c "import sys, json; print(json.load(sys.stdin))"
```

## Déploiement en production

### Sur un hébergement Node.js

1. **Cloner le repository** :
```bash
git clone https://github.com/DancingDead/dancing-dead-relay-api.git
cd dancing-dead-relay-api
```

2. **Installer les dépendances** :
```bash
npm install --production
```

3. **Configurer les variables d'environnement** :
```bash
cp .env.example .env
nano .env  # Éditer avec vos clés API
```

4. **Démarrer avec PM2** (recommandé) :
```bash
npm install -g pm2
pm2 start index.js --name "dancing-dead-api"
pm2 save
pm2 startup
```

5. **Configurer le reverse proxy** (nginx) :
```nginx
server {
    listen 80;
    server_name api.votresite.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Variables d'environnement de production

```env
NODE_ENV=production
PORT=3000
SCHEDULE_NIGHTLY=true
```

## Troubleshooting

### Problème : Instagram links ne sont jamais enregistrés

**Solution** : Vérifiez que les deux champs ACF existent :
- `instagram_link`
- `instagram`

Le service utilise les deux noms pour compatibilité.

### Problème : Certains artistes manquent dans la liste

**Solution** : L'API récupère maintenant TOUS les artistes (principal + collaborateurs).
```bash
# Forcer la mise à jour
curl -X POST http://localhost:3000/dancingdeadartists/update
```

### Problème : Duplicate artists sur WordPress

**Cause** : La normalisation des noms avec caractères spéciaux (& devient &#038;)

**Solution temporaire** : Supprimer les doublons manuellement via l'admin WordPress

### Problème : Sync très lent

**Cause** : Rate limiting des APIs (Brave : 1 req/sec, Spotify : limites variables)

**Solutions** :
- Utiliser `skipSpotifyUpdate: true` pour utiliser le cache
- Limiter le nombre d'artistes avec `limit: 10`
- Augmenter le délai entre les recherches (SocialLinksService.js)

## Support et contribution

### Logs de debug

Pour activer les logs détaillés :
```bash
DEBUG=* npm start
```

### Rapporter un bug

Créez une issue sur GitHub avec :
- Description du problème
- Logs d'erreur (depuis `server.log`)
- Configuration (sans les clés API)
- Étapes pour reproduire

## Licence

Ce projet est destiné à un usage interne pour Dancing Dead Records.

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025-01-30
