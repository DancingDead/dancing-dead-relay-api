# 🚀 Déployer sur o2switch

## Étapes de déploiement

### 1. Connexion SSH à o2switch

```bash
ssh votre-utilisateur@ssh.o2switch.net
```

### 2. Naviguer vers le répertoire du projet

```bash
cd ~/dancing-dead-relay-api
# ou le chemin où se trouve votre projet
```

### 3. Récupérer les dernières modifications

```bash
git pull origin main
```

### 4. Installer les nouvelles dépendances (si nécessaire)

```bash
npm install
```

### 5. Redémarrer l'application

```bash
# Pour Passenger (le plus courant sur o2switch)
mkdir -p tmp && touch tmp/restart.txt

# Vérifier que le redémarrage a fonctionné (attendre 5-10 secondes)
curl -I http://localhost/dancingdeadartists/
```

### 6. Vérifier les logs

```bash
# Vérifier que le système de logs fonctionne
ls -la logs/

# Tester une mise à jour pour générer des logs
curl -X POST http://localhost/dancingdeadartists/update

# Consulter les logs générés
tail -f logs/dancingdeadartists.log
```

## 🔍 Vérification

Une fois déployé, vous pouvez vérifier que tout fonctionne :

### Test de l'endpoint principal
```bash
curl https://votre-domaine.com/dancingdeadartists/
```

### Test de la mise à jour
```bash
curl -X POST https://votre-domaine.com/dancingdeadartists/update
```

### Consulter les logs
```bash
tail -n 50 logs/dancingdeadartists.log
```

## ⚠️ Problèmes courants

### "Permission denied" lors du git pull
```bash
# Vérifier les permissions
ls -la ~/dancing-dead-relay-api

# Si nécessaire, régénérer la clé SSH
ssh-keygen -t ed25519 -C "votre-email@exemple.com"
# Puis ajouter la clé publique sur GitHub
```

### L'application ne redémarre pas
```bash
# Forcer le redémarrage de Passenger
touch tmp/restart.txt && passenger-config restart-app ~/dancing-dead-relay-api

# Si Passenger n'est pas disponible, vérifier le processus
ps aux | grep node
```

### Les logs ne s'écrivent pas
```bash
# Vérifier les permissions du dossier logs
chmod 755 logs
chmod 644 logs/*.log

# Créer le dossier si nécessaire
mkdir -p logs
```

## 📋 Checklist de déploiement

- [ ] Connexion SSH réussie
- [ ] `git pull` effectué sans erreur
- [ ] Application redémarrée (tmp/restart.txt créé)
- [ ] Test GET sur `/dancingdeadartists/` réussi
- [ ] Test POST sur `/dancingdeadartists/update` réussi
- [ ] Logs visibles dans `logs/dancingdeadartists.log`
- [ ] Les logs contiennent les nouveaux messages détaillés

## 🆘 Support

Si vous rencontrez des problèmes :
1. Consultez les logs : `tail -f logs/dancingdeadartists.log`
2. Vérifiez les logs Apache : `tail -f ~/logs/error_log`
3. Vérifiez que Node.js tourne : `ps aux | grep node`
