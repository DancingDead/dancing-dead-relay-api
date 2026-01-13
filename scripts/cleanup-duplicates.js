/**
 * Script de nettoyage des doublons de pages artistes
 *
 * Ce script détecte et supprime les pages artistes en double dans WordPress.
 * Il conserve la page la plus ancienne et supprime les doublons récents.
 *
 * USAGE:
 *   node scripts/cleanup-duplicates.js --dry-run    # Rapport sans suppression
 *   node scripts/cleanup-duplicates.js --execute    # Suppression réelle
 */

require('dotenv').config();
const WordPressMCPService = require('../services/WordPressMCPService');
const { wordpressSlugify } = require('../utils/wordpressSlugify');

class DuplicateCleanupService {
  constructor() {
    this.wordpress = new WordPressMCPService();
    this.dryRun = true;
  }

  /**
   * Normalise le nom d'un artiste pour la comparaison
   */
  normalizeArtistName(name) {
    return wordpressSlugify(name);
  }

  /**
   * Détecte tous les doublons de pages artistes
   * Retourne un objet avec les artistes en double groupés par nom normalisé
   */
  async detectDuplicates() {
    console.log('\n🔍 Scanning WordPress for duplicate artist pages...\n');

    try {
      // Récupérer tous les artistes (EN + FR)
      const allPosts = await this.wordpress.getArtists();
      console.log(`✅ Fetched ${allPosts.length} artist posts from WordPress\n`);

      // Grouper par nom normalisé
      const grouped = {};

      for (const post of allPosts) {
        const normalized = this.normalizeArtistName(post.name);

        if (!grouped[normalized]) {
          grouped[normalized] = {
            originalName: post.name,
            normalized,
            posts: []
          };
        }

        grouped[normalized].posts.push(post);
      }

      // Filtrer pour ne garder que ceux avec des doublons
      const duplicates = {};

      for (const [key, group] of Object.entries(grouped)) {
        // Grouper par langue
        const byLang = {};
        for (const post of group.posts) {
          const lang = post.lang || 'en';
          if (!byLang[lang]) byLang[lang] = [];
          byLang[lang].push(post);
        }

        // Vérifier s'il y a plus d'une page par langue
        let hasDuplicates = false;
        for (const [lang, posts] of Object.entries(byLang)) {
          if (posts.length > 1) {
            hasDuplicates = true;
            break;
          }
        }

        if (hasDuplicates) {
          duplicates[key] = {
            ...group,
            byLang
          };
        }
      }

      return duplicates;

    } catch (error) {
      console.error('❌ Error detecting duplicates:', error.message);
      throw error;
    }
  }

  /**
   * Génère un rapport détaillé des doublons
   */
  generateReport(duplicates) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DUPLICATE DETECTION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const duplicateCount = Object.keys(duplicates).length;

    if (duplicateCount === 0) {
      console.log('✅ No duplicates found! All artists are unique.\n');
      return { totalArtists: 0, totalPages: 0, toDelete: [] };
    }

    console.log(`⚠️  Found ${duplicateCount} artists with duplicate pages:\n`);

    let totalPagesToDelete = 0;
    const toDelete = [];

    for (const [key, group] of Object.entries(duplicates)) {
      console.log(`\n🎵 Artist: ${group.originalName} (${group.normalized})`);
      console.log('   ─────────────────────────────────────');

      for (const [lang, posts] of Object.entries(group.byLang)) {
        if (posts.length > 1) {
          console.log(`\n   Language: ${lang.toUpperCase()} - ${posts.length} pages found`);

          // Trier par ID (le plus ancien en premier)
          posts.sort((a, b) => a.id - b.id);

          // Le premier (plus ancien) sera conservé
          const toKeep = posts[0];
          const toRemove = posts.slice(1);

          console.log(`   ✅ KEEP:   ID ${toKeep.id} (oldest)`);

          for (const post of toRemove) {
            console.log(`   ❌ DELETE: ID ${post.id}`);
            toDelete.push({
              id: post.id,
              name: post.name,
              slug: post.slug,
              lang: post.lang
            });
            totalPagesToDelete++;
          }
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 SUMMARY:`);
    console.log(`   Artists with duplicates: ${duplicateCount}`);
    console.log(`   Total pages to delete: ${totalPagesToDelete}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      totalArtists: duplicateCount,
      totalPages: totalPagesToDelete,
      toDelete
    };
  }

  /**
   * Supprime les doublons identifiés
   */
  async deleteDuplicates(toDelete) {
    if (this.dryRun) {
      console.log('\n🔒 DRY RUN MODE - No pages will be deleted');
      console.log('   Run with --execute to actually delete duplicates\n');
      return { success: 0, failed: 0 };
    }

    console.log('\n🗑️  DELETING DUPLICATES...\n');

    let success = 0;
    let failed = 0;

    for (const post of toDelete) {
      try {
        console.log(`   Deleting: ${post.name} (ID ${post.id}, ${post.lang})...`);

        await this.wordpress.callTool('wp_delete_post', {
          ID: post.id,
          force_delete: true
        });

        success++;
        console.log(`   ✅ Deleted`);

        // Délai pour éviter la surcharge
        await this.wait(2000);

      } catch (error) {
        failed++;
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 DELETION SUMMARY:`);
    console.log(`   ✅ Successfully deleted: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { success, failed };
  }

  /**
   * Nettoie les termes Polylang orphelins
   */
  async cleanupOrphanedPolylangTerms() {
    console.log('\n🧹 Cleaning up orphaned Polylang terms...\n');

    if (this.dryRun) {
      console.log('🔒 DRY RUN MODE - Skipping Polylang cleanup\n');
      return;
    }

    try {
      // Note: Cette fonctionnalité nécessite un endpoint WordPress custom
      // ou un accès direct à la base de données pour être pleinement efficace
      console.log('⚠️  Polylang cleanup requires manual verification');
      console.log('   Check wp_term_taxonomy for orphaned post_translations terms\n');
    } catch (error) {
      console.error('❌ Polylang cleanup error:', error.message);
    }
  }

  /**
   * Exécute le processus complet de nettoyage
   */
  async run(mode = 'dry-run') {
    this.dryRun = mode === 'dry-run';

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║   WORDPRESS ARTIST DUPLICATE CLEANUP SCRIPT        ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`\nMode: ${this.dryRun ? '🔒 DRY RUN (no changes)' : '⚠️  EXECUTE (will delete duplicates)'}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    try {
      // Étape 1: Détecter les doublons
      const duplicates = await this.detectDuplicates();

      // Étape 2: Générer le rapport
      const report = this.generateReport(duplicates);

      if (report.totalPages === 0) {
        console.log('✨ All done! No action needed.\n');
        return;
      }

      // Étape 3: Supprimer les doublons (si mode execute)
      const result = await this.deleteDuplicates(report.toDelete);

      // Étape 4: Nettoyer les termes Polylang orphelins
      if (!this.dryRun && result.success > 0) {
        await this.cleanupOrphanedPolylangTerms();
      }

      if (this.dryRun) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 NEXT STEPS:');
        console.log('   1. Review the report above');
        console.log('   2. Run with --execute to delete duplicates:');
        console.log('      node scripts/cleanup-duplicates.js --execute');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.log('✅ Cleanup completed!\n');
      }

    } catch (error) {
      console.error('\n❌ Cleanup script failed:', error);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.wordpress.disconnect();
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exécution du script
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args.includes('--execute') ? 'execute' : 'dry-run';

  const cleanup = new DuplicateCleanupService();
  cleanup.run(mode).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DuplicateCleanupService;