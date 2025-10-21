import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Industry benchmarks for realistic pricing validation
const INDUSTRY_BENCHMARKS: Record<string, {
  avgMaterialPerSqm: number;
  avgWorkHoursPerSqm: number;
  minMaterial: number;
  workTypes: string[];
  avgTotalPerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
}> = {
  'badrum_renovering': {
    avgMaterialPerSqm: 3500,
    avgWorkHoursPerSqm: 12,
    minMaterial: 15000,
    workTypes: ['Plattsättare', 'VVS', 'Elektriker', 'Snickare'],
    avgTotalPerSqm: 20000,
    minPricePerSqm: 15000,
    maxPricePerSqm: 30000
  },
  'kok_renovering': {
    avgMaterialPerSqm: 4000,
    avgWorkHoursPerSqm: 10,
    minMaterial: 30000,
    workTypes: ['Snickare', 'Elektriker', 'VVS'],
    avgTotalPerSqm: 25000,
    minPricePerSqm: 20000,
    maxPricePerSqm: 40000
  },
  'altan': {
    avgMaterialPerSqm: 1500,
    avgWorkHoursPerSqm: 6,
    minMaterial: 8000,
    workTypes: ['Snickare'],
    avgTotalPerSqm: 3500,
    minPricePerSqm: 2500,
    maxPricePerSqm: 5000
  },
  'malning': {
    avgMaterialPerSqm: 50,
    avgWorkHoursPerSqm: 0.5,
    minMaterial: 3000,
    workTypes: ['Målare'],
    avgTotalPerSqm: 400,
    minPricePerSqm: 300,
    maxPricePerSqm: 600
  },
  'golvlaggning': {
    avgMaterialPerSqm: 400,
    avgWorkHoursPerSqm: 2,
    minMaterial: 8000,
    workTypes: ['Snickare'],
    avgTotalPerSqm: 1800,
    minPricePerSqm: 1200,
    maxPricePerSqm: 2500
  }
};

// Reality check validation against industry benchmarks
function performRealityCheck(
  quote: any,
  projectType: string,
  area?: number
): { valid: boolean; reason?: string } {
  const totalValue = quote.summary.totalBeforeVAT;
  
  // Map project description keywords to benchmark keys
  const projectLower = projectType.toLowerCase();
  let benchmarkKey: string | null = null;
  
  if (projectLower.includes('badrum') || projectLower.includes('våtrum')) {
    benchmarkKey = 'badrum_renovering';
  } else if (projectLower.includes('kök')) {
    benchmarkKey = 'kok_renovering';
  } else if (projectLower.includes('altan') || projectLower.includes('däck')) {
    benchmarkKey = 'altan';
  } else if (projectLower.includes('mål') || projectLower.includes('färg')) {
    benchmarkKey = 'malning';
  } else if (projectLower.includes('golv')) {
    benchmarkKey = 'golvlaggning';
  }
  
  if (!benchmarkKey || !area) {
    return { valid: true }; // Can't validate without benchmark or area
  }
  
  const benchmark = INDUSTRY_BENCHMARKS[benchmarkKey];
  const pricePerSqm = totalValue / area;
  
  if (pricePerSqm < benchmark.minPricePerSqm) {
    return {
      valid: false,
      reason: `Priset ${Math.round(pricePerSqm)} kr/m² är orealistiskt lågt för ${projectType}. Branschnorm: ${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/m². Kontrollera material och arbetstid.`
    };
  }
  
  if (pricePerSqm > benchmark.maxPricePerSqm * 1.5) {
    return {
      valid: false,
      reason: `Priset ${Math.round(pricePerSqm)} kr/m² är orealistiskt högt för ${projectType}. Branschnorm: ${benchmark.minPricePerSqm}-${benchmark.maxPricePerSqm} kr/m². Kontrollera om något dubbelräknats.`
    };
  }
  
  return { valid: true };
}

// Validation function to ensure AI output matches base totals
function validateQuoteOutput(quote: any, baseTotals: any, hourlyRatesByType?: { [workType: string]: number } | null, detailLevel?: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 1. Validate work hours by type
  const workHoursByType = new Map<string, number>();
  quote.workItems.forEach((item: any) => {
    const type = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
    workHoursByType.set(type, (workHoursByType.get(type) || 0) + item.hours);
  });
  
  Object.entries(baseTotals.workHours).forEach(([type, hours]) => {
    const actualHours = workHoursByType.get(type) || 0;
    const tolerance = 0.5;
    if (Math.abs(actualHours - (hours as number)) > tolerance) {
      errors.push(`${type}: Förväntade ${hours}h men fick ${actualHours}h`);
    }
  });
  
  // 2. Validate material cost
  const totalMaterialCost = quote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const costTolerance = 100;
  if (Math.abs(totalMaterialCost - expectedMaterialCost) > costTolerance) {
    errors.push(`Material: Förväntade ${expectedMaterialCost} kr men fick ${totalMaterialCost} kr`);
  }
  
  // 2b. Validate that NO materials have pricePerUnit = 0
  const materialsWithZeroPrice = quote.materials.filter((m: any) => m.pricePerUnit === 0 || m.subtotal === 0);
  if (materialsWithZeroPrice.length > 0) {
    errors.push(`Material med pris 0 kr: ${materialsWithZeroPrice.map((m: any) => m.name).join(', ')} - ALLA material MÅSTE ha realistiska priser!`);
  }
  
  // 3. Validate summary calculations
  const actualWorkCost = quote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  if (Math.abs(quote.summary.workCost - actualWorkCost) > 1) {
    errors.push('summary.workCost matchar inte summan av workItems');
  }
  
  if (Math.abs(quote.summary.materialCost - totalMaterialCost) > 1) {
    errors.push('summary.materialCost matchar inte summan av materials');
  }
  
  // 4. Validate hourly rates match user's custom rates
  if (hourlyRatesByType && Object.keys(hourlyRatesByType).length > 0) {
    quote.workItems.forEach((item: any) => {
      const workTypeName = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
      const expectedRate = hourlyRatesByType[workTypeName];
      
      if (expectedRate) {
        const tolerance = 1; // Allow 1 kr difference
        if (Math.abs(item.hourlyRate - expectedRate) > tolerance) {
          errors.push(`${workTypeName}: Förväntade timpris ${expectedRate} kr/h men fick ${item.hourlyRate} kr/h`);
        }
      }
    });
  }
  
  // 5. Validate detail level requirements
  if (detailLevel) {
    const workItemCount = quote.workItems.length;
    const materialCount = quote.materials.length;
    const notesLength = quote.notes?.length || 0;
    
    switch (detailLevel) {
      case 'quick':
        if (workItemCount < 2 || workItemCount > 3) {
          errors.push(`Quick: Ska ha 2-3 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 3 || materialCount > 5) {
          errors.push(`Quick: Ska ha 3-5 materialposter, har ${materialCount}`);
        }
        if (notesLength > 100) {
          errors.push(`Quick: Notes ska vara max 100 tecken, är ${notesLength}`);
        }
        break;
        
      case 'standard':
        if (workItemCount < 4 || workItemCount > 6) {
          errors.push(`Standard: Ska ha 4-6 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 5 || materialCount > 10) {
          errors.push(`Standard: Ska ha 5-10 materialposter, har ${materialCount}`);
        }
        if (notesLength < 200 || notesLength > 300) {
          errors.push(`Standard: Notes ska vara 200-300 tecken, är ${notesLength}`);
        }
        break;
        
      case 'detailed':
        if (workItemCount < 6 || workItemCount > 10) {
          errors.push(`Detailed: Ska ha 6-10 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 10 || materialCount > 15) {
          errors.push(`Detailed: Ska ha 10-15 materialposter, har ${materialCount}`);
        }
        if (notesLength < 500 || notesLength > 800) {
          errors.push(`Detailed: Notes ska vara 500-800 tecken, är ${notesLength}`);
        }
        if (!quote.notes?.includes('Fas ')) {
          errors.push('Detailed: Notes ska innehålla fasindelning (Fas 1, Fas 2...)');
        }
        break;
        
      case 'construction':
        if (workItemCount < 10 || workItemCount > 15) {
          errors.push(`Construction: Ska ha 10-15 arbetsposter, har ${workItemCount}`);
        }
        if (materialCount < 15 || materialCount > 25) {
          errors.push(`Construction: Ska ha 15-25 materialposter, har ${materialCount}`);
        }
        if (notesLength < 1200 || notesLength > 2000) {
          errors.push(`Construction: Notes ska vara 1200-2000 tecken, är ${notesLength}`);
        }
        const requiredTerms = ['projektledning', 'tidsplan', 'garanti', 'besiktning'];
        const missingTerms = requiredTerms.filter(term => 
          !quote.notes?.toLowerCase().includes(term)
        );
        if (missingTerms.length > 0) {
          errors.push(`Construction: Notes saknar: ${missingTerms.join(', ')}`);
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Auto-correct function to force mathematical consistency
function autoCorrectQuote(quote: any, baseTotals: any): any {
  const correctedQuote = JSON.parse(JSON.stringify(quote)); // Deep clone
  
  // Force correct work hours distribution
  Object.entries(baseTotals.workHours).forEach(([type, expectedHours]) => {
    const typeItems = correctedQuote.workItems.filter((item: any) => 
      item.name.startsWith(type + ' -') || item.name === type
    );
    
    if (typeItems.length > 0) {
      const totalActualHours = typeItems.reduce((sum: number, item: any) => sum + item.hours, 0);
      const ratio = (expectedHours as number) / totalActualHours;
      
      typeItems.forEach((item: any) => {
        item.hours = Math.round(item.hours * ratio * 10) / 10;
        item.subtotal = item.hours * item.hourlyRate;
      });
    }
  });
  
  // Force correct material cost
  const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
  const actualMaterialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  
  if (actualMaterialCost > 0) {
    const materialRatio = expectedMaterialCost / actualMaterialCost;
    correctedQuote.materials.forEach((item: any) => {
      item.subtotal = Math.round(item.subtotal * materialRatio);
      item.pricePerUnit = Math.round(item.subtotal / item.quantity);
    });
  }
  
  // Recalculate summary
  correctedQuote.summary.workCost = correctedQuote.workItems.reduce((sum: number, w: any) => sum + w.subtotal, 0);
  correctedQuote.summary.materialCost = correctedQuote.materials.reduce((sum: number, m: any) => sum + m.subtotal, 0);
  correctedQuote.summary.totalBeforeVAT = correctedQuote.summary.workCost + correctedQuote.summary.materialCost;
  correctedQuote.summary.vat = Math.round(correctedQuote.summary.totalBeforeVAT * 0.25);
  correctedQuote.summary.totalWithVAT = correctedQuote.summary.totalBeforeVAT + correctedQuote.summary.vat;
  
  return correctedQuote;
}

// Industry standard validation
function validateRealism(quote: any, description: string): string[] {
  const warnings: string[] = [];
  const descLower = description.toLowerCase();
  
  // Bathroom renovation should take at least 30h
  if ((descLower.includes('badrum') || descLower.includes('våtrum')) && 
      descLower.includes('renovering')) {
    const totalHours = quote.workItems.reduce((sum: number, w: any) => sum + w.hours, 0);
    if (totalHours < 30) {
      warnings.push(`Badrumsrenovering: ${totalHours}h verkar orealistiskt lågt (branschstandard: 40-80h)`);
    }
  }
  
  // Tree felling should cost at least 800 kr/h
  if (descLower.includes('träd') && (descLower.includes('fälla') || descLower.includes('fällning'))) {
    const treeWorkItem = quote.workItems.find((w: any) => 
      w.name.toLowerCase().includes('träd') || w.name.toLowerCase().includes('arborist')
    );
    if (treeWorkItem && treeWorkItem.hourlyRate < 800) {
      warnings.push(`Trädfällning: ${treeWorkItem.hourlyRate} kr/h är för lågt (branschstandard: 800-1200 kr/h)`);
    }
  }
  
  // Cleaning should not use carpenter rates
  if ((descLower.includes('städ') || descLower.includes('rengör')) && 
      !descLower.includes('renovering')) {
    const carpenterItem = quote.workItems.find((w: any) => 
      w.name.toLowerCase().includes('snickare')
    );
    if (carpenterItem) {
      warnings.push('Städning kräver inte snickare - kontrollera arbetstyper');
    }
  }
  
  return warnings;
}

// Pre-flight check: Validate context before generating quote
async function performPreflightCheck(
  description: string,
  conversationHistory: any[] | undefined,
  apiKey: string
): Promise<{ valid: boolean; errors: string[]; projectType?: string }> {
  console.log('🛫 Running pre-flight check...');
  
  const userRequest = conversationHistory && conversationHistory.length > 0
    ? conversationHistory.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' → ')
    : description;
  
  const checkPrompt = `Analysera följande kundförfrågan och identifiera vad de FAKTISKT ber om.

Kundförfrågan: "${userRequest}"

Returnera JSON:
{
  "projectType": "målning|altan|kök|badrum|städning|trädfällning|trädgård|annat",
  "confidence": 0.0-1.0,
  "keywords": ["lista", "av", "nyckelord"],
  "potentialConflicts": ["eventuella motsägelser i förfrågan"]
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: checkPrompt },
          { role: 'user', content: userRequest }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    });

    if (!response.ok) {
      console.error('Pre-flight check API error:', response.status);
      return { valid: true, errors: [] }; // Fallback: allow generation
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    console.log('Pre-flight result:', result);
    
    // Check for low confidence or conflicts
    if (result.confidence < 0.5) {
      return {
        valid: false,
        errors: [`Osäker projekttyp (${Math.round(result.confidence * 100)}% säkerhet). Be om mer specifika detaljer.`],
        projectType: result.projectType
      };
    }
    
    if (result.potentialConflicts && result.potentialConflicts.length > 0) {
      return {
        valid: false,
        errors: result.potentialConflicts,
        projectType: result.projectType
      };
    }
    
    console.log(`✅ Pre-flight OK: Projekttyp "${result.projectType}" (${Math.round(result.confidence * 100)}%)`);
    return { valid: true, errors: [], projectType: result.projectType };
    
  } catch (error) {
    console.error('Pre-flight check error:', error);
    return { valid: true, errors: [] }; // Fallback: allow generation
  }
}

async function calculateBaseTotals(
  description: string, 
  apiKey: string,
  hourlyRates: any[] | null,
  equipmentRates: any[] | null
): Promise<{
  workHours: any;
  materialCost: number;
  equipmentCost: number;
  hourlyRatesByType: { [workType: string]: number };
}> {
  const ratesContext = hourlyRates && hourlyRates.length > 0
    ? `Timpriserna är: ${hourlyRates.map(r => `${r.work_type}: ${r.rate} kr/h`).join(', ')}`
    : 'Standardpris: 650 kr/h';

  const equipmentContext = equipmentRates && equipmentRates.length > 0
    ? `\n\nTillgänglig utrustning: ${equipmentRates.map(e => `${e.name} (${e.price_per_day || e.price_per_hour} kr/${e.price_per_day ? 'dag' : 'tim'})`).join(', ')}`
    : '';

  const equipmentKnowledge = `

BRANSCH-STANDARD VERKTYG/MASKINER (lägg alltid till dessa om relevant):

Arborist/Trädfällning:
- Motorsåg: 200-300 kr/tim (ägd) eller 800-1200 kr/dag (hyrd)
- Flishugg: 1500-2500 kr/dag (hyrd)
- Säkerhetsutrustning: 500 kr (engångskostnad)

Grävarbete/Markarbete:
- Minigrävare (1-3 ton): 800-1200 kr/dag
- Grävmaskin (5+ ton): 1500-2500 kr/dag

Kakel/Plattsättning:
- Kakelskärare: 150 kr/dag (hyrd)
- Blandare/mixxer: 100 kr/dag (hyrd)

Målning/Fasadarbete:
- Ställning: 200-400 kr/dag per sektion
- Sprututrustning: 300-500 kr/dag (hyrd)

Om användaren INTE har lagt in dessa verktyg i sina inställningar,
lägg ändå till dem i equipmentCost med branschstandardpriser.
`;

  const materialPriceKnowledge = `

**═══════════════════════════════════════════════════════════════**
**KRITISKT - MATERIAL MÅSTE ALLTID HA REALISTISKA PRISER!**
**═══════════════════════════════════════════════════════════════**

**VIKTIGA REGLER:**
1. materialCost FÅR ALDRIG vara 0 för renoveringsprojekt!
2. Använd chain-of-thought: "Vad behövs? → Räkna ut kvantitet → Uppskattar pris per enhet → Summera"
3. Om du är osäker, använd 30-40% av arbetskostnaden som estimat

**CHAIN-OF-THOUGHT EXEMPEL:**
Projekt: "Renovera badrum 5 kvm, mellan-nivå"
→ Tänk: "Vad behöver ett badrum?"
→ Kakel på väggar: 5 kvm vägg × 375 kr/kvm = 1875 kr
→ Klinker på golv: 5 kvm golv × 425 kr/kvm = 2125 kr
→ VVS: rör + kopplingar + kranar = 6000 kr
→ El: kablar + dosor = 3000 kr
→ Tätskikt: 1500 kr
→ Golvvärme: 4250 kr
→ Fästmassor och fog: 1500 kr
→ TOTAL: 20 250 kr ✅

Projekt: "Bygga altandäck 25 kvm, budget"
→ Tänk: "Vad behövs för ett däck?"
→ Virke konstruktion: 25 kvm × 300 kr/kvm = 7500 kr
→ Däckbräder: 25 kvm × 200 kr/kvm = 5000 kr
→ Räcke: 15 löpmeter × 650 kr/m = 9750 kr
→ Trappa: 4000 kr
→ Skruv och beslag: 2500 kr
→ TOTAL: 28 750 kr ✅

**DETALJERADE PRISGUIDER PER PROJEKTTYP:**

BADRUMSRENOVERING (per kvm):
═══════════════════════════════════════════════════════════════
Budget-nivå (ex: 5 kvm):
• Kakel vägg: 150-250 kr/kvm → 5 kvm = 1000 kr
• Klinker golv: 200-300 kr/kvm → 5 kvm = 1250 kr
• Tätskikt: 800-1200 kr totalt
• VVS-material (rör, kopplingar): 3000-5000 kr
• El-material (kablar, dosor): 1500-2500 kr
• Golvvärmesystem: 2000-3500 kr
• Fästmassor och fog: 800-1200 kr
→ TOTAL: 10 000-15 000 kr

Mellan-nivå (ex: 5 kvm):
• Kakel vägg: 300-450 kr/kvm → 5 kvm = 1875 kr
• Klinker golv: 350-500 kr/kvm → 5 kvm = 2125 kr
• Tätskikt: 1200-1800 kr totalt
• VVS-material: 5000-7000 kr
• El-material: 2500-3500 kr
• Golvvärmesystem: 3500-5000 kr
• Fästmassor och fog: 1200-1800 kr
→ TOTAL: 18 000-25 000 kr

Premium (ex: 5 kvm):
• Kakel vägg: 500-800 kr/kvm → 5 kvm = 3250 kr
• Klinker golv: 600-900 kr/kvm → 5 kvm = 3750 kr
• Tätskikt: 1800-2500 kr totalt
• VVS-material premium: 7000-10000 kr
• El-material premium: 3500-5000 kr
• Golvvärmesystem premium: 5000-7000 kr
• Fästmassor och fog premium: 1800-2500 kr
→ TOTAL: 28 000-38 000 kr

ALTANBYGGE (per kvm):
═══════════════════════════════════════════════════════════════
Budget tryckimpregnerat (ex: 25 kvm):
• Virke konstruktion (reglar, bärbalkar): 250-350 kr/kvm → 25 kvm = 7500 kr
• Altangolv (däckbräder): 150-250 kr/kvm → 25 kvm = 5000 kr
• Räcke (stolpar, spjälor): 500-800 kr/löpmeter → 15m = 10500 kr
• Trappa: 3000-5000 kr
• Fästmaterial (skruv, beslag): 2000-3000 kr
→ TOTAL: 28 000-36 000 kr

Mellan-nivå (ex: 25 kvm):
• Virke konstruktion: 350-450 kr/kvm → 25 kvm = 10000 kr
• Altangolv premium: 250-350 kr/kvm → 25 kvm = 7500 kr
• Räcke premium: 800-1200 kr/löpmeter → 15m = 15000 kr
• Trappa: 5000-7000 kr
• Fästmaterial: 3000-4000 kr
→ TOTAL: 40 500-53 500 kr

MÅLNING (rum):
═══════════════════════════════════════════════════════════════
Budget färg (ex: 120 kvm yta):
• Vägfärg: 80-120 kr/liter → 30 liter = 3000 kr
• Spackel: 500-800 kr
• Grundfärg: 1000-1500 kr
• Målartejp, presenning: 500-800 kr
→ TOTAL: 5 000-6 500 kr

Mellan-nivå (ex: 120 kvm yta):
• Vägfärg premium: 150-200 kr/liter → 30 liter = 5250 kr
• Spackel premium: 800-1200 kr
• Grundfärg: 1500-2000 kr
• Målartillbehör: 800-1200 kr
→ TOTAL: 8 500-10 500 kr

GOLVLÄGGNING:
═══════════════════════════════════════════════════════════════
Laminat budget (ex: 40 kvm):
• Laminatgolv: 150-250 kr/kvm → 40 kvm = 8000 kr
• Underlag: 50-80 kr/kvm → 40 kvm = 2600 kr
• Sockel: 30-50 kr/löpmeter → 30m = 1200 kr
→ TOTAL: 11 800 kr

Trägolv mellan (ex: 40 kvm):
• Trägolv: 400-600 kr/kvm → 40 kvm = 20000 kr
• Underlag: 80-120 kr/kvm → 40 kvm = 4000 kr
• Sockel: 60-80 kr/löpmeter → 30m = 2100 kr
→ TOTAL: 26 100 kr

**FALLBACK-REGEL:**
Om du inte hittar exakt projekttyp i guiderna ovan:
→ Använd denna formel: materialCost = arbetskostnad × 0.35 (35%)
→ Förklaring: Material är typiskt 30-40% av arbetskostnaden i de flesta renoveringsprojekt
`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Du beräknar ENDAST total arbetstid och materialkostnad för projekt. 

${equipmentKnowledge}

${materialPriceKnowledge}

VIKTIGT: Identifiera vilka FAKTISKA arbetstyper som krävs för detta uppdrag.

Exempel:
- Städning → "Städare"
- Fönsterputsning → "Fönsterputsare"
- Trädfällning → "Arborist" eller "Trädvård"
- Badrumsrenovering → "Snickare", "VVS", "Elektriker", "Plattsättare"
- Målning → "Målare"
- Gräsklippning → "Trädgårdsskötare"
- Altanbygge → "Snickare"

${ratesContext}${equipmentContext}

Returnera ENDAST JSON i detta format:
{
  "workHours": { "Städare": 8, "Fönsterputsare": 2 },
  "materialCost": 5000,
  "equipmentCost": 0
}

**═══════════════════════════════════════════════════════════════**
**KRITISKA REGLER - FÖLJ DESSA EXAKT:**
**═══════════════════════════════════════════════════════════════**

1. **workHours:** Total arbetstid per FAKTISK arbetstyp som projektet kräver (svenska yrkestitlar)

2. **materialCost:** MÅSTE VARA REALISTISKT! FÅR ALDRIG vara 0 för renovering/byggprojekt!
   → Använd chain-of-thought (se exempel ovan)
   → Om osäker: materialCost = arbetskostnad × 0.35

3. **equipmentCost:** Kostnad för maskiner/utrustning (0 om inget behövs)

4. **Var specifik med arbetstyper** - använd INTE "Snickare" för städning!

**KORREKTA EXEMPEL:**
─────────────────────────────────────────────────────────────────
Input: "Renovera badrum 5 kvm, mellan-nivå"
→ workHours: {"Plattsättare": 12, "VVS": 8, "Elektriker": 4}
→ materialCost: 21500 (följ chain-of-thought ovan)
→ equipmentCost: 0
✅ KORREKT!

Input: "Bygga altandäck 25 kvm, tryckimpregnerat"
→ workHours: {"Snickare": 40}
→ materialCost: 32000 (följ prisguiden)
→ equipmentCost: 0
✅ KORREKT!

Input: "Måla 3 rum (ca 120 kvm yta), budget"
→ workHours: {"Målare": 16}
→ materialCost: 5500 (följ prisguiden)
→ equipmentCost: 0
✅ KORREKT!

**FELAKTIGA EXEMPEL (GÖR ALDRIG SÅHÄR):**
─────────────────────────────────────────────────────────────────
Input: "Renovera badrum 5 kvm"
→ materialCost: 0
❌ FEL! Badrumsrenovering MÅSTE ha material!

Input: "Bygga altan"
→ materialCost: 0
❌ FEL! Altanbygge MÅSTE ha virke och material!`
        },
        {
          role: 'user',
          content: `Beräkna totaler för: "${description}"`
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to calculate base totals: ${response.status}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  
  // Map hourly rates to dictionary for easier validation
  const hourlyRatesByType: { [key: string]: number } = {};
  if (hourlyRates && hourlyRates.length > 0) {
    hourlyRates.forEach(r => {
      hourlyRatesByType[r.work_type] = r.rate;
    });
  }

  console.log('✅ Base totals calculated:', { 
    workHours: result.workHours, 
    materialCost: result.materialCost, 
    equipmentCost: result.equipmentCost,
    hourlyRatesByType
  });

  return { 
    workHours: result.workHours, 
    materialCost: result.materialCost, 
    equipmentCost: result.equipmentCost,
    hourlyRatesByType
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Input validation schema
    const requestSchema = z.object({
      description: z.string().trim().min(10, "Description too short").max(5000, "Description too long"),
      customer_id: z.string().uuid().optional(),
      detailLevel: z.enum(['quick', 'standard', 'detailed', 'construction']).default('standard'),
      deductionType: z.enum(['rot', 'rut', 'none', 'auto']).default('auto'),
      referenceQuoteId: z.string().optional(),
      numberOfRecipients: z.number().int().min(1).max(10).default(1),
      conversation_history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })).optional()
    });

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    // Extract user_id from JWT token instead of trusting client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create admin client to verify JWT and get user
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = user.id;
    const { description, customer_id, detailLevel, deductionType, referenceQuoteId, numberOfRecipients, conversation_history } = validatedData;

    console.log('Generating quote for user:', user_id);
    console.log('Description:', description);
    console.log('Deduction type requested:', deductionType);
    console.log('Conversation history length:', conversation_history?.length || 0);

    // Bestäm avdragssats baserat på datum (Fas 9B)
    const currentDate = new Date();
    const is2025HigherRate = currentDate >= new Date('2025-05-12') && currentDate <= new Date('2025-12-31');
    const deductionRate = is2025HigherRate ? 0.50 : 0.30;
    const deductionPeriodText = is2025HigherRate 
      ? 'T.o.m. 31 december 2025: 50% avdrag på arbetskostnad inkl. moms'
      : 'Fr.o.m. 1 januari 2026: 30% avdrag på arbetskostnad inkl. moms';
    
    console.log(`📅 Datum: ${currentDate.toISOString().split('T')[0]} → Avdragssats: ${deductionRate * 100}%`);

    // Beräkna max ROT/RUT baserat på antal mottagare (Fas 9A)
    const maxRotPerPerson = 50000;
    const maxRutPerPerson = 75000;
    const totalMaxRot = maxRotPerPerson * numberOfRecipients;
    const totalMaxRut = maxRutPerPerson * numberOfRecipients;

    console.log(`📊 ROT/RUT-gränser: ${numberOfRecipients} mottagare → Max ROT: ${totalMaxRot} kr, Max RUT: ${totalMaxRut} kr`);

    // Skapa Supabase-klient för att hämta timpriser
    const supabaseClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // Detect deduction type if set to auto
    let finalDeductionType = deductionType;
    if (deductionType === 'auto') {
      console.log('Auto-detecting deduction type...');
      finalDeductionType = await detectDeductionType(description, LOVABLE_API_KEY);
      console.log('Detected deduction type:', finalDeductionType);
    }

    // Hämta referensofferter om användaren valt det
    let referenceQuotes: any[] = [];
    if (referenceQuoteId) {
      if (referenceQuoteId === 'auto') {
        console.log('Auto-selecting similar quotes...');
        const { data: similar, error: similarError } = await supabaseClient
          .rpc('find_similar_quotes', {
            user_id_param: user_id,
            description_param: description,
            limit_param: 3
          });
        
        if (similarError) {
          console.error('Error finding similar quotes:', similarError);
        } else if (similar && similar.length > 0) {
          referenceQuotes = similar.map((q: any) => ({
            id: q.quote_id,
            title: q.title,
            description: q.description,
            quote_data: q.quote_data
          }));
          console.log(`Found ${referenceQuotes.length} similar quotes`);
        }
      } else {
        console.log('Using specific reference quote:', referenceQuoteId);
        const { data: specific, error: specificError } = await supabaseClient
          .from('quotes')
          .select('id, title, description, generated_quote, edited_quote')
          .eq('id', referenceQuoteId)
          .eq('user_id', user_id)
          .single();
        
        if (specificError) {
          console.error('Error fetching specific quote:', specificError);
        } else if (specific) {
          referenceQuotes = [{
            id: specific.id,
            title: specific.title,
            description: specific.description,
            quote_data: specific.edited_quote || specific.generated_quote
          }];
          console.log('Using reference quote:', specific.title);
        }
      }
    }

    // Hämta användarens timpriser
    const { data: hourlyRates, error: ratesError} = await supabaseClient
      .from('hourly_rates')
      .select('work_type, rate')
      .eq('user_id', user_id);

    if (ratesError) {
      console.error('Error fetching hourly rates:', ratesError);
    }

    // Hämta användarens maskiner och utrustning
    const { data: equipmentRates, error: equipmentError } = await supabaseClient
      .from('equipment_rates')
      .select('name, equipment_type, price_per_day, price_per_hour, is_rented, default_quantity')
      .eq('user_id', user_id);

    if (equipmentError) {
      console.error('Error fetching equipment rates:', equipmentError);
    }

    // Hämta kundspecifik historik (om customer_id finns)
    let customerHistoryText = '';
    if (customer_id) {
      const { data: customerQuotes } = await supabaseClient
        .from('quotes')
        .select('title, generated_quote, edited_quote, status, created_at')
        .eq('user_id', user_id)
        .eq('customer_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (customerQuotes && customerQuotes.length > 0) {
        customerHistoryText = '\n\nTidigare offerter för denna kund:\n' +
          customerQuotes.map(q => {
            const quote = q.edited_quote || q.generated_quote;
            const totalCost = quote?.summary?.totalWithVAT || 0;
            return `- ${q.title}: ${totalCost} kr (Status: ${q.status}, ${new Date(q.created_at).toLocaleDateString('sv-SE')})`;
          }).join('\n') +
          '\n\nAnvänd denna historik för att matcha priser och nivå om liknande arbete.';
      }
    }

    // Hämta prishistorik från alla användarens offerter
    const { data: recentQuotes } = await supabaseClient
      .from('quotes')
      .select('generated_quote, edited_quote')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    let pricingHistoryText = '';
    if (recentQuotes && recentQuotes.length > 0) {
      const allWorkItems: any[] = [];
      recentQuotes.forEach(q => {
        const quote = q.edited_quote || q.generated_quote;
        if (quote?.workItems) {
          allWorkItems.push(...quote.workItems);
        }
      });
      
      const workTypeAverages = new Map();
      allWorkItems.forEach(item => {
        const name = item.name.toLowerCase();
        if (!workTypeAverages.has(name)) {
          workTypeAverages.set(name, []);
        }
        workTypeAverages.get(name).push(item.hourlyRate);
      });
      
      if (workTypeAverages.size > 0) {
        pricingHistoryText = '\n\nDina genomsnittliga priser från tidigare offerter:\n';
        workTypeAverages.forEach((rates, workType) => {
          const avg = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
          pricingHistoryText += `- ${workType}: ~${Math.round(avg)} kr/h (baserat på ${rates.length} tidigare poster)\n`;
        });
        pricingHistoryText += '\nAnvänd dessa som referens för konsekvent prissättning.';
      }
    }

    // Bygg rates-text för prompten
    let ratesText = '';
    let hasCustomRates = false;
    
    if (hourlyRates && hourlyRates.length > 0) {
      ratesText = 'Använd EXAKT dessa timpriser som användaren har angivit:\n' + 
                  hourlyRates.map(r => `- ${r.work_type}: ${r.rate} kr/h`).join('\n');
      hasCustomRates = true;
      console.log('Using custom hourly rates:', hourlyRates);
    } else {
      ratesText = 'Användaren har inte angivit specifika timpriser. Använd standardpris 650 kr/h.';
      console.log('No custom rates found, using default 650 kr/h');
    }

    // Bygg equipment-text för prompten
    let equipmentText = '';
    let hasEquipment = false;
    
    // Bygg lista över användarens verktyg
    const userEquipment = equipmentRates || [];
    
    // Lägg till bransch-standard verktyg som fallback
    const standardEquipment = `

OM PROJEKTET KRÄVER VERKTYG SOM INTE FINNS I LISTAN OVAN:
Lägg till dem i materials-array med dessa standardpriser:
- Motorsåg (arborist): 250 kr/tim eller 1000 kr/dag
- Flishugg: 2000 kr/dag
- Minigrävare: 1000 kr/dag
- Grävmaskin: 2000 kr/dag
- Kakelskärare: 150 kr/dag
- Ställning: 300 kr/dag per sektion
- Blandare: 100 kr/dag
- Sprututrustning: 400 kr/dag
`;
    
    if (userEquipment.length > 0) {
      equipmentText = '\n\nAnvändarens maskiner och utrustning:\n' + 
        userEquipment.map(e => {
          const priceInfo = e.price_per_day 
            ? `${e.price_per_day} kr/dag`
            : `${e.price_per_hour} kr/timme`;
          const status = e.is_rented ? 'hyrd' : 'ägd';
          return `- ${e.name} (${e.equipment_type}): ${priceInfo} (${status}, standard antal: ${e.default_quantity})`;
        }).join('\n');
      hasEquipment = true;
      console.log('Using equipment rates:', equipmentRates);
    }
    
    equipmentText += standardEquipment;

    // Hämta bransch-benchmarks
    const { data: benchmarks, error: benchmarksError } = await supabaseClient
      .from('industry_benchmarks')
      .select('*')
      .order('last_updated', { ascending: false });

    if (benchmarksError) {
      console.error('Error fetching benchmarks:', benchmarksError);
    }

    const benchmarkData = benchmarks || [];
    console.log(`Loaded ${benchmarkData.length} industry benchmarks`);

    // Analysera användarens stil från tidigare offerter
    function analyzeUserStyle(userQuotes: any[]): any {
      if (!userQuotes || userQuotes.length === 0) return null;
      
      const descriptions = userQuotes.flatMap(q => {
        const quote = q.edited_quote || q.generated_quote;
        if (!quote || !quote.workItems) return [];
        return quote.workItems.map((w: any) => w.description || w.name);
      }).filter(Boolean);
      
      if (descriptions.length === 0) return null;
      
      const usesEmojis = descriptions.some(d => /[\p{Emoji}]/u.test(d));
      const avgLength = descriptions.reduce((sum, d) => sum + d.length, 0) / descriptions.length;
      
      return {
        usesEmojis,
        avgDescriptionLength: Math.round(avgLength),
        sampleSize: userQuotes.length
      };
    }

    const { data: userQuotes, error: userQuotesError } = await supabaseClient
      .from('quotes')
      .select('generated_quote, edited_quote')
      .eq('user_id', user_id)
      .in('status', ['accepted', 'completed', 'sent'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (userQuotesError) {
      console.error('Error fetching user quotes for style analysis:', userQuotesError);
    }

    const userStyle = analyzeUserStyle(userQuotes || []);
    if (userStyle) {
      console.log('User style analyzed:', userStyle);
    }

    // Build deduction info based on type
    const deductionInfo = finalDeductionType === 'rot' 
      ? `ROT-avdrag: 50% av arbetskostnaden (max 50 000 kr per person/år). Gäller renovering, reparation, ombyggnad.`
      : finalDeductionType === 'rut'
      ? `RUT-avdrag: 50% av arbetskostnaden (max 75 000 kr per person/år). Gäller städning, underhåll, trädgård, hemservice.`
      : `Inget skatteavdrag tillämpas på detta arbete.`;

    // STEG 1: Beräkna bastotaler först (för priskonsistens)
    console.log('Step 1: Calculating base totals for price consistency...');
    const baseTotals = await calculateBaseTotals(description, LOVABLE_API_KEY!, hourlyRates, equipmentRates);
    console.log('Base totals calculated:', baseTotals);

    // KRITISK VALIDERING: Säkerställ att materialCost INTE är 0 för renoveringsprojekt
    const descLower = description.toLowerCase();
    const isRenovationProject = 
      descLower.includes('renovera') || 
      descLower.includes('bygga') || 
      descLower.includes('byta') ||
      descLower.includes('installera') ||
      descLower.includes('altandäck') ||
      descLower.includes('altan') ||
      descLower.includes('badrum') ||
      descLower.includes('kök') ||
      descLower.includes('kakel') ||
      descLower.includes('golv') ||
      descLower.includes('målning') ||
      descLower.includes('måla');

    // CRITICAL: Validate material cost BEFORE generating quote
    if (isRenovationProject && baseTotals.materialCost < 1000) {
      console.warn('⚠️ Material cost too low for renovation project, requesting clarification');
      return new Response(
        JSON.stringify({
          type: 'clarification',
          message: 'Jag behöver veta vilken materialnivå du vill ha för att kunna beräkna materialkostnaden korrekt. Välj mellan:\n\n• **Budget** - Enklare material, god kvalitet\n• **Mellan** - Standardmaterial från kända märken\n• **Premium** - Exklusiva material och design\n\nVilken nivå passar ditt projekt?',
          currentData: {}
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (isRenovationProject && baseTotals.materialCost === 0) {
      console.warn('⚠️ MATERIAL FALLBACK: materialCost är 0 för renoveringsprojekt!');
      
      // Fallback: Beräkna materialCost baserat på arbetskostnad (branschnorm ~30-40%)
      const totalWorkCost = Object.values(baseTotals.workHours as Record<string, number>).reduce((sum, hours) => {
        const rate = hourlyRates && hourlyRates.length > 0 
          ? (hourlyRates.find(r => Object.keys(baseTotals.workHours).includes(r.work_type))?.rate || 650)
          : 650;
        return sum + (hours * rate);
      }, 0);
      
      // Material är typiskt 30-40% av arbetskostnaden för renovering
      baseTotals.materialCost = Math.round(totalWorkCost * 0.35);
      console.log(`✅ AUTO-GENERATED materialCost: ${baseTotals.materialCost} kr (35% av arbetskostnad ${totalWorkCost} kr)`);
      console.log('AI_FALLBACK aktiverad - granska material noga i resulterande offert!');
    }

    // Check if this is the first message in a conversation (no history)
    const isFirstMessage = !conversation_history || conversation_history.length === 0;
    
    if (isFirstMessage) {
      // FÖRSTA MEDDELANDET - Ställ motfrågor istället för att generera komplett offert
      console.log('First message detected - generating clarification questions');
      
      // Build conversation summary for context
      const conversationSummary = conversation_history && conversation_history.length > 0
        ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' → ')
        : description;
      
      console.log(`📝 Konversationssammanfattning: ${conversationSummary}`);
      
      const clarificationPrompt = `Du är en AI-assistent som hjälper hantverkare att skapa professionella offerter.

Användaren har skrivit: "${description}"

Din uppgift är INTE att generera en komplett offert ännu. Istället ska du:

1. Bekräfta att du förstått grunderna i projektet
2. Ställ 2-4 KONKRETA motfrågor för att få mer detaljer

**Viktiga frågeområden:**
- Materialval och kvalitetsnivå (budget/mellan/premium)
- Tidram och deadline
- Specifika detaljer om arbetet (t.ex. storlek i kvm, antal enheter, etc.)
- Tillstånd eller förberedelser som behövs
- Kundönskemål kring utförande

Returnera ett JSON-objekt med detta format:
{
  "needs_clarification": true,
  "clarification_questions": [
    "Fråga 1 här",
    "Fråga 2 här",
    "Fråga 3 här"
  ],
  "initial_estimate": {
    "estimated_hours": ${baseTotals.workHours ? (Object.values(baseTotals.workHours) as number[]).reduce((a, b) => a + b, 0) : 40},
    "estimated_cost": ${Math.round(baseTotals.materialCost + baseTotals.equipmentCost || 10000)}
  }
}

GENERERA INGEN KOMPLETT OFFERT ÄNNU. Returnera endast JSON-objektet ovan.`;

      const clarificationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: clarificationPrompt },
            { role: 'user', content: description }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        }),
      });

      if (!clarificationResponse.ok) {
        console.error('Clarification API error:', clarificationResponse.status);
        // Fallback - fortsätt med normal offertgenerering
      } else {
        const clarificationData = await clarificationResponse.json();
        const result = JSON.parse(clarificationData.choices[0].message.content);
        
        if (result.needs_clarification) {
          console.log('Returning clarification questions');
          return new Response(
            JSON.stringify({
              type: 'clarification',
              questions: result.clarification_questions,
              initial_estimate: result.initial_estimate
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }
      }
    }

    // STEG 2: PRE-FLIGHT CHECK - Validera kontext innan generering
    console.log('Step 2: Running pre-flight check...');
    const preflightCheck = await performPreflightCheck(description, conversation_history, LOVABLE_API_KEY!);
    
    if (!preflightCheck.valid) {
      console.warn('⚠️ Pre-flight check failed:', preflightCheck.errors);
      return new Response(
        JSON.stringify({
          type: 'clarification',
          message: 'Jag behöver lite mer information för att skapa en korrekt offert.',
          questions: [
            preflightCheck.errors.join('\n'),
            'Kan du ge mer specifika detaljer om vad du vill ha gjort?',
            'Finns det några särskilda krav eller önskemål?'
          ],
          currentData: { projectType: preflightCheck.projectType }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Om vi kommer hit har vi antingen historik eller clarification misslyckades
    // Fortsätt med normal offertgenerering
    console.log('Generating complete quote...');

    // Define strict JSON schema for tool calling
    const quoteSchema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Kort beskrivande titel för offerten" },
        workItems: {
          type: "array",
          description: "Lista över arbetsmoment",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på arbetsmoment" },
              description: { type: "string", description: "Beskrivning av momentet" },
              hours: { type: "number", description: "Antal timmar" },
              hourlyRate: { type: "number", description: "Timpris i kronor" },
              subtotal: { type: "number", description: "Totalkostnad (hours × hourlyRate)" }
            },
            required: ["name", "description", "hours", "hourlyRate", "subtotal"],
            additionalProperties: false
          }
        },
        materials: {
          type: "array",
          description: "Lista över material",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Namn på material/produkt" },
              quantity: { type: "number", description: "Antal" },
              unit: { type: "string", description: "Enhet (st/m2/m/kg)" },
              pricePerUnit: { type: "number", description: "Pris per enhet" },
              subtotal: { type: "number", description: "Totalkostnad (quantity × pricePerUnit)" }
            },
            required: ["name", "quantity", "unit", "pricePerUnit", "subtotal"],
            additionalProperties: false
          }
        },
        summary: {
          type: "object",
          description: "Sammanfattning av kostnader",
          properties: {
            workCost: { type: "number", description: "Total arbetskostnad" },
            materialCost: { type: "number", description: "Total materialkostnad" },
            totalBeforeVAT: { type: "number", description: "Summa före moms" },
            vat: { type: "number", description: "Moms (25%)" },
            totalWithVAT: { type: "number", description: "Totalt inkl moms" },
            deductionAmount: { type: "number", description: "ROT/RUT-avdrag" },
            deductionType: { type: "string", enum: ["rot", "rut", "none"], description: "Typ av avdrag" },
            customerPays: { type: "number", description: "Kund betalar efter avdrag" }
          },
          required: ["workCost", "materialCost", "totalBeforeVAT", "vat", "totalWithVAT", "deductionAmount", "deductionType", "customerPays"],
          additionalProperties: false
        },
        notes: { type: "string", description: "Anteckningar och villkor" }
      },
      required: ["title", "workItems", "materials", "summary"],
      additionalProperties: false
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        tools: [{
          type: "function",
          function: {
            name: "create_quote",
            description: "Skapa en strukturerad offert baserat på jobbeskrivning och förutberäknade totaler",
            parameters: quoteSchema
          }
        }],
        tool_choice: { type: "function", function: { name: "create_quote" } },
        messages: [
          {
            role: 'system',
            content: `Du är en expert på att skapa professionella offerter för svenska hantverkare.

**═══════════════════════════════════════════════════════════════**
**DE 5 ABSOLUTA REGLERNA (BRYT ALDRIG DESSA!)**
**═══════════════════════════════════════════════════════════════**

1. **MATCHA ANVÄNDARENS FÖRFRÅGAN EXAKT**
   Användaren bad om: "${conversation_history && conversation_history.length > 0 ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' → ') : description}"
   → Skapa offert för EXAKT detta (om "målning" → målningsoffert, INTE altan/kök)

2. **LÅS FÖRUTBERÄKNADE TOTALER (VIKTIGAST AV ALLT!)**
   Arbetstimmar: ${JSON.stringify(baseTotals.workHours)}
   Material: ${baseTotals.materialCost} kr | Utrustning: ${baseTotals.equipmentCost} kr
   → **DU MÅSTE** använda exakt dessa timmar i din offert
   → **ALDRIG** sätt 0 timmar om baseTotals säger något annat!
   → Summan av hours i alla workItems MÅSTE = baseTotals.workHours
   → FÅR INTE ändras, endast fördelas över poster!

3. **ANVÄND EXAKTA TIMPRISER**
   ${JSON.stringify(baseTotals.hourlyRatesByType, null, 2)}
   → Använd EXAKT dessa priser för matchande arbetstyper

4. **MATERIAL MÅSTE HA REALISTISKA PRISER**
   → ALDRIG pricePerUnit = 0 kr
   → Total materials.subtotal = ${baseTotals.materialCost + baseTotals.equipmentCost} kr

5. **FÖLJ DETALJNIVÅ "${detailLevel}"**
   ${detailLevel === 'quick' ? '→ 2-3 arbetsposter, 3-5 material, notes <100 tecken' : ''}
   ${detailLevel === 'standard' ? '→ 4-6 arbetsposter, 5-10 material, notes 200-300 tecken' : ''}
   ${detailLevel === 'detailed' ? '→ 6-10 arbetsposter, 10-15 material, notes 500-800 tecken med fasindelning' : ''}
   ${detailLevel === 'construction' ? '→ 10-15 arbetsposter (inkl. projektledning), 15-25 material, notes 1200-2000 tecken med projektledning+tidsplan+garanti+besiktning' : ''}


**═══════════════════════════════════════════════════════════════**
**PROJEKTSPECIFIK KONTEXT**
**═══════════════════════════════════════════════════════════════**
            
${ratesText}
${equipmentText}
${customerHistoryText}
${pricingHistoryText}

${referenceQuotes.length > 0 ? `

**═══════════════════════════════════════════════════════════════**
**VIKTIGT - ANVÄND DESSA TIDIGARE OFFERTER SOM REFERENS**
**═══════════════════════════════════════════════════════════════**

Du har tillgång till ${referenceQuotes.length} tidigare liknande offert(er) från SAMMA användare.
Använd dessa för att hålla KONSEKVENT prissättning, omfattning och stil.

${referenceQuotes.map((ref, idx) => {
  const quoteData = ref.quote_data;
  if (!quoteData) return '';
  const summary = quoteData.summary;
  
  return `
════════════════════════════════════════════════════════════════
REFERENS ${idx + 1}: ${ref.title}
════════════════════════════════════════════════════════════════
Beskrivning: ${ref.description}

PRISER:
• Totalt: ${summary.totalWithVAT} kr (inkl. moms)
• Kund betalar: ${summary.customerPays} kr (efter ${summary.deductionType?.toUpperCase() || 'inget'}-avdrag)
• Arbete: ${summary.workCost} kr
• Material: ${summary.materialCost} kr
• Avdrag: ${summary.deductionAmount || 0} kr

ARBETSPOSTER:
${quoteData.workItems?.map((w: any) => `• ${w.name}: ${w.hours}h × ${w.hourlyRate} kr/h = ${w.subtotal} kr`).join('\n') || 'Inga arbetsposter'}

MATERIALPOSTER:
${quoteData.materials?.map((m: any) => `• ${m.name}: ${m.quantity} ${m.unit} × ${m.pricePerUnit} kr = ${m.subtotal} kr`).join('\n') || 'Inga materialposter'}
`;
}).join('\n')}

**MATCHNINGSREGLER FÖR REFERENSER:**
1. Om nya uppdraget är MINDRE än referensen → Skala ner proportionellt men håll struktur
2. Om nya uppdraget är STÖRRE → Skala upp men håll EXAKT samma timpris
3. Om materialnivå skiljer sig (budget/mellan/premium) → Justera materialpriser, ALDRIG timpriser
4. Behåll SAMMA timpris som i referensen för matchande arbetstyper
5. Om nya uppdraget är NÄSTAN identiskt → använd nästan exakt samma struktur och fördelning
6. Matcha arbetstyper: Om referens använder "Snickare" → använd samma arbetstyp i nya offerten

` : ''}

${benchmarkData.length > 0 ? `

**═══════════════════════════════════════════════════════════════**
**BRANSCH-KONTEXT (för validering och kvalitetskontroll)**
**═══════════════════════════════════════════════════════════════**

Följande data är baserad på ANONYMISERAD statistik från hela plattformen:

${benchmarkData.map((b: any) => `
• ${b.work_category} (${b.metric_type}):
  - Medianvärde: ${b.median_value}
  - Spann: ${b.min_value} - ${b.max_value}
  - Baserat på ${b.sample_size} offerter
`).join('\n')}

**ANVÄNDNING AV BRANSCHDATA:**
✓ Använd för att validera rimlighet i dina estimat
✓ Om användarens priser AVVIKER >30% från median → var extra noggrann
✓ ALLTID prioritera användarens egna priser (ovan) över branschdata
✓ Branschdata är ENDAST för att säkerställa kvalitet, aldrig för att ersätta användarens priser

` : ''}

${userStyle ? `

**═══════════════════════════════════════════════════════════════**
**STIL-ANPASSNING (matcha användarens tidigare offerter)**
**═══════════════════════════════════════════════════════════════**

Analys av användarens senaste ${userStyle.sampleSize} offerter visar:
• ${userStyle.usesEmojis ? '✅ Använder emojis och ikoner i beskrivningar' : '❌ Använder ren text utan emojis'}
• Genomsnittlig beskrivningslängd: ~${userStyle.avgDescriptionLength} tecken

**INSTRUKTION:**
${userStyle.usesEmojis ? 'Inkludera relevanta emojis i workItems-beskrivningar och notes.' : 'Håll texten professionell och emoji-fri.'}
Håll beskrivningslängder runt ${userStyle.avgDescriptionLength} tecken.
Matcha tonen och stilen från användarens tidigare offerter.

` : ''}

**══════════════════════════════════════════════════════════════**
**PROJEKTSPECIFIK KONTEXT**
**══════════════════════════════════════════════════════════════**

**TIMPRIS-MATCHNING (workItem.name → hourlyRate):**
• "Snickare - Rivning" → använd ${baseTotals.hourlyRatesByType['Snickare'] || 650} kr/h
• "Målare - Målning" → använd ${baseTotals.hourlyRatesByType['Målare'] || 700} kr/h
• workItem.name MÅSTE börja med arbetstypen från baseTotals.hourlyRatesByType
• Fallback (om arbetstyp saknas): Städare 500, Arborist 1000, Trädgård 550, Elektriker 850, VVS 900

**MATERIAL-FÖRDELNING:**
• ALDRIG pricePerUnit = 0 kr!
• Total materials.subtotal = ${baseTotals.materialCost + baseTotals.equipmentCost} kr exakt
• Exempel badrum 5 kvm: Kakel vägg (1750 kr) + Klinker golv (2125 kr) + VVS (6000 kr) = 20000 kr ✓

**══════════════════════════════════════════════════════════════**
**MATEMATIK MÅSTE STÄMMA**
**══════════════════════════════════════════════════════════════**

• workItems.hours per arbetstyp = baseTotals.workHours exakt
• materials.subtotal totalt = ${baseTotals.materialCost + baseTotals.equipmentCost} kr exakt
• workItems.hourlyRate = baseTotals.hourlyRatesByType exakt
            
Baserat på uppdragsbeskrivningen ska du returnera en strukturerad offert i JSON-format med följande struktur:

{
  "title": "Kort beskrivande titel",
  "workItems": [
    {
      "name": "Arbetsmoment",
      "description": "Beskrivning av momentet",
      "hours": 10,
      "hourlyRate": 650,
      "subtotal": 6500
    }
  ],
  "materials": [
    {
      "name": "Material/produkt",
      "quantity": 1,
      "unit": "st/m2/m",
      "pricePerUnit": 1000,
      "subtotal": 1000
    }
  ],
        "summary": {
          "workCost": 10000,
          "materialCost": 5000,
          "totalBeforeVAT": 15000,
          "vat": 3750,
          "totalWithVAT": 18750,
          "deductionAmount": ${finalDeductionType !== 'none' ? '5000' : '0'},
          "deductionType": "${finalDeductionType}",
          ${finalDeductionType === 'rot' ? '"rotDeduction": 5000,' : ''}
          ${finalDeductionType === 'rut' ? '"rutDeduction": 5000,' : ''}
          "customerPays": ${finalDeductionType !== 'none' ? '13750' : '18750'}
        },
  "deductionType": "${finalDeductionType}",
  "notes": "Eventuella anteckningar eller villkor"
}

**VIKTIGT - SKATTEAVDRAGSTYP:**
Du MÅSTE inkludera exakt detta i ditt svar:
- "deductionType": "${finalDeductionType}"
${finalDeductionType === 'rot' ? '- Använd fältet "rotDeduction" för avdraget (INTE rutDeduction)' : ''}
${finalDeductionType === 'rut' ? '- Använd fältet "rutDeduction" för avdraget (INTE rotDeduction)' : ''}
${finalDeductionType === 'none' ? '- Inkludera INGET avdragsfält (varken rotDeduction eller rutDeduction)' : ''}

**═══════════════════════════════════════════════════════════════**
**KRITISKT - ROT/RUT-AVDRAG BERÄKNING (FÖLJ EXAKT!)**
**═══════════════════════════════════════════════════════════════**

${deductionPeriodText}

**ROT-AVDRAG (Renovering, Ombyggnad, Tillbyggnad):**
1. Beräkna arbetskostnad INKL moms: workCost × 1.25
2. ROT-avdrag = (workCost × 1.25) × ${deductionRate}
3. Max ${totalMaxRot} kr (${numberOfRecipients} ${numberOfRecipients === 1 ? 'person' : 'personer'} × ${maxRotPerPerson} kr/person)
4. Gäller ENDAST arbetskostnad, INTE material
5. Kund betalar: (workCost + materialCost) × 1.25 - rotDeduction

**EXEMPEL ROT (${numberOfRecipients} mottagare, ${deductionRate * 100}%):**
• Arbetskostnad: 40,000 kr (exkl moms)
• Arbetskostnad inkl moms: 40,000 × 1.25 = 50,000 kr
• ROT-avdrag (${deductionRate * 100}%): 50,000 × ${deductionRate} = ${Math.round(50000 * deductionRate)} kr
• Max-gräns: ${totalMaxRot} kr
• Faktiskt avdrag: ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)} kr
• Material: 10,000 kr (× 1.25 = 12,500 kr inkl moms)
• Total inkl moms: 50,000 + 12,500 = 62,500 kr
• Kund betalar: 62,500 - ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)} = ${62500 - Math.min(Math.round(50000 * deductionRate), totalMaxRot)} kr

