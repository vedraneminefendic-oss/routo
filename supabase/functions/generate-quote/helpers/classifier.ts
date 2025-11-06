// ============================================
// CLASSIFIER - Generell work item-klassificering
// ============================================

export interface WorkItemClassification {
  domain: string;        // el, tiles, plumbing, etc.
  component?: string;    // installation, golvvarme, wall, floor
  surface?: string;      // vagg, golv, tak
}

// Token-baserad matchning för att undvika substring-problem
export function hasWord(text: string, word: string): boolean {
  if (!text || !word) return false;
  const pattern = new RegExp(`\\b${word}\\b`, 'i');
  return pattern.test(text);
}

// Svenska böjningar och synonymer
const DOMAIN_PATTERNS: Record<string, { keywords: string[]; aliases: string[] }> = {
  el: {
    keywords: ['el', 'elinstallation', 'el-installation', 'elektricitet', 'elektriker', 'eluttag', 'strömbrytare'],
    aliases: ['elektricitet', 'elektriker']
  },
  tiles: {
    keywords: ['kakel', 'klinker', 'kakelsättning', 'kakelsätt', 'klinkersättning', 'klinkersätt', 'plattor'],
    aliases: ['kakelsätt', 'klinkersätt', 'plattor']
  },
  plumbing: {
    keywords: ['vvs', 'rör', 'avlopp', 'vatten', 'sanitär', 'kranar'],
    aliases: ['rör', 'sanitär']
  },
  ventilation: {
    keywords: ['ventilation', 'fläkt', 'frånluft', 'tilluft', 'luft'],
    aliases: ['fläkt', 'luft']
  },
  waterproofing: {
    keywords: ['tätskikt', 'membran', 'folie', 'vattenisolering'],
    aliases: ['membran', 'folie', 'vattenisolering']
  },
  painting: {
    keywords: ['målning', 'måla', 'färg', 'lackering', 'spackling'],
    aliases: ['måla', 'färg', 'lacka']
  },
};

const COMPONENT_PATTERNS: Record<string, string[]> = {
  installation: ['installation', 'installera', 'montera', 'montage'],
  golvvarme: ['golvvärme', 'golvvarme', 'uppvärmning golv'],
  removal: ['rivning', 'demontering', 'ta bort', 'riva'],
  wall: ['vägg', 'väggar'],
  floor: ['golv'],
  ceiling: ['tak'],
};

const SURFACE_PATTERNS: Record<string, string[]> = {
  vagg: ['vägg', 'väggar'],
  golv: ['golv'],
  tak: ['tak'],
};

export function classifyWorkItem(
  name: string,
  description?: string,
  context?: string
): WorkItemClassification {
  const text = `${name} ${description || ''} ${context || ''}`.toLowerCase();
  
  // Detect domain
  let domain = 'other';
  for (const [key, pattern] of Object.entries(DOMAIN_PATTERNS)) {
    for (const keyword of [...pattern.keywords, ...pattern.aliases]) {
      if (hasWord(text, keyword)) {
        domain = key;
        break;
      }
    }
    if (domain !== 'other') break;
  }
  
  // Special case: "kakel" vs "klinker"
  if (domain === 'tiles') {
    if (hasWord(text, 'klinker') && !hasWord(text, 'kakel')) {
      domain = 'tiles'; // Still tiles domain
    }
  }
  
  // Detect component
  let component: string | undefined;
  for (const [key, keywords] of Object.entries(COMPONENT_PATTERNS)) {
    for (const keyword of keywords) {
      if (hasWord(text, keyword)) {
        component = key;
        break;
      }
    }
    if (component) break;
  }
  
  // Detect surface
  let surface: string | undefined;
  for (const [key, keywords] of Object.entries(SURFACE_PATTERNS)) {
    for (const keyword of keywords) {
      if (hasWord(text, keyword)) {
        surface = key;
        break;
      }
    }
    if (surface) break;
  }
  
  // Special handling for el domain
  if (domain === 'el') {
    if (hasWord(text, 'golvvärme') || hasWord(text, 'golvvarme')) {
      component = 'golvvarme';
    } else if (!component) {
      component = 'installation';
    }
  }
  
  // Special handling for tiles domain
  if (domain === 'tiles') {
    if (hasWord(text, 'klinker') && !hasWord(text, 'kakel')) {
      component = 'klinker';
      surface = surface || 'golv';
    } else if (hasWord(text, 'kakel')) {
      component = 'kakel';
      surface = surface || 'vagg';
    }
  }
  
  console.log(`🧭 Classifier: "${name}" → domain=${domain}, component=${component || '-'}, surface=${surface || '-'}`);
  
  return { domain, component, surface };
}

// Build canonical key from classification
export function buildCanonicalKey(cls: WorkItemClassification, standardJobType?: string): string {
  if (standardJobType) {
    return `${standardJobType}:${cls.component || 'general'}`;
  }
  return `${cls.domain}:${cls.component || 'general'}:${cls.surface || '-'}`;
}
