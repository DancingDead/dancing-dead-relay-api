#!/usr/bin/env node
/**
 * Tests pour la fonction wordpressSlugify
 * Vérifie que la slugification reproduit EXACTEMENT le comportement de WordPress
 */

const { wordpressSlugify, wordpressSlugifyDebug, isSameArtist } = require('../utils/wordpressSlugify');

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
 * Test cases basés sur des artistes réels problématiques
 */
const testCases = [
  // CAS PROBLÉMATIQUE PRINCIPAL
  {
    name: "Rhi'N'B",
    expected: "rhinb",
    description: "Artiste avec apostrophes (cause des 500 doublons)"
  },

  // Accents et caractères spéciaux
  {
    name: "Café Tacvba",
    expected: "cafe-tacvba",
    description: "Accent sur 'e'"
  },
  {
    name: "Röyksopp",
    expected: "royksopp",
    description: "Tréma sur 'o'"
  },
  {
    name: "Sigur Rós",
    expected: "sigur-ros",
    description: "Accent sur 'o'"
  },
  {
    name: "Björk",
    expected: "bjork",
    description: "Tréma sur 'o'"
  },
  {
    name: "Måneskin",
    expected: "maneskin",
    description: "Å scandinave"
  },

  // Apostrophes et quotes
  {
    name: "D'Angelo",
    expected: "dangelo",
    description: "Apostrophe simple"
  },
  {
    name: "O'Connor",
    expected: "oconnor",
    description: "Apostrophe simple"
  },
  {
    name: "L'Impératrice",
    expected: "limperatrice",
    description: "Apostrophe + accents"
  },

  // Espaces et tirets
  {
    name: "Jay-Z",
    expected: "jay-z",
    description: "Tiret existant"
  },
  {
    name: "A Tribe Called Quest",
    expected: "a-tribe-called-quest",
    description: "Espaces multiples"
  },
  {
    name: "deadmau5",
    expected: "deadmau5",
    description: "Déjà en minuscule avec chiffres"
  },

  // Caractères spéciaux
  {
    name: "M83",
    expected: "m83",
    description: "Lettre + chiffre"
  },
  {
    name: "!!!",
    expected: "",
    description: "Uniquement caractères spéciaux (devrait être vide)"
  },
  {
    name: "AC/DC",
    expected: "ac-dc",
    description: "Slash"
  },
  {
    name: "Gesaffelstein",
    expected: "gesaffelstein",
    description: "Nom simple sans modification"
  },

  // Edge cases
  {
    name: "  Spaced Out  ",
    expected: "spaced-out",
    description: "Espaces en début/fin"
  },
  {
    name: "Multiple---Dashes",
    expected: "multiple-dashes",
    description: "Tirets multiples"
  },
  {
    name: "André 3000",
    expected: "andre-3000",
    description: "Accent + espace + chiffres"
  },
  {
    name: "Tiësto",
    expected: "tiesto",
    description: "Tréma sur 'e'"
  },

  // Symboles spéciaux
  {
    name: "The Black Eyed Peas",
    expected: "the-black-eyed-peas",
    description: "Nom avec 'The'"
  },
  {
    name: "N.E.R.D.",
    expected: "n-e-r-d",
    description: "Points entre lettres"
  },
  {
    name: "a-ha",
    expected: "a-ha",
    description: "Tiret au milieu"
  },

  // Unicode et emojis
  {
    name: "Naëleck",
    expected: "naeleck",
    description: "Tréma sur 'e'"
  },
  {
    name: "Søn",
    expected: "son",
    description: "Ø scandinave"
  }
];

/**
 * Exécute tous les tests
 */