**RUT-AVDRAG (Rengöring, Underhåll, Tvätt, Trädgård):**
1. Beräkna arbetskostnad INKL moms: workCost × 1.25
2. RUT-avdrag = (workCost × 1.25) × ${deductionRate}
3. Max ${totalMaxRut} kr (${numberOfRecipients} ${numberOfRecipients === 1 ? 'person' : 'personer'} × ${maxRutPerPerson} kr/person)
4. Gäller: Städning, trädgård, snöskottning, fönsterputsning
5. Kund betalar: (workCost + materialCost) × 1.25 - rutDeduction

**EXEMPEL RUT (${numberOfRecipients} mottagare, ${deductionRate * 100}%):**
• Arbetskostnad: 4,000 kr (exkl moms)
• Arbetskostnad inkl moms: 4,000 × 1.25 = 5,000 kr
• RUT-avdrag (${deductionRate * 100}%): 5,000 × ${deductionRate} = ${Math.round(5000 * deductionRate)} kr

**═══════════════════════════════════════════════════════════════**
**SJÄLVKONTROLL OCH AUTO-KORRIGERING (KRITISKT!)**
**═══════════════════════════════════════════════════════════════**

⚠️ **INNAN DU ANROPAR create_quote - GENOMFÖR DESSA KONTROLLER OCH KORRIGERINGAR:**

