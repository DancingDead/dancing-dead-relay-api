/**
 * WordPress Slug Generator
 *
 * Reproduit EXACTEMENT le comportement de sanitize_title() de WordPress
 * pour éviter les doublons d'artistes avec des noms comme "Rhi'N'B"
 *
 * WordPress sanitize_title() fait:
 * 1. Normalise Unicode (NFD)
 * 2. Convertit en minuscules
 * 3. Retire les accents
 * 4. Convertit apostrophes/quotes en tirets
 * 5. Convertit espaces en tirets
 * 6. Retire caractères spéciaux
 * 7. Collapse tirets multiples
 * 8. Retire tirets en début/fin
 */

/**
 * Map des caractères spéciaux vers leurs équivalents ASCII
 * (similaire à WordPress remove_accents())
 */
const accentMap = {
  // Lettres avec accents latins
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o', 'ő': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u', 'ű': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ñ': 'n', 'ń': 'n', 'ň': 'n',
  'ç': 'c', 'ć': 'c', 'č': 'c',
  'ß': 'ss',
  'ł': 'l',
  'ś': 's', 'š': 's',
  'ź': 'z', 'ż': 'z', 'ž': 'z',
  // Majuscules
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Ā': 'A', 'Ă': 'A', 'Ą': 'A',
  'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ė': 'E', 'Ę': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'Ī': 'I', 'Į': 'I',
  'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Ō': 'O', 'Ő': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U', 'Ū': 'U', 'Ů': 'U', 'Ű': 'U',
  'Ý': 'Y', 'Ÿ': 'Y',
  'Ñ': 'N', 'Ń': 'N', 'Ň': 'N',
  'Ç': 'C', 'Ć': 'C', 'Č': 'C',
  'Ł': 'L',
  'Ś': 'S', 'Š': 'S',
  'Ź': 'Z', 'Ż': 'Z', 'Ž': 'Z',
  // Ligatures
  'æ': 'ae', 'Æ': 'AE',
  'œ': 'oe', 'Œ': 'OE',
  // Autres symboles courants
  '&': 'and',
  '@': 'at',
  '©': 'c',
  '®': 'r',
  '™': 'tm',
};

/**
 * Retire les accents d'une chaîne (similaire à WordPress remove_accents())
 */
function removeAccents(str) {
  // Utiliser le map d'abord pour les cas spéciaux
  let result = str.split('').map(char => accentMap[char] || char).join('');

  // Puis normaliser Unicode et retirer les marques diacritiques restantes
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return result;
}

/**
 * Génère un slug WordPress à partir d'un nom d'artiste
 * Reproduit EXACTEMENT sanitize_title() de WordPress
 *
 * @param {string} artistName - Nom de l'artiste
 * @returns {string} - Slug WordPress
 *
 * @example
 * wordpressSlugify("Rhi'N'B") → "rhinb"
 * wordpressSlugify("Café Taçuba") → "cafe-tacuba"
 * wordpressSlugify("M83") → "m83"
 * wordpressSlugify("deadmau5") → "deadmau5"
 * wordpressSlugify("Röyksopp") → "royksopp"
 * wordpressSlugify("Sigur Rós") → "sigur-ros"
 */
function wordpressSlugify(artistName) {
  if (!artistName || typeof artistName !== 'string') {
    return '';
  }

  let slug = artistName;

  // 1. Convertir en minuscules
  slug = slug.toLowerCase();

  // 2. Retirer les accents
  slug = removeAccents(slug);

  // 3. SUPPRIMER les apostrophes et quotes (WordPress les supprime, ne les remplace pas par des tirets)
  // WordPress traite ' ' ` comme des caractères à retirer
  slug = slug.replace(/[''`]/g, '');

  // 4. Remplacer les espaces par des tirets
  slug = slug.replace(/\s+/g, '-');

  // 5. Retirer tous les caractères non alphanumériques sauf tirets
  // WordPress garde uniquement: a-z, 0-9, - (et _ dans certains cas, mais on l'ignore)
  slug = slug.replace(/[^a-z0-9\-]/g, '-');

  // 6. Collapse tirets multiples en un seul
  slug = slug.replace(/-+/g, '-');

  // 7. Retirer les tirets en début et fin
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
}

/**
 * Version alternative avec logging pour debug
 */
function wordpressSlugifyDebug(artistName) {
  if (!artistName || typeof artistName !== 'string') {
    return { slug: '', steps: [] };
  }

  const steps = [];
  let slug = artistName;
  steps.push({ step: 'Initial', value: slug });

  // 1. Minuscules
  slug = slug.toLowerCase();
  steps.push({ step: 'Lowercase', value: slug });

  // 2. Accents
  slug = removeAccents(slug);
  steps.push({ step: 'Remove accents', value: slug });

  // 3. Apostrophes (SUPPRIMER, pas remplacer par tiret)
  slug = slug.replace(/[''`]/g, '');
  steps.push({ step: 'Remove quotes', value: slug });

  // 4. Espaces
  slug = slug.replace(/\s+/g, '-');
  steps.push({ step: 'Replace spaces', value: slug });

  // 5. Caractères spéciaux
  slug = slug.replace(/[^a-z0-9\-]/g, '-');
  steps.push({ step: 'Remove special chars', value: slug });

  // 6. Collapse tirets
  slug = slug.replace(/-+/g, '-');
  steps.push({ step: 'Collapse dashes', value: slug });

  // 7. Trim tirets
  slug = slug.replace(/^-+|-+$/g, '');
  steps.push({ step: 'Trim dashes', value: slug });

  return { slug, steps };
}

/**
 * Teste si deux noms d'artistes génèrent le même slug WordPress
 */
function isSameArtist(name1, name2) {
  const slug1 = wordpressSlugify(name1);
  const slug2 = wordpressSlugify(name2);
  return slug1 === slug2 && slug1 !== '';
}

module.exports = {
  wordpressSlugify,
  wordpressSlugifyDebug,
  removeAccents,
  isSameArtist
};
