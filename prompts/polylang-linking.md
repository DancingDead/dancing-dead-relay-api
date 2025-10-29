# PROMPT : Lier deux pages WordPress avec Polylang (FR/EN)

## Prérequis

- Taxonomie `language` avec les termes :
  - English (term_id: 4, slug: "en")
  - Français (term_id: 7, slug: "fr")
- Taxonomie `post_translations` pour les liens de traduction

## Étapes à suivre

### 1. Créer les deux pages (EN et FR)

```jsx
// Page EN
wp_create_post({
  post_title: "Nom Artiste",
  post_name: "nom-artiste",
  post_type: "artist",
  post_status: "publish",
  meta_input: { /* tous les champs ACF */ }
})
// Retourne ID_EN (ex: 7710)

// Page FR
wp_create_post({
  post_title: "Nom Artiste",
  post_name: "nom-artiste",
  post_type: "artist",
  post_status: "publish",
  meta_input: { /* tous les champs ACF en français */ }
})
// Retourne ID_FR (ex: 7711)

```

### 2. Assigner les langues aux pages

```jsx
// Assigner "English" à la page EN
wp_add_post_terms({
  ID: ID_EN,
  taxonomy: "language",
  terms: [4],
  append: false
})

// Assigner "Français" à la page FR
wp_add_post_terms({
  ID: ID_FR,
  taxonomy: "language",
  terms: [7],
  append: false
})

```

### 3. Créer un terme de traduction unique

```jsx
// Générer un nom unique pour le terme (pattern Polylang)
const termName = `pll_${Date.now().toString(16)}${Math.random().toString(36).substr(2, 9)}`
// Exemple: "pll_671e9a5b8f2d4"

wp_create_term({
  taxonomy: "post_translations",
  term_name: termName
})
// Retourne TERM_ID (ex: 234)

```

### 4. Assigner le terme aux deux pages

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

### 5. CRUCIAL : Mettre à jour la description du terme avec les IDs

```jsx
// Créer la chaîne sérialisée PHP contenant les IDs
const description = `a:2:{s:2:"en";i:${ID_EN};s:2:"fr";i:${ID_FR};}`
// Exemple: "a:2:{s:2:"en";i:7710;s:2:"fr";i:7711;}"

wp_update_term({
  term_id: TERM_ID,
  taxonomy: "post_translations",
  description: description
})

```

## Résultat attendu

- ✅ Page EN accessible via `/artists/nom-artiste/`
- ✅ Page FR accessible via `/fr/artistes/nom-artiste/`
- ✅ Drapeaux FR/EN fonctionnels sur chaque page
- ✅ Navigation entre les deux versions
- ✅ Plus de symbole `+` dans l'admin WordPress

## Format de la description sérialisée

```php
a:2:{
  s:2:"en";  // string de longueur 2 ("en")
  i:7710;    // integer ID de la page EN
  s:2:"fr";  // string de longueur 2 ("fr")
  i:7711;    // integer ID de la page FR
}

```

## Notes importantes

- **L'étape 5 est CRITIQUE** : sans la description sérialisée, les pages ne seront pas liées
- Le nom du terme `post_translations` doit être unique (utiliser timestamp + random)
- Les termes de langue (4 et 7) sont fixes pour ce site
- Ne pas oublier `append: false` pour remplacer les termes existants