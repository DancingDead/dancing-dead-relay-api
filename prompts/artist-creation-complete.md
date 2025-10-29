# PROMPT COMPLET : Création automatique de pages artistes bilingues (FR/EN) sur WordPress avec Polylang

## Contexte

- Site WordPress : [dancingdeadrecords.com](http://dancingdeadrecords.com/)
- CPT (Custom Post Type) : "artist"
- Langues : Français (FR) et Anglais (EN)
- Plugin multilingue : Polylang
- Champs personnalisés : ACF (Advanced Custom Fields)
- SEO : Yoast SEO

## Architecture des URLs

- **Page EN** : `https://www.dancingdeadrecords.com/artists/[slug]/`
- **Page FR** : `https://www.dancingdeadrecords.com/fr/artistes/[slug]/`

## Prérequis techniques

### Taxonomies Polylang

- **Taxonomie "language"** : Gère la langue de chaque post
  - Terme "English" : term_id = 4, slug = "en"
  - Terme "Français" : term_id = 7, slug = "fr"
- **Taxonomie "post_translations"** : Gère les liens entre traductions
  - Chaque groupe de traductions a un terme unique
  - Format du nom : `pll_[timestamp][hash]` (ex: "pll_671e9a5b8f2d4")
  - Description du terme : sérialisé PHP avec les IDs des posts liés
  - Format : `a:2:{s:2:"en";i:[ID_EN];s:2:"fr";i:[ID_FR];}`

### Champs ACF disponibles

- `title` : Nom de l'artiste (string)
- `role` : Rôle (string) - "DJ & Producer" ou "DJ & Producteur" (FR) / "Singer & Songwriter"
- `description` : Description HTML (text area) - Utilise `<strong>` pour emphase, `<br><br>` pour paragraphes
- `photo` : ID de l'image (integer)
- `spotify_link` : Lien Spotify (URL)
- `soundcloud_link` : Lien SoundCloud (URL)
- `instagram_link` : Lien Instagram (URL)
- `tag1`, `tag2`, `tag3` : Genres musicaux (string)

### Champs SEO (Yoast)

- `_yoast_wpseo_title` : Titre SEO - Utiliser "%%title%%" pour titre dynamique
- `_yoast_wpseo_metadesc` : Meta description (~150 caractères)
- `_yoast_wpseo_focuskw` : Mot-clé focus (nom de l'artiste)

## PROCESSUS COMPLET - Étape par étape

### ÉTAPE 1 : Recherche d'informations sur l'artiste

### 1.1 Recherche web

```jsx
web_search({
  query: "[NOM ARTISTE] electronic music DJ producer genres collaborations"
})

```

### 1.2 Identifier les informations clés

- Genres musicaux principaux (3 maximum)
- Labels associés
- Collaborations notables
- Festivals/événements majeurs
- Histoire et style artistique
- Rôle : DJ & Producer ou Singer & Songwriter

### 1.3 Trouver les liens réseaux sociaux

```jsx
web_search({
  query: "[NOM ARTISTE] Spotify Instagram SoundCloud"
})

```

- Spotify : `https://open.spotify.com/artist/[ID]`
- Instagram : `https://www.instagram.com/[username]/`
- SoundCloud : `https://soundcloud.com/[username]`

### ÉTAPE 2 : Génération des descriptions (FR et EN)

### 2.1 Structure de la description

**Format attendu** :

- Paragraphe d'intro : Présentation de l'artiste avec genres en `<strong>`
- Paragraphe 2 : Labels, collaborations, soutiens
- Paragraphe 3 : Performances, festivals, histoire
- Paragraphe 4 (optionnel) : Vision artistique, influences
- Paragraphe final : Mention de Dancing Dead Records

**Règles de formatage** :

- Emphase avec `<strong>` uniquement pour : genres musicaux, noms de labels
- Sauts de paragraphe : `<br><br>` (2 fois)
- Pas de balises autour du nom de l'artiste dans le titre
- Ton : professionnel, inspirant, immersif
- Inclure naturellement des mots-clés SEO : electronic music, DJ producer, festival, remix, etc.

**Exemple de structure EN** :

```html
<strong>[ARTISTE]</strong> is a [nationalité] DJ and producer recognized for blending <strong>[Genre 1]</strong>, <strong>[Genre 2]</strong>, and <strong>[Genre 3]</strong>.<br><br>Signed to <strong>[Label]</strong>, [Artiste] has collaborated with [artistes notables]...<br><br>On stage, [description performances]...<br><br>[Artiste] embodies the innovative spirit of <strong>Dancing Dead Records</strong>.

```

**Exemple de structure FR** :

```html
<strong>[ARTISTE]</strong> est un DJ et producteur [nationalité] reconnu pour son mélange de <strong>[Genre 1]</strong>, <strong>[Genre 2]</strong> et <strong>[Genre 3]</strong>.<br><br>Signé sur le label <strong>[Label]</strong>, [Artiste] a collaboré avec [artistes notables]...<br><br>Sur scène, [description performances]...<br><br>[Artiste] incarne l'esprit innovant de <strong>Dancing Dead Records</strong>.

```

### 2.2 Meta descriptions SEO

- **Longueur** : ~150 caractères maximum
- **Contenu** : Résumé concis avec genres, nationalité, caractéristique unique
- **Format EN** : `[ARTISTE], [nationalité] DJ and producer, blends [Genre 1], [Genre 2], and [Genre 3], [particularité]`
- **Format FR** : `[ARTISTE], DJ et producteur [nationalité], fusionne [Genre 1], [Genre 2] et [Genre 3], [particularité]`

### ÉTAPE 3 : Recherche de l'image dans la médiathèque

```jsx
// Recherche avec le nom de l'artiste
wp_get_media({
  search: "[nom-artiste]",
  limit: 10
})

// Si pas trouvée, recherche plus large
wp_get_media({
  search: "[mot-clé-partiel]",
  limit: 50
})

```

**Patterns de noms d'images courants** :

- `[nom-artiste].webp`
- `dancing-dead-artist-[nom-artiste].webp`
- `artist-[nom-artiste].webp`

**Si image non trouvée** : Noter pour upload manuel ultérieur

### ÉTAPE 4 : Création de la page EN

```jsx
const postEN = wp_create_post({
  post_title: "[NOM ARTISTE]",
  post_name: "[nom-artiste]",  // Slug en minuscules, avec tirets
  post_type: "artist",
  post_status: "publish",
  meta_input: {
    // ACF Fields
    "title": "[NOM ARTISTE]",
    "role": "DJ & Producer",  // ou "Singer & Songwriter"
    "description": "[HTML description EN]",
    "photo": "[IMAGE_ID]",  // Si image trouvée
    "spotify_link": "[URL Spotify]",
    "soundcloud_link": "[URL SoundCloud]",
    "instagram_link": "[URL Instagram]",
    "tag1": "[Genre 1]",
    "tag2": "[Genre 2]",
    "tag3": "[Genre 3]",

    // Yoast SEO
    "_yoast_wpseo_title": "%%title%%",
    "_yoast_wpseo_focuskw": "[NOM ARTISTE]",
    "_yoast_wpseo_metadesc": "[Meta description EN ~150 chars]"
  }
})
// Retourne ID_EN

```

### ÉTAPE 5 : Création de la page FR

```jsx
const postFR = wp_create_post({
  post_title: "[NOM ARTISTE]",
  post_name: "[nom-artiste]",  // Même slug que EN
  post_type: "artist",
  post_status: "publish",
  meta_input: {
    // ACF Fields
    "title": "[NOM ARTISTE]",
    "role": "DJ & Producteur",  // ou "Chanteur & Auteur-compositeur"
    "description": "[HTML description FR]",
    "photo": "[IMAGE_ID]",  // Même image que EN
    "spotify_link": "[URL Spotify]",  // Mêmes liens
    "soundcloud_link": "[URL SoundCloud]",
    "instagram_link": "[URL Instagram]",
    "tag1": "[Genre 1]",  // Mêmes tags
    "tag2": "[Genre 2]",
    "tag3": "[Genre 3]",

    // Yoast SEO
    "_yoast_wpseo_title": "%%title%%",
    "_yoast_wpseo_focuskw": "[NOM ARTISTE]",
    "_yoast_wpseo_metadesc": "[Meta description FR ~150 chars]"
  }
})
// Retourne ID_FR

```

### ÉTAPE 6 : Attribution de l'image mise en avant

**Si image trouvée dans la médiathèque** :

```jsx
// Pour la page EN
wp_set_featured_image({
  post_id: ID_EN,
  media_id: IMAGE_ID
})

// Pour la page FR
wp_set_featured_image({
  post_id: ID_FR,
  media_id: IMAGE_ID
})

```

### ÉTAPE 7 : Liaison Polylang (CRITIQUE)

### 7.1 Assigner la langue à chaque page

```jsx
// Page EN
wp_add_post_terms({
  ID: ID_EN,
  taxonomy: "language",
  terms: [4],  // term_id pour "English"
  append: false
})

// Page FR
wp_add_post_terms({
  ID: ID_FR,
  taxonomy: "language",
  terms: [7],  // term_id pour "Français"
  append: false
})

```

### 7.2 Créer un terme de traduction unique

```jsx
// Générer un nom unique
const timestamp = Date.now().toString(16)
const random = Math.random().toString(36).substr(2, 9)
const termName = `pll_${timestamp}${random}`
// Exemple : "pll_671e9a5b8f2d4"

const translationTerm = wp_create_term({
  taxonomy: "post_translations",
  term_name: termName
})
// Retourne TERM_ID

```

### 7.3 Assigner le terme aux deux pages

```jsx
// Assigner à la page EN
wp_add_post_terms({
  ID: ID_EN,
  taxonomy: "post_translations",
  terms: [TERM_ID],
  append: false
})

// Assigner à la page FR
wp_add_post_terms({
  ID: ID_FR,
  taxonomy: "post_translations",
  terms: [TERM_ID],
  append: false
})

```

### 7.4 Mettre à jour la description du terme (CRITIQUE)

**Cette étape est OBLIGATOIRE pour que les liens Polylang fonctionnent** :

```jsx
// Créer la chaîne sérialisée PHP
const description = `a:2:{s:2:"en";i:${ID_EN};s:2:"fr";i:${ID_FR};}`
// Exemple : "a:2:{s:2:"en";i:7710;s:2:"fr";i:7711;}"

wp_update_term({
  term_id: TERM_ID,
  taxonomy: "post_translations",
  description: description
})

```

**Format de la description sérialisée expliqué** :

```php
a:2:{              // array avec 2 éléments
  s:2:"en";        // string de longueur 2 : "en"
  i:7710;          // integer : ID de la page EN
  s:2:"fr";        // string de longueur 2 : "fr"
  i:7711;          // integer : ID de la page FR
}

```

### ÉTAPE 8 : Vérification et rapport

```jsx
// Vérifier la page EN
const checkEN = wp_get_post({ ID: ID_EN })
console.log("URL EN:", checkEN.permalink)

// Vérifier la page FR
const checkFR = wp_get_post({ ID: ID_FR })
console.log("URL FR:", checkFR.permalink)

```

**Résultat attendu** :

- URL EN : `https://www.dancingdeadrecords.com/artists/[nom-artiste]/`
- URL FR : `https://www.dancingdeadrecords.com/fr/artistes/[nom-artiste]/`
- Drapeaux FR/EN cliquables dans l'admin WordPress
- Navigation entre versions fonctionnelle
- Plus de symbole `+` dans l'admin

## CHECKLIST FINALE PAR ARTISTE

### Contenu

- ✅ Description EN (HTML avec `<strong>` et `<br><br>`)
- ✅ Description FR (HTML avec `<strong>` et `<br><br>`)
- ✅ Meta description EN (~150 caractères)
- ✅ Meta description FR (~150 caractères)
- ✅ 3 tags de genres musicaux
- ✅ Rôle correct (DJ & Producer/Producteur ou Singer & Songwriter)

### Liens

- ✅ Spotify
- ✅ Instagram
- ✅ SoundCloud

### Image

- ✅ Champ ACF `photo` rempli
- ✅ Image mise en avant définie (Featured Image)
- ✅ Même image pour FR et EN

### SEO

- ✅ `_yoast_wpseo_title` = "%%title%%"
- ✅ `_yoast_wpseo_focuskw` = nom de l'artiste
- ✅ `_yoast_wpseo_metadesc` rempli (FR et EN)

### Polylang

- ✅ Langue EN assignée (term_id: 4)
- ✅ Langue FR assignée (term_id: 7)
- ✅ Terme de traduction créé
- ✅ Terme assigné aux 2 pages
- ✅ Description du terme mise à jour avec IDs sérialisés

### Validation

- ✅ URL EN correcte : `/artists/[slug]/`
- ✅ URL FR correcte : `/fr/artistes/[slug]/`
- ✅ Drapeaux fonctionnels dans l'admin
- ✅ Navigation entre versions opérationnelle

## ORDRE D'EXÉCUTION (IMPORTANT)

**L'ordre des étapes est critique pour éviter les erreurs** :

1. Recherche web → Informations artiste
2. Génération descriptions FR + EN
3. Recherche image dans médiathèque
4. **Création page EN** (avec tous les champs)
5. **Création page FR** (avec tous les champs)
6. **Attribution image mise en avant** (EN puis FR)
7. **Assignation langue** (term_id 4 pour EN, 7 pour FR)
8. **Création terme traduction** (nom unique)
9. **Assignation terme** (aux 2 pages)
10. **Mise à jour description terme** (avec IDs sérialisés) ← **CRITIQUE**
11. Vérification URLs et rapport

## GESTION DES ERREURS

### Image non trouvée

- Créer les pages sans le champ `photo`
- Noter l'artiste pour upload manuel
- Continuer le processus

### Liens réseaux non trouvés

- Laisser les champs vides
- Noter pour recherche manuelle
- Ne pas bloquer la création

### Informations insuffisantes

- Créer une description générique basée sur le genre
- Marquer l'artiste pour révision manuelle
- Publier quand même pour ne pas perdre le travail

## GENRES MUSICAUX COURANTS

**Pour référence lors de la recherche** :

- Hard Techno, Techno, Tech House
- Bass Music, Dubstep, Drum & Bass
- Trap, Future Bass, Future House
- House, Deep House, Progressive House
- Hardcore, Hardstyle, Rawstyle
- EDM, Big Room, Electro House
- Trance, Psytrance
- Garage, UK Garage

## NOTES IMPORTANTES

1. **Ne JAMAIS reprYou can oduire ou citer exactement du contenu trouvé sur le web** - toujours paraphraser
2. **Les descriptions doivent être originales** et adaptées au style Dancing Dead Records
3. **Les slugs doivent être2 en minuscules** avec tirets, pas d'accents
4. **L'étape 7.4 (description sérialisée) est OBLIGATOIRE** sinon les traductions ne seront pas liées
5. **Utiliser "append: false"** pour remplacer les termes existants, pas les ajouter
6. **Les deux pages doivent avoir le même slug** mais dans des URLs différentes
7. **Publier immédiatement** (post_status: "publish") pour que Polylang génère les bonnes URLs

## EXEMPLE COMPLET : VIVID

**Résultat final** :

- Page EN : [https://www.dancingdeadrecords.com/artists/vivid/](https://www.dancingdeadrecords.com/artists/vivid/)
- Page FR : [https://www.dancingdeadrecords.com/fr/artistes/vivid/](https://www.dancingdeadrecords.com/fr/artistes/vivid/)
- ID EN : 7710
- ID FR : 7711
- Image : ID 7725
- Terme traduction : ID 234, nom "pll_671e9a5b8f2d4"
- Description terme : `a:2:{s:2:"en";i:7710;s:2:"fr";i:7711;}`