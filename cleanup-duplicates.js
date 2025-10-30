#!/usr/bin/env node

/**
 * Script de nettoyage des artistes dupliqués dans WordPress
 *
 * Ce script:
 * 1. Récupère tous les posts "artist" de WordPress
 * 2. Identifie les doublons (même nom, normalisé)
 * 3. Garde le plus ancien post et supprime les doublons
 *
 * Usage:
 *   node cleanup-duplicates.js --dry-run    (affiche ce qui serait supprimé)
 *   node cleanup-duplicates.js              (supprime réellement)
 */

require('dotenv').config();
const WordPressMCPService = require('./services/WordPressMCPService');

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

class DuplicateCleanupService {
  constructor() {
    this.wordpress = new WordPressMCPService();
  }

  /**
   * Normalise le nom d'un artiste pour la comparaison
   */
  normalizeArtistName(name) {
    return name.toLowerCase().trim();
  }

  /**
   * Trouve tous les doublons
   */
  async findDuplicates() {
    console.log('📥 Fetching all artist posts from WordPress...\n');

    const allPosts = await this.wordpress.getArtists();
    console.log(`✅ Found ${allPosts.length} artist posts total (includes EN/FR versions)\n`);

    // Grouper les posts par nom normalisé
    const postsByName = new Map();

    for (const post of allPosts) {
      const normalizedName = this.normalizeArtistName(post.name);

      if (!postsByName.has(normalizedName)) {
        postsByName.set(normalizedName, []);
      }

      postsByName.get(normalizedName).push(post);
    }

    // Identifier les doublons (groupes avec plus de 2 posts - car chaque artiste devrait avoir EN + FR = 2 posts)
    const duplicates = [];

    for (const [normalizedName, posts] of postsByName.entries()) {
      if (posts.length > 2) {
        duplicates.push({
          name: posts[0].name, // Utiliser le nom original du premier post
          normalizedName,
          posts: posts.sort((a, b) => a.id - b.id) // Trier par ID (plus ancien en premier)
        });
      }
    }

    return duplicates;
  }

  /**
   * Affiche les doublons trouvés
   */
  displayDuplicates(duplicates) {
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! All artists are unique.\n');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} artists with duplicates:\n`);

    let totalToDelete = 0;

    for (const dup of duplicates) {
      const toKeep = dup.posts.slice(0, 2); // Garder les 2 premiers (EN + FR)
      const toDelete = dup.posts.slice(2);  // Supprimer les autres

      console.log(`\n📌 ${dup.name}`);
      console.log(`   Total posts: ${dup.posts.length} (expected: 2)`);
      console.log(`   🟢 Keeping:`);
      for (const post of toKeep) {
        console.log(`      - ID ${post.id} (${post.lang || 'unknown'}) - ${post.slug}`);
      }
      console.log(`   🔴 To delete:`);
      for (const post of toDelete) {
        console.log(`      - ID ${post.id} (${post.lang || 'unknown'}) - ${post.slug}`);
        totalToDelete++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Summary:`);
    console.log(`   - Artists with duplicates: ${duplicates.length}`);
    console.log(`   - Total posts to delete: ${totalToDelete}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  /**
   * Supprime les doublons
   */
  async deleteDuplicates(duplicates, dryRun = false) {
    if (duplicates.length === 0) {
      return { deleted: 0, errors: [] };
    }

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No posts will be deleted\n');
      console.log('Run without --dry-run to actually delete the duplicates.\n');
      return { deleted: 0, errors: [] };
    }

    console.log('🗑️  Starting deletion process...\n');

    const deleted = [];
    const errors = [];

    for (const dup of duplicates) {
      const toDelete = dup.posts.slice(2); // Supprimer tous sauf les 2 premiers

      for (const post of toDelete) {
        try {
          console.log(`   🗑️  Deleting: ${dup.name} (ID: ${post.id}, Lang: ${post.lang || 'unknown'})`);

          await this.wordpress.callTool('wp_delete_post', {
            ID: post.id,
            force_delete: true
          });

          deleted.push({ name: dup.name, id: post.id });
          console.log(`      ✅ Deleted successfully`);

        } catch (error) {
          errors.push({ name: dup.name, id: post.id, error: error.message });
          console.log(`      ❌ Error: ${error.message}`);
        }

        // Pause entre chaque suppression pour éviter de surcharger l'API
        await this.wait(500);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Cleanup Results:`);
    console.log(`   ✅ Successfully deleted: ${deleted.length} posts`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (errors.length > 0) {
      console.log('⚠️  Posts that failed to delete:');
      for (const err of errors) {
        console.log(`   - ${err.name} (ID: ${err.id}): ${err.error}`);
      }
      console.log();
    }

    return { deleted, errors };
  }

  /**
   * Attend un certain temps (en millisecondes)
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exécute le nettoyage complet
   */
  async run(dryRun = false) {
    console.log('\n🧹 Artist Duplicate Cleanup Tool\n');
    console.log(`Mode: ${dryRun ? '🧪 DRY RUN' : '🚨 LIVE (will delete posts)'}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!this.wordpress.isConfigured()) {
      console.error('❌ WordPress MCP not configured!');
      console.error('   Add WORDPRESS_MCP_ENDPOINT and WORDPRESS_MCP_KEY to .env\n');
      process.exit(1);
    }

    try {
      // Trouver les doublons
      const duplicates = await this.findDuplicates();

      // Afficher les doublons
      this.displayDuplicates(duplicates);

      // Supprimer les doublons (ou dry run)
      await this.deleteDuplicates(duplicates, dryRun);

      console.log('✅ Cleanup completed!\n');

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      process.exit(1);
    }
  }
}

// Exécuter le script
const cleanup = new DuplicateCleanupService();
cleanup.run(isDryRun);
