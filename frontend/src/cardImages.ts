// Hero cards have hero_card images; champions use base_card
const HERO_KEYS = new Set([
  'knight',
  'giant',
  'mini-pekka',
  'musketeer',
  'mega-minion',
  'goblins',
  'wizard',
  'ice-golem',
  'barbarian-barrel',
  'magic-archer',
])

export const UNKNOWN_CARD_IMAGE_URL = '/images/base_card/unknown.png'

export function getCardImageUrl(cardKey: string, variant: 'base' | 'ability'): string {
  const base = '/images'
  if (variant === 'ability' && HERO_KEYS.has(cardKey)) {
    return `${base}/hero_card/${cardKey}.png`
  }
  return `${base}/base_card/${cardKey}.png`
}