**STEG 1: KONTROLLERA ARBETSTIMMAR**
• Summera hours från ALLA workItems per arbetstyp
• MÅSTE exakt matcha: ${JSON.stringify(baseTotals.workHours)}
• **OM FEL:** Justera hours-värdena tills det stämmer EXAKT!
• **FÖRBJUDET:** Att ha 0 hours för någon arbetstyp som finns i baseTotals

**Exempel fel:**
baseTotals: { "Snickare": 20, "Målare": 10 }
workItems: [{ name: "Snickare - Rivning", hours: 15 }, { name: "Målare - Målning", hours: 0 }] ❌

**Korrigerat:**
workItems: [{ name: "Snickare - Rivning", hours: 20 }, { name: "Målare - Målning", hours: 10 }] ✓

**STEG 2: KONTROLLERA MATERIALKOSTNAD**
• Summera subtotal från ALLA materials
• MÅSTE exakt = ${baseTotals.materialCost + baseTotals.equipmentCost} kr
• **OM FEL:** Justera pricePerUnit eller lägg till/ta bort material!
• **FÖRBJUDET:** pricePerUnit = 0 kr för någon material

**STEG 3: KONTROLLERA PROJEKTMATCHNING**
• Offerten MÅSTE vara för: "${conversation_history && conversation_history.length > 0 ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' → ') : description}"
• **OM FEL:** Generera en HELT NY offert för rätt projekt!
• Exempel: Om användare bad om "målning" → skapa INTE en altanoffert!

