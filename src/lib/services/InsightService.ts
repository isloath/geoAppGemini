import { AnalysisResult } from '../types';

export class InsightService {
  static generateRecommendations(result: Partial<AnalysisResult>): AnalysisResult['recommendations'] {
    const recs: AnalysisResult['recommendations'] = [];
    const metrics = result.aggregatedMetrics;
    const results = result.results;
    if (!metrics || !results) return [];

    // Rule 1: Visibility Gap in "Best Of" Intents
    const bestOfResults = results.filter(r => r.intent === 'best_of');
    const bestOfMentionRate = bestOfResults.reduce((acc, r) => acc + r.metrics.mentionRate, 0) / (bestOfResults.length || 1);
    
    if (bestOfMentionRate < 40) {
      recs.push({
        type: "Content Strategy",
        reasoning: `Your brand is missing from ${bestOfResults.length} "Best Of" queries. Models likely lack authoritative comparison data.`,
        affectedPromptCount: bestOfResults.length,
        expectedImpact: 'high'
      });
    }

    // Rule 2: Low Confidence / High Variance
    if (metrics.overallConfidence < 0.7) {
      recs.push({
        type: "Messaging Consistency",
        reasoning: "High variance detected across model runs. This indicates inconsistent brand signals in the training data.",
        affectedPromptCount: results.length,
        expectedImpact: 'medium'
      });
    }

    // Rule 3: Competitor Dominance in Citations
    const topComp = Object.entries(metrics.competitorDominance).sort((a, b) => b[1] - a[1])[0];
    if (topComp && topComp[1] > metrics.shareOfVoice * 1.5) {
      recs.push({
        type: "Authority Building",
        reasoning: `${topComp[0]} is cited significantly more often. Audit their backlink profile and comparison page structure.`,
        affectedPromptCount: results.length,
        expectedImpact: 'high'
      });
    }

    return recs;
  }
}
