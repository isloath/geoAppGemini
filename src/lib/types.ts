import { z } from 'zod';

export const AnalysisJobSchema = z.object({
  brand: z.string(),
  domain: z.string(),
  competitors: z.array(z.string()),
  category: z.string(),
  runsPerPrompt: z.number().default(3),
});

export type AnalysisJobInput = z.infer<typeof AnalysisJobSchema>;

export interface LLMResponse {
  raw: string;
  parsed: {
    brandMentioned: boolean;
    rank?: number;
    competitorsMentioned: string[];
    sources: string[];
  };
  model: string;
  provider: string;
  latencyMs: number;
}

export interface PromptResult {
  prompt: string;
  runs: LLMResponse[];
  metrics: {
    mentionRate: number;
    avgRank?: number;
    confidence: number;
  };
}

export interface AnalysisResult {
  id: string;
  input: AnalysisJobInput;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  results: PromptResult[];
  aggregatedMetrics: {
    shareOfVoice: number;
    mentionRate: number;
    avgRank?: number;
    competitorDominance: Record<string, number>;
    overallConfidence: number;
  };
  recommendations: string[];
}