**STEG 4: KONTROLLERA DETALJNIVÅ**
• Antal workItems och materials MÅSTE följa "${detailLevel}"-kraven:
  - quick: 2-3 workItems, 3-5 materials
  - standard: 4-6 workItems, 5-10 materials
  - detailed: 6-10 workItems, 10-15 materials
  - construction: 10-15 workItems, 15-25 materials
• **OM FEL:** Lägg till eller slå ihop poster tills det stämmer!

**STEG 5: KONTROLLERA TIMPRISER**
• Varje workItem.hourlyRate MÅSTE matcha baseTotals.hourlyRatesByType
• **OM FEL:** Korrigera hourlyRate OCH räkna om subtotal!

⚠️ **NÄR ALLT STÄMMER → ANROPA create_quote**
⚠️ **OM NÅGOT ÄR FEL → KORRIGERA FÖRST, SEDAN ANROPA create_quote**

**═══════════════════════════════════════════════════════════════**

• Max-gräns: ${totalMaxRut} kr
• Faktiskt avdrag: ${Math.min(Math.round(5000 * deductionRate), totalMaxRut)} kr
• Material: 500 kr (× 1.25 = 625 kr inkl moms)
• Total inkl moms: 5,000 + 625 = 5,625 kr
• Kund betalar: 5,625 - ${Math.min(Math.round(5000 * deductionRate), totalMaxRut)} = ${5625 - Math.min(Math.round(5000 * deductionRate), totalMaxRut)} kr

