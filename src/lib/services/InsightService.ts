import { AnalysisResult } from '../types';

export class InsightService {
  static generateRecommendations(result: Partial<AnalysisResult>): string[] {
    const recs: string[] = [];
    const metrics = result.aggregatedMetrics;
    if (!metrics) return [];

    // Rule 1: Visibility Gap
    const compAvg = Object.values(metrics.competitorDominance).reduce((a, b) => a + b, 0) / 
                    (Object.keys(metrics.competitorDominance).length || 1);
    
    if (metrics.shareOfVoice < compAvg) {
      recs.push("Visibility Gap: Your brand is being recommended significantly less than competitors. Consider optimizing your technical documentation and public PR.");
    }

    // Rule 2: Rank Weakness
    if (metrics.avgRank && metrics.avgRank > 3) {
      recs.push("Low Ranking: You appear in lists but often at the bottom. Focus on 'Best of' content and comparison pages to improve authority.");
    }

    // Rule 3: Low Consensus
    if (metrics.overallConfidence < 0.7) {
      recs.push("Low Model Consensus: Models are inconsistent in mentioning you. This usually indicates a lack of clear, authoritative data about your brand in the training set.");
    }

    // Rule 4: Competitor Dominance
    const topComp = Object.entries(metrics.competitorDominance).sort((a, b) => b[1] - a[1])[0];
    if (topComp && topComp[1] > metrics.shareOfVoice * 2) {
      recs.push(`Competitor Dominance: ${topComp[0]} is dominating the conversation. Audit their backlink profile and cited sources to understand their advantage.`);
    }

    return recs.slice(0, 3);
  }
}
