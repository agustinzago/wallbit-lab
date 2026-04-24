// Diccionario hardcodeado de merchants comunes. La clave es un substring en
// lowercase que se matchea contra el descriptor crudo normalizado. El primer
// match gana (orden de inserción en el Map), así que entries más específicas
// van primero si llegan a solaparse.
//
// Vale más tener este diccionario chico y curado que intentar cubrirlo todo:
// el objetivo es evitar llamadas a Claude Haiku para los ~80% de casos comunes,
// no clasificar exhaustivamente.

import type { MerchantInfo, ServiceCategory } from './types.js';

export type DictionaryEntry = Omit<MerchantInfo, 'rawDescriptor' | 'confidence'>;

export const MERCHANT_DICTIONARY: ReadonlyMap<string, DictionaryEntry> = new Map<
  string,
  DictionaryEntry
>([
  // Entertainment
  ['netflix', mk('Netflix', 'entertainment', 'video-streaming')],
  ['spotify', mk('Spotify', 'entertainment', 'music-streaming')],
  ['youtube', mk('YouTube Premium', 'entertainment', 'video-streaming')],
  ['disney', mk('Disney+', 'entertainment', 'video-streaming')],
  ['hbo', mk('HBO / Max', 'entertainment', 'video-streaming')],
  ['paramount', mk('Paramount+', 'entertainment', 'video-streaming')],

  // Cloud storage / platforms
  ['apple.com/bill', mk('Apple (iCloud/Services)', 'cloud_storage', 'cloud-storage')],
  ['google', mk('Google (Workspace/One)', 'cloud_storage', 'cloud-storage')],
  ['dropbox', mk('Dropbox', 'cloud_storage', 'cloud-storage')],

  // AI tools
  ['openai', mk('ChatGPT / OpenAI', 'ai_tools', 'ai-assistant')],
  ['anthropic', mk('Claude / Anthropic', 'ai_tools', 'ai-assistant')],
  ['midjourney', mk('Midjourney', 'ai_tools', 'ai-image')],
  ['perplexity', mk('Perplexity', 'ai_tools', 'ai-assistant')],

  // Development / hosting
  ['github', mk('GitHub', 'development', 'code-hosting')],
  ['vercel', mk('Vercel', 'development', 'hosting')],
  ['cloudflr', mk('Cloudflare', 'development', 'hosting')],
  ['cloudflare', mk('Cloudflare', 'development', 'hosting')],
  ['railway', mk('Railway', 'development', 'hosting')],
  ['cursor', mk('Cursor', 'development', 'ai-coding')],

  // Productivity
  ['notion', mk('Notion', 'productivity', 'note-taking')],
  ['obsidian', mk('Obsidian Sync', 'productivity', 'note-taking')],
  ['linear', mk('Linear', 'productivity', 'project-mgmt')],

  // Design
  ['figma', mk('Figma', 'design', 'design')],
  ['canva', mk('Canva', 'design', 'design')],
  ['adobe', mk('Adobe', 'design', 'design')],

  // Communication
  ['zoom', mk('Zoom', 'communication', 'video-calls')],
  ['slack', mk('Slack', 'communication', 'team-chat')],
  ['discord', mk('Discord Nitro', 'communication', 'team-chat')],

  // Security
  ['1password', mk('1Password', 'security', 'password-manager')],
  ['lastpass', mk('LastPass', 'security', 'password-manager')],
  ['nordvpn', mk('NordVPN', 'security', 'vpn')],
  ['expressvpn', mk('ExpressVPN', 'security', 'vpn')],
]);

function mk(
  normalizedName: string,
  category: ServiceCategory,
  functionalGroup: string,
): DictionaryEntry {
  return {
    normalizedName,
    category,
    isSaasSubscription: true,
    functionalGroup,
  };
}

// Match fuzzy simple: si el descriptor (lowercase) contiene alguna key del
// diccionario, devolvemos su entry. Sin regex, sin Levenshtein — solo substring.
export function lookupMerchant(descriptor: string): DictionaryEntry | undefined {
  const lower = descriptor.toLowerCase();
  for (const [key, entry] of MERCHANT_DICTIONARY) {
    if (lower.includes(key)) return entry;
  }
  return undefined;
}
