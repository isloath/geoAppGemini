import { z } from 'zod';

export type Intent = 'best_of' | 'alternatives' | 'comparison' | 'use_case' | 'pricing' | 'negative_control';

export const PromptTemplateSchema = z.object({
  id: z.string(),
  text: z.string(),
  intent: z.enum(['best_of', 'alternatives', 'comparison', 'use_case', 'pricing', 'negative_control']),
  locale: z.string().default('en-US'),
  weight: z.number().default(1.0),
  version: z.string(),
  expected_brand_presence: z.boolean().optional(),
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const AnalysisJobSchema = z.object({
  projectId: z.string().uuid(),
  brand: z.string(),
  domain: z.string(),
  competitors: z.array(z.string()),
  category: z.string(),
  runsPerPrompt: z.number().default(3),
  locale: z.string().default('en-US'),
  brandAliases: z.array(z.string()).default([]),
});

export type AnalysisJobInput = z.infer<typeof AnalysisJobSchema>;

export interface Citation {
  url: string;
  domain: string;
  isAlive: boolean;
  mentionsBrand: boolean;
  verifiedAt?: string;
}

export interface LLMResponse {
  raw: string;
  parsed: {
    brandMentioned: boolean;
    rank?: number;
    competitorsMentioned: string[];
    citations: Citation[];
  };
  model: string;
  provider: string;
  latencyMs: number;
  tokensUsed: number;
  costEstimate: number;
  params: {
    temperature: number;
    top_p: number;
    max_tokens: number;
    repeat_index: number;
    prompt_version: string;
  };
}

export interface PromptResult {
  promptId: string;
  promptText: string;
  intent: Intent;
  runs: LLMResponse[];
  metrics: {
    mentionRate: number;
    mentionRateCI: [number, number];
    avgRank?: number;
    rankStdDev?: number;
    agreementRate: number;
    competitorJaccard: number;
    citationJaccard: number;
    confidence: number;
    confidenceBreakdown: {
      agreement: number;
      jaccard: number;
      rankStability: number;
      citationStability: number;
    };
  };
}

export interface AnalysisResult {
  id: string;
  projectId: string;
  input: AnalysisJobInput;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  results: PromptResult[];
  aggregatedMetrics: {
    shareOfVoice: number; // Prompt-anchored SoV
    sovCI: [number, number];
    mentionRate: number;
    mentionRateCI: [number, number];
    avgRank?: number;
    weightedVisibilityScore: number;
    visibilityBreakdown: {
      mentionContribution: number;
      rankContribution: number;
      intentWeightContribution: number;
      modelWeightContribution: number;
    };
    competitorDominance: Record<string, number>;
    citationAnalytics: {
      competitorCitationShare: Record<string, number>;
      topDomainConcentration: number;
      authorityGapIndex: number;
    };
    overallConfidence: number;
    deltaSignificance?: {
      isSignificant: boolean;
      pValue: number;
      previousAnalysisId: string;
    };
  };
  recommendations: Array<{
    type: string;
    reasoning: string;
    affectedPromptCount: number;
    expectedImpact: 'high' | 'medium' | 'low';
  }>;
}
