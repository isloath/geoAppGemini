import { describe, it, expect } from 'vitest';
import { MetricsService } from './MetricsService';

describe('MetricsService', () => {
  describe('calculateWilsonCI', () => {
    it('should calculate correct CI for 50% mention rate', () => {
      const ci = MetricsService.calculateWilsonCI(5, 10);
      expect(ci[0]).toBeGreaterThan(20);
      expect(ci[1]).toBeLessThan(80);
      expect(ci[0]).toBeLessThan(50);
      expect(ci[1]).toBeGreaterThan(50);
    });

    it('should handle 0 mentions', () => {
      const ci = MetricsService.calculateWilsonCI(0, 10);
      expect(ci[0]).toBe(0);
      expect(ci[1]).toBeGreaterThan(0);
    });
  });

  describe('decomposeVisibilityScore', () => {
    it('should decompose score into contributions', () => {
      const mockResults: any[] = [{
        runs: [
          { parsed: { brandMentioned: true, rank: 1 } },
          { parsed: { brandMentioned: true, rank: 5 } }
        ]
      }];
      const decomp = MetricsService.decomposeVisibilityScore(mockResults);
      expect(decomp.score).toBeGreaterThan(0);
      expect(decomp.breakdown.mentionContribution).toBeGreaterThan(0);
      expect(decomp.breakdown.rankContribution).toBeGreaterThan(0);
    });
  });

  describe('calculateHardenedConfidence', () => {
    it('should penalize consistent absence', () => {
      const mockRuns: any[] = [
        { parsed: { brandMentioned: false, competitorsMentioned: [], citations: [] } },
        { parsed: { brandMentioned: false, competitorsMentioned: [], citations: [] } }
      ];
      const conf = MetricsService.calculateHardenedConfidence(mockRuns);
      expect(conf.confidence).toBeLessThan(0.8); // Penalty for absence
    });

    it('should penalize rank instability', () => {
      const mockRuns: any[] = [
        { parsed: { brandMentioned: true, rank: 1, competitorsMentioned: [], citations: [] } },
        { parsed: { brandMentioned: true, rank: 10, competitorsMentioned: [], citations: [] } }
      ];
      const conf = MetricsService.calculateHardenedConfidence(mockRuns);
      expect(conf.rankStability).toBeLessThan(1);
    });
  });
});
