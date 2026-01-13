# Guide de résolution des doublons de pages artistes

## 📋 Résumé exécutif

Ce guide documente le problème de triplication des pages artistes WordPress et les solutions implémentées pour le résoudre.

**Problème:** Les pages artistes étaient créées 3 fois (3 paires EN+FR au lieu de 1) avec des timestamps quasi-identiques (0-3 secondes).

**Cause:** Race condition + lock non-persistant permettant des exécutions multiples simultanées.

**Solutions implémentées:**
1. ✅ Lock fichier persistant (survit aux redémarrages)
2. ✅ Vérification double: Spotify ID + Nom
3. ✅ Script de nettoyage des doublons existants
4. ✅ Monitoring amélioré avec logs détaillés

---

## 🔍 Diagnostic du problème

### Symptômes observés

**Exemple: AAMAR** - 6 pages créées au lieu de 2:

| ID    | Langue | Timestamp création  |
|-------|--------|-------------------|
| 11193 | EN     | 2026-01-12 14:13:00 |
| 11194 | EN     | 2026-01-12 14:13:03 |
| 11195 | EN     | 2026-01-12 14:13:03 |
| 11196 | FR     | 2026-01-12 14:13:00 |
| 11197 | FR     | 2026-01-12 14:13:03 |
| 11198 | FR     | 2026-01-12 14:13:03 |

### Cause racine

**Race condition en 3 étapes:**

```
T+0.0s → Processus 1 vérifie WordPress → Artiste absent → Démarre création
T+0.1s → Processus 2 vérifie WordPress → Artiste absent (pas encore indexé) → Démarre création
T+0.2s → Processus 3 vérifie WordPress → Artiste absent (pas encore indexé) → Démarre création
```

**Facteurs aggravants:**
- Lock en mémoire perdu au redémarrage (`syncInProgress = false`)
- Délai d'indexation WordPress (pages pas immédiatement visibles dans l'API REST)
- Vérification non-atomique (délai entre check et create)

### Fichiers concernés

| Fichier | Problème |
|---------|----------|
| `api/artists/index.js:16,41-51` | Lock non-persistant |
| `services/ArtistAutomationService.js:809-821` | Race condition lors de la vérification |
| `services/WordPressMCPService.js:240,279` | Création sans contrainte d'unicité |

---

## ✅ Solutions implémentées

### 1. Lock fichier persistant

**Fichier:** `services/SyncLockService.js` (nouveau)

**Fonctionnement:**
- Crée un fichier `.locks/artist-sync.lock` lors de l'acquisition
- Stocke métadonnées (IP, timestamp, PID, requestId)
- Timeout automatique après 1 heure (locks orphelins)
- Survit aux redémarrages Node.js

**Avantages:**
- ✅ Persiste entre redémarrages
- ✅ Fonctionne sans Redis/base de données
- ✅ Détecte et nettoie les locks orphelins

**Utilisation:**
```javascript
const syncLock = new SyncLockService();

// Acquérir le lock
if (syncLock.acquire({ ip: req.ip, userAgent: req.get('user-agent') })) {
  // Faire le travail...

  // Libérer le lock
  syncLock.release();
}
```

---

### 2. Vérification double (Spotify ID + Nom)

**Fichier:** `services/WordPressMCPService.js:607-656` (nouveau)
**Fichier:** `services/ArtistAutomationService.js:808-837` (modifié)

**Fonctionnement:**
1. **Niveau 1:** Vérification par Spotify ID (unique et immuable)
2. **Niveau 2:** Vérification par nom normalisé (fallback)

**Méthode ajoutée:**
```javascript
async findArtistBySpotifyId(spotifyId) {
  // Recherche dans les champs ACF spotify_link
  // Retourne le post existant ou null
}
```

**Avantages:**
- ✅ Spotify ID est 100% unique
- ✅ Évite les faux positifs ("Rhi'N'B" vs "RhiNB")
- ✅ Plus rapide que scan complet des artistes

---

### 3. Script de nettoyage des doublons

**Fichier:** `scripts/cleanup-duplicates.js` (nouveau)

**Fonctionnalités:**
- Détection automatique des doublons par nom normalisé
- Groupement par langue (EN/FR)
- Conserve la page la plus ancienne (ID le plus bas)
- Mode dry-run (rapport sans suppression)
- Mode execute (suppression réelle)

**Usage:**

