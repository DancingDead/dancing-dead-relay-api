# Guide de l'Automatisation des Artistes - Dancing Dead Records

## Vue d'ensemble

Ce système automatise la création et la gestion des pages d'artistes sur le site WordPress de Dancing Dead Records. Il synchronise les artistes depuis Spotify, effectue des recherches web pour enrichir les biographies, et crée automatiquement des pages bilingues (EN/FR) avec toutes les métadonnées nécessaires.

## Comment ça fonctionne

### 1. Synchronisation Spotify

Le système récupère tous les artistes depuis les playlists Spotify de Dancing Dead Records :
- Lit toutes les tracks des playlists configurées
- Extrait tous les artistes (artiste principal + collaborateurs)
- Déduplique la liste pour obtenir des artistes uniques
- Actuellement : **189 artistes uniques** indexés

### 2. Recherche Web Intelligente

Pour chaque artiste manquant, le système effectue 3 recherches web ciblées via **Brave Search API** :
- **Biographie** : historique, parcours, projets passés
- **Labels** : maisons de disques, collaborations
- **Performances** : festivals, événements, tournées

**Note importante** : Les gros artistes bénéficient de descriptions plus riches et précises car il y a beaucoup plus de données disponibles sur le web. Les artistes émergents auront des descriptions plus génériques mais toujours professionnelles.

### 3. Génération de Contenu par IA

**Claude AI (Sonnet 4)** analyse les résultats de recherche et génère :
- Description bilingue EN/FR (4 paragraphes narratifs, style Jéja)
- Meta descriptions pour le SEO
- Rôle de l'artiste (DJ & Producer / DJ & Producteur)
- Contenu adapté au style éditorial de Dancing Dead Records

Le système utilise un prompt enrichi avec le contexte du label pour produire des textes cohérents avec l'identité de Dancing Dead.

### 4. Création des Pages WordPress

Pour chaque artiste, le système crée **2 pages liées** (via Polylang) :
- Page EN (anglais)
- Page FR (français)

