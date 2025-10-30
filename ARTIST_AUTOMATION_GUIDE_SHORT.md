# Automatisation des Artistes - Guide Rapide

## Vue d'ensemble

Système automatisé qui crée les pages d'artistes WordPress depuis Spotify avec descriptions IA et recherche web.

**Status** : ✅ Opérationnel sur O2Switch
**URL** : https://api.dancingdeadrecords.com/dancing-dead-relay-api/
**Synchronisation** : Tous les vendredis à 2h du matin

## Comment ça marche

```
Spotify → Recherche Web (Brave) → Claude AI → WordPress (EN/FR)
```

1. **Récupère** les artistes depuis les playlists Spotify (189 artistes)
2. **Recherche** biographie/labels/performances sur le web
3. **Génère** descriptions bilingues avec Claude AI (4 paragraphes)
4. **Crée** pages WordPress EN + FR avec images, liens sociaux, SEO

## Coûts

| Service | Coût | Usage |
|---------|------|-------|
| **Claude AI** | ~$1-2/mois | Génération de contenu (~$0.024/artiste) |
| **Brave Search** | Gratuit | 2000 recherches/mois (utilise ~240/mois) |
| **Spotify API** | Gratuit | Lecture des playlists |

**Total** : ~$1-2/mois (négligeable)

## Ce qui est créé automatiquement

### Contenu
- ✅ Description 4 paragraphes (EN + FR)
- ✅ Image Spotify (haute qualité)
- ✅ Lien Spotify
- ✅ Genres musicaux
- ✅ Liens sociaux (Instagram, Facebook, Twitter/X)
- ✅ Meta descriptions SEO (Yoast)

### Qualité des Descriptions
- **Gros artistes** : Descriptions riches avec détails de carrière (comme Jéja)
- **Artistes émergents** : Descriptions professionnelles mais plus génériques
- **Style** : Narratif, engageant, optimisé SEO (~300-400 mots)

## Édition Manuelle

**IMPORTANT** : Vous pouvez éditer les pages après création. Le système ne met **jamais à jour** les pages existantes, seulement crée les manquantes.

Tout changement manuel est **conservé définitivement**.

## Endpoints Utiles

### Déclencher une sync manuelle
```bash
curl -X POST "https://api.dancingdeadrecords.com/dancing-dead-relay-api/api/artists/sync" \
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'
```

### Voir les artistes manquants
```bash
curl https://api.dancingdeadrecords.com/dancing-dead-relay-api/api/artists/missing
```

### Statut de la dernière sync
```bash
curl https://api.dancingdeadrecords.com/dancing-dead-relay-api/api/artists/status
```

## Protection Anti-Doublons

Le système bloque les synchronisations concurrentes pour éviter les pages dupliquées.

**Si doublons existants** :
```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
node cleanup-duplicates.js --dry-run  # Voir les doublons
node cleanup-duplicates.js            # Supprimer les doublons
```

## Troubleshooting Rapide

| Problème | Solution |
|----------|----------|
| **"Sync already in progress"** | Attendre la fin ou redémarrer : `touch tmp/restart.txt` |
| **Descriptions trop génériques** | Vérifier quota Brave : https://api.search.brave.com/app/dashboard |
| **Images manquantes** | Uploader manuellement dans WordPress |
| **Liens sociaux manquants** | Ajouter manuellement dans champs ACF |
| **Pages dupliquées** | Utiliser `cleanup-duplicates.js` |

## Logs

```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
tail -f server.log
```

**Emojis importants** :
- 🚀 Sync démarre
- ✅ Succès
- ⚠️ Avertissement
- ❌ Erreur
- 🔒 Lock actif (protection doublons)

## Ce que le système NE FAIT PAS

- ❌ Mettre à jour les pages existantes
- ❌ Supprimer des pages automatiquement
- ❌ Gérer les releases/tracks individuels
- ❌ Autres langues que EN/FR

## Déploiement sur O2Switch

```bash
ssh dancideadwp@api.dancingdeadrecords.com
cd dancing-dead-relay-api
git pull origin main
npm install
mkdir -p tmp && touch tmp/restart.txt
```

## Variables d'Environnement Requises

```bash
WORDPRESS_MCP_ENDPOINT=https://...
WORDPRESS_MCP_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
BRAVE_SEARCH_API_KEY=BSA...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

## FAQ

**Q: Les pages seront-elles écrasées ?**
R: Non, jamais. Seules les pages manquantes sont créées.

**Q: Combien de temps pour 20 artistes ?**
R: ~40-60 minutes (2-3 min/artiste)

**Q: Que faire si un artiste est raté ?**
R: Supprimer la page EN+FR, il sera recréé au prochain vendredi.

**Q: Puis-je forcer une sync maintenant ?**
R: Oui, via l'endpoint `/api/artists/sync`

## Support

Pour questions techniques ou bugs : contactez l'équipe dev.

**Dernière mise à jour** : 30 octobre 2025
**Version** : 2.0 (descriptions riches)
