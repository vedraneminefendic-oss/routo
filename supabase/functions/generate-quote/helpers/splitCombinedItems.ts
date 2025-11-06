// FIX-HOURS-V4: Split combined "kakel och klinker" items into separate work items
// This runs BEFORE normalizeAndMergeDuplicates to ensure clean separation

import { findStandard, calculateTimeFromStandard } from './industryStandards.ts';

export function splitCombinedItems(
  quote: any,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  projectType?: string
): any {
  const items = quote?.workItems || [];
  const expanded: any[] = [];
  
  for (const item of items) {
    const name = (item.name || item.workItemName || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    
    // Om både "kakel" OCH "klinker" nämns i NAMNET eller BESKRIVNINGEN
    const hasKakel = name.includes('kakel') || desc.includes('kakel');
    const hasKlinker = name.includes('klinker') || desc.includes('klinker');
    
    if (hasKakel && hasKlinker) {
      console.log(`✂️ Splitting combined item: "${item.name || item.workItemName}"`);
      
      // Dela upp i två separata poster
      const kakelStd = findStandard('Kakel vägg', { jobType: projectType });
      const klinkerStd = findStandard('Klinker golv', { jobType: projectType });
      
      // Beräkna timmar baserat på standard och mått
      const kakelHours = kakelStd 
        ? calculateTimeFromStandard(kakelStd, measurements)
        : 8.8; // Fallback
      const klinkerHours = klinkerStd 
        ? calculateTimeFromStandard(klinkerStd, measurements)
        : 11.2; // Fallback
      
      // Använd existerande hourlyRate eller standard
      const hourlyRate = item.hourlyRate || kakelStd?.hourlyRate?.standard || 850;
      
      // Lägg till kakel-post
      expanded.push({
        ...item,
        name: 'Kakel vägg',
        workItemName: 'Kakel vägg',
        hours: kakelHours,
        estimatedHours: kakelHours,
        hourlyRate,
        subtotal: Math.round(kakelHours * hourlyRate),
        description: 'Kakelsättning av väggar',
        reasoning: `[UPPDELAD från "${item.name || item.workItemName}"] Baserat på ${measurements.area || 'okänt'} kvm`
      });
      
      // Lägg till klinker-post
      expanded.push({
        ...item,
        name: 'Klinker golv',
        workItemName: 'Klinker golv',
        hours: klinkerHours,
        estimatedHours: klinkerHours,
        hourlyRate,
        subtotal: Math.round(klinkerHours * hourlyRate),
        description: 'Klinkersättning av golv',
        reasoning: `[UPPDELAD från "${item.name || item.workItemName}"] Baserat på ${measurements.area || 'okänt'} kvm`
      });
      
      console.log(`  → Kakel vägg: ${kakelHours.toFixed(1)}h`);
      console.log(`  → Klinker golv: ${klinkerHours.toFixed(1)}h`);
      
    } else {
      // Behåll original om inte kombinerad
      expanded.push(item);
    }
  }
  
  return { ...quote, workItems: expanded };
}
