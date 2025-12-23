const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

/**
 * Service WordPress utilisant MCP (Model Context Protocol)
 * Se connecte au serveur MCP WordPress via SSE
 */
class WordPressMCPService {
  constructor() {
    this.mcpUrl = process.env.WORDPRESS_MCP_ENDPOINT || 'https://www.dancingdeadrecords.com/wp-json/mcp/v1';
    this.apiKey = process.env.WORDPRESS_MCP_KEY || process.env.AIWU_API_KEY;
    this.client = null;
    this.connected = false;
  }

  /**
   * Vérifie que MCP est configuré
   */
  isConfigured() {
    return !!(this.mcpUrl && this.apiKey);
  }

  /**
   * Connecte au serveur MCP WordPress
   */
  async connect() {
    if (this.connected) {
      return;
    }

    if (!this.isConfigured()) {
      throw new Error('WordPress MCP not configured. Set WORDPRESS_MCP_ENDPOINT and WORDPRESS_MCP_KEY in .env');
    }

    try {
      console.log(`   🔌 Connecting to WordPress MCP: ${this.mcpUrl}`);

      // Créer le transport SSE avec le token en query parameter
      const sseUrl = `${this.mcpUrl}/sse?token=${this.apiKey}`;
      const transport = new SSEClientTransport(
        new URL(sseUrl)
      );

      // Créer le client MCP
      this.client = new Client(
        {
          name: 'dancing-dead-artist-automation',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connecter
      await this.client.connect(transport);
      this.connected = true;

      console.log('   ✅ Connected to WordPress MCP');
    } catch (error) {
      console.error('   ❌ MCP connection error:', error.message);
      throw error;
    }
  }

  /**
   * Déconnecte du serveur MCP
   */
  async disconnect() {
    if (this.client && this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  /**
   * Appelle un tool MCP
   */
  async callTool(name, args = {}) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });

      const text = result.content[0]?.text;
      if (!text) {
        return result.content;
      }

      // Try to parse as JSON first
      try {
        return JSON.parse(text);
      } catch (parseError) {
        // If JSON parsing fails, handle plain text responses

        // Extract term ID from responses like "Term 290 created"
        const termMatch = text.match(/Term\s+(\d+)/i);
        if (termMatch) {
          return { id: parseInt(termMatch[1]), term_id: parseInt(termMatch[1]) };
        }

        // Extract post ID from responses like "Post created ID 8031"
        const idMatch = text.match(/ID\s+(\d+)/i);
        if (idMatch) {
          return { id: parseInt(idMatch[1]), ID: parseInt(idMatch[1]) };
        }

        // Return the plain text as-is
        return text;
      }
    } catch (error) {
      console.error(`   ❌ MCP tool call failed (${name}):`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les artistes WordPress existants via REST API
   * (MCP wp_get_posts a une limite de 10 posts et ne supporte pas la pagination)
   */
  async getArtists() {
    try {
      const fetch = require('node-fetch');
      const baseUrl = process.env.WORDPRESS_URL || 'https://dancingdeadrecords.com';

      let allPosts = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      console.log('   📥 Fetching artists from WordPress REST API...');

      while (hasMore) {
        // Use WordPress REST API directly (public endpoint, no auth needed)
        const url = `${baseUrl}/wp-json/wp/v2/artist?per_page=${perPage}&page=${page}&status=publish`;
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`   ⚠️  REST API error: ${response.status} ${response.statusText}`);
          break;
        }

        const posts = await response.json();

        if (!posts || posts.length === 0) {
          hasMore = false;
        } else {
          allPosts = allPosts.concat(posts);

          // Si on a moins de posts que demandé, c'est la dernière page
          if (posts.length < perPage) {
            hasMore = false;
          } else {
            page++;
            // Délai entre les pages pour éviter la surcharge RAM
            await this.wait(5000); // 5s entre chaque page
          }
        }
      }

      console.log(`   ✅ Fetched ${allPosts.length} artists from WordPress`);

      return allPosts.map(post => ({
        id: post.id || post.ID,
        name: post.title?.rendered || post.post_title || post.title,
        slug: post.slug || post.post_name,
        lang: post.lang || 'en'
      }));
    } catch (error) {
      console.error('   ⚠️  Error fetching WordPress artists:', error.message);
      return [];
    }
  }

  /**
   * Attendre (délai pour protéger la RAM)
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Crée les pages artistes bilingues (EN + FR) avec Polylang
   */
  async createArtistPages(artistData, content) {
    console.log(`\n📝 Creating WordPress pages for: ${artistData.name} via MCP`);

    try {
      // 1. Créer la page EN
      console.log('   📄 Creating English page...');
      const postEN = await this.callTool('wp_create_post', {
        post_title: artistData.name,
        post_name: content.slug,
        post_type: 'artist',
        post_status: 'publish',
        meta_input: {
          title: artistData.name,
          role: content.en.role,
          description: content.en.description,
          spotify_link: artistData.external_urls || artistData.spotify_url || '',
          soundcloud_link: content.socialLinks?.soundcloud || '',
          instagram_link: content.socialLinks?.instagram || '',
          instagram: content.socialLinks?.instagram || '', // Try both field names
          tag1: artistData.genres?.[0] || '',
          tag2: artistData.genres?.[1] || '',
          tag3: artistData.genres?.[2] || '',
          _yoast_wpseo_title: '%%title%%',
          _yoast_wpseo_focuskw: artistData.name,
          _yoast_wpseo_metadesc: content.en.meta_description
        }
      });

      const idEN = postEN.ID || postEN.id || postEN;
      console.log(`   ✅ English page created (ID: ${idEN})`);

      // Forcer la mise à jour du slug (WordPress peut ignorer post_name lors de la création)
      console.log(`   🔧 Forcing slug update to: ${content.slug}`);
      await this.callTool('wp_update_post', {
        ID: idEN,
        post_name: content.slug
      });
      console.log(`   ✅ Slug updated`);

      // Délai pour libérer la RAM
      console.log('   ⏸️  RAM cleanup (30s)...');
      await this.wait(30000);

      // 2. Créer la page FR
      console.log('   📄 Creating French page...');
      const postFR = await this.callTool('wp_create_post', {
        post_title: artistData.name,
        post_name: content.slug,
        post_type: 'artist',
        post_status: 'publish',
        meta_input: {
          title: artistData.name,
          role: content.fr.role,
          description: content.fr.description,
          spotify_link: artistData.external_urls || artistData.spotify_url || '',
          soundcloud_link: content.socialLinks?.soundcloud || '',
          instagram_link: content.socialLinks?.instagram || '',
          instagram: content.socialLinks?.instagram || '', // Try both field names
          tag1: artistData.genres?.[0] || '',
          tag2: artistData.genres?.[1] || '',
          tag3: artistData.genres?.[2] || '',
          _yoast_wpseo_title: '%%title%%',
          _yoast_wpseo_focuskw: artistData.name,
          _yoast_wpseo_metadesc: content.fr.meta_description
        }
      });

      const idFR = postFR.ID || postFR.id || postFR;
      console.log(`   ✅ French page created (ID: ${idFR})`);

      // Forcer la mise à jour du slug (WordPress peut ignorer post_name lors de la création)
      console.log(`   🔧 Forcing slug update to: ${content.slug}`);
      await this.callTool('wp_update_post', {
        ID: idFR,
        post_name: content.slug
      });
      console.log(`   ✅ Slug updated`);

      // Délai pour libérer la RAM
      console.log('   ⏸️  RAM cleanup (30s)...');
      await this.wait(30000);

      // 3. Lier avec Polylang (optional - skip if tools not available)
      try {
        console.log('   🌐 Linking pages with Polylang...');

        // Assigner les langues
        await this.callTool('wp_add_post_terms', {
          ID: idEN,
          taxonomy: 'language',
          terms: [4], // EN
          append: false
        });

        await this.wait(10000); // 10s entre chaque opération Polylang

        await this.callTool('wp_add_post_terms', {
          ID: idFR,
          taxonomy: 'language',
          terms: [7], // FR
          append: false
        });

        await this.wait(10000); // 10s entre chaque opération Polylang

        // Créer le terme de traduction
        const termName = `pll_${Date.now().toString(16)}${Math.random().toString(36).substr(2, 9)}`;
        const translationTerm = await this.callTool('wp_create_term', {
          taxonomy: 'post_translations',
          term_name: termName
        });

        const termId = translationTerm.term_id || translationTerm.id || translationTerm;

        await this.wait(10000); // 10s entre chaque opération Polylang

        // Assigner le terme aux deux pages
        await this.callTool('wp_add_post_terms', {
          ID: idEN,
          taxonomy: 'post_translations',
          terms: [termId],
          append: false
        });

        await this.wait(10000); // 10s entre chaque opération Polylang

        await this.callTool('wp_add_post_terms', {
          ID: idFR,
          taxonomy: 'post_translations',
          terms: [termId],
          append: false
        });

        await this.wait(10000); // 10s entre chaque opération Polylang

        // Mettre à jour la description du terme (lien Polylang)
        const description = `a:2:{s:2:"en";i:${idEN};s:2:"fr";i:${idFR};}`;
        await this.callTool('wp_update_term', {
          term_id: termId,
          taxonomy: 'post_translations',
          description: description
        });

        console.log('   ✅ Polylang linking successful');
      } catch (polylangError) {
        console.log('   ⚠️  Polylang linking skipped (required MCP tools not available)');
        console.log('   ℹ️  Pages created successfully but not linked as translations');
      }

      // Délai pour libérer la RAM après Polylang
      console.log('   ⏸️  RAM cleanup (30s)...');
      await this.wait(30000);

      // 4. Assigner l'image et les champs ACF
      if (content.imageId || content.socialLinks) {
        console.log('   🖼️  Updating featured image and ACF fields...');

        // Préparer les champs ACF à mettre à jour
        const acfFields = {};

        if (content.imageId) {
          acfFields.photo = content.imageId;
        }

        if (content.socialLinks) {
          if (content.socialLinks.soundcloud) acfFields.soundcloud_link = content.socialLinks.soundcloud;
          if (content.socialLinks.instagram) {
            // Essayer les deux noms de champs possibles
            acfFields.instagram_link = content.socialLinks.instagram;
            acfFields.instagram = content.socialLinks.instagram;
            console.log(`   🔍 DEBUG: Setting Instagram ACF field to: ${content.socialLinks.instagram}`);
          }
        }

        // Assigner l'image mise en avant si disponible
        if (content.imageId) {
          const imageAssignedEN = await this.setFeaturedImage(idEN, content.imageId);

          await this.wait(10000); // 10s entre les 2 assignations d'image

          const imageAssignedFR = await this.setFeaturedImage(idFR, content.imageId);

          if (imageAssignedEN && imageAssignedFR) {
            console.log('   ✅ Featured image assigned to both pages');
          }
        }

        // Mettre à jour les champs ACF
        if (Object.keys(acfFields).length > 0) {
          console.log(`   🔍 DEBUG: ACF fields to update:`, JSON.stringify(acfFields, null, 2));
          const acfUpdatedEN = await this.updateACFFields(idEN, acfFields);

          await this.wait(10000); // 10s entre les 2 mises à jour ACF

          const acfUpdatedFR = await this.updateACFFields(idFR, acfFields);

          if (acfUpdatedEN && acfUpdatedFR) {
            console.log('   ✅ ACF fields updated on both pages');
          } else {
            console.log('   ⚠️  ACF fields partially updated');
          }
        }
      }

      const baseUrl = process.env.WORDPRESS_URL || 'https://dancingdeadrecords.com';
      console.log(`   ✅ Artist pages created successfully!`);
      console.log(`   🌍 EN: ${baseUrl}/artists/${content.slug}/`);
      console.log(`   🌍 FR: ${baseUrl}/fr/artistes/${content.slug}/`);

      return {
        success: true,
        ids: { en: idEN, fr: idFR },
        urls: {
          en: `${baseUrl}/artists/${content.slug}/`,
          fr: `${baseUrl}/fr/artistes/${content.slug}/`
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

  /**
   * Upload un fichier media sur WordPress
   * @param {Object} params - Paramètres de l'upload
   * @param {string} params.filename - Nom du fichier
   * @param {string} params.content - Contenu du fichier en base64
   * @param {string} params.mimeType - Type MIME du fichier
   * @param {string} params.title - Titre du media
   * @param {string} params.alt_text - Texte alternatif
   * @returns {Object} Informations du media uploadé (avec id)
   */
  async uploadMedia({ filename, content, mimeType, title, alt_text }) {
    try {
      const result = await this.callTool('wp_upload_media', {
        filename,
        content,
        mime_type: mimeType,
        title,
        alt_text
      });

      return result;
    } catch (error) {
      console.error(`   ❌ Media upload error:`, error.message);
      throw error;
    }
  }

  /**
   * Assigner une image mise en avant via endpoint custom
   * @param {number} postId - ID du post
   * @param {number} mediaId - ID du média
   */
  async setFeaturedImage(postId, mediaId) {
    try {
      const fetch = require('node-fetch');
      const baseUrl = process.env.WORDPRESS_URL || 'https://dancingdeadrecords.com';
      const apiKey = process.env.WORDPRESS_MCP_KEY || process.env.AIWU_API_KEY;

      const response = await fetch(`${baseUrl}/wp-json/dd-api/v1/set-featured-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          post_id: postId,
          media_id: mediaId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ⚠️  Featured image assignment failed: ${response.status} ${errorText}`);
        return false;
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.log(`   ⚠️  Featured image assignment error: ${error.message}`);
      return false;
    }
  }

  /**
   * Mettre à jour les champs ACF d'un post
   * @param {number} postId - ID du post
   * @param {Object} fields - Champs ACF à mettre à jour
   */
  async updateACFFields(postId, fields) {
    try {
      const fetch = require('node-fetch');
      const baseUrl = process.env.WORDPRESS_URL || 'https://dancingdeadrecords.com';
      const apiKey = process.env.WORDPRESS_MCP_KEY || process.env.AIWU_API_KEY;

      const response = await fetch(`${baseUrl}/wp-json/dd-api/v1/update-acf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          post_id: postId,
          fields: fields
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ⚠️  ACF update failed: ${response.status} ${errorText}`);
        return false;
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.log(`   ⚠️  ACF update error: ${error.message}`);
      return false;
    }
  }

  /**
   * Recherche d'image dans la bibliothèque
   */
  async searchMedia(artistName) {
    try {
      // Note: wp_search_media may not be available on all MCP servers
      const result = await this.callTool('wp_search_media', {
        search: artistName
      });

      return Array.isArray(result) ? result : (result.media || []);
    } catch (error) {
      // Tool not available or search failed - skip image search
      if (error.message.includes('Unknown tool')) {
        console.log(`   ℹ️  Image search not available (wp_search_media tool not found)`);
      } else {
        console.log(`   ⚠️  Image search error:`, error.message);
      }
      return [];
    }
  }

  /**
   * Trouve l'image de l'artiste
   */
  async findArtistImage(artistName) {
    try {
      const media = await this.searchMedia(artistName);
      if (media && media.length > 0) {
        console.log(`   ✅ Found image for ${artistName}`);
        return media[0].ID || media[0].id;
      }
      console.log(`   ℹ️  No image found for ${artistName}`);
      return null;
    } catch (error) {
      console.log(`   ⚠️  Image search error:`, error.message);
      return null;
    }
  }
}

module.exports = WordPressMCPService;