function runTests() {
  console.log('\n' + '█'.repeat(60));
  log(colors.cyan, '🧪 TESTS DE SLUGIFICATION WORDPRESS');
  console.log('█'.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  testCases.forEach((test, index) => {
    const result = wordpressSlugify(test.name);
    const success = result === test.expected;

    if (success) {
      passed++;
      log(colors.green, `✅ Test ${index + 1}/${testCases.length}: ${test.name}`);
      console.log(colors.gray + `   → ${result}` + colors.reset);
    } else {
      failed++;
      log(colors.red, `❌ Test ${index + 1}/${testCases.length}: ${test.name}`);
      console.log(`   Attendu: "${test.expected}"`);
      console.log(`   Obtenu:  "${result}"`);
      console.log(colors.gray + `   (${test.description})` + colors.reset);
      failures.push({ test, result });
    }
  });

  // Résumé
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(60));
  console.log(`   Tests passés: ${passed}/${testCases.length}`);
  console.log(`   Tests échoués: ${failed}/${testCases.length}`);

  if (failed > 0) {
    console.log('\n' + '='.repeat(60));
    log(colors.red, '❌ ÉCHECS DÉTAILLÉS:');
    console.log('='.repeat(60));
    failures.forEach(({ test, result }) => {
      console.log(`\n   ${test.name}`);
      console.log(`   Attendu: "${test.expected}"`);
      console.log(`   Obtenu:  "${result}"`);

      // Debug détaillé
      const debug = wordpressSlugifyDebug(test.name);
      console.log(colors.gray + '   Étapes:' + colors.reset);
      debug.steps.forEach(step => {
        console.log(colors.gray + `      ${step.step}: "${step.value}"` + colors.reset);
      });
    });
  }

  console.log('\n' + '█'.repeat(60));
  if (failed === 0) {
    log(colors.green, '✅ TOUS LES TESTS PASSÉS');
  } else {
    log(colors.red, `❌ ${failed} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('█'.repeat(60) + '\n');

  return failed === 0;
}

/**
 * Test de détection de doublons
 */
function testDuplicateDetection() {
  console.log('\n' + '█'.repeat(60));
  log(colors.cyan, '🔍 TEST DE DÉTECTION DE DOUBLONS');
  console.log('█'.repeat(60) + '\n');

  const duplicatePairs = [
    ["Rhi'N'B", "RhiNB"],
    ["Rhi'N'B", "Rhi N B"],
    ["Rhi'N'B", "rhinb"],
    ["Café Tacvba", "Cafe Tacvba"],
    ["D'Angelo", "DAngelo"],
    ["Jay-Z", "Jay Z"],
  ];

  duplicatePairs.forEach(([name1, name2]) => {
    const slug1 = wordpressSlugify(name1);
    const slug2 = wordpressSlugify(name2);
    const areSame = isSameArtist(name1, name2);

    console.log(`"${name1}" vs "${name2}"`);
    console.log(colors.gray + `   Slug 1: ${slug1}` + colors.reset);
    console.log(colors.gray + `   Slug 2: ${slug2}` + colors.reset);

    if (areSame) {
      log(colors.yellow, '   ⚠️  DOUBLON DÉTECTÉ (même slug)');
    } else {
      log(colors.green, '   ✅ Artistes différents');
    }
    console.log();
  });

  console.log('█'.repeat(60) + '\n');
}

/**
 * Test avec le cas problématique réel "Rhi'N'B"
 */
function testRhiNBCase() {
  console.log('\n' + '█'.repeat(60));
  log(colors.cyan, '🐛 CAS PROBLÉMATIQUE: Rhi\'N\'B (500 doublons)');
  console.log('█'.repeat(60) + '\n');

  const variations = [
    "Rhi'N'B",
    "RhiNB",
    "Rhi N B",
    "rhi'n'b",
    "rhinb",
    "RHINB",
    "Rhi-N-B"
  ];

  log(colors.blue, '📋 VARIATIONS TESTÉES:');
  console.log();

  const slugs = new Set();
  variations.forEach(name => {
    const slug = wordpressSlugify(name);
    slugs.add(slug);
    console.log(`   "${name}"`);
    console.log(colors.gray + `   → slug: "${slug}"` + colors.reset);
  });

  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🔍 ANALYSE:');
  console.log('='.repeat(60));
  console.log(`   Variations testées: ${variations.length}`);
  console.log(`   Slugs uniques générés: ${slugs.size}`);

  if (slugs.size === 1) {
    const uniqueSlug = Array.from(slugs)[0];
    log(colors.green, `   ✅ TOUS IDENTIQUES: "${uniqueSlug}"`);
    log(colors.green, '   La fonction détectera correctement les doublons !');
  } else {
    log(colors.red, `   ❌ PROBLÈME: ${slugs.size} slugs différents générés`);
    log(colors.red, '   Certaines variations ne seront pas détectées comme doublons');
    console.log('\n   Slugs trouvés:');
    slugs.forEach(slug => console.log(`      - "${slug}"`));
  }

  console.log('\n' + '█'.repeat(60) + '\n');
}

// Exécution
if (require.main === module) {
  const allPassed = runTests();
  testDuplicateDetection();
  testRhiNBCase();

  process.exit(allPassed ? 0 : 1);
}

module.exports = {
  runTests,
  testDuplicateDetection,
  testRhiNBCase
};