**KORREKT BERÄKNING I SUMMARY:**
{
  "workCost": 40000,           // Exkl moms
  "materialCost": 10000,       // Exkl moms
  "totalBeforeVAT": 50000,     // workCost + materialCost
  "vat": 12500,                // totalBeforeVAT × 0.25
  "totalWithVAT": 62500,       // totalBeforeVAT + vat
  "deductionAmount": ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)},    // (workCost × 1.25) × ${deductionRate}
  "deductionType": "rot",
  "rotDeduction": ${Math.min(Math.round(50000 * deductionRate), totalMaxRot)},       // Samma som deductionAmount
  "customerPays": ${62500 - Math.min(Math.round(50000 * deductionRate), totalMaxRot)}        // totalWithVAT - rotDeduction
}

**FEL BERÄKNING (gör INTE så här!):**
{
  "deductionAmount": 12000,    // ❌ FEL: Använder workCost direkt (40000 × 0.30)
  "customerPays": 50500        // ❌ FEL: Blir fel totalt
}

**═══════════════════════════════════════════════════════════════**

**SKATTEAVDRAG:**
${deductionInfo}

${finalDeductionType !== 'none' ? `
VIKTIGT för ${finalDeductionType.toUpperCase()}-arbeten:
1. Var tydlig med vad som är arbetskostnad (avdragsgillt)
2. Material och utrustning är INTE avdragsgilla
3. Kunden får avdraget preliminärt direkt på fakturan
4. Visa tydligt i sammanfattningen: "Kund betalar efter ${finalDeductionType.toUpperCase()}-avdrag"
` : ''}

