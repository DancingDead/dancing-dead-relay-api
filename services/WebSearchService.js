const fetch = require('node-fetch');

/**
 * Service de recherche web avec fallback
 * - Brave Search API (2000 requêtes/mois gratuit) - Priorité 1
 * - DuckDuckGo (gratuit illimité) - Fallback
 */
class WebSearchService {
  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    this.useBrave = !!this.braveApiKey;

    if (this.useBrave) {
      console.log('   🔍 Web Search: Using Brave Search API');
    } else {
      console.log('   🔍 Web Search: Using DuckDuckGo (no Brave API key)');
    }
  }

  /**
   * Recherche principale - essaie Brave, fallback sur DuckDuckGo
   */
  async search(query, maxResults = 5) {
    try {
      // Essayer Brave d'abord si disponible
      if (this.useBrave) {
        try {
          return await this.searchWithBrave(query, maxResults);
        } catch (braveError) {
          console.warn(`   ⚠️  Brave Search failed, falling back to DuckDuckGo: ${braveError.message}`);
          return await this.searchWithDuckDuckGo(query, maxResults);
        }
      } else {
        // Sinon utiliser DuckDuckGo directement
        return await this.searchWithDuckDuckGo(query, maxResults);
      }
    } catch (error) {
      console.error(`   ❌ Web search failed for "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Brave Search API
   */
  async searchWithBrave(query, maxResults = 5) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        'X-Subscription-Token': this.braveApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];

    return results.map(r => ({
      title: r.title,
      description: r.description,
      url: r.url,
      source: 'brave'
    }));
  }

  /**
   * DuckDuckGo (via HTML scraping léger)
   */
  async searchWithDuckDuckGo(query, maxResults = 5) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo error: ${response.status}`);
    }

    const html = await response.text();

    // Parser les résultats (extraction basique)
    const results = [];
    const regex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) && results.length < maxResults) {
      results.push({
        url: this.decodeDDGUrl(match[1]),
        title: this.decodeHtml(match[2]),
        description: this.decodeHtml(match[3]),
        source: 'duckduckgo'
      });
    }

    return results;
  }

  /**
   * Délai pour respecter le rate limit de Brave (1 req/sec)
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Recherche spécifique pour un artiste
   * Les recherches sont séquencées avec 60s entre chaque pour éviter la surcharge RAM
   */
  async searchArtist(artistName, genres = []) {
    const genresStr = genres.length > 0 ? genres.slice(0, 2).join(' ') : 'electronic music';

    console.log(`      🔎 Searching web for: ${artistName}...`);

    // Faire 3 recherches ciblées SÉQUENTIELLEMENT avec délais pour protéger la RAM
    console.log(`      📡 Search 1/3: Biography & Origin...`);
    const bioResults = await this.search(`${artistName} DJ producer ${genresStr} biography nationality origin`);
    console.log(`      ⏸️  RAM cleanup (60s)...`);
    await this.wait(60000); // Attendre 1 minute entre chaque requête

    console.log(`      📡 Search 2/3: Labels & Discography...`);
    const labelsResults = await this.search(`${artistName} ${genresStr} record labels releases discography`);
    console.log(`      ⏸️  RAM cleanup (60s)...`);
    await this.wait(60000);

    console.log(`      📡 Search 3/3: Performances & Collaborations...`);
    const performancesResults = await this.search(`${artistName} festivals performances achievements collaborations`);

    const allResults = {
      biography: bioResults,
      labels: labelsResults,
      performances: performancesResults
    };

    console.log(`      ✅ Found ${bioResults.length + labelsResults.length + performancesResults.length} web results`);

    return allResults;
  }

  /**
   * Decode DuckDuckGo redirect URL
   */
  decodeDDGUrl(ddgUrl) {
    try {
      const match = ddgUrl.match(/uddg=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : ddgUrl;
    } catch {
      return ddgUrl;
    }
  }

  /**
   * Decode HTML entities
   */
  decodeHtml(html) {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Formater les résultats pour Claude
   */
  formatForClaude(searchResults) {
    let formatted = '';

    if (searchResults.biography?.length > 0) {
      formatted += '=== BIOGRAPHY & BACKGROUND ===\n';
      searchResults.biography.forEach((r, i) => {
        formatted += `${i + 1}. ${r.title}\n   ${r.description}\n   Source: ${r.url}\n\n`;
      });
    }

    if (searchResults.labels?.length > 0) {
      formatted += '=== LABELS & RELEASES ===\n';
      searchResults.labels.forEach((r, i) => {
        formatted += `${i + 1}. ${r.title}\n   ${r.description}\n   Source: ${r.url}\n\n`;
      });
    }

    if (searchResults.performances?.length > 0) {
      formatted += '=== PERFORMANCES & ACHIEVEMENTS ===\n';
      searchResults.performances.forEach((r, i) => {
        formatted += `${i + 1}. ${r.title}\n   ${r.description}\n   Source: ${r.url}\n\n`;
      });
    }

    return formatted || 'No web results found.';
  }
}

module.exports = WebSearchService;
