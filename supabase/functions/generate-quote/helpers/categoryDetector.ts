/**
 * CATEGORY DETECTOR - Detektera jobbkategori från beskrivning
 * Används för moment-specifik viktning av användarprisinput
 */

export function detectJobCategory(description: string, jobType?: string): string {
  const normalized = description.toLowerCase();
  
  // Om jobType finns, använd det först
  if (jobType) {
    const type = jobType.toLowerCase();
    if (type.includes('målning') || type.includes('måla')) return 'målning';
    if (type.includes('badrum') || type.includes('våtrum')) return 'badrum';
    if (type.includes('kök')) return 'kök';
    if (type.includes('el')) return 'el';
    if (type.includes('vvs') || type.includes('rör')) return 'vvs';
    if (type.includes('trädgård') || type.includes('gräs')) return 'trädgård';
    if (type.includes('städ')) return 'städning';
    if (type.includes('golv') || type.includes('parkett') || type.includes('klinker')) return 'golv';
    if (type.includes('puts') || type.includes('fasad')) return 'fasad';
    if (type.includes('fönster') || type.includes('dörr')) return 'fönster_dörr';
    if (type.includes('tak')) return 'tak';
  }
  
  // Annars analysera beskrivning
  if (normalized.includes('måla') || normalized.includes('målning') || normalized.includes('färg')) return 'målning';
  if (normalized.includes('badrum') || normalized.includes('dusch') || normalized.includes('wc')) return 'badrum';
  if (normalized.includes('kök')) return 'kök';
  if (normalized.includes('el') || normalized.includes('uttag') || normalized.includes('belysning')) return 'el';
  if (normalized.includes('vvs') || normalized.includes('rör') || normalized.includes('avlopp')) return 'vvs';
  if (normalized.includes('trädgård') || normalized.includes('gräs') || normalized.includes('träd')) return 'trädgård';
  if (normalized.includes('städ') || normalized.includes('flytt')) return 'städning';
  if (normalized.includes('parkett') || normalized.includes('golv') || normalized.includes('klinker')) return 'golv';
  if (normalized.includes('puts') || normalized.includes('fasad')) return 'fasad';
  if (normalized.includes('fönster') || normalized.includes('dörr')) return 'fönster_dörr';
  if (normalized.includes('tak')) return 'tak';
  
  return 'övrigt';
}
