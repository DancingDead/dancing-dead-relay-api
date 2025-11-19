const WebSearchService = require('./WebSearchService');

/**
 * Service dédié à la recherche et extraction des liens sociaux d'artistes
 */
class SocialLinksService {
  constructor() {
    this.webSearch = new WebSearchService();
  }

  /**
   * Recherche les liens sociaux d'un artiste
   * Fait des recherches ciblées pour chaque réseau social avec délais pour protéger la RAM
   */
  async findSocialLinks(artistName) {
    console.log(`      🔗 Searching for social media links...`);

    const socialLinks = {
      soundcloud: await this.findSoundCloudLink(artistName),
      instagram: '',
      facebook: '',
      twitter: ''
    };

    // Attendre 1 minute entre les recherches pour éviter la surcharge RAM
    console.log(`      ⏸️  RAM cleanup before next social search (60s)...`);
    await this.wait(60000);
    socialLinks.instagram = await this.findInstagramLink(artistName);

    const foundCount = Object.values(socialLinks).filter(link => link !== '').length;
    if (foundCount > 0) {
      console.log(`      ✅ Found ${foundCount} social media link(s)`);
    } else {
      console.log(`      ℹ️  No social media links found`);
    }

    return socialLinks;
  }

  /**
   * Recherche le lien SoundCloud
   */
  async findSoundCloudLink(artistName) {
    try {
      const query = `${artistName} DJ producer soundcloud`;
      const results = await this.webSearch.search(query, 5);

      // Chercher un lien soundcloud.com dans les résultats
      for (const result of results) {
        if (result.url && result.url.includes('soundcloud.com/')) {
          // Valider que c'est bien un profil (pas un track ou playlist isolé)
          if (!result.url.includes('/tracks') && !result.url.includes('/sets')) {
            console.log(`      🎵 SoundCloud: ${result.url}`);
            return result.url;
          }
        }
      }

      return '';
    } catch (error) {
      console.log(`      ⚠️  SoundCloud search failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Recherche le lien Instagram
   */
  async findInstagramLink(artistName) {
    try {
      const query = `${artistName} DJ producer instagram`;
      const results = await this.webSearch.search(query, 5);

      // Chercher un lien instagram.com dans les résultats
      for (const result of results) {
        if (result.url && result.url.includes('instagram.com/')) {
          // Valider que c'est un profil (pas un post individuel)
          const match = result.url.match(/instagram\.com\/([^\/\?]+)/);
          if (match && !result.url.includes('/p/') && !result.url.includes('/reel/')) {
            const cleanUrl = `https://www.instagram.com/${match[1]}/`;
            console.log(`      📸 Instagram: ${cleanUrl}`);
            return cleanUrl;
          }
        }
      }

      return '';
    } catch (error) {
      console.log(`      ⚠️  Instagram search failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Attend un certain temps (en millisecondes)
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SocialLinksService;
