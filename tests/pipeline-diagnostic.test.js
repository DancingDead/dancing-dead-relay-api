#!/usr/bin/env node
/**
 * Tests de diagnostic complet du pipeline Brave Search → Anthropic
 * Identifie la source du bug "Electronic et Electronic"
 */

require('dotenv').config();
const ArtistAutomationService = require('../services/ArtistAutomationService');
const WebSearchService = require('../services/WebSearchService');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

/**
 * Analyse la qualité d'une description générée
 */
function analyzeDescription(description) {
  const issues = [];

  // Répétition de mots (ex: "Electronic et Electronic")
  const repetitionPattern = /(\b\w{4,}\b)\s+(et|and|,)\s+\1/gi;
  const matches = description.match(repetitionPattern);
  if (matches) {
    issues.push(`Répétition de mots: ${matches.join(', ')}`);
  }

  // Placeholders non remplacés
  if (/\{\{.*?\}\}/.test(description)) issues.push("Placeholders {{}} non remplacés");
  if (/\[\[.*?\]\]/.test(description)) issues.push("Placeholders [[]] non remplacés");

  // Valeurs nulles/undefined
  if (/undefined/i.test(description)) issues.push("'undefined' dans le texte");
  if (/\bnull\b/i.test(description)) issues.push("'null' dans le texte");

  // Longueur
  if (description.length < 100) issues.push("Description trop courte (<100 chars)");
  if (description.length > 1000) issues.push("Description trop longue (>1000 chars)");

  return issues;
}

/**
 * Identifie la cause probable du bug
 */
function identifyBugCause(spotifyData, braveData, description) {
  if (!spotifyData?.genres?.length && !braveData?.genres?.length) {
    return "Aucun genre disponible → le fallback utilise un template mal configuré";
  }
  if (spotifyData?.genres?.length === 1 && (!braveData?.genres || braveData.genres.length === 0)) {
    return "Un seul genre Spotify, pas de Brave → le template duplique le genre pour remplir 2 slots";
  }
  if (description.includes("{{") || description.includes("}}")) {
    return "Placeholders non remplacés dans le template";
  }
  const repetitionPattern = /(\b\w+\b)\s+(et|and)\s+\1/gi;
  if (repetitionPattern.test(description)) {
    return "Le template ou le prompt génère des répétitions de genres";
  }
  return "Cause non identifiée - vérifier le prompt Anthropic et le fallback";
}

/**
 * Fusionne et déduplique les genres
 */
function mergeGenres(spotifyGenres = [], braveGenres = []) {
  const allGenres = [...spotifyGenres, ...braveGenres];
  const uniqueGenres = [...new Set(allGenres.map(g => g.toLowerCase()))];
  return uniqueGenres;
}

/**
 * TEST 1: Reproduction du bug avec un seul genre
 */
async function testSingleGenreBug() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🐛 TEST 1: REPRODUCTION BUG "Electronic et Electronic"');
  console.log('='.repeat(60) + '\n');

  const service = new ArtistAutomationService();

  // Artiste avec un seul genre (cas problématique)
  const mockArtist = {
    name: "Test Artist Single Genre",
    genres: ["electronic"], // Un seul genre
    popularity: 30
  };

  log(colors.blue, '📋 CONDITIONS:');
  console.log(`   Genres Spotify: ${mockArtist.genres.join(', ')}`);
  console.log(`   Genres Brave: (aucun - simulation échec recherche)`);
  console.log();

  try {
    // Simuler un échec de recherche web (pas de données Brave)
    const emptyResearch = { formatted: 'Limited information available.', social_links: {} };

    log(colors.blue, '🤖 Génération description...');
    const content = await service.generateBilingualDescription(mockArtist, emptyResearch.formatted);

    const descriptionEN = content.en.description;
    const descriptionFR = content.fr.description;

    log(colors.blue, '\n📝 DESCRIPTION GÉNÉRÉE (EN):');
    console.log(colors.gray + descriptionEN.substring(0, 400) + '...' + colors.reset);

    // Analyse
    const issuesEN = analyzeDescription(descriptionEN);
    const issuesFR = analyzeDescription(descriptionFR);

    log(colors.blue, '\n🔍 ANALYSE:');

    if (issuesEN.length === 0 && issuesFR.length === 0) {
      log(colors.green, '   ✅ AUCUN PROBLÈME DÉTECTÉ');
      log(colors.green, '   Le bug a été corrigé !');
    } else {
      log(colors.red, '   ❌ PROBLÈMES DÉTECTÉS:');
      if (issuesEN.length > 0) {
        console.log('      EN: ' + issuesEN.join(', '));
      }
      if (issuesFR.length > 0) {
        console.log('      FR: ' + issuesFR.join(', '));
      }

      const cause = identifyBugCause(mockArtist, {}, descriptionEN);
      log(colors.yellow, '\n   💡 CAUSE PROBABLE:');
      console.log(`      ${cause}`);
    }

  } catch (error) {
    log(colors.red, `   ❌ ERREUR: ${error.message}`);
  }
}

