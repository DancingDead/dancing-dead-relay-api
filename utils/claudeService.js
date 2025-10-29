const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load the context file once at startup
const CONTEXT = fs.readFileSync(
  path.join(__dirname, '../claude-context.md'),
  'utf-8'
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Send a message to Claude with project context
 * @param {string} userPrompt - The specific task/question for Claude
 * @param {object} options - Additional options (model, max_tokens, etc.)
 */
async function askClaude(userPrompt, options = {}) {
  const {
    model = 'claude-sonnet-4-20250514',
    max_tokens = 1024,
    temperature = 1,
    includeContext = true,
  } = options;

  // Build the message with context
  const fullPrompt = includeContext
    ? `${CONTEXT}\n\n---\n\n${userPrompt}`
    : userPrompt;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    return {
      success: true,
      text: message.content[0].text,
      usage: message.usage,
    };
  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate an event description
 */
async function generateEventDescription(event) {
  const prompt = `Generate an engaging event description for:
- Type: ${event.type || 'Event'}
- Location: ${event.location || 'TBA'}
- Date: ${event.date || 'TBA'}

Write 2-3 sentences that will excite music fans.`;

  return askClaude(prompt, { max_tokens: 300 });
}

/**
 * Generate an artist bio
 */
async function generateArtistBio(artist) {
  const prompt = `Write a compelling 2-3 sentence artist bio for:
- Artist Name: ${artist.name}
- Genres: ${artist.genres?.join(', ') || 'Electronic'}
- Popularity: ${artist.popularity || 'N/A'}/100

Focus on their sound and what makes them unique.`;

  return askClaude(prompt, { max_tokens: 400 });
}

/**
 * Generate playlist description
 */
async function generatePlaylistDescription(playlist) {
  const prompt = `Create an exciting playlist description for:
- Playlist Name: ${playlist.name}
- Number of Tracks: ${playlist.trackCount || 'Multiple'}
- Featured Artists: ${playlist.artists?.slice(0, 5).join(', ') || 'Various'}

Write 1-2 sentences that capture the vibe.`;

  return askClaude(prompt, { max_tokens: 250 });
}

module.exports = {
  askClaude,
  generateEventDescription,
  generateArtistBio,
  generatePlaylistDescription,
};