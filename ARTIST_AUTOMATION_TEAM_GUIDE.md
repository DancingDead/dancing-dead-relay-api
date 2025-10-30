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

## Endpoints API Disponibles

### Synchronisation

```bash
POST /api/artists/sync
Body: { "limit": 3, "skipSpotifyUpdate": true }
```

Déclenche la synchronisation des artistes manquants.

### Statut

```bash
GET /api/artists/status
```

Retourne le statut de la dernière synchronisation et le nombre d'artistes en attente.

### Artistes Manquants

```bash
GET /api/artists/missing
```

Liste tous les artistes Spotify qui n'ont pas encore de page WordPress.

### Test Brave Search

```bash
GET /api/artists/test-search?artist=LNY%20TNZ
```

Teste la recherche web pour un artiste spécifique.

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

## Contact et Support Technique

Pour toute question ou problème technique, contactez l'équipe de développement.

**Dernière mise à jour** : 30 octobre 2025
**Version du système** : 2.0 (avec descriptions riches style Jéja)
