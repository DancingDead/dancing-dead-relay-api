const fetch = require('node-fetch');

/**
 * Service pour interagir avec WordPress via l'API REST native
 */
class WordPressRESTService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL;
    this.username = process.env.WORDPRESS_USERNAME;
    this.password = process.env.WORDPRESS_PASSWORD;
    this.apiUrl = `${this.baseUrl}/wp-json/wp/v2`;

    // Créer le token Basic Auth
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  /**
   * Vérifie que WordPress REST API est configuré
   */
  isConfigured() {
    return !!(this.baseUrl && this.username && this.password);
  }

  /**
   * Appelle l'API WordPress
   */
  async call(endpoint, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('WordPress REST API not configured. Please set WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_PASSWORD in .env');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}/${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.authHeader,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WordPress API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`WordPress API call failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère tous les posts d'un type donné
   */
  async getPosts(postType = 'artist', options = {}) {
    const params = new URLSearchParams({
      per_page: options.perPage || 100,
      status: options.status || 'publish',
      ...options.params
    });

    const posts = await this.call(`${postType}?${params}`);
    return posts;
  }

  /**
   * Récupère les artistes WordPress existants
   */
  async getArtists() {
    try {
      const posts = await this.getPosts('artist', { perPage: 100 });

      return posts.map(post => ({
        id: post.id,
        name: post.title?.rendered || post.title,
        slug: post.slug,
        lang: post.lang || 'en'
      }));
    } catch (error) {
      console.error('Error fetching WordPress artists:', error.message);
      return [];
    }
  }

  /**
   * Crée un nouveau post
   */
  async createPost(postData) {
    const data = await this.call(postData.post_type || 'artist', {
      method: 'POST',
      body: JSON.stringify({
        title: postData.post_title || postData.title,
        slug: postData.post_name || postData.slug,
        status: postData.post_status || 'publish',
        meta: postData.meta_input || postData.meta || {}
      })
    });

    return data.id;
  }

  /**
   * Met à jour les métadonnées d'un post
   */
  async updatePostMeta(postId, postType, metaData) {
    const data = await this.call(`${postType}/${postId}`, {
      method: 'POST',
      body: JSON.stringify({
        meta: metaData
      })
    });

    return data.id;
  }

  /**
   * Crée une page artiste complète (version simplifiée)
   */
  async createArtistPages(artistData, content) {
    console.log(`\n📝 Creating WordPress pages for: ${artistData.name}`);

    try {
      // Note: Cette version simplifiée crée juste la page EN
      // Pour créer les 2 pages (EN + FR) avec Polylang, il faudrait des endpoints spécifiques

      console.log('   📄 Creating page...');

      const postId = await this.createPost({
        post_type: 'artist',
        title: artistData.name,
        slug: content.slug,
        status: 'publish',
        meta: {
          title: artistData.name,
          role: content.en.role,
          description: content.en.description,
          spotify_link: artistData.external_urls?.spotify || '',
          tag1: artistData.genres?.[0] || '',
          tag2: artistData.genres?.[1] || '',
          tag3: artistData.genres?.[2] || '',
          _yoast_wpseo_title: '%%title%%',
          _yoast_wpseo_focuskw: artistData.name,
          _yoast_wpseo_metadesc: content.en.meta_description
        }
      });

      console.log(`   ✅ Page created (ID: ${postId})`);
      console.log(`   🌍 URL: ${this.baseUrl}/artists/${content.slug}/`);

      return {
        success: true,
        ids: { en: postId },
        urls: {
          en: `${this.baseUrl}/artists/${content.slug}/`
        }
      };

    } catch (error) {
      console.error(`   ❌ Error creating artist page:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WordPressRESTService;