/**
 * TEST 2: Pipeline complet avec trace
 */
async function testFullPipeline() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🔄 TEST 2: TRACE PIPELINE COMPLÈTE');
  console.log('='.repeat(60) + '\n');

  const service = new ArtistAutomationService();
  const webSearch = new WebSearchService();

  // Utiliser un artiste réel de Spotify
  const artistName = "Naeleck"; // Artiste connu

  try {
    // Charger les données Spotify
    const spotifyArtists = await service.getSpotifyArtists();
    const spotifyData = spotifyArtists.find(a => a.name.toLowerCase() === artistName.toLowerCase());

    if (!spotifyData) {
      log(colors.yellow, `⚠️  Artiste "${artistName}" non trouvé dans Spotify - utilisation données mock`);
      return;
    }

    // ÉTAPE 1: Spotify
    log(colors.blue, '📀 ÉTAPE 1: SPOTIFY');
    console.log(`   Artiste: ${spotifyData.name}`);
    console.log(`   Genres: ${spotifyData.genres?.join(', ') || 'Aucun'}`);
    console.log(`   Followers: ${spotifyData.followers || 'N/A'}`);
    console.log(`   Status: ${spotifyData ? '✅' : '❌'}`);

    // ÉTAPE 2: Brave Search
    log(colors.blue, '\n🔍 ÉTAPE 2: BRAVE SEARCH');
    console.log(`   Requête: "${artistName}"`);

    let braveResults;
    try {
      braveResults = await webSearch.searchArtist(artistName, spotifyData.genres);
      const totalResults = (braveResults.biography?.length || 0) +
                          (braveResults.labels?.length || 0) +
                          (braveResults.performances?.length || 0);
      console.log(`   Résultats: ${totalResults}`);
      console.log(`   Status: ${totalResults > 0 ? '✅' : '⚠️ Pas de résultats'}`);
    } catch (error) {
      log(colors.red, `   ❌ ERREUR: ${error.message}`);
      braveResults = { biography: [], labels: [], performances: [] };
    }

    // ÉTAPE 3: Synthèse Claude
    log(colors.blue, '\n🤖 ÉTAPE 3: SYNTHÈSE CLAUDE');
    let synthesizedData;
    try {
      synthesizedData = await service.synthesizeWebResults(spotifyData, braveResults);
      console.log(`   Nationalité: ${synthesizedData?.nationality || 'N/A'}`);
      console.log(`   Origine: ${synthesizedData?.origin || 'N/A'}`);
      console.log(`   Labels: ${synthesizedData?.labels?.length || 0}`);
      console.log(`   Status: ${synthesizedData ? '✅' : '⚠️ Échec'}`);
    } catch (error) {
      log(colors.red, `   ❌ ERREUR: ${error.message}`);
      synthesizedData = null;
    }

    // ÉTAPE 4: Merge genres
    log(colors.blue, '\n🔀 ÉTAPE 4: MERGE GENRES');
    const spotifyGenres = spotifyData.genres || [];
    const braveGenres = synthesizedData?.genres || [];
    const mergedGenres = mergeGenres(spotifyGenres, braveGenres);

    console.log(`   Genres Spotify: ${spotifyGenres.join(', ') || 'Aucun'}`);
    console.log(`   Genres Brave: ${braveGenres.join(', ') || 'Aucun'}`);
    console.log(`   Genres fusionnés: ${mergedGenres.join(', ') || 'Aucun'}`);
    console.log(`   Déduplication: ${mergedGenres.length < spotifyGenres.length + braveGenres.length ? '✅' : '➖'}`);

    // ÉTAPE 5: Génération description
    log(colors.blue, '\n📝 ÉTAPE 5: GÉNÉRATION DESCRIPTION');
    const formatted = service.formatWebResearch(synthesizedData || {});
    const content = await service.generateBilingualDescription(spotifyData, formatted);

    const issues = analyzeDescription(content.en.description);
    console.log(`   Longueur EN: ${content.en.description.length} chars`);
    console.log(`   Longueur FR: ${content.fr.description.length} chars`);
    console.log(`   Problèmes: ${issues.length > 0 ? issues.join(', ') : '✅ Aucun'}`);

    // RÉSULTAT FINAL
    console.log('\n' + '='.repeat(60));
    if (issues.length === 0) {
      log(colors.green, '✅ PIPELINE OK - Aucun problème détecté');
    } else {
      log(colors.red, '❌ PROBLÈMES DÉTECTÉS:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    console.log('='.repeat(60));

  } catch (error) {
    log(colors.red, `❌ ERREUR PIPELINE: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * TEST 3: Déduplication de genres
 */
async function testGenreDeduplication() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🔄 TEST 3: DÉDUPLICATION GENRES');
  console.log('='.repeat(60) + '\n');

  const testCases = [
    {
      name: "Doublons exact",
      spotifyGenres: ["electronic", "Electronic", "ELECTRONIC"],
      braveGenres: ["electronic"],
      expected: ["electronic"]
    },
    {
      name: "Genres différents",
      spotifyGenres: ["electronic", "house"],
      braveGenres: ["techno", "house"],
      expected: ["electronic", "house", "techno"]
    },
    {
      name: "Un seul genre",
      spotifyGenres: ["electronic"],
      braveGenres: [],
      expected: ["electronic"]
    }
  ];

  testCases.forEach(test => {
    log(colors.blue, `\n📋 Test: ${test.name}`);
    console.log(`   Spotify: ${test.spotifyGenres.join(', ')}`);
    console.log(`   Brave: ${test.braveGenres.join(', ')}`);

    const merged = mergeGenres(test.spotifyGenres, test.braveGenres);
    console.log(`   Résultat: ${merged.join(', ')}`);

    const isCorrect = merged.length === test.expected.length &&
                      merged.every(g => test.expected.includes(g));

    if (isCorrect) {
      log(colors.green, '   ✅ CORRECT');
    } else {
      log(colors.red, `   ❌ INCORRECT - Attendu: ${test.expected.join(', ')}`);
    }
  });
}

/**
 * TEST 4: Test avec données vides (fallback)
 */
async function testEmptyDataFallback() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '⚠️  TEST 4: FALLBACK AVEC DONNÉES VIDES');
  console.log('='.repeat(60) + '\n');

  const service = new ArtistAutomationService();

  const testArtist = {
    name: "Unknown DJ",
    genres: ["electronic"],
    popularity: 10
  };

  log(colors.blue, '📋 CONDITIONS:');
  console.log(`   Artiste: ${testArtist.name}`);
  console.log(`   Genres: ${testArtist.genres.join(', ')}`);
  console.log(`   Brave data: null/vide (simulation échec)`);
  console.log();

  try {
    const emptyResearch = { formatted: 'Limited information available.' };

    log(colors.blue, '🤖 Génération avec fallback...');
    const content = await service.generateBilingualDescription(testArtist, emptyResearch.formatted);

    const descriptionEN = content.en.description;
    const issues = analyzeDescription(descriptionEN);

    const hasRepetition = /(\b\w+\b)\s+(et|and)\s+\1/gi.test(descriptionEN);

    log(colors.blue, '\n📝 EXTRAIT GÉNÉRÉ:');
    console.log(colors.gray + descriptionEN.substring(0, 300) + '...' + colors.reset);

    log(colors.blue, '\n🔍 ANALYSE FALLBACK:');
    console.log(`   Répétition de genre: ${hasRepetition ? '❌ OUI - BUG TROUVÉ' : '✅ Non'}`);
    console.log(`   Autres problèmes: ${issues.length > 0 ? issues.join(', ') : '✅ Aucun'}`);

    if (hasRepetition) {
      log(colors.yellow, '\n   💡 Le fallback génère le bug "Electronic et Electronic"');
      log(colors.yellow, '   → Vérifier le template de fallback dans ArtistAutomationService.js:469-491');
    } else {
      log(colors.green, '   ✅ Le fallback fonctionne correctement');
    }

  } catch (error) {
    log(colors.red, `   ❌ ERREUR: ${error.message}`);
  }
}

/**
 * Exécution de tous les tests
 */
async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  log(colors.cyan, '🧪 DIAGNOSTIC COMPLET DU PIPELINE');
  log(colors.cyan, '   Brave Search → Anthropic → WordPress');
  console.log('█'.repeat(60));

  try {
    await testSingleGenreBug();
    await testGenreDeduplication();
    await testEmptyDataFallback();

    // Test pipeline complet uniquement si Brave API est configuré
    if (process.env.BRAVE_SEARCH_API_KEY) {
      await testFullPipeline();
    } else {
      log(colors.yellow, '\n⚠️  Test pipeline complet ignoré - BRAVE_SEARCH_API_KEY non configuré');
    }

    console.log('\n' + '█'.repeat(60));
    log(colors.green, '✅ DIAGNOSTIC TERMINÉ');
    console.log('█'.repeat(60) + '\n');

  } catch (error) {
    log(colors.red, '\n❌ ERREUR FATALE:', error.message);
    console.error(error.stack);
  }
}

// Exécution
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  analyzeDescription,
  identifyBugCause,
  mergeGenres,
  testSingleGenreBug,
  testFullPipeline,
  testGenreDeduplication,
  testEmptyDataFallback,
  runAllTests
};
