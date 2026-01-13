/**
 * Service de gestion du lock de synchronisation
 * Utilise un fichier pour persister le lock entre les redémarrages
 */

const fs = require('fs');
const path = require('path');

class SyncLockService {
  constructor() {
    this.lockDir = path.join(__dirname, '../.locks');
    this.lockFile = path.join(this.lockDir, 'artist-sync.lock');
    this.maxLockAge = 3600000; // 1 heure en millisecondes

    // Créer le dossier .locks s'il n'existe pas
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }
  }

  /**
   * Tente d'acquérir le lock
   * @param {Object} metadata - Métadonnées à stocker (IP, timestamp, etc.)
   * @returns {boolean} true si le lock a été acquis, false sinon
   */
  acquire(metadata = {}) {
    try {
      // Vérifier si un lock existe déjà
      if (fs.existsSync(this.lockFile)) {
        const lockData = this.readLock();

        if (lockData) {
          const lockAge = Date.now() - lockData.timestamp;

          // Si le lock est récent (moins de maxLockAge), refuser
          if (lockAge < this.maxLockAge) {
            console.log(`\n⚠️  Lock already held by ${lockData.ip || 'unknown'}`);
            console.log(`   Acquired at: ${new Date(lockData.timestamp).toISOString()}`);
            console.log(`   Age: ${Math.round(lockAge / 1000)}s (max: ${this.maxLockAge / 1000}s)`);
            return false;
          }

          // Lock trop ancien, considéré comme orphelin
          console.log(`\n⚠️  Found stale lock (${Math.round(lockAge / 1000)}s old), removing...`);
          this.release();
        }
      }

      // Créer le lock
      const lockData = {
        timestamp: Date.now(),
        pid: process.pid,
        ip: metadata.ip || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        requestId: this.generateRequestId()
      };

      fs.writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2));
      console.log(`\n🔒 Lock acquired successfully`);
      console.log(`   Request ID: ${lockData.requestId}`);
      console.log(`   IP: ${lockData.ip}`);
      console.log(`   PID: ${lockData.pid}`);

      return true;

    } catch (error) {
      console.error('❌ Error acquiring lock:', error.message);
      return false;
    }
  }

  /**
   * Libère le lock
   * @returns {boolean} true si le lock a été libéré, false sinon
   */
  release() {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = this.readLock();
        fs.unlinkSync(this.lockFile);
        console.log(`\n🔓 Lock released successfully`);
        if (lockData) {
          const duration = Date.now() - lockData.timestamp;
          console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error releasing lock:', error.message);
      return false;
    }
  }

  /**
   * Vérifie si un lock est actuellement actif
   * @returns {boolean} true si un lock existe et est valide
   */
  isLocked() {
    try {
      if (!fs.existsSync(this.lockFile)) {
        return false;
      }

      const lockData = this.readLock();
      if (!lockData) {
        return false;
      }

      const lockAge = Date.now() - lockData.timestamp;
      return lockAge < this.maxLockAge;

    } catch (error) {
      console.error('❌ Error checking lock:', error.message);
      return false;
    }
  }

  /**
   * Récupère les informations du lock actuel
   * @returns {Object|null} Données du lock ou null
   */
  getLockInfo() {
    if (!this.isLocked()) {
      return null;
    }

    const lockData = this.readLock();
    if (!lockData) {
      return null;
    }

    return {
      ...lockData,
      age: Date.now() - lockData.timestamp,
      maxAge: this.maxLockAge
    };
  }

  /**
   * Lit le contenu du fichier lock
   * @private
   */
  readLock() {
    try {
      const content = fs.readFileSync(this.lockFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('⚠️  Error reading lock file:', error.message);
      // Si le fichier est corrompu, le supprimer
      try {
        fs.unlinkSync(this.lockFile);
      } catch (unlinkError) {
        // Ignorer
      }
      return null;
    }
  }

  /**
   * Génère un ID unique pour la requête
   * @private
   */
  generateRequestId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Force la suppression du lock (utiliser avec précaution)
   */
  forceRelease() {
    console.log('\n⚠️  FORCING lock release...');
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
        console.log('   Lock file deleted');
        return true;
      }
      console.log('   No lock file found');
      return false;
    } catch (error) {
      console.error('❌ Error forcing lock release:', error.message);
      return false;
    }
  }
}

module.exports = SyncLockService;