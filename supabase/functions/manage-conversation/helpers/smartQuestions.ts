// ============================================================================
// SMART QUESTIONS - FAS 3: Batch-frågor och synonym-mapping
// ============================================================================

export interface ProjectRequirements {
  projectType: string;
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  assumptions: string[];
}

// ============================================================================
// FAS 16: AI-DRIVEN SMART QUESTIONS
// Simplified version - all projects now use AI-generated questions
// ============================================================================

// Simplified: All projects now use AI-driven questioning
export function getProjectRequirements(description: string): ProjectRequirements {
  return { 
    projectType: 'ai_driven', 
    mandatoryQuestions: [], 
    optionalQuestions: [], 
    assumptions: [] 
  };
}

// Legacy batch questions - kept for backward compatibility but not used in AI-driven mode
export function generateBatchQuestions(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[],
  maxQuestions: number = 6
): string[] {
  return []; // Not used in AI-driven mode
}

// Legacy single-question mode (fallback)
export function generateNextQuestion(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[]
): string | null {
  return null; // Not used in AI-driven mode
}