**Contenu automatiquement rempli** :
- Titre de la page (nom de l'artiste)
- Description complète (4 paragraphes)
- Meta description Yoast SEO
- Lien Spotify
- Image de l'artiste (téléchargée depuis Spotify)
- Genres musicaux (taxonomie WordPress)
- Liens réseaux sociaux (Instagram, Facebook, Twitter/X)
- Champs ACF personnalisés

### 5. Protection Anti-Doublons

Le système implémente **deux niveaux de protection** :
1. **Lock API** : Empêche les synchronisations concurrentes
2. **Vérification pré-création** : Re-vérifie l'existence avant chaque création

Cela évite les pages dupliquées même en cas de requêtes simultanées.

## Déclenchement Automatique

### Synchronisation Hebdomadaire

**Tous les vendredis à 2h du matin** (fuseau horaire du serveur), le système :
1. Récupère la liste des artistes Spotify
2. Identifie les artistes manquants dans WordPress
3. Effectue les recherches web
4. Génère les descriptions
5. Crée les pages bilingues

Cette synchronisation se fait automatiquement via un cron job configuré sur le serveur O2Switch.

### Synchronisation Manuelle

Il est possible de déclencher manuellement une synchronisation via l'API :

```bash
# Sync complète
curl -X POST "https://api.dancingdeadrecords.com/dancing-dead-relay-api/api/artists/sync" \
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'

# Test avec 1 artiste
curl -X POST "https://api.dancingdeadrecords.com/dancing-dead-relay-api/api/artists/sync" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1, "skipSpotifyUpdate": true}'
```

## Coûts et APIs

### Claude AI - Génération de Contenu

**Modèle utilisé** : Claude Sonnet 4 (claude-sonnet-4-20250514)

**Tarification** :
- Input : $3 / MTok (million de tokens)
- Output : $15 / MTok

**Estimation par artiste** :
- ~3000 tokens input (contexte + recherche)
- ~1000 tokens output (descriptions bilingues)
- **Coût par artiste : ~$0.024**

**Estimation hebdomadaire** :
- 10-20 nouveaux artistes par semaine (estimé)
- **Coût : $0.24 - $0.48 par semaine**
- **~$1-2 par mois**

**Conclusion** : Coût très faible, négligeable pour le budget du label.

### Brave Search API - Recherche Web

**Tarification** : **GRATUIT** jusqu'à 2000 requêtes/mois

**Utilisation actuelle** :
- 3 recherches par artiste (biography, labels, performances)
- 20 artistes/semaine × 3 = 60 recherches/semaine
- **~240 recherches/mois**

**Conclusion** : Largement dans le quota gratuit. Brave Search a été choisi spécifiquement pour son tier gratuit généreux tout en offrant des résultats de qualité supérieure à DuckDuckGo.

**Fallback** : Si le quota Brave est dépassé, le système bascule automatiquement sur DuckDuckGo (gratuit illimité mais résultats moins riches).

### Spotify API

**Gratuit** pour l'utilisation actuelle (lecture de playlists publiques).

## Hébergement et Infrastructure

### Serveur

- **Hébergeur** : O2Switch
- **Type** : Node.js + Phusion Passenger
- **URL** : https://api.dancingdeadrecords.com/dancing-dead-relay-api/
- **Statut** : ✅ Opérationnel

### Stack Technique

- Node.js + Express.js
- Services :
  - `ArtistAutomationService` : Orchestration principale
  - `WebSearchService` : Recherches Brave/DuckDuckGo
  - `WordPressMCPService` : Intégration WordPress via MCP (SSE)
  - `SocialLinksService` : Extraction des réseaux sociaux
  - `ImageUploadService` : Upload d'images artistes

### Déploiement

Le code est versionné sur GitHub. Pour mettre à jour le serveur :

```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
git pull origin main
npm install
mkdir -p tmp && touch tmp/restart.txt  # Redémarre Passenger
```

## Édition Post-Création

**Important** : Les pages créées automatiquement **peuvent être éditées manuellement** après coup dans WordPress.

Le système ne fait que remplir les CPT (Custom Post Types) et les champs ACF. Toute modification manuelle sera conservée lors des prochaines synchronisations car le système ne met **pas à jour** les pages existantes, il crée uniquement les pages manquantes.

### Ce qui peut être modifié

- Description de l'artiste
- Meta descriptions SEO
- Liens réseaux sociaux
- Image de l'artiste
- Genres musicaux
- Tout autre champ ACF

Les modifications manuelles ne seront **jamais écrasées** par le système d'automatisation.

## Configuration Requise

### Variables d'Environnement

Le fichier `.env` doit contenir ces clés pour que le système fonctionne :

```bash
# WordPress MCP (Model Context Protocol)
WORDPRESS_MCP_ENDPOINT=https://votre-site.com/wp-json/mcp/v1/stream
WORDPRESS_MCP_KEY=votre_cle_mcp

# Claude AI (génération de contenu)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Brave Search API (recherche web)
BRAVE_SEARCH_API_KEY=BSAxxxxx

# Spotify API (récupération des artistes)
SPOTIFY_CLIENT_ID=xxxxx
SPOTIFY_CLIENT_SECRET=xxxxx
```

**Note** : Sans ces variables, certaines fonctionnalités ne fonctionneront pas. Le système détectera automatiquement les clés manquantes et utilisera des fallbacks si possible.

## Champs WordPress Automatiquement Remplis

### Custom Post Type : `artist`

Le système crée des posts de type `artist` avec :

**Métadonnées de base** :
- `post_title` : Nom de l'artiste
- `post_content` : Description complète (4 paragraphes)
- `post_status` : published
- `post_type` : artist
- Featured image (image Spotify)

**Champs ACF** :
- `spotify_link` : URL Spotify de l'artiste
- `instagram` / `instagram_link` : Lien Instagram
- `facebook` / `facebook_link` : Lien Facebook
- `twitter` / `twitter_link` : Lien Twitter/X
- `role` : "DJ & Producer" (EN) ou "DJ & Producteur" (FR)

**Yoast SEO** :
- `_yoast_wpseo_metadesc` : Meta description optimisée
- `_yoast_wpseo_title` : Titre SEO

**Taxonomies** :
- `genre` : Genres musicaux Spotify (Hard Techno, Hardstyle, etc.)

**Polylang** :
- Pages EN/FR liées automatiquement
- `pll_translations_link` : ID de traduction

## Endpoints API Disponibles

### Synchronisation

```bash
POST /api/artists/sync
Body: { "limit": 3, "skipSpotifyUpdate": true }
```

**Paramètres** :
- `limit` (optionnel) : Nombre d'artistes à synchroniser (test)
- `skipSpotifyUpdate` (optionnel) : Utiliser le cache Spotify au lieu de refetch

**Réponse** :
```json
{
  "success": true,
  "status": "completed",
  "results": {
    "created": ["Artist 1", "Artist 2"],
    "skipped": [],
    "failed": []
  }
}
```

### Statut

```bash
GET /api/artists/status
```

Retourne le statut de la dernière synchronisation et le nombre d'artistes en attente.

**Réponse** :
```json
{
  "lastSync": {
    "lastRun": "2025-10-30T02:00:00.000Z",
    "status": "completed",
    "results": { "created": 15, "skipped": 0, "failed": 0 }
  },
  "nextScheduledSync": "2025-11-06T02:00:00.000Z",
  "pendingArtists": 5,
  "apiKeyConfigured": true
}
```

### Artistes Manquants

```bash
GET /api/artists/missing
```

Liste tous les artistes Spotify qui n'ont pas encore de page WordPress.

**Réponse** :
```json
{
  "success": true,
  "count": 5,
  "artists": [
    {
      "name": "LNY TNZ",
      "genres": ["hardstyle", "hard techno"],
      "popularity": 65,
      "spotifyUrl": "https://open.spotify.com/artist/..."
    }
  ]
}
```

### Test Brave Search

```bash
GET /api/artists/test-search?artist=LNY%20TNZ
```

Teste la recherche web pour un artiste spécifique.

**Réponse** :
```json
{
  "success": true,
  "artist": "LNY TNZ",
  "braveApiConfigured": true,
  "searchEngine": "Brave Search API",
  "totalResults": 15,
  "breakdown": {
    "biography": 8,
    "labels": 4,
    "performances": 3
  }
}
```

## Qualité des Descriptions

Le système génère des descriptions dans le style de **Jéja** (exemple de référence) :

### Caractéristiques
- **4 paragraphes riches** (~300-400 mots)
- Style narratif et engageant
- Informations spécifiques sur la carrière
- Mention de collaborations et labels
- Contexte dans la scène électronique
- Optimisé pour le SEO

### Exemple de Structure

1. **Introduction** : Présentation de l'artiste, fusion de genres, vision artistique
2. **Carrière** : Projets passés, succès, labels, millions d'écoutes
3. **Collaborations** : Artistes avec qui il a travaillé, évolution artistique
4. **Impact** : Influence sur la scène, performances, philosophie

### Cas Particuliers

- **Gros artistes** : Descriptions très détaillées grâce à l'abondance de données web
- **Artistes émergents** : Descriptions professionnelles mais plus génériques, basées sur les genres Spotify et la popularité
- **Fallback** : Si aucune donnée web n'est trouvée, un template riche est utilisé

## Maintenance et Support

### État Actuel

✅ **Système opérationnel en production**

Le système tourne actuellement sur O2Switch et effectue des synchronisations hebdomadaires automatiques.

### Corrections Futures

Des corrections de bugs éventuelles pourraient arriver dans les prochains jours pour :
- Améliorer la qualité des descriptions
- Optimiser la détection des liens sociaux
- Affiner les recherches web
- Corriger tout comportement inattendu

### Monitoring

Consultez les logs de synchronisation :

```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
tail -f server.log
```

### Nettoyage des Doublons

Un script de nettoyage est disponible pour supprimer les pages dupliquées (gardant uniquement la paire EN/FR la plus ancienne) :

```bash
node cleanup-duplicates.js --dry-run  # Test
node cleanup-duplicates.js            # Suppression réelle
```

## Interprétation des Logs

Les logs sont disponibles dans `server.log`. Voici comment les interpréter :

### Logs de Synchronisation

```
🚀 Manual artist sync triggered via API
🔍 Step 1: Fetching Spotify artists...
✅ Found 189 unique artists from Spotify

🔍 Step 2: Checking WordPress for existing artists...
✅ Found 170 artists in WordPress

📊 Artists to create: 19

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 Artist [1/19]: LNY TNZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🔍 Step 3.0: Checking if artist already exists in WordPress...
  ✅ Artist does not exist yet - proceeding with creation
  🔎 Step 3.1: Performing web research via Brave Search...
     • Biography search: 8 results
     • Labels search: 4 results
     • Performances search: 3 results
  ✅ Found 15 web results for research context

  🤖 Step 3.2: Generating bilingual descriptions with Claude AI...
  ✅ Descriptions generated successfully

  🌐 Step 3.3: Creating WordPress pages (EN + FR)...
  ✅ Artist pages created: EN (ID: 1234), FR (ID: 1235)

Progress: 1/19 artists processed (5.26%)
```

### Signification des Emojis

- 🚀 Démarrage d'une synchronisation
- 🔍 Étape de recherche/vérification
- ✅ Succès d'une opération
- ⚠️ Avertissement (ex: artiste déjà existant, skippé)
- ❌ Erreur
- 🔒 Lock acquis (protection anti-doublons)
- 🔓 Lock libéré
- 🔎 Recherche web en cours
- 🤖 Génération Claude AI
- 🌐 Création WordPress
- 💾 Sauvegarde de données
- 📊 Statistiques/résumé

## Troubleshooting

### Problème : "Sync already in progress"

**Symptôme** : L'API retourne une erreur 409 "Synchronization already in progress"

**Cause** : Une synchronisation est déjà en cours (protection anti-doublons)

**Solution** : Attendre la fin de la sync en cours, ou vérifier les logs pour voir si un processus est bloqué. Si bloqué, redémarrer le serveur :
```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
mkdir -p tmp && touch tmp/restart.txt
```

### Problème : Descriptions génériques pour tous les artistes

**Symptôme** : Toutes les descriptions ressemblent à des templates

**Causes possibles** :
1. Brave Search API ne retourne pas de résultats (quota dépassé ou API down)
2. Les recherches ne trouvent pas d'informations (artistes très obscurs)

**Solutions** :
- Vérifier le quota Brave : https://api.search.brave.com/app/dashboard
- Tester la recherche : `GET /api/artists/test-search?artist=NomArtiste`
- Le système basculera automatiquement sur le template fallback enrichi

### Problème : Images manquantes

**Symptôme** : Les pages d'artistes n'ont pas d'image à la une

**Causes possibles** :
1. L'artiste n'a pas d'image sur Spotify
2. Erreur d'upload vers WordPress

**Solutions** :
- Vérifier les logs pour des erreurs d'upload
- Uploader manuellement l'image dans WordPress (elle ne sera pas écrasée)

### Problème : Liens sociaux manquants

**Symptôme** : Certains artistes n'ont pas leurs liens Instagram/Facebook

**Causes** :
- Le système effectue 3 recherches séparées avec délai de 1.5s (rate limit Brave)
- Si l'artiste a peu de présence web, les liens peuvent ne pas être trouvés

**Solution** : Ajouter manuellement les liens dans les champs ACF WordPress

### Problème : Pages dupliquées

**Symptôme** : Un artiste apparaît 2-4 fois dans WordPress

**Cause** : Bug ancien (corrigé depuis le 30/10/2025)

**Solution** : Utiliser le script de nettoyage :
```bash
node cleanup-duplicates.js --dry-run  # Voir ce qui sera supprimé
node cleanup-duplicates.js            # Supprimer les doublons
```

## Exemples de Pages Créées

### Exemple 1 : Gros Artiste (Jéja)

**URL** : dancingdeadrecords.com/artist/jeja

**Description (extrait)** :
> Artiste polyvalent et visionnaire de la scène électronique, Jéja fusionne les énergies de la Hard Techno et du Hardstyle pour créer des compositions puissantes et émotionnelles. Passionné par les festivals, Jéja donne régulièrement des performances explosives lors d'événements majeurs...

**Caractéristiques** :
- 4 paragraphes riches (~350 mots)
- Informations spécifiques sur la carrière
- Mentions de collaborations et labels
- Liens sociaux complets

### Exemple 2 : Artiste Émergent

**Description (extrait)** :
> Versatile artist and visionary producer in the electronic music scene, [Artist] fuses the energies of Hard Techno and Techno to create powerful and emotional compositions. With a distinctive sound characterized by innovative production techniques...

**Caractéristiques** :
- 4 paragraphes professionnels (~300 mots)
- Style template enrichi mais cohérent
- Focus sur les genres Spotify
- Optimisé SEO

## Limites Connues du Système

### Ce que le système NE FAIT PAS

1. **Mise à jour de pages existantes** : Le système crée uniquement les pages manquantes, ne met jamais à jour
2. **Suppression automatique** : Ne supprime jamais de pages (même si l'artiste disparaît de Spotify)
3. **Gestion des releases/tracks** : Ne crée pas de pages pour les morceaux individuels
4. **Multi-labels** : Si un artiste est sur plusieurs labels, seul Dancing Dead Records est mentionné
5. **Biographies multi-langues avancées** : EN/FR uniquement (pas d'autres langues)
6. **Détection de changement de nom** : Si un artiste change de nom sur Spotify, une nouvelle page sera créée

### Précautions à Prendre

- **Ne pas supprimer manuellement** les artistes WordPress sans raison (ils ne seront pas recréés si encore sur Spotify)
- **Backup WordPress régulier** recommandé avant les grosses syncs
- **Vérifier les doublons** après une sync importante (via cleanup script)
- **Surveiller le quota Brave** si vous faites beaucoup de tests manuels

## Roadmap et Améliorations Futures

### Court Terme (Prochaines Semaines)

- ✅ Descriptions riches style Jéja (FAIT)
- ✅ Protection anti-doublons (FAIT)
- ⏳ Amélioration de la détection des liens sociaux
- ⏳ Optimisation du taux de succès des recherches web
- ⏳ Notifications par email après chaque sync hebdomadaire

### Moyen Terme

- 📋 Dashboard web pour monitorer les syncs
- 📋 Re-génération manuelle de descriptions existantes
- 📋 Support d'autres plateformes (SoundCloud, Beatport)
- 📋 Détection des changements d'image Spotify
- 📋 Cache intelligent pour réduire les coûts Claude AI

### Long Terme

- 📋 Synchronisation des releases/EPs/albums
- 📋 Génération automatique de setlists
- 📋 Intégration avec calendrier d'événements
- 📋 Analytics sur la popularité des artistes

## Test en Local (Pour Développeurs)

### Prérequis

- Node.js 18+
- Accès aux variables d'environnement (.env)
- MAMP ou serveur local avec WordPress

### Installation

```bash
cd "/Applications/MAMP/htdocs/Dancing Dead/dancing-dead-relay-api"
npm install
```

### Lancer le Serveur

```bash
# Développement avec auto-restart
npm run dev

# Production
npm start
```

### Test Rapide

```bash
# Tester avec 1 artiste
curl -X POST "http://localhost:3000/api/artists/sync" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1, "skipSpotifyUpdate": true}'

# Voir les artistes manquants
curl http://localhost:3000/api/artists/missing

# Tester Brave Search
curl "http://localhost:3000/api/artists/test-search?artist=LNY%20TNZ"
```

## Sécurité et Backup

### Protection des Données

- **Variables d'environnement** : Jamais committées sur Git (`.env` dans `.gitignore`)
- **Clés API** : Stockées uniquement sur le serveur de production
- **Logs** : Ne contiennent jamais de clés sensibles

### Backup Recommandé

Avant une grosse synchronisation :

```bash
# Backup WordPress (via plugin)
# UpdraftPlus ou WP Migrate DB Pro recommandé

# Backup de la base d'artistes Spotify
cd dancing-dead-relay-api
cp dancingdeadartists/data.json dancingdeadartists/data.backup.json
```

## Questions Fréquentes

### Est-ce que le système met à jour les pages existantes ?

**Non**. Le système crée uniquement les pages manquantes. Les pages déjà créées ne sont jamais modifiées, ce qui permet l'édition manuelle sans risque d'écrasement.

### Puis-je forcer la re-création d'un artiste ?

Oui, en supprimant manuellement la page WordPress (EN + FR), l'artiste sera recréé lors de la prochaine synchronisation.

### Que se passe-t-il si Brave API est en panne ?

Le système bascule automatiquement sur DuckDuckGo comme moteur de recherche de secours.

### Combien de temps prend une synchronisation complète ?

Environ 2-3 minutes par artiste (recherches web + génération IA + création WordPress). Pour 20 artistes : ~40-60 minutes.

### Les images sont-elles optimisées ?

Oui, les images sont téléchargées depuis Spotify (haute qualité) et uploadées dans la médiathèque WordPress comme images à la une.

### Puis-je lancer plusieurs syncs en parallèle ?

Non, le système bloque automatiquement les syncs concurrentes pour éviter les doublons. Une erreur 409 sera retournée si vous essayez.

## Contact et Support Technique

Pour toute question ou problème technique, contactez l'équipe de développement.

**Dernière mise à jour** : 30 octobre 2025
**Version du système** : 2.0 (avec descriptions riches style Jéja)
