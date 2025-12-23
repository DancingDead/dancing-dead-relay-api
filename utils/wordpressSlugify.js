/**
 * WordPress Slug Generator
 *
 * Convertit un nom d'artiste en slug compatible WordPress
 * Reproduit le comportement de sanitize_title() de WordPress
 */

/**
 * Convertit un nom d'artiste en slug compatible WordPress
 * Reproduit le comportement de sanitize_title() de WordPress
 * @param {string} name - Le nom de l'artiste
 * @returns {string} - Le slug compatible WordPress
 */
function slugifyArtistName(name) {
  // Table de remplacement pour les caractères spéciaux qui ne sont pas bien gérés par NFD
  const charMap = {
    'ø': 'o', 'Ø': 'o',
    'œ': 'oe', 'Œ': 'oe',
    'æ': 'ae', 'Æ': 'ae',
    'ß': 'ss',
    'đ': 'd', 'Đ': 'd',
    'ł': 'l', 'Ł': 'l',
    'ı': 'i', 'İ': 'i',
    'ð': 'd', 'Ð': 'd',
    'þ': 'th', 'Þ': 'th'
  };

  let result = name;

  // Remplacer les caractères spéciaux avant la normalisation
  Object.keys(charMap).forEach(char => {
    result = result.replace(new RegExp(char, 'g'), charMap[char]);
  });

  return result
    .toLowerCase()
    .normalize("NFD")                           // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, "")           // Supprime les accents
    .replace(/[^\w\s-]/g, "-")                 // Remplace tous les caractères spéciaux (apostrophes, etc.) par des tirets
    .replace(/\s+/g, "-")                      // Remplace les espaces par des tirets
    .replace(/-+/g, "-")                       // Remplace les tirets multiples par un seul tiret
    .replace(/^-+|-+$/g, "");                  // Supprime les tirets au début et à la fin
}

/**
 * Normalise un genre musical pour affichage propre
 * Convertit "Rhi'N'B" en "Rhi'n'b", "ELECTRONIC" en "Electronic", etc.
 * @param {string} genre - Le genre musical
 * @returns {string} - Le genre normalisé
 */
function normalizeGenre(genre) {
  if (!genre || typeof genre !== 'string') {
    return '';
  }

  // Convertir en minuscules d'abord
  let normalized = genre.toLowerCase();

  // Mettre la première lettre en majuscule
  normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  // Traiter les cas spéciaux avec apostrophes (Rhi'N'B -> Rhi'n'b)
  // Remplacer les apostrophes droites par des apostrophes typographiques
  normalized = normalized.replace(/'/g, "'");

  return normalized;
}

/**
 * Compare deux noms d'artistes en normalisant les différences de formatage
 * @param {string} name1 - Premier nom d'artiste
 * @param {string} name2 - Deuxième nom d'artiste
 * @returns {boolean} - true si les noms correspondent
 */
function artistNamesMatch(name1, name2) {
  if (!name1 || !name2) return false;

  const normalize = (str) => {
    // Table de remplacement pour les caractères spéciaux
    const charMap = {
      'ø': 'o', 'Ø': 'o',
      'œ': 'oe', 'Œ': 'oe',
      'æ': 'ae', 'Æ': 'ae',
      'ß': 'ss',
      'đ': 'd', 'Đ': 'd',
      'ł': 'l', 'Ł': 'l',
      'ı': 'i', 'İ': 'i',
      'ð': 'd', 'Ð': 'd',
      'þ': 'th', 'Þ': 'th'
    };

    let result = str;

    // Remplacer les caractères spéciaux avant la normalisation
    Object.keys(charMap).forEach(char => {
      result = result.replace(new RegExp(char, 'g'), charMap[char]);
    });

    return result
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")      // Supprime les accents
      .replace(/[^\w]/g, "");               // Supprime tout sauf lettres et chiffres
  };

  return normalize(name1) === normalize(name2);
}

// Aliases pour compatibilité avec le code existant
function wordpressSlugify(artistName) {
  if (!artistName || typeof artistName !== 'string') {
    return '';
  }
  return slugifyArtistName(artistName);
}

function isSameArtist(name1, name2) {
  return artistNamesMatch(name1, name2);
}

module.exports = {
  slugifyArtistName,
  artistNamesMatch,
  wordpressSlugify,
  isSameArtist,
  normalizeGenre
};
