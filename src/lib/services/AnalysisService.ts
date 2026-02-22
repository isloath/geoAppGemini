import { v4 as uuidv4 } from 'uuid';
import { AnalysisJobInput, AnalysisResult, PromptResult, LLMResponse } from '../types';
import { OpenAIProvider } from '../llm/OpenAIProvider';
import { AnthropicProvider } from '../llm/AnthropicProvider';
import { MetricsService } from './MetricsService';
import { InsightService } from './InsightService';
import db from '../db';

export class AnalysisService {
  private providers = [new OpenAIProvider(), new AnthropicProvider()];

  private getPrompts(category: string, brand: string): string[] {
    return [
      `What are the best ${category} solutions for a mid-sized enterprise?`,
      `Compare the top 5 ${category} platforms currently on the market.`,
      `I'm looking for a ${category} tool that integrates well with Slack and Salesforce. Any recommendations?`,
    ];
  }

  async createJob(input: AnalysisJobInput): Promise<string> {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO analysis_runs (id, status, input_json)
      VALUES (?, ?, ?)
    `).run(id, 'pending', JSON.stringify(input));

    // In a real production app, this would be pushed to a Celery/Redis queue.
    // Here we use a background promise to simulate async processing.
    this.runAnalysis(id, input).catch(console.error);

    return id;
  }

  private async runAnalysis(id: string, input: AnalysisJobInput) {
    db.prepare("UPDATE analysis_runs SET status = 'processing' WHERE id = ?").run(id);

    const prompts = this.getPrompts(input.category, input.brand);
    const results: PromptResult[] = [];

    for (const promptText of prompts) {
      const runs: LLMResponse[] = [];
      
      for (const provider of this.providers) {
        for (let i = 0; i < input.runsPerPrompt; i++) {
          const start = Date.now();
          try {
            const raw = await provider.generate(promptText);
            const parsed = await (provider as any).parseResponse(raw, input.brand, input.competitors);
            
            runs.push({
              raw,
              parsed,
              model: provider.model,
              provider: provider.name,
              latencyMs: Date.now() - start,
            });
          } catch (error) {
            console.error(`Error in ${provider.name} run ${i}:`, error);
          }
        }
      }

      results.push({
        prompt: promptText,
        runs,
        metrics: {
          mentionRate: MetricsService.calculateMentionRate([{ prompt: promptText, runs, metrics: { mentionRate: 0, confidence: 0 } }]),
          avgRank: MetricsService.calculateAvgRank([{ prompt: promptText, runs, metrics: { mentionRate: 0, confidence: 0 } }]),
          confidence: MetricsService.calculateConfidence(runs),
        }
      });
    }

    const aggregatedMetrics = {
      shareOfVoice: MetricsService.calculateSoV(results, input.brand, input.competitors),
      mentionRate: MetricsService.calculateMentionRate(results),
      avgRank: MetricsService.calculateAvgRank(results),
      competitorDominance: this.calculateCompetitorDominance(results, input.competitors),
      overallConfidence: results.reduce((acc, r) => acc + r.metrics.confidence, 0) / results.length,
    };

    const recommendations = InsightService.generateRecommendations({ aggregatedMetrics });

    db.prepare(`
      UPDATE analysis_runs 
      SET status = 'completed', 
          results_json = ?, 
          metrics_json = ?, 
          recommendations_json = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      JSON.stringify(results),
      JSON.stringify(aggregatedMetrics),
      JSON.stringify(recommendations),
      id
    );
  }

  private calculateCompetitorDominance(results: PromptResult[], competitors: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    competitors.forEach(c => counts[c] = 0);
    let totalMentions = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        run.parsed.competitorsMentioned.forEach(c => {
          if (counts[c] !== undefined) {
            counts[c]++;
            totalMentions++;
          }
        });
      });
    });

    const dominance: Record<string, number> = {};
    Object.entries(counts).forEach(([name, count]) => {
      dominance[name] = totalMentions === 0 ? 0 : (count / totalMentions) * 100;
    });
    return dominance;
  }

  getJob(id: string): any {
    const row = db.prepare("SELECT * FROM analysis_runs WHERE id = ?").get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      status: row.status,
      input: JSON.parse(row.input_json),
      results: row.results_json ? JSON.parse(row.results_json) : null,
      aggregatedMetrics: row.metrics_json ? JSON.parse(row.metrics_json) : null,
      recommendations: row.recommendations_json ? JSON.parse(row.recommendations_json) : null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}
