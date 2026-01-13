# Fix des doublons de pages artistes - Guide rapide

## 🚀 Quick Start

### 1. Nettoyer les doublons existants

```bash
# Rapport sans suppression (recommandé en premier)
node scripts/cleanup-duplicates.js --dry-run

# Suppression réelle (après vérification du rapport)
node scripts/cleanup-duplicates.js --execute
```

### 2. Vérifier que tout fonctionne

```bash
# Vérifier le statut de la sync
curl http://localhost:3000/api/artists/status | jq

# Tester la protection anti-doublon (doit retourner HTTP 409)
curl -X POST http://localhost:3000/api/artists/sync &
curl -X POST http://localhost:3000/api/artists/sync
```

### 3. En cas de lock bloqué

```bash
# Forcer la libération du lock
curl -X POST http://localhost:3000/api/artists/force-unlock
```

---

## 🛡️ Protections implémentées

### ✅ 1. Lock fichier persistant
- **Fichier:** `services/SyncLockService.js`
- **Fonction:** Empêche les synchronisations simultanées
- **Timeout:** 1 heure (auto-cleanup)
- **Stockage:** `.locks/artist-sync.lock`

### ✅ 2. Vérification double
- **Niveau 1:** Par Spotify ID (unique et fiable)
- **Niveau 2:** Par nom normalisé (fallback)
- **Fichiers:** `WordPressMCPService.js` + `ArtistAutomationService.js`

### ✅ 3. Script de nettoyage
- **Fichier:** `scripts/cleanup-duplicates.js`
- **Modes:** --dry-run (rapport) | --execute (suppression)
- **Critère:** Conserve la page la plus ancienne (ID le plus bas)

### ✅ 4. Monitoring amélioré
- **Endpoint:** `GET /api/artists/status` (avec info lock)
- **Endpoint:** `POST /api/artists/force-unlock` (déblocage d'urgence)
- **Logs:** Timestamps + IP + Request ID

---

## 📝 Commandes utiles

```bash
# NETTOYAGE
node scripts/cleanup-duplicates.js --dry-run   # Rapport sans suppression
node scripts/cleanup-duplicates.js --execute   # Suppression réelle

# MONITORING
curl http://localhost:3000/api/artists/status                    # Statut général
curl http://localhost:3000/api/artists/status | jq '.syncLock'  # État du lock
curl http://localhost:3000/api/artists/missing                   # Artistes manquants

# DÉBLOCAGE
curl -X POST http://localhost:3000/api/artists/force-unlock      # Forcer unlock

# SYNC
curl -X POST http://localhost:3000/api/artists/sync \            # Sync normale
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'

curl -X POST http://localhost:3000/api/artists/sync \            # Sync limitée (test)
  -H "Content-Type: application/json" \
  -d '{"limit": 1, "skipSpotifyUpdate": true}'
```

---

## 📊 Exemple de sortie du script de nettoyage

```
╔════════════════════════════════════════════════════╗
║   WORDPRESS ARTIST DUPLICATE CLEANUP SCRIPT        ║
╚════════════════════════════════════════════════════╝

Mode: 🔒 DRY RUN (no changes)

🔍 Scanning WordPress for duplicate artist pages...
✅ Fetched 243 artist posts from WordPress

📊 DUPLICATE DETECTION REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Found 2 artists with duplicate pages:

🎵 Artist: AAMAR (aamar)
   ─────────────────────────────────────
   Language: EN - 3 pages found
   ✅ KEEP:   ID 11193 (oldest)
   ❌ DELETE: ID 11194
   ❌ DELETE: ID 11195

   Language: FR - 3 pages found
   ✅ KEEP:   ID 11196 (oldest)
   ❌ DELETE: ID 11197
   ❌ DELETE: ID 11198

📈 SUMMARY:
   Artists with duplicates: 2
   Total pages to delete: 8

💡 NEXT STEPS:
   1. Review the report above
   2. Run with --execute to delete duplicates:
      node scripts/cleanup-duplicates.js --execute
```

---

## ⚠️ Avant de nettoyer

1. **Backup WordPress** (base de données + fichiers)
2. **Vérifier le rapport** du dry-run
3. **Confirmer les IDs** à supprimer
4. **Exécuter en production** uniquement après tests

---

## 🔧 Fichiers modifiés/créés

### Nouveaux fichiers
- ✅ `services/SyncLockService.js` - Gestion du lock fichier
- ✅ `scripts/cleanup-duplicates.js` - Nettoyage des doublons
- ✅ `docs/DUPLICATE-FIX-GUIDE.md` - Documentation complète
- ✅ `README-DUPLICATE-FIX.md` - Ce fichier (guide rapide)

### Fichiers modifiés
- ✅ `api/artists/index.js` - Lock fichier + endpoints monitoring
- ✅ `services/ArtistAutomationService.js` - Vérification double (Spotify ID + Nom)
- ✅ `services/WordPressMCPService.js` - Recherche par Spotify ID
- ✅ `.gitignore` - Exclusion de `.locks/`

---

## 📚 Documentation complète

Pour plus de détails (diagnostic, architecture, tests, maintenance):
👉 **[docs/DUPLICATE-FIX-GUIDE.md](docs/DUPLICATE-FIX-GUIDE.md)**

---

**Date:** 2026-01-13
**Version:** 1.0.0
**Status:** ✅ Production Ready