Viktig information:
- Använd realistiska svenska priser (2025)
- Använd de angivna timpriserna ovan för varje arbetsmoment
- Inkludera moms (25%)
- Specificera material och kvantiteter
- Var tydlig med vad som ingår och inte ingår`
          },
          {
            role: 'user',
            content: description
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'För många förfrågningar. Försök igen om en stund.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Tjänsten kräver betalning. Kontakta support.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract quote from tool call response
    let generatedQuote;
    if (data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
      // Tool calling response format
      generatedQuote = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    } else {
      // Fallback to old format if tool calling not used
      generatedQuote = JSON.parse(data.choices[0].message.content);
    }
    
    // SANITY CHECK: Verify quote matches user's actual request
    console.log('🔍 Performing sanity check on generated quote...');
    
    const projectTypeCheck: Record<string, RegExp> = {
      målning: /målning|måla|färg|spackling|målare/i,
      altan: /altan|trall|uteplats|däck|spjäl/i,
      kök: /kök|köks|diskbänk|skåp|köksinredning/i,
      badrum: /badrum|kakel|dusch|toalett|wc|våtrum/i,
      tak: /tak|takläggning|takpannor|taktäckning|takrenovering/i,
      'trädfällning': /träd|fälla|fällning|arborist|stam/i
    };
    
    const userWanted = (conversation_history && conversation_history.length > 0 
      ? conversation_history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' ')
      : description).toLowerCase();
    
    let expectedType: string | null = null;
    for (const [type, pattern] of Object.entries(projectTypeCheck)) {
      if (pattern.test(userWanted)) {
        expectedType = type;
        break;
      }
    }
    
    if (expectedType) {
      const quoteTitle = generatedQuote.title?.toLowerCase() || '';
      const workItemsText = generatedQuote.workItems?.map((w: any) => w.name + ' ' + w.description).join(' ').toLowerCase() || '';
      const materialsText = generatedQuote.materials?.map((m: any) => m.name).join(' ').toLowerCase() || '';
      const allQuoteText = quoteTitle + ' ' + workItemsText + ' ' + materialsText;
      
      const matchesExpectedType = projectTypeCheck[expectedType].test(allQuoteText);
      
      if (!matchesExpectedType) {
        console.error(`❌ KRITISKT FEL: Användaren bad om "${expectedType}" men offerten handlar om något annat!`);
        console.error(`Offertens innehåll: ${allQuoteText.substring(0, 200)}...`);
        console.error(`Användarens begäran: ${userWanted.substring(0, 200)}...`);
        
        return new Response(
          JSON.stringify({ 
            error: 'AI-kontextfel',
            message: `Tyvärr, AI:n skapade en offert för fel projekttyp. Du bad om "${expectedType}"-arbete men offerten verkar handla om något annat. Försök att omformulera din förfrågan mer specifikt.`,
            needsClarification: true,
            expectedType: expectedType,
            detectedContent: allQuoteText.substring(0, 100)
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      console.log(`✅ Sanity check OK: Offerten matchar förväntad projekttyp "${expectedType}"`);
    } else {
      console.log('ℹ️ Sanity check skipped: Kunde inte identifiera specifik projekttyp');
    }
    
    // VALIDATION STEP 1: Validate AI output against base totals
    console.log('Validating quote output...');
    const validation = validateQuoteOutput(generatedQuote, baseTotals, baseTotals.hourlyRatesByType, detailLevel);
    const realismWarnings = validateRealism(generatedQuote, description);
    
    let finalQuote = generatedQuote;
    let wasAutoCorrected = false;
    let retryCount = 0;
    
    // Helper function for detail level requirements
    const getDetailLevelRequirements = (level: string): string => {
      const reqs: Record<string, string> = {
        quick: '• 2-3 arbetsposter\n• 3-5 materialposter\n• Notes max 100 tecken',
        standard: '• 4-6 arbetsposter\n• 5-10 materialposter\n• Notes 200-300 tecken\n• Inkludera giltighetstid',
        detailed: '• 6-10 arbetsposter\n• 10-15 materialposter\n• Notes 500-800 tecken\n• Måste ha fasindelning',
        construction: '• 10-15 arbetsposter (inkl. projektledning)\n• 15-25 materialposter\n• Notes 1200-2000 tecken\n• Måste innehålla: projektledning, tidsplan, garanti, besiktning'
      };
      return reqs[level] || '';
    };
    
    if (!validation.valid) {
      console.error('Quote validation failed:', validation.errors);
      retryCount = 1;
      
      // RETRY: Try one more time with more specific instructions about errors
      console.log('Retrying with more specific instructions...');
      
      // Ge AI:n EXAKT vad som är fel
      const errorFeedback = `
DIN FÖREGÅENDE OFFERT VALIDERADES OCH FÖLJANDE FEL UPPTÄCKTES:

${validation.errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}

KRAV SOM MÅSTE UPPFYLLAS:
- Arbetsposter MÅSTE summera till EXAKT dessa timmar per arbetstyp:
  ${Object.entries(baseTotals.workHours).map(([type, hours]) => `${type}: ${hours}h`).join(', ')}
  
- Materialkostnad MÅSTE vara EXAKT: ${baseTotals.materialCost + baseTotals.equipmentCost} kr

- Detaljnivå "${detailLevel}" kräver:
  ${getDetailLevelRequirements(detailLevel)}

SKAPA OM OFFERTEN OCH FÖLJ DESSA EXAKTA KRAV.
`;
      
      const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0,
          tools: [{
            type: "function",
            function: {
              name: "create_quote",
              description: "Skapa en strukturerad offert",
              parameters: quoteSchema
            }
          }],
          tool_choice: { type: "function", function: { name: "create_quote" } },
          messages: [
            {
              role: 'system',
              content: `Du misslyckades med valideringen förra gången. Felen var: ${validation.errors.join(', ')}
              
Korrigera detta och följ dessa EXAKTA totaler:
${JSON.stringify(baseTotals, null, 2)}

