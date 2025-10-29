const fetch = require('node-fetch');

/**
 * Service de téléchargement et upload d'images d'artistes
 * - Upload directement depuis URL Spotify vers WordPress via endpoint custom
 */
class ImageUploadService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL || 'https://dancingdeadrecords.com';
    this.apiKey = process.env.WORDPRESS_MCP_KEY || process.env.AIWU_API_KEY;
  }

  /**
   * Upload une image sur WordPress via endpoint custom depuis une URL
   * @returns {number} Media ID
   */
  async uploadToWordPress(spotifyImageUrl, artistName) {
    try {
      console.log(`      📤 Uploading to WordPress via custom endpoint...`);

      // Upload via endpoint custom WordPress
      const response = await fetch(`${this.baseUrl}/wp-json/dd-api/v1/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          url: spotifyImageUrl,
          title: artistName,
          alt_text: artistName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WordPress API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result && result.success && result.id) {
        console.log(`      ✅ Image uploaded: ID ${result.id}`);
        return result.id;
      }

      throw new Error('No media ID returned from WordPress');

    } catch (error) {
      console.error(`   ❌ WordPress upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process complet: upload directement depuis URL Spotify
   * @param {string} spotifyImageUrl - URL de l'image Spotify
   * @param {string} artistName - Nom de l'artiste
   * @returns {number|null} Media ID ou null si échec
   */
  async processArtistImage(spotifyImageUrl, artistName) {
    if (!spotifyImageUrl) {
      console.log(`      ℹ️  No Spotify image URL for ${artistName}`);
      return null;
    }

    try {
      console.log(`      🖼️  Processing artist image from Spotify...`);

      // Upload directement via MCP
      const mediaId = await this.uploadToWordPress(spotifyImageUrl, artistName);

      return mediaId;

    } catch (error) {
      console.error(`      ❌ Image processing failed for ${artistName}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ImageUploadService;
