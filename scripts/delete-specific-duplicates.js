/**
 * Script de suppression des doublons spécifiques identifiés
 * AAMAR et Mac&Wester
 */

require('dotenv').config();
const WordPressMCPService = require('../services/WordPressMCPService');

async function deleteSpecificDuplicates() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   DELETE SPECIFIC DUPLICATES VIA MCP               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const wordpress = new WordPressMCPService();

  // Pages à supprimer (IDs en trop)
  const pagesToDelete = [
    // AAMAR (garder 11193 EN + 11196 FR)
    { id: 11194, name: 'AAMAR', lang: 'EN' },
    { id: 11195, name: 'AAMAR', lang: 'EN' },
    { id: 11197, name: 'AAMAR', lang: 'FR' },
    { id: 11198, name: 'AAMAR', lang: 'FR' },

    // Mac&Wester (garder 11184 EN + 11187 FR)
    { id: 11185, name: 'Mac&Wester', lang: 'EN' },
    { id: 11186, name: 'Mac&Wester', lang: 'EN' },
    { id: 11188, name: 'Mac&Wester', lang: 'FR' },
    { id: 11189, name: 'Mac&Wester', lang: 'FR' }
  ];

  console.log(`📋 Pages to delete: ${pagesToDelete.length}\n`);

  let success = 0;
  let failed = 0;

  for (const page of pagesToDelete) {
    try {
      console.log(`🗑️  Deleting: ${page.name} (ID ${page.id}, ${page.lang})...`);

      await wordpress.callTool('wp_delete_post', {
        ID: page.id,
        force_delete: true
      });

      success++;
      console.log(`   ✅ Deleted successfully\n`);

      // Délai pour éviter la surcharge
      await wait(2000);

    } catch (error) {
      failed++;
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 DELETION SUMMARY:`);
  console.log(`   ✅ Successfully deleted: ${success}/${pagesToDelete.length}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await wordpress.disconnect();

  if (success === pagesToDelete.length) {
    console.log('✅ All duplicates deleted successfully!\n');
  } else {
    console.log('⚠️  Some deletions failed. Check the errors above.\n');
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exécution
deleteSpecificDuplicates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
