/**
 * FLAG DETECTOR - Detekterar viktiga användarmönster i konversation
 * 
 * Denna modul analyserar konversationshistorik och beskrivning för att detektera:
 * 1. customerProvidesMaterial - kunden står för material (kök, vitvaror, etc)
 * 2. noComplexity - inga särskilda hinder eller komplexitet
 * 
 * Används av pipeline för att automatiskt justera offerten.
 */

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DetectedFlags {
  customerProvidesMaterial: boolean;
  noComplexity: boolean;
  customerProvidesDetails?: {
    materials: string[];
    patterns: string[];
  };
  noComplexityDetails?: {
    patterns: string[];
  };
}

/**
 * Detektera om kunden står för material
 */
export function detectCustomerProvidesMaterial(
  conversationHistory: Message[],
  description: string
): { detected: boolean; materials: string[]; patterns: string[] } {
  
  const allText = [
    description,
    ...conversationHistory.map(m => m.content)
  ].join(' ').toLowerCase();

  // Mönster för "kund står för material"
  const patterns = [
    // Kök och vitvaror
    /(?:kund(?:en)?|vi|jag)\s+(?:står\s+för|köper|ordnar|fixar|skaffar|tillhandahåller)\s+(?:själva?\s+)?(?:köket|köksinredning|köksskåp|vitvaror|vitvarorna|köksutrustning)/i,
    /(?:köket|vitvaror(?:na)?|köksinredning(?:en)?)\s+(?:ingår\s+)?(?:inte|ej|icke)/i,
    /(?:köket|vitvaror(?:na)?)\s+(?:är|kommer)\s+(?:kundens|min|vår)\s+(?:ansvar|sak)/i,
    
    // Generellt material
    /(?:kund(?:en)?|vi|jag)\s+(?:står\s+för|köper|ordnar|skaffar)\s+(?:alla?\s+)?(?:material(?:en)?|tillbehör)/i,
    /material(?:en)?\s+(?:ingår\s+)?(?:inte|ej|icke)/i,
    /(?:endast|bara)\s+(?:montering|installation|arbete)/i,
    
    // Specifika varugrupper
    /(?:kund(?:en)?|vi|jag)\s+(?:har|äger)\s+(?:redan|egna?)\s+(?:material|kakel|färg|trä)/i,
  ];

  const matchedPatterns: string[] = [];
  const materials: string[] = [];

  // Kör alla mönster
  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match) {
      matchedPatterns.push(match[0]);
      
      // Extrahera vilka material som nämns
      if (match[0].includes('kök')) materials.push('kök');
      if (match[0].includes('vitvaror')) materials.push('vitvaror');
      if (match[0].includes('kakel')) materials.push('kakel');
      if (match[0].includes('färg')) materials.push('färg');
      if (match[0].includes('material')) materials.push('material (generellt)');
    }
  }

  const detected = matchedPatterns.length > 0;
  
  if (detected) {
    console.log(`🏷️ FLAG DETECTED: customerProvidesMaterial = true`);
    console.log(`   Materials: ${materials.join(', ')}`);
    console.log(`   Patterns matched: ${matchedPatterns.length}`);
  }

  return {
    detected,
    materials: [...new Set(materials)], // Remove duplicates
    patterns: matchedPatterns
  };
}

/**
 * Detektera om kunden bekräftat "ingen komplexitet"
 */
