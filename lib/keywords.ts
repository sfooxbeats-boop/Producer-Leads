// Keywords the app searches on Threads for each producer type.
// Add or remove keywords here to tune your lead quality over time.

export const KEYWORDS: Record<string, string[]> = {
  producer: [
    'need a producer',
    'looking for producer',
    'music producer needed',
    'need music production',
    'need a music producer',
  ],
  beatmaker: [
    'need beats',
    'looking for beats',
    'buy beats',
    'need a beatmaker',
    'need trap beats',
    'need drill beats',
    'need hip hop beats',
    'where can i buy beats',
    'need rnb beats',
  ],
  sound_engineer: [
    'need mixing',
    'need mastering',
    'need a mix engineer',
    'need sound engineer',
    'need someone to mix',
    'need vocals mixed',
    'audio engineer needed',
    'need my song mixed',
  ],
};

// Human-readable tag shown on each lead card
export const MATCH_TAGS: Record<string, string> = {
  producer: 'Production Needed',
  beatmaker: 'Beat Request',
  sound_engineer: 'Mixing / Mastering Needed',
};

export type Category = 'producer' | 'beatmaker' | 'sound_engineer';

export const CATEGORY_LABELS: Record<Category, string> = {
  producer: 'Music Producer',
  beatmaker: 'Beatmaker',
  sound_engineer: 'Sound Engineer',
};

export const GENRE_OPTIONS = [
  'Hip-Hop',
  'Trap',
  'Drill',
  'R&B',
  'Pop',
  'EDM',
  'Afrobeats',
  'Latin',
  'Rock',
  'Gospel',
];
