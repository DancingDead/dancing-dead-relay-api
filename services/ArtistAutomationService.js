const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const WordPressMCPService = require('./WordPressMCPService');
const ResearchQueueService = require('./ResearchQueueService');
const WebSearchService = require('./WebSearchService');
const ImageUploadService = require('./ImageUploadService');
const SocialLinksService = require('./SocialLinksService');

class ArtistAutomationService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Service WordPress MCP
    this.wordpress = new WordPressMCPService();

    // Service de queue de recherche (avec Claude Code + WebSearch)
    this.researchQueue = new ResearchQueueService();

    // Service de recherche web (Brave + DuckDuckGo fallback)
    this.webSearch = new WebSearchService();

    // Service d'upload d'images (Spotify → WordPress via endpoint custom)
    this.imageUpload = new ImageUploadService();

    // Service de recherche de liens sociaux (recherches ciblées par plateforme)
    this.socialLinks = new SocialLinksService();

    // Charger le contexte du projet (optionnel)
    try {
      this.projectContext = fs.readFileSync(
        path.join(__dirname, '../claude-context.md'),
        'utf-8'
      );
    } catch (error) {
      this.projectContext = 'Dancing Dead Records - Artist Automation System';
    }

    // Configuration Polylang
    this.polylangConfig = {
      languageTermIds: {
        en: 4,
        fr: 7
      }
    };
  }

  /**
   * Met à jour la liste des artistes depuis Spotify
   * Note: In production, this should be triggered via cron or manually via:
   *       curl -X POST https://api.dancingdeadrecords.com/dancing-dead-relay-api/dancingdeadartists/update
   */
  async updateSpotifyArtistsList() {
    try {
      console.log('  📥 Updating Spotify artists list...');

      // Load and call the update function directly instead of HTTP request
      const dancingDeadArtistsRouter = require('../dancingdeadartists/index.js');

      // Note: The router doesn't export the update function, so we skip the update
      // and rely on the cached data. Updates should be done via the cron job or manual API call.
      console.log('  ⚠️  Skipping Spotify update - using cached data');
      console.log('  💡 To update manually: POST /dancingdeadartists/update');

      return null; // Will use cached data from data.json
    } catch (error) {
      console.error('⚠️  Error updating Spotify artists list:', error.message);
      console.log('  → Continuing with cached data...');
      return null;
    }
  }

  /**
   * Récupère tous les artistes depuis Spotify (via l'API relay locale)
   */
  async getSpotifyArtists() {
    try {
      // Read directly from the data file instead of making HTTP request
      const dataPath = path.join(__dirname, '../dancingdeadartists/data.json');
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(rawData);

      // The file structure is { artistsWithImages: [...], latestReleasesOfPlaylist: [...] }
      return data.artistsWithImages || [];
    } catch (error) {
      console.error('Error fetching Spotify artists:', error);
      throw error;
    }
  }

  /**
   * Récupère les artistes WordPress existants via REST API
   * Déduplique les posts bilingues (EN/FR) pour avoir une liste unique par artiste
   */
  async getWordPressArtists() {
    if (!this.wordpress.isConfigured()) {
      console.log('⚠️  WordPress MCP not configured - returning empty array');
      console.log('   Add WORDPRESS_MCP_ENDPOINT and WORDPRESS_MCP_KEY to .env');
      return [];
    }

    try {
      const allPosts = await this.wordpress.getArtists();
      console.log(`✅ Found ${allPosts.length} artist posts in WordPress (includes EN/FR versions)`);

      // Dédupliquer par nom d'artiste (car chaque artiste a 2 posts: EN + FR)
      const uniqueArtists = [];
      const seenNames = new Set();

      for (const post of allPosts) {
        const normalizedName = this.normalizeArtistName(post.name);
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueArtists.push(post);
        }
      }

      console.log(`   → ${uniqueArtists.length} unique artists (deduplicated)`);
      return uniqueArtists;
    } catch (error) {
      console.error('⚠️  Error fetching WordPress artists:', error.message);
      return [];
    }
  }

  /**
   * Compare les artistes Spotify avec WordPress et retourne les artistes manquants
   */
  async findMissingArtists() {
    const spotifyArtists = await this.getSpotifyArtists();
    const wordpressArtists = await this.getWordPressArtists();

    // Créer un Set des noms d'artistes WordPress (normalisés)
    const wpArtistNames = new Set(
      wordpressArtists.map(artist => this.normalizeArtistName(artist.name))
    );

    // Filtrer les artistes Spotify qui n'existent pas dans WordPress
    const missingArtists = spotifyArtists.filter(artist => {
      const normalizedName = this.normalizeArtistName(artist.name);
      return !wpArtistNames.has(normalizedName);
    });

    console.log(`Found ${missingArtists.length} artists to create in WordPress`);
    return missingArtists;
  }

  /**
   * Normalise le nom d'un artiste pour la comparaison
   */
  normalizeArtistName(name) {
    return name.toLowerCase().trim();
  }

  /**
   * Génère un slug WordPress à partir d'un nom d'artiste
   */
  generateSlug(artistName) {
    return artistName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retire les accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Recherche des informations sur l'artiste
   * 1. Vérifie le cache
   * 2. Fait une recherche web réelle (Brave/DuckDuckGo)
   * 3. Demande à Claude de synthétiser les résultats
   * 4. Sauvegarde dans le cache
   */
  async researchArtist(artist) {
    // PRIORITÉ 1: Vérifier si on a des données de recherche web réelles en cache
    const cachedResearch = this.researchQueue.getArtistResearch(artist.name);

    if (cachedResearch) {
      console.log('      ✅ Using cached web research data');
      return {
        formatted: this.formatWebResearch(cachedResearch),
        social_links: cachedResearch.social_links || {}
      };
    }

    // PRIORITÉ 2: Faire la recherche web MAINTENANT
    console.log('      🌐 Performing live web search...');

    try {
      // Rechercher sur le web (Brave ou DuckDuckGo)
      const webResults = await this.webSearch.searchArtist(artist.name, artist.genres);

      // Demander à Claude de synthétiser les résultats web
      const synthesizedData = await this.synthesizeWebResults(artist, webResults);

      // Sauvegarder dans le cache pour la prochaine fois
      if (synthesizedData) {
        this.researchQueue.saveArtistResearch(artist.name, synthesizedData);
        console.log('      💾 Research saved to cache');
      }

      return {
        formatted: this.formatWebResearch(synthesizedData),
        social_links: synthesizedData?.social_links || {}
      };

    } catch (error) {
      console.error(`      ❌ Web search failed: ${error.message}`);

      // FALLBACK: Utiliser Claude API sans recherche web
      console.log('      📝 Using Claude knowledge fallback (less accurate)');
      const fallbackText = await this.fallbackResearch(artist);
      return {
        formatted: fallbackText,
        social_links: {}
      };
    }
  }

  /**
   * Synthétise les résultats web avec Claude
   */
  async synthesizeWebResults(artist, webResults) {
    const formattedResults = this.webSearch.formatForClaude(webResults);

    const prompt = `${this.projectContext}

---

Based on these web search results about ${artist.name}, extract and structure key information:

${formattedResults}

Spotify Info:
- Genres: ${artist.genres?.join(', ') || 'Unknown'}
- Popularity: ${artist.popularity}/100

Extract the following information as JSON:
{
  "nationality": "...",
  "origin": "city, country",
  "labels": ["label1", "label2"],
  "style": "brief description of musical style",
  "collaborations": ["artist1", "artist2"],
  "achievements": ["achievement1", "achievement2"],
  "festivals": ["festival1", "festival2"],
  "bio": "2-3 sentence biography",
  "social_links": {
    "soundcloud": "full URL to SoundCloud profile or empty string",
    "instagram": "full URL to Instagram profile or empty string",
    "facebook": "full URL to Facebook page or empty string",
    "twitter": "full URL to Twitter/X profile or empty string"
  }
}

IMPORTANT:
- Base your response ONLY on the web search results above
- For social_links, ONLY include URLs that are explicitly found in the search results
- If a social media profile is not found, use an empty string ""
- DO NOT guess or generate social media URLs`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = message.content[0].text;

      // Extraire le JSON de la réponse
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse JSON from Claude response');

    } catch (error) {
      console.error(`      ❌ Failed to synthesize web results: ${error.message}`);
      return null;
    }
  }

  /**
   * Fallback sans recherche web - génère des infos structurées basées sur les genres
   */
  async fallbackResearch(artist) {
    const genres = artist.genres?.join(', ') || 'electronic music';
    const popularity = artist.popularity || 50;

    const prompt = `Based on the genre(s) "${genres}" and Spotify popularity of ${popularity}/100, generate structured information about artist "${artist.name}":

Musical Style: Describe the typical sound characteristics of ${genres} artists
Key Genre Elements: What defines this style (BPM range, instruments, production techniques)
Typical Scene: Where do ${genres} artists typically perform (clubs, festivals, online)
Artist Profile: What kind of artist bio fits this genre and popularity level

Format your response with clear sections. Be specific about the genre characteristics, not generic.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].text;
    } catch (error) {
      console.error(`Error in fallback research:`, error);
      // Fallback structuré basé sur les genres
      return `Musical Style: ${artist.name} is a ${genres} artist.

Key Genre Elements: This style is characterized by heavy bass, intricate sound design, and underground appeal.

Typical Scene: Active in the electronic music underground scene, with presence on digital platforms and streaming services.

Artist Profile: An emerging talent in the ${genres} scene with ${popularity > 50 ? 'growing' : 'underground'} recognition.`;
    }
  }

  /**
   * Formate les données de recherche web pour le prompt de génération
   */
  formatWebResearch(research) {
    let formatted = '';

    if (research.nationality || research.origin) {
      formatted += `Nationality/Origin: ${research.nationality || 'Unknown'}`;
      if (research.origin) formatted += ` (${research.origin})`;
      formatted += '\n';
    }

    if (research.labels && research.labels.length > 0) {
      formatted += `Record Labels: ${research.labels.join(', ')}\n`;
    }

    if (research.style) {
      formatted += `Musical Style: ${research.style}\n`;
    }

    if (research.collaborations && research.collaborations.length > 0) {
      formatted += `Notable Collaborations: ${research.collaborations.slice(0, 5).join(', ')}\n`;
    }

    if (research.festivals && research.festivals.length > 0) {
      formatted += `Festivals/Performances: ${research.festivals.slice(0, 5).join(', ')}\n`;
    }

    if (research.achievements && research.achievements.length > 0) {
      formatted += `Key Achievements:\n`;
      research.achievements.slice(0, 5).forEach(achievement => {
        formatted += `  • ${achievement}\n`;
      });
    }

    if (research.bio) {
      formatted += `\nBiography: ${research.bio}\n`;
    }

    return formatted || 'Limited information available.';
  }

  /**
   * Génère une description bilingue (EN/FR) pour un artiste
   */
  async generateBilingualDescription(artist, researchText) {
    const prompt = `${this.projectContext}

---

Create bilingual artist descriptions (English and French) for WordPress.

Artist: ${artist.name}
Spotify Genres: ${artist.genres?.join(', ') || 'Electronic'}
Popularity: ${artist.popularity}/100

Research findings:
${researchText}

Generate TWO descriptions:

1. ENGLISH description (3-4 paragraphs):
   - Paragraph 1: Introduction with genres in <strong> tags
   - Paragraph 2: Labels, collaborations, notable support
   - Paragraph 3: Live performances, festivals
   - Paragraph 4: Mention connection to Dancing Dead Records
   - Use <br><br> between paragraphs
   - Use <strong> only for genres and labels
   - Energetic, modern tone for electronic music fans

2. FRENCH description (3-4 paragraphs):
   - Same structure as English
   - Natural French translation (not literal)
   - Maintain artistic tone

Return in this exact JSON format:
{
  "en": {
    "description": "HTML description here",
    "meta_description": "~150 char meta description",
    "role": "DJ & Producer" or "Singer & Songwriter"
  },
  "fr": {
    "description": "Description HTML en français",
    "meta_description": "~150 char description meta",
    "role": "DJ & Producteur" or "Chanteur & Auteur-compositeur"
  }
}`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = message.content[0].text;

      // Extraire le JSON de la réponse
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse JSON from Claude response');
    } catch (error) {
      console.error(`Error generating description for ${artist.name}:`, error);

      // Fallback avec description basée sur les genres
      const genres = artist.genres?.join(', ') || 'Electronic';
      const primaryGenres = artist.genres?.slice(0, 2).join(' and ') || 'electronic music';
      const popularity = artist.popularity || 50;
      const recognition = popularity > 60 ? 'growing recognition' : 'underground following';

      return {
        en: {
          description: `Specializing in <strong>${genres}</strong>, ${artist.name} represents the cutting edge of modern electronic music production.<br><br>With a focus on ${primaryGenres}, this artist crafts distinctive sounds characterized by heavy basslines, intricate sound design, and innovative production techniques. Active in the underground scene with a ${recognition} on digital platforms and streaming services.<br><br>As part of the Dancing Dead Records roster, ${artist.name} contributes to the label's commitment to showcasing forward-thinking electronic artists pushing genre boundaries.<br><br>Listen on Spotify`,
          meta_description: `${artist.name} - ${genres} producer and DJ bringing innovative sounds to the electronic music underground scene.`,
          role: 'DJ & Producer'
        },
        fr: {
          description: `Spécialisé dans le <strong>${genres}</strong>, ${artist.name} représente l'avant-garde de la production musicale électronique moderne.<br><br>Avec un focus sur le ${primaryGenres}, cet artiste crée des sons distinctifs caractérisés par des basses lourdes, un sound design complexe et des techniques de production innovantes. Actif dans la scène underground avec une ${recognition === 'growing recognition' ? 'reconnaissance croissante' : 'base de fans underground'} sur les plateformes digitales et services de streaming.<br><br>En tant que membre du roster Dancing Dead Records, ${artist.name} contribue à l'engagement du label à présenter des artistes électroniques avant-gardistes repoussant les frontières des genres.<br><br>Écouter sur Spotify`,
          meta_description: `${artist.name} - Producteur et DJ ${genres} apportant des sons innovants à la scène underground de musique électronique.`,
          role: 'DJ & Producteur'
        }
      };
    }
  }

  /**
   * Trouve l'image de l'artiste dans la bibliothèque WordPress via MCP
   */
  async findArtistImage(artistName) {
    if (!this.wordpress.isConfigured()) {
      return null;
    }

    try {
      return await this.wordpress.findArtistImage(artistName);
    } catch (error) {
      console.log(`   ⚠️  Image search error for ${artistName}:`, error.message);
      return null;
    }
  }

  /**
   * Crée une page WordPress pour un artiste via REST API
   */
  async createArtistPage(artist, content, imageId = null, socialLinks = {}) {
    const slug = this.generateSlug(artist.name);

    if (!this.wordpress.isConfigured()) {
      console.log('⚠️  WordPress REST API not configured - skipping page creation');
      console.log('   Add credentials to .env to enable');
      return {
        success: false,
        message: 'WordPress REST API not configured',
        artist: artist.name,
        slug
      };
    }

    try {
      const result = await this.wordpress.createArtistPages(
        artist,
        {
          slug,
          imageId,
          socialLinks,
          en: content.en,
          fr: content.fr
        }
      );

      return {
        success: result.success,
        message: result.success ? 'Pages created successfully' : result.error,
        artist: artist.name,
        slug,
        urls: result.urls
      };
    } catch (error) {
      console.error(`   ❌ Error creating pages:`, error.message);
      return {
        success: false,
        message: error.message,
        artist: artist.name,
        slug
      };
    }
  }

  /**
   * Synchronise tous les artistes manquants
   * @param {number} maxArtists - Nombre maximum d'artistes à traiter (pour les tests)
   */
  async syncArtists(maxArtists = null, skipSpotifyUpdate = false) {
    console.log('\n🎵 Starting artist synchronization...\n');
    if (maxArtists) {
      console.log(`🧪 TEST MODE: Limiting to ${maxArtists} artists\n`);
    }

    const startTime = Date.now();
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    try {
      // ÉTAPE 1 : Mettre à jour la liste Spotify (optionnel)
      if (!skipSpotifyUpdate) {
        console.log('📋 STEP 1: Updating Spotify artists list\n');
        await this.updateSpotifyArtistsList();
        console.log();
      } else {
        console.log('📋 STEP 1: Using cached Spotify artists list (update skipped)\n');
      }

      // ÉTAPE 2 : Trouver les artistes manquants
      console.log('🔍 STEP 2: Finding missing artists in WordPress\n');
      let missingArtists = await this.findMissingArtists();

      // Limiter le nombre d'artistes si demandé
      if (maxArtists && missingArtists.length > maxArtists) {
        console.log(`   Limiting from ${missingArtists.length} to ${maxArtists} artists for testing\n`);
        missingArtists = missingArtists.slice(0, maxArtists);
      }

      if (missingArtists.length === 0) {
        console.log('✅ No new artists to create. All artists are up to date!');
        return {
          status: 'success',
          message: 'All artists are already in WordPress',
          results
        };
      }

      console.log(`Found ${missingArtists.length} new artists to process\n`);

      // ÉTAPE 3-4 : Traiter chaque artiste un par un
      console.log('🔄 STEP 3-4: Processing artists one by one\n');
      for (let i = 0; i < missingArtists.length; i++) {
        const artist = missingArtists[i];
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📌 Artist [${i + 1}/${missingArtists.length}]: ${artist.name}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        try {
          // PROTECTION ANTI-DOUBLON: Re-vérifier si l'artiste existe déjà
          console.log('  🔍 Step 3.0: Checking if artist already exists in WordPress...');
          const currentWordPressArtists = await this.getWordPressArtists();
          const normalizedArtistName = this.normalizeArtistName(artist.name);
          const artistExists = currentWordPressArtists.some(
            wpArtist => this.normalizeArtistName(wpArtist.name) === normalizedArtistName
          );

          if (artistExists) {
            console.log(`  ⚠️  Artist "${artist.name}" already exists - SKIPPING to prevent duplicate`);
            results.skipped.push(artist.name);
            continue; // Passer au prochain artiste
          }
          console.log(`  ✅ Artist does not exist yet - proceeding with creation`);

          // Recherche d'informations
          console.log('  🔍 Step 3.1: Researching artist information...');
          const research = await this.researchArtist(artist);

          // Recherche des liens sociaux (recherches ciblées par plateforme)
          console.log('  🔗 Step 3.2: Searching for social media links...');
          const socialLinks = await this.socialLinks.findSocialLinks(artist.name);

          // Génération du contenu bilingue
          console.log('  ✍️  Step 3.3: Generating bilingual content (EN/FR)...');
          const content = await this.generateBilingualDescription(artist, research.formatted);

          // Upload de l'image depuis Spotify
          console.log('  🖼️  Step 3.4: Processing artist image from Spotify...');
          let imageId = null;
          try {
            imageId = await this.imageUpload.processArtistImage(artist.image_url, artist.name);
            if (imageId) {
              console.log(`      → Image uploaded with ID: ${imageId}`);
            }
          } catch (imageError) {
            console.log(`      ⚠️  Image upload skipped: ${imageError.message}`);
            console.log(`      → Searching for existing image in WordPress...`);
            imageId = await this.findArtistImage(artist.name);
            if (imageId) {
              console.log(`      → Found existing image ID: ${imageId}`);
            }
          }

          // Création de la page WordPress
          console.log('  📄 Step 3.5: Creating bilingual WordPress pages...');
          const result = await this.createArtistPage(artist, content, imageId, socialLinks);

          if (result.success) {
            results.success.push(artist.name);
            console.log('  ✅ Artist pages created successfully');
            if (result.urls) {
              console.log(`      → EN: ${result.urls.en || 'N/A'}`);
              console.log(`      → FR: ${result.urls.fr || 'N/A'}`);
            }
          } else {
            results.failed.push({ name: artist.name, error: result.message });
            console.log(`  ❌ Failed: ${result.message}`);
          }

          // Pause entre les artistes pour éviter les rate limits
          if (i < missingArtists.length - 1) {
            console.log(`\n  ⏸️  Waiting 2s before next artist...\n`);
            await this.wait(2000);
          }

        } catch (error) {
          console.error(`  ❌ Error processing ${artist.name}:`, error.message);
          results.failed.push({ name: artist.name, error: error.message });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n\n📊 Synchronization completed in ${duration}s`);
      console.log(`   ✅ Success: ${results.success.length}`);
      console.log(`   ❌ Failed: ${results.failed.length}`);
      console.log(`   ⏭️  Skipped: ${results.skipped.length}`);

      return {
        status: 'completed',
        duration,
        results
      };

    } catch (error) {
      console.error('❌ Synchronization error:', error);
      throw error;
    }
  }

  /**
   * Peuple la queue de recherche avec tous les artistes manquants
   * Cette méthode permet de préparer les artistes pour la recherche web
   * sans créer les pages WordPress immédiatement
   */
  async populateResearchQueue() {
    console.log('\n📋 Populating research queue with missing artists...\n');

    try {
      // Mettre à jour la liste Spotify
      console.log('📥 Step 1: Updating Spotify artists list...');
      await this.updateSpotifyArtistsList();
      console.log();

      // Trouver les artistes manquants
      console.log('🔍 Step 2: Finding missing artists...');
      const missingArtists = await this.findMissingArtists();

      if (missingArtists.length === 0) {
        console.log('✅ No missing artists found. All artists are up to date!\n');
        return {
          success: true,
          added: 0,
          total: 0,
          message: 'No missing artists'
        };
      }

      // Ajouter à la queue
      console.log(`\n✍️  Step 3: Adding ${missingArtists.length} artists to research queue...\n`);
      const added = this.researchQueue.addMultipleToQueue(missingArtists);

      console.log(`✅ Successfully added ${added} new artists to research queue`);
      console.log(`📊 Queue stats:`, this.researchQueue.getStats());

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 NEXT STEPS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('1. Run the research worker to process the queue:');
      console.log('   node research-worker.js\n');
      console.log('2. Claude Code will perform web searches for each artist');
      console.log('   (this is FREE - no scraping service needed!)\n');
      console.log('3. Once research is complete, run the sync again:');
      console.log('   curl -X POST http://localhost:3000/api/artists/sync\n');
      console.log('4. Pages will be created with REAL, VERIFIED data!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return {
        success: true,
        added,
        total: missingArtists.length,
        stats: this.researchQueue.getStats()
      };

    } catch (error) {
      console.error('❌ Error populating research queue:', error);
      throw error;
    }
  }

  /**
   * Attend un certain temps (en millisecondes)
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ArtistAutomationService;