export function detectNoComplexity(
  conversationHistory: Message[],
  description: string
): { detected: boolean; patterns: string[] } {
  
  const allText = [
    description,
    ...conversationHistory.map(m => m.content)
  ].join(' ').toLowerCase();

  // Mönster för "nej, inget som gör det svårare"
  const patterns = [
    // Direkta "nej"-svar
    /(?:nej|nä|nejdå|nope)\s*[,.]?\s*(?:inget|ingenting)?\s*(?:som|gör|det)?\s*(?:svårare|svårt|komplicerat|speciellt|särskilt)/i,
    /(?:nej|nä|nejdå)\s*[,.]?\s*(?:inga|inte\s+några?)\s*(?:konstigheter|problem|hinder|svårigheter)/i,
    
    // Bekräftelser på enkelhet
    /(?:inget|ingenting|inga)\s+(?:särskilt|speciellt|konstigt)/i,
    /(?:ganska|rätt|helt)\s+(?:enkelt|straightforward|rakt fram)/i,
    /(?:inga?|inte\s+några?)\s+(?:problem|hinder|svårigheter|konstigheter)/i,
    
    // "Standard"-bekräftelser
    /(?:standard|normal|vanlig)\s+(?:installation|montering|situation)/i,
    /(?:allt|det)\s+(?:är|verkar)\s+(?:standard|normalt|ok)/i,
  ];

  const matchedPatterns: string[] = [];

  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match) {
      matchedPatterns.push(match[0]);
    }
  }

  const detected = matchedPatterns.length > 0;
  
  if (detected) {
    console.log(`🏷️ FLAG DETECTED: noComplexity = true`);
    console.log(`   Patterns matched: ${matchedPatterns.length}`);
    console.log(`   Examples: ${matchedPatterns.slice(0, 2).join(', ')}`);
  }

  return {
    detected,
    patterns: matchedPatterns
  };
}

/**
 * Huvudfunktion: Detektera alla flags på en gång
 */
export function detectFlags(
  conversationHistory: Message[],
  description: string
): DetectedFlags {
  
  console.log('\n🏷️ ===== FLAG DETECTOR: Analyzing conversation =====');
  
  const customerMaterial = detectCustomerProvidesMaterial(conversationHistory, description);
  const noComplexity = detectNoComplexity(conversationHistory, description);

  const flags: DetectedFlags = {
    customerProvidesMaterial: customerMaterial.detected,
    noComplexity: noComplexity.detected
  };

  if (customerMaterial.detected) {
    flags.customerProvidesDetails = {
      materials: customerMaterial.materials,
      patterns: customerMaterial.patterns
    };
  }

  if (noComplexity.detected) {
    flags.noComplexityDetails = {
      patterns: noComplexity.patterns
    };
  }

  console.log(`\n🏷️ FLAG DETECTOR: Complete`);
  console.log(`   customerProvidesMaterial: ${flags.customerProvidesMaterial}`);
  console.log(`   noComplexity: ${flags.noComplexity}`);
  console.log('================================================\n');

  return flags;
}

/**
 * Hjälpfunktion: Filtrera bort material som kunden tillhandahåller
 */
export function filterCustomerProvidedMaterials(
  materials: any[],
  customerMaterials: string[]
): any[] {
  
  if (customerMaterials.length === 0) {
    return materials;
  }

  console.log(`🧹 Filtering customer-provided materials: ${customerMaterials.join(', ')}`);

  const filtered = materials.filter(material => {
    const name = (material.name || '').toLowerCase();
    
    // Om "kök" är kundens ansvar
    if (customerMaterials.includes('kök') || customerMaterials.includes('vitvaror')) {
      if (
        name.includes('kök') ||
        name.includes('skåp') ||
        name.includes('bänk') ||
        name.includes('spis') ||
        name.includes('ugn') ||
        name.includes('kyl') ||
        name.includes('frys') ||
        name.includes('diskmaskin') ||
        name.includes('fläkt') ||
        name.includes('vitvaror')
      ) {
        console.log(`   ❌ Removed: ${material.name} (customer provides)`);
        return false;
      }
    }

    // Om "kakel" är kundens ansvar
    if (customerMaterials.includes('kakel')) {
      if (name.includes('kakel') || name.includes('plattor') || name.includes('klinker')) {
        console.log(`   ❌ Removed: ${material.name} (customer provides)`);
        return false;
      }
    }

    // Om "färg" är kundens ansvar
    if (customerMaterials.includes('färg')) {
      if (name.includes('färg') || name.includes('målar')) {
        console.log(`   ❌ Removed: ${material.name} (customer provides)`);
        return false;
      }
    }

    // Om "material (generellt)" är kundens ansvar - ta bort allt material
    if (customerMaterials.includes('material (generellt)')) {
      console.log(`   ❌ Removed: ${material.name} (customer provides all materials)`);
      return false;
    }

    return true;
  });

  console.log(`🧹 Filtered ${materials.length - filtered.length} materials`);
  
  return filtered;
}