```bash
# Étape 1: Générer le rapport (sans suppression)
node scripts/cleanup-duplicates.js --dry-run

# Étape 2: Vérifier le rapport

# Étape 3: Exécuter le nettoyage
node scripts/cleanup-duplicates.js --execute
```

**Exemple de sortie:**
```
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
```

---

### 4. Monitoring amélioré

**Fichiers modifiés:**
- `api/artists/index.js` (endpoints status & force-unlock ajoutés)

**Nouveaux endpoints:**

#### GET /api/artists/status
Retourne le statut détaillé de la synchronisation:
```json
{
  "lastSync": {
    "lastRun": "2026-01-13T10:30:00.000Z",
    "status": "completed",
    "results": { "success": 5, "failed": 0, "skipped": 2 }
  },
  "syncLock": {
    "active": true,
    "acquiredAt": "2026-01-13T10:25:00.000Z",
    "age": "300s",
    "maxAge": "3600s",
    "ip": "192.168.1.100",
    "requestId": "sync_1736767500_abc123"
  },
  "pendingArtists": 12
}
```

#### POST /api/artists/force-unlock
Force la libération d'un lock orphelin:
```bash
curl -X POST http://localhost:3000/api/artists/force-unlock
```

---

## 📖 Procédure de nettoyage

### Étape 1: Identifier les doublons

```bash
# Lancer le script en mode dry-run
node scripts/cleanup-duplicates.js --dry-run
```

Vérifier le rapport généré:
- Nombre d'artistes en double
- IDs à conserver vs supprimer
- Total de pages à nettoyer

### Étape 2: Backup (recommandé)

Avant toute suppression, faire un backup WordPress:
```bash
# Via cPanel ou plugin WordPress
# Ou via WP-CLI:
wp db export backup-$(date +%Y%m%d).sql
```

### Étape 3: Exécuter le nettoyage

```bash
# Exécution réelle
node scripts/cleanup-duplicates.js --execute
```

### Étape 4: Vérification post-nettoyage

```bash
# Re-lancer en dry-run pour confirmer qu'il n'y a plus de doublons
node scripts/cleanup-duplicates.js --dry-run
```

Résultat attendu:
```
✅ No duplicates found! All artists are unique.
```

---

## 🚀 Utilisation des nouvelles protections

### Démarrage normal

Les protections sont activées automatiquement:
1. Lock fichier s'active lors de `POST /api/artists/sync`
2. Vérification double (Spotify ID + Nom) avant chaque création
3. Logs détaillés dans la console

### Monitoring

```bash
# Vérifier le statut actuel
curl http://localhost:3000/api/artists/status

# Vérifier si un lock est actif
curl http://localhost:3000/api/artists/status | jq '.syncLock'
```

### En cas de lock bloqué

Si un sync plante et laisse un lock orphelin:

```bash
# Option 1: Attendre le timeout (1 heure)

# Option 2: Forcer la libération
curl -X POST http://localhost:3000/api/artists/force-unlock
```

---

## 🧪 Tests

### Test 1: Lock fichier persistant

```bash
# Terminal 1: Lancer un sync
curl -X POST http://localhost:3000/api/artists/sync -H "Content-Type: application/json" -d '{"limit": 1}'

# Terminal 2: Pendant que le sync est en cours, tenter un second sync
curl -X POST http://localhost:3000/api/artists/sync
```

**Résultat attendu:** Le second sync doit être bloqué avec un HTTP 409 Conflict.

### Test 2: Vérification Spotify ID

```bash
# Créer un artiste
# Tenter de le re-créer avec le même Spotify ID
# → Doit être skippé avec message "already exists (Spotify ID: xxx)"
```

### Test 3: Script de nettoyage

```bash
# Créer manuellement 3 pages pour le même artiste
# Lancer le script en dry-run
node scripts/cleanup-duplicates.js --dry-run

# Vérifier que le rapport identifie correctement les 3 pages
# et propose de conserver la plus ancienne
```

---

## 📊 Métriques & Monitoring

### Logs à surveiller

**Lock acquisition:**
```
🔒 Lock acquired successfully
   Request ID: sync_1736767500_abc123
   IP: 192.168.1.100
   PID: 12345
```

**Lock conflict:**
```
⚠️  Lock already held by 192.168.1.100
   Acquired at: 2026-01-13T10:25:00.000Z
   Age: 120s (max: 3600s)
```