Du MÅSTE:
- Fördela exakt ${Object.entries(baseTotals.workHours).map(([type, hours]) => `${hours}h ${type}`).join(', ')}
- Total materialkostnad MÅSTE bli exakt ${baseTotals.materialCost + baseTotals.equipmentCost} kr
- Ingen avvikelse accepteras!`
            },
            {
              role: 'user',
              content: description + '\n\n' + errorFeedback
            }
          ]
        }),
      });
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        let retryQuote;
        if (retryData.choices[0].message.tool_calls && retryData.choices[0].message.tool_calls[0]) {
          retryQuote = JSON.parse(retryData.choices[0].message.tool_calls[0].function.arguments);
        } else {
          retryQuote = JSON.parse(retryData.choices[0].message.content);
        }
        
        const retryValidation = validateQuoteOutput(retryQuote, baseTotals, baseTotals.hourlyRatesByType, detailLevel);
        
        if (retryValidation.valid) {
          console.log('✅ Retry successful!');
          finalQuote = retryQuote;
        } else {
          console.error('⚠️ Retry also failed. Validation errors:', retryValidation.errors);
          
          // Check if errors are minor and can be auto-corrected
          const hasOnlyMinorErrors = retryValidation.errors.every(err => 
            err.includes('Material: Förväntade') || 
            err.includes('Notes ska vara') ||
            err.includes('Ska ha') && err.includes('poster')
          );
          
          if (hasOnlyMinorErrors) {
            console.log('→ Applying intelligent auto-correction for minor errors...');
            
            // Fix material cost if needed
            if (retryValidation.errors.some(e => e.includes('Material: Förväntade'))) {
              const expectedMaterialCost = baseTotals.materialCost + baseTotals.equipmentCost;
              console.log(`→ Korrigerar materialkostnad till ${expectedMaterialCost} kr`);
              retryQuote.summary.materialCost = expectedMaterialCost;
              retryQuote.summary.totalBeforeVAT = retryQuote.summary.workCost + expectedMaterialCost;
              retryQuote.summary.vat = Math.round(retryQuote.summary.totalBeforeVAT * 0.25);
              retryQuote.summary.totalWithVAT = retryQuote.summary.totalBeforeVAT + retryQuote.summary.vat;
            }
            
            // Fix notes length if needed
            if (retryValidation.errors.some(e => e.includes('Notes ska vara'))) {
              const targetLength = detailLevel === 'standard' ? 250 : detailLevel === 'detailed' ? 650 : 75;
              if (retryQuote.notes && retryQuote.notes.length > targetLength) {
                console.log(`→ Trimmar notes till ${targetLength} tecken`);
                retryQuote.notes = retryQuote.notes.substring(0, targetLength - 3) + '...';
              }
            }
            
            finalQuote = retryQuote;
            wasAutoCorrected = true;
            console.log('✅ Auto-correction applied successfully');
          } else {
            console.error('❌ Retry failed with major errors. Returning error to user.');
            
            // Check if error is about 0 hours when baseTotals expected hours
            const hasZeroHoursError = retryValidation.errors.some((err: string) => 
              err.includes('Förväntade') && err.includes('men fick 0h')
            );
            
            if (hasZeroHoursError) {
              return new Response(
                JSON.stringify({ 
                  type: 'clarification',
                  message: 'Jag behöver lite mer information för att kunna skapa en korrekt offert.',
                  questions: [
                    'Kan du berätta mer detaljerat om vilka arbetsmoment som ingår?',
                    'Finns det några specifika krav eller önskemål för hur arbetet ska utföras?',
                    'Är det något särskilt jag bör tänka på för detta projekt?'
                  ]
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
            
            return new Response(
              JSON.stringify({ 
                error: 'Validering misslyckades',
                message: 'AI:n kunde inte generera en korrekt offert efter flera försök. Försök omformulera din förfrågan eller ge mer specifika detaljer.',
                validationErrors: retryValidation.errors,
                needsClarification: true
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }
      } else {
        console.error('❌ Retry request failed. Returning error to user.');
        
        return new Response(
          JSON.stringify({ 
            error: 'AI-generering misslyckades',
            message: 'Kunde inte generera offert efter flera försök. Försök igen eller kontakta support.',
            needsClarification: true
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    
    // Add deduction type to the quote
    finalQuote.deductionType = finalDeductionType;

    // Normalize deduction fields for consistent display
    if (finalDeductionType === 'rot') {
      // ROT deduction - använd dynamisk sats och max
      const workCostInclVAT = finalQuote.summary.workCost * 1.25;
      const calculatedRot = workCostInclVAT * deductionRate;
      finalQuote.summary.rotDeduction = Math.min(calculatedRot, totalMaxRot);
      finalQuote.summary.deductionAmount = finalQuote.summary.rotDeduction;
      finalQuote.summary.deductionType = 'rot';
      delete finalQuote.summary.rutDeduction;
      
      console.log(`✅ ROT (${deductionRate * 100}%): ${workCostInclVAT} kr × ${deductionRate} = ${calculatedRot} kr → begränsat till ${finalQuote.summary.rotDeduction} kr (max ${totalMaxRot} kr för ${numberOfRecipients} person${numberOfRecipients > 1 ? 'er' : ''})`);
    } else if (finalDeductionType === 'rut') {
      // RUT deduction - använd dynamisk sats och max
      const workCostInclVAT = finalQuote.summary.workCost * 1.25;
      const calculatedRut = workCostInclVAT * deductionRate;
      finalQuote.summary.rutDeduction = Math.min(calculatedRut, totalMaxRut);
      finalQuote.summary.deductionAmount = finalQuote.summary.rutDeduction;
      finalQuote.summary.deductionType = 'rut';
      delete finalQuote.summary.rotDeduction;
      
      console.log(`✅ RUT (${deductionRate * 100}%): ${workCostInclVAT} kr × ${deductionRate} = ${calculatedRut} kr → begränsat till ${finalQuote.summary.rutDeduction} kr (max ${totalMaxRut} kr för ${numberOfRecipients} person${numberOfRecipients > 1 ? 'er' : ''})`);
    } else {
      // No deduction
      finalQuote.summary.deductionAmount = 0;
      finalQuote.summary.deductionType = 'none';
      delete finalQuote.summary.rotDeduction;
      delete finalQuote.summary.rutDeduction;
    }
    
    console.log('Final quote summary after normalization:', finalQuote.summary);

    console.log('Generated quote successfully with detail level:', detailLevel);
    
    // REALITY CHECK: Validate against industry benchmarks
    const areaMatch = description.match(/(\d+(?:[.,]\d+)?)\s*(?:kvm|m2|kvadratmeter|kvadrat|m²)/i);
    const extractedArea = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : undefined;
    
    let realityCheckResult: { valid: boolean; reason?: string } = { valid: true };
    if (extractedArea) {
      realityCheckResult = performRealityCheck(finalQuote, description, extractedArea);
      if (!realityCheckResult.valid) {
        console.warn('⚠️ REALITY CHECK FAILED:', realityCheckResult.reason);
      }
    }
    
    // Prepare response with quality indicators
    const responseData: any = {
      type: 'complete_quote',  // VIKTIGT: Lägg till type för frontend
      quote: finalQuote,
      hasCustomRates,
      hasEquipment,
      detailLevel,
      deductionType: finalDeductionType,
      usedReference: referenceQuotes.length > 0,
      referenceTitle: referenceQuotes[0]?.title || undefined
    };
    
    // Add quality warnings if any
    if (wasAutoCorrected) {
      responseData.qualityWarning = 'auto_corrected';
      responseData.warningMessage = 'Offerten har korrigerats automatiskt för att säkerställa korrekt matematik. Granska noggrannt.';
    }
    
    if (!validation.valid && !wasAutoCorrected) {
      responseData.validationErrors = validation.errors;
    }
    
    if (realismWarnings.length > 0) {
      responseData.realismWarnings = realismWarnings;
    }
    
    // Add reality check warning if failed
    if (!realityCheckResult.valid && realityCheckResult.reason) {
      responseData.realityCheckWarning = realityCheckResult.reason;
      if (!responseData.realismWarnings) {
        responseData.realismWarnings = [];
      }
      responseData.realismWarnings.push(realityCheckResult.reason);
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-quote:', error);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod vid generering av offert. Kontakta support om problemet kvarstår." }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// AI function to detect deduction type based on job description
async function detectDeductionType(description: string, apiKey: string): Promise<'rot' | 'rut' | 'none'> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du är expert på svenska skatteregler för ROT och RUT-avdrag. Avgör om ett jobb klassificeras som ROT, RUT eller inget avdrag.

**ROT-arbeten (Reparation, Ombyggnad, Tillbyggnad):**
- Renovering av badrum, kök, våtrum
- Målning, måla om, tapetsering, spackling, väggmålning, fasadmålning
- Golvläggning, kakelläggning, plattsättning
- El- och VVS-installation som kräver byggarbete
- Värmepump, solpaneler, fönsterbyte
- Fasadrenovering, fasadarbeten, puts
- Takläggning, takbyte, takrenovering
- Tillbyggnad, ombyggnad av bostaden
- Altanbygge, trallbygge, uteplatser
- Installation av hiss
- Dränering runt huset
- KRÄVER OFTA SPECIALISTKUNSKAP OCH BYGGARBETE

**RUT-arbeten (Rengöring, Underhåll, Trädgård):**
- Städning (hemstädning, storstädning, trappstädning)
- Fönsterputs, rengöring
- Gräsklippning, snöskottning, ogräsrensning
- Trädfällning, häckklippning, trädgårdsskötsel
- Flyttjänster, flyttstädning
- Klädtvätt, matlagning (hemservice)
- IT-support i hemmet
- Reparation av vitvaror (diskmaskin, tvättmaskin, spis)
- Enkel reparation och underhåll som inte kräver bygglov
- SAKER SOM HUSHÅLL KAN GÖRA SJÄLVA

**Viktiga skillnader:**
- "Installera värmepump" = ROT (kräver byggarbete)
- "Rengöra värmepumpens filter" = RUT (underhåll)
- "Renovera badrum" = ROT (bygg och installation)
- "Städa badrum" = RUT (rengöring)
- "Måla fasad" = ROT (renovering av byggnad)
- "Tvätta fönster" = RUT (hemservice)
- "Bygga altandäck" = ROT (tillbyggnad)
- "Sopa och rensa däck" = RUT (underhåll)
- "Rensa stuprör" = RUT (underhåll)
- "Byta taket" = ROT (renovering)

Returnera ENDAST ett JSON-objekt med detta format:
{"type": "rot"} eller {"type": "rut"} eller {"type": "none"}`
          },
          {
            role: 'user',
            content: `Klassificera följande arbete: "${description}"`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    });

    if (!response.ok) {
      console.error('AI detection failed, defaulting to ROT');
      return 'rot';
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    if (result.type === 'rot' || result.type === 'rut' || result.type === 'none') {
      return result.type;
    }
    
    console.warn('Invalid deduction type from AI, defaulting to ROT');
    return 'rot';
  } catch (error) {
    console.error('Error detecting deduction type:', error);
    return 'rot'; // Default fallback
  }
}