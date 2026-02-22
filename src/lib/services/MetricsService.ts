import { LLMResponse, PromptResult } from '../types';

export class MetricsService {
  /**
   * Share of Voice (SoV) Formula:
   * (Total Brand Mentions / Total Mentions of All Tracked Brands) * 100
   */
  static calculateSoV(results: PromptResult[], brand: string, competitors: string[]): number {
    let brandMentions = 0;
    let totalMentions = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        if (run.parsed.brandMentioned) brandMentions++;
        totalMentions += (run.parsed.brandMentioned ? 1 : 0) + run.parsed.competitorsMentioned.length;
      });
    });

    return totalMentions === 0 ? 0 : (brandMentions / totalMentions) * 100;
  }

  /**
   * Mention Rate Formula:
   * (Total Brand Mentions / Total Number of Runs) * 100
   */
  static calculateMentionRate(results: PromptResult[]): number {
    let mentions = 0;
    let totalRuns = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        totalRuns++;
        if (run.parsed.brandMentioned) mentions++;
      });
    });

    return totalRuns === 0 ? 0 : (mentions / totalRuns) * 100;
  }

  /**
   * Average Rank Formula:
   * Sum(Rank) / Count(Runs where rank exists)
   */
  static calculateAvgRank(results: PromptResult[]): number | undefined {
    let sum = 0;
    let count = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        if (run.parsed.rank) {
          sum += run.parsed.rank;
          count++;
        }
      });
    });

    return count === 0 ? undefined : sum / count;
  }

  /**
   * Confidence Score Formula:
   * 1 - (Standard Deviation of Mentions across runs / Mean Mentions)
   * Simplified for MVP: Percentage of runs that agree on the mention status.
   */
  static calculateConfidence(runs: LLMResponse[]): number {
    if (runs.length === 0) return 0;
    const mentions = runs.filter(r => r.parsed.brandMentioned).length;
    const rate = mentions / runs.length;
    // High confidence if rate is close to 1 or 0 (consensus)
    return Math.max(rate, 1 - rate);
  }
}
