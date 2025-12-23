const fetch = require('node-fetch');

/**
 * Service pour interagir avec WordPress via le plugin AIWU (MCP)
 */
class WordPressAIWUService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL;
    this.apiKey = process.env.AIWU_API_KEY || process.env.WORDPRESS_MCP_KEY;
    this.mcpEndpoint = process.env.WORDPRESS_MCP_ENDPOINT || `${this.baseUrl}/wp-json/mcp/v1`;
  }

  /**
   * Vérifie que AIWU est configuré
   */
  isConfigured() {
    return !!(this.baseUrl && this.apiKey);
  }

  /**
   * Appelle une fonction WordPress via AIWU MCP
   */
  async call(action, params = {}) {
    if (!this.isConfigured()) {
      throw new Error('AIWU not configured. Please set WORDPRESS_URL and AIWU_API_KEY in .env');
    }

    try {
      const response = await fetch(`${this.mcpEndpoint}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          action,
          params
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AIWU API error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`AIWU call failed for action "${action}":`, error.message);
      throw error;
    }
  }

  /**
   * Récupère tous les posts d'un type donné
   */
  async getPosts(postType = 'artist', options = {}) {
    const params = {
      post_type: postType,
      posts_per_page: options.perPage || -1,
      post_status: options.status || 'publish',
      ...options
    };

    const result = await this.call('get_posts', params);
    return result.posts || [];
  }

  /**
   * Récupère les artistes WordPress existants
   */
  async getArtists() {
    try {
      const posts = await this.getPosts('artist');

      return posts.map(post => ({
        id: post.ID,
        name: post.post_title,
        slug: post.post_name,
        lang: post.language || 'en'
      }));
    } catch (error) {
      console.error('Error fetching WordPress artists:', error);
      return [];
    }
  }

  /**
   * Crée un nouveau post
   */
  async createPost(postData) {
    const result = await this.call('create_post', postData);
    return result.post_id || null;
  }

  /**
   * Met à jour les métadonnées d'un post
   */
  async updatePostMeta(postId, metaData) {
    const result = await this.call('update_post_meta', {
      post_id: postId,
      meta: metaData
    });
    return result.success;
  }

  /**
   * Assigne des termes à un post (taxonomies)
   */
  async setPostTerms(postId, taxonomy, terms, append = false) {
    const result = await this.call('set_post_terms', {
      post_id: postId,
      taxonomy,
      terms,
      append
    });
    return result.success;
  }

  /**
   * Crée un nouveau terme dans une taxonomie
   */
  async createTerm(taxonomy, termName, args = {}) {
    const result = await this.call('create_term', {
      taxonomy,
      term_name: termName,
      ...args
    });
    return result.term_id || null;
  }

  /**
   * Met à jour un terme existant
   */
  async updateTerm(termId, taxonomy, args = {}) {
    const result = await this.call('update_term', {
      term_id: termId,
      taxonomy,
      ...args
    });
    return result.success;
  }

  /**
   * Recherche des médias dans la bibliothèque
   */
  async searchMedia(searchTerm) {
    const result = await this.call('search_media', {
      search: searchTerm
    });
    return result.media || [];
  }

  /**
   * Crée une page artiste complète avec Polylang (EN + FR)
   */
  async createArtistPages(artistData, content) {
    console.log(`\n📝 Creating WordPress pages for: ${artistData.name}`);

    try {
      // 1. Créer la page EN
      console.log('   📄 Creating English page...');
      const postEN = await this.createPost({
        post_title: artistData.name,
        post_name: content.slug,
        post_type: 'artist',
        post_status: 'publish',
        meta_input: {
          title: artistData.name,
          role: content.en.role,
          description: content.en.description,
          spotify_link: artistData.external_urls?.spotify || '',
          soundcloud_link: '',
          instagram_link: '',
          tag1: artistData.genres?.[0] || '',
          tag2: artistData.genres?.[1] || '',
          tag3: artistData.genres?.[2] || '',
          _yoast_wpseo_title: '%%title%%',
          _yoast_wpseo_focuskw: artistData.name,
          _yoast_wpseo_metadesc: content.en.meta_description
        }
      });

      if (!postEN) {
        throw new Error('Failed to create English page');
      }

      console.log(`   ✅ English page created (ID: ${postEN})`);

      // Forcer la mise à jour du slug (WordPress peut ignorer post_name lors de la création)
      console.log(`   🔧 Forcing slug update to: ${content.slug}`);
      await this.updatePost(postEN, {
        post_name: content.slug
      });
      console.log(`   ✅ Slug updated`);

      // 2. Créer la page FR
      console.log('   📄 Creating French page...');
      const postFR = await this.createPost({
        post_title: artistData.name,
        post_name: content.slug,
        post_type: 'artist',
        post_status: 'publish',
        meta_input: {
          title: artistData.name,
          role: content.fr.role,
          description: content.fr.description,
          spotify_link: artistData.external_urls?.spotify || '',
          soundcloud_link: '',
          instagram_link: '',
          tag1: artistData.genres?.[0] || '',
          tag2: artistData.genres?.[1] || '',
          tag3: artistData.genres?.[2] || '',
          _yoast_wpseo_title: '%%title%%',
          _yoast_wpseo_focuskw: artistData.name,
          _yoast_wpseo_metadesc: content.fr.meta_description
        }
      });

      if (!postFR) {
        throw new Error('Failed to create French page');
      }

      console.log(`   ✅ French page created (ID: ${postFR})`);

      // Forcer la mise à jour du slug (WordPress peut ignorer post_name lors de la création)
      console.log(`   🔧 Forcing slug update to: ${content.slug}`);
      await this.updatePost(postFR, {
        post_name: content.slug
      });
      console.log(`   ✅ Slug updated`);

      // 3. Assigner les langues (Polylang)
      console.log('   🌐 Linking pages with Polylang...');

      // Assigner EN à la page anglaise
      await this.setPostTerms(postEN, 'language', [4], false); // 4 = EN

      // Assigner FR à la page française
      await this.setPostTerms(postFR, 'language', [7], false); // 7 = FR

      // 4. Créer le terme de traduction Polylang
      const termName = `pll_${Date.now().toString(16)}${Math.random().toString(36).substr(2, 9)}`;
      const translationTermId = await this.createTerm('post_translations', termName);

      if (!translationTermId) {
        console.log('   ⚠️  Warning: Could not create translation term');
      } else {
        // Assigner le terme aux deux pages
        await this.setPostTerms(postEN, 'post_translations', [translationTermId], false);
        await this.setPostTerms(postFR, 'post_translations', [translationTermId], false);

        // Créer la description sérialisée PHP
        const description = `a:2:{s:2:"en";i:${postEN};s:2:"fr";i:${postFR};}`;
        await this.updateTerm(translationTermId, 'post_translations', { description });

        console.log('   ✅ Polylang linking successful');
      }

      // 5. Assigner l'image si disponible
      if (content.imageId) {
        await this.call('set_post_thumbnail', {
          post_id: postEN,
          thumbnail_id: content.imageId
        });
        await this.call('set_post_thumbnail', {
          post_id: postFR,
          thumbnail_id: content.imageId
        });
        console.log('   🖼️  Image assigned');
      }

      console.log(`   ✅ Artist pages created successfully!`);
      console.log(`   🌍 EN: ${this.baseUrl}/artists/${content.slug}/`);
      console.log(`   🌍 FR: ${this.baseUrl}/fr/artistes/${content.slug}/`);

      return {
        success: true,
        ids: { en: postEN, fr: postFR },
        urls: {
          en: `${this.baseUrl}/artists/${content.slug}/`,
          fr: `${this.baseUrl}/fr/artistes/${content.slug}/`
        }
      };

    } catch (error) {
      console.error(`   ❌ Error creating artist pages:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WordPressAIWUService;
