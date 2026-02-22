import { LLMResponse, PromptResult } from '../types';

export class MetricsService {
  /**
   * Prompt-Anchored Share of Voice (SoV)
   * Formula: Total Brand Credits / Total Credits across all prompts
   * Credit is assigned if brand appears in Top-K (default 5).
   */
  static calculateSoV(results: PromptResult[], brand: string, competitors: string[], k: number = 5): number {
    let brandCredits = 0;
    let totalCredits = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        // Brand credit
        if (run.parsed.brandMentioned && (run.parsed.rank === undefined || run.parsed.rank <= k)) {
          brandCredits++;
        }
        
        // Competitor credits (only if in Top-K)
        let compCredits = 0;
        run.parsed.competitorsMentioned.forEach(comp => {
          const rank = run.parsed.competitorRanks[comp];
          if (rank === undefined || rank <= k) {
            compCredits++;
          }
        });
        
        totalCredits += (run.parsed.brandMentioned ? 1 : 0) + compCredits;
      });
    });

    return totalCredits === 0 ? 0 : (brandCredits / totalCredits) * 100;
  }

  /**
   * Bootstrap SoV Confidence Interval
   * Resamples prompts with replacement to estimate variance of the SoV ratio.
   */
  static calculateSoVCI(results: PromptResult[], brand: string, competitors: string[], iterations: number = 1000): [number, number] {
    if (results.length === 0) return [0, 0];
    const sovDist: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const sample: PromptResult[] = [];
      for (let j = 0; j < results.length; j++) {
        sample.push(results[Math.floor(Math.random() * results.length)]);
      }
      sovDist.push(this.calculateSoV(sample, brand, competitors));
    }

    sovDist.sort((a, b) => a - b);
    return [sovDist[Math.floor(iterations * 0.025)], sovDist[Math.floor(iterations * 0.975)]];
  }

  /**
   * Wilson Score Interval for Mention Rate
   * Provides better coverage for small N or extreme proportions than Wald.
   */
  static calculateWilsonCI(mentions: number, n: number, z: number = 1.96): [number, number] {
    if (n === 0) return [0, 0];
    const p = mentions / n;
    const factor = 1 / (1 + (z * z) / n);
    const center = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [
      Math.max(0, factor * (center - spread)) * 100,
      Math.min(1, factor * (center + spread)) * 100
    ];
  }

  /**
   * Visibility Score Decomposition
   * Explains the drivers of the visibility score.
   */
  static decomposeVisibilityScore(results: PromptResult[]): {
    score: number;
    breakdown: {
      mentionContribution: number;
      rankContribution: number;
      intentWeightContribution: number;
      modelWeightContribution: number;
    };
  } {
    let totalScore = 0;
    let mentionSum = 0;
    let rankSum = 0;
    let totalRuns = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        totalRuns++;
        if (run.parsed.brandMentioned) {
          mentionSum += 0.5; // Base mention credit
          const rankCredit = run.parsed.rank ? Math.max(0, (11 - run.parsed.rank) / 10) : 0.5;
          rankSum += rankCredit;
          totalScore += 0.5 + rankCredit;
        }
      });
    });

    const finalScore = totalRuns === 0 ? 0 : (totalScore / totalRuns) * 100;
    
    return {
      score: finalScore,
      breakdown: {
        mentionContribution: totalRuns === 0 ? 0 : (mentionSum / totalRuns) * 100,
        rankContribution: totalRuns === 0 ? 0 : (rankSum / totalRuns) * 100,
        intentWeightContribution: 1.0, // Placeholder for future intent weighting
        modelWeightContribution: 1.0,  // Placeholder for future model weighting
      }
    };
  }

  /**
   * Hardened Confidence Engine
   * Rules:
   * - High rank variance reduces confidence.
   * - High absence consistency is MEDIUM confidence (to avoid false sense of security).
   * - Citation domain consistency added.
   */
  static calculateHardenedConfidence(runs: LLMResponse[]): PromptResult['metrics']['confidenceBreakdown'] & { confidence: number } {
    if (runs.length < 2) return { 
      confidence: 0.5, 
      agreement: 1, 
      jaccard: 1, 
      rankStability: 1, 
      citationStability: 1 
    };

    // 1. Agreement Rate
    const mentions = runs.filter(r => r.parsed.brandMentioned).length;
    let agreement = Math.max(mentions / runs.length, 1 - (mentions / runs.length));
    
    // Penalty: Consistent absence is only 0.3 confidence max for agreement component
    if (mentions === 0) agreement = 0.3;

    // 2. Competitor Jaccard
    const compSets = runs.map(r => new Set(r.parsed.competitorsMentioned));
    const jaccard = this.calculateAverageJaccard(compSets);

    // 3. Rank Stability (Conditional on mentions)
    const ranks = runs.map(r => r.parsed.rank).filter((r): r is number => r !== undefined);
    let rankStability = 1;
    if (ranks.length > 1) {
      const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const variance = ranks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ranks.length;
      const stdDev = Math.sqrt(variance);
      rankStability = Math.max(0, 1 - (stdDev / 5)); // Penalty for stdDev > 0
    }

    // 4. Citation Stability
    const citationSets = runs.map(r => new Set(r.parsed.citations.map(c => c.domain)));
    const citationStability = this.calculateAverageJaccard(citationSets);

    const confidence = (agreement * 0.4) + (jaccard * 0.2) + (rankStability * 0.2) + (citationStability * 0.2);

    return {
      confidence,
      agreement,
      jaccard,
      rankStability,
      citationStability
    };
  }

  private static calculateAverageJaccard(sets: Set<string>[]): number {
    let totalJaccard = 0;
    let pairs = 0;
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const intersection = new Set([...sets[i]].filter(x => sets[j].has(x)));
        const union = new Set([...sets[i], ...sets[j]]);
        totalJaccard += union.size === 0 ? 1 : intersection.size / union.size;
        pairs++;
      }
    }
    return pairs === 0 ? 1 : totalJaccard / pairs;
  }

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
   * Two-Proportion Z-Test for Delta Significance
   * Determines if the change in mention rate between two runs is statistically significant.
   */
  static calculateDeltaSignificance(
    mentions1: number, n1: number, 
    mentions2: number, n2: number, 
    alpha: number = 0.05
  ): { isSignificant: boolean; pValue: number } {
    if (n1 === 0 || n2 === 0) return { isSignificant: false, pValue: 1 };
    
    const p1 = mentions1 / n1;
    const p2 = mentions2 / n2;
    const pPooled = (mentions1 + mentions2) / (n1 + n2);
    
    if (pPooled === 0 || pPooled === 1) return { isSignificant: false, pValue: 1 };

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
    const z = (p1 - p2) / se;
    
    // Simple p-value approximation for Z (Normal distribution)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    return {
      isSignificant: pValue < alpha,
      pValue
    };
  }

  private static normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
}