**Duplicate skip:**
```
⚠️  Artist "AAMAR" already exists (Spotify ID: 5K4W6rqBFWDnAN6FQUkS6x)
    Existing post ID: 11193 (en)
```

### Dashboard (futur)

Endpoints disponibles pour créer un dashboard:
- `GET /api/artists/status` - Statut général
- `GET /api/artists/missing` - Artistes manquants
- `GET /api/artists/research-status` - Queue de recherche

---

## ⚠️ Avertissements

### Lock fichier

- **Timeout:** 1 heure par défaut (configurable dans `SyncLockService.js:7`)
- **Emplacement:** `.locks/artist-sync.lock` (ne pas commiter dans git)
- **Permissions:** Le dossier `.locks/` doit être writable

### Nettoyage des doublons

- **Irréversible:** La suppression est définitive (force_delete: true)
- **Backup obligatoire:** Toujours faire un backup WordPress avant
- **Polylang:** Les termes `post_translations` orphelins nécessitent un nettoyage manuel

### Production

- **Multi-instance:** Si l'app tourne sur plusieurs serveurs (load balancing), utiliser Redis au lieu du lock fichier
- **Cron jobs:** S'assurer qu'un seul cron n'est actif (désactiver sur les serveurs secondaires)

---

## 🔧 Maintenance

### Nettoyage des fichiers lock orphelins

```bash
# Supprimer manuellement les locks de plus de 24h
find .locks -name "*.lock" -mtime +1 -delete
```

### Logs de diagnostic

Activer les logs détaillés:
```bash
# Ajouter dans .env
DEBUG=artist:*
```

### Audit des créations

```sql
-- Identifier les artistes créés en même temps
SELECT post_title, COUNT(*) as count,
       MIN(post_date) as first_created,
       MAX(post_date) as last_created
FROM wp_posts
WHERE post_type = 'artist'
  AND post_status = 'publish'
GROUP BY post_title
HAVING COUNT(*) > 2
ORDER BY count DESC;
```

---

## 📚 Références

### Fichiers créés/modifiés

**Nouveaux fichiers:**
- `services/SyncLockService.js` - Service de lock fichier
- `scripts/cleanup-duplicates.js` - Script de nettoyage
- `docs/DUPLICATE-FIX-GUIDE.md` - Cette documentation

**Fichiers modifiés:**
- `api/artists/index.js` - Lock fichier + monitoring
- `services/ArtistAutomationService.js` - Vérification double
- `services/WordPressMCPService.js` - Recherche par Spotify ID
- `.gitignore` - Exclusion du dossier `.locks/`

### Architecture

```
┌─────────────────────────────────────────────────────┐
│           POST /api/artists/sync                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  SyncLockService.acquire()                          │
│  ├─ Check: Fichier .locks/artist-sync.lock existe?  │
│  ├─ Check: Age < 1h?                                │
│  └─ Create: Lock file avec metadata                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  ArtistAutomationService.syncArtists()              │
│  Pour chaque artiste:                                │
│  ├─ NIVEAU 1: findArtistBySpotifyId(artist.id)      │
│  ├─ NIVEAU 2: findArtistByName(artist.name)         │
│  └─ Si absent: Créer pages EN + FR                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  WordPressMCPService.createArtistPages()            │
│  ├─ wp_create_post (EN)                             │
│  ├─ wp_create_post (FR)                             │
│  ├─ wp_create_term (post_translations)              │
│  └─ wp_add_post_terms (liaison Polylang)            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  SyncLockService.release()                          │
│  └─ Delete: .locks/artist-sync.lock                 │
└─────────────────────────────────────────────────────┘
```

---

## 🆘 Support

### Problèmes connus

**Q: Le lock reste bloqué après un crash**
R: Utiliser `POST /api/artists/force-unlock` ou attendre 1h (timeout auto)

**Q: Le script de nettoyage ne trouve pas de doublons**
R: Vérifier que les noms sont bien identiques (ignorer les accents/apostrophes)

**Q: La vérification Spotify ID ne fonctionne pas**
R: S'assurer que le champ ACF `spotify_link` existe et est rempli

### Contact

Pour toute question sur cette implémentation:
- Consulter les logs: `tail -f *.log`
- Vérifier le statut: `GET /api/artists/status`
- Relancer les tests (section Tests ci-dessus)

---

**Date de création:** 2026-01-13
**Version:** 1.0.0
**Auteur:** Claude Code (Anthropic)
