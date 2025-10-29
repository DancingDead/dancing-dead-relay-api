const fs = require('fs');
const path = require('path');

/**
 * Service de gestion de la queue de recherche d'artistes
 * Permet à Claude Code de traiter les recherches web en arrière-plan
 */
class ResearchQueueService {
  constructor() {
    this.queuePath = path.join(__dirname, '../data/research-queue.json');
    this.resultsPath = path.join(__dirname, '../data/research-results.json');
    this.dataDir = path.join(__dirname, '../data');

    // Créer le dossier data s'il n'existe pas
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialiser les fichiers s'ils n'existent pas
    if (!fs.existsSync(this.queuePath)) {
      this.saveQueue([]);
    }
    if (!fs.existsSync(this.resultsPath)) {
      this.saveResults({});
    }
  }

  /**
   * Charge la queue depuis le fichier
   */
  loadQueue() {
    try {
      const data = fs.readFileSync(this.queuePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading queue:', error);
      return [];
    }
  }

  /**
   * Sauvegarde la queue dans le fichier
   */
  saveQueue(queue) {
    try {
      fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  /**
   * Charge les résultats depuis le fichier
   */
  loadResults() {
    try {
      const data = fs.readFileSync(this.resultsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading results:', error);
      return {};
    }
  }

  /**
   * Sauvegarde les résultats dans le fichier
   */
  saveResults(results) {
    try {
      fs.writeFileSync(this.resultsPath, JSON.stringify(results, null, 2));
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }

  /**
   * Ajoute un artiste à la queue de recherche
   */
  addToQueue(artist) {
    const queue = this.loadQueue();

    // Vérifier si l'artiste est déjà dans la queue
    const exists = queue.some(item =>
      item.name.toLowerCase() === artist.name.toLowerCase()
    );

    if (!exists) {
      queue.push({
        name: artist.name,
        spotifyId: artist.id,
        genres: artist.genres || [],
        popularity: artist.popularity || 0,
        spotifyUrl: artist.external_urls,
        addedAt: new Date().toISOString(),
        status: 'pending' // pending, processing, completed, failed
      });
      this.saveQueue(queue);
      return true;
    }

    return false;
  }

  /**
   * Ajoute plusieurs artistes à la queue
   */
  addMultipleToQueue(artists) {
    let added = 0;
    for (const artist of artists) {
      if (this.addToQueue(artist)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Récupère les artistes en attente de recherche
   */
  getPendingArtists() {
    const queue = this.loadQueue();
    return queue.filter(item => item.status === 'pending');
  }

  /**
   * Marque un artiste comme "en cours de traitement"
   */
  markAsProcessing(artistName) {
    const queue = this.loadQueue();
    const artist = queue.find(item =>
      item.name.toLowerCase() === artistName.toLowerCase()
    );

    if (artist) {
      artist.status = 'processing';
      artist.processingAt = new Date().toISOString();
      this.saveQueue(queue);
    }
  }

  /**
   * Sauvegarde le résultat de recherche pour un artiste
   */
  saveArtistResearch(artistName, researchData) {
    const results = this.loadResults();
    const queue = this.loadQueue();

    // Normaliser le nom de l'artiste
    const normalizedName = artistName.toLowerCase().trim();

    // Sauvegarder le résultat
    results[normalizedName] = {
      ...researchData,
      updatedAt: new Date().toISOString()
    };
    this.saveResults(results);

    // Marquer comme complété dans la queue
    const artist = queue.find(item =>
      item.name.toLowerCase() === normalizedName
    );

    if (artist) {
      artist.status = 'completed';
      artist.completedAt = new Date().toISOString();
      this.saveQueue(queue);
    }

    return true;
  }

  /**
   * Marque un artiste comme échoué
   */
  markAsFailed(artistName, error) {
    const queue = this.loadQueue();
    const artist = queue.find(item =>
      item.name.toLowerCase() === artistName.toLowerCase()
    );

    if (artist) {
      artist.status = 'failed';
      artist.error = error;
      artist.failedAt = new Date().toISOString();
      this.saveQueue(queue);
    }
  }

  /**
   * Récupère les résultats de recherche pour un artiste
   */
  getArtistResearch(artistName) {
    const results = this.loadResults();
    const normalizedName = artistName.toLowerCase().trim();
    return results[normalizedName] || null;
  }

  /**
   * Vérifie si un artiste a déjà été recherché
   */
  hasResearch(artistName) {
    const results = this.loadResults();
    const normalizedName = artistName.toLowerCase().trim();
    return normalizedName in results;
  }

  /**
   * Nettoie les artistes complétés de la queue
   */
  cleanupCompletedArtists() {
    const queue = this.loadQueue();
    const filtered = queue.filter(item => item.status !== 'completed');
    this.saveQueue(filtered);
    return queue.length - filtered.length;
  }

  /**
   * Statistiques de la queue
   */
  getStats() {
    const queue = this.loadQueue();
    const results = this.loadResults();

    return {
      total: queue.length,
      pending: queue.filter(item => item.status === 'pending').length,
      processing: queue.filter(item => item.status === 'processing').length,
      completed: queue.filter(item => item.status === 'completed').length,
      failed: queue.filter(item => item.status === 'failed').length,
      totalResearched: Object.keys(results).length
    };
  }
}

module.exports = ResearchQueueService;