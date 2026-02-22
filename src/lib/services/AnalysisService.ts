import { v4 as uuidv4 } from 'uuid';
import { AnalysisJobInput, AnalysisResult, PromptResult, LLMResponse, PromptTemplate, Intent } from '../types';
import { OpenAIProvider } from '../llm/OpenAIProvider';
import { AnthropicProvider } from '../llm/AnthropicProvider';
import { MetricsService } from './MetricsService';
import { InsightService } from './InsightService';
import db from '../db';

export class AnalysisService {
  private providers = [new OpenAIProvider(), new AnthropicProvider()];

  private getPromptTemplates(category: string): PromptTemplate[] {
    return [
      {
        id: 'p1',
        text: `What are the best ${category} solutions for a mid-sized enterprise?`,
        intent: 'best_of',
        locale: 'en-US',
        version: '1.1',
        weight: 1.2
      },
      {
        id: 'p2',
        text: `Compare the top 5 ${category} platforms currently on the market.`,
        intent: 'comparison',
        locale: 'en-US',
        version: '1.1',
        weight: 1.0
      },
      {
        id: 'p3',
        text: `I'm looking for a ${category} tool that integrates well with Slack and Salesforce. Any recommendations?`,
        intent: 'use_case',
        locale: 'en-US',
        version: '1.1',
        weight: 0.8
      }
    ];
  }

  async createJob(input: AnalysisJobInput, previousAnalysisId?: string): Promise<string> {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO analysis_runs (id, project_id, previous_analysis_id, status, input_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.projectId, previousAnalysisId || null, 'pending', JSON.stringify(input));

    this.runAnalysis(id, input).catch(console.error);
    return id;
  }

  async rerunJob(analysisId: string): Promise<string> {
    const job = this.getJob(analysisId);
    if (!job) throw new Error('Analysis not found');
    return this.createJob(job.input, analysisId);
  }

  private async runAnalysis(id: string, input: AnalysisJobInput) {
    db.prepare("UPDATE analysis_runs SET status = 'processing' WHERE id = ?").run(id);

    const templates = this.getPromptTemplates(input.category);
    const results: PromptResult[] = [];
    let totalCost = 0;

    for (const template of templates) {
      const runs: LLMResponse[] = [];
      
      for (const provider of this.providers) {
        for (let i = 0; i < input.runsPerPrompt; i++) {
          const start = Date.now();
          const temperature = 0.7;
          const max_tokens = 1024;

          try {
            const raw = await provider.generate(template.text);
            const parsed = await (provider as any).parseResponse(
              raw, 
              input.brand, 
              input.competitors, 
              input.brandAliases
            );
            
            const tokensUsed = Math.ceil(raw.length / 4);
            const cost = (tokensUsed / 1000) * 0.01; // Simplified cost model
            totalCost += cost;

            runs.push({
              raw,
              parsed,
              model: provider.model,
              provider: provider.name,
              latencyMs: Date.now() - start,
              tokensUsed,
              costEstimate: cost,
              params: {
                temperature,
                top_p: 1.0,
                max_tokens,
                repeat_index: i,
                prompt_version: template.version,
              }
            });
          } catch (error) {
            console.error(`[AUDIT] Error in ${provider.name} run ${i}:`, error);
          }
        }
      }

      const confidenceData = MetricsService.calculateHardenedConfidence(runs);
      const mentions = runs.filter(r => r.parsed.brandMentioned).length;
      const mentionRate = (mentions / runs.length) * 100;

      results.push({
        promptId: template.id,
        promptText: template.text,
        intent: template.intent as Intent,
        runs,
        metrics: {
          mentionRate,
          mentionRateCI: MetricsService.calculateWilsonCI(mentions, runs.length),
          avgRank: MetricsService.calculateAvgRank([{ runs } as any]),
          agreementRate: confidenceData.agreement,
          competitorJaccard: confidenceData.jaccard,
          citationJaccard: confidenceData.citationStability,
          confidence: confidenceData.confidence,
          confidenceBreakdown: {
            agreement: confidenceData.agreement,
            jaccard: confidenceData.jaccard,
            rankStability: confidenceData.rankStability,
            citationStability: confidenceData.citationStability,
          }
        }
      });
    }

    const totalMentions = results.reduce((acc, r) => acc + r.runs.filter(run => run.parsed.brandMentioned).length, 0);
    const totalRuns = results.reduce((acc, r) => acc + r.runs.length, 0);
    const visibilityDecomp = MetricsService.decomposeVisibilityScore(results);

    const aggregatedMetrics = {
      shareOfVoice: MetricsService.calculateSoV(results, input.brand, input.competitors),
      sovCI: MetricsService.calculateSoVCI(results, input.brand, input.competitors),
      mentionRate: (totalMentions / totalRuns) * 100,
      mentionRateCI: MetricsService.calculateWilsonCI(totalMentions, totalRuns),
      avgRank: MetricsService.calculateAvgRank(results),
      weightedVisibilityScore: visibilityDecomp.score,
      visibilityBreakdown: visibilityDecomp.breakdown,
      competitorDominance: this.calculateCompetitorDominance(results, input.competitors),
      citationAnalytics: this.calculateCitationAnalytics(results, input.competitors),
      overallConfidence: results.reduce((acc, r) => acc + r.metrics.confidence, 0) / results.length,
    };

    const recommendations = InsightService.generateRecommendations({ results, aggregatedMetrics });

    // Delta Significance calculation
    let deltaSignificance = undefined;
    if (input.projectId && id) {
      const previousRun = db.prepare("SELECT * FROM analysis_runs WHERE project_id = ? AND id != ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1").get(input.projectId, id) as any;
      if (previousRun && previousRun.metrics_json) {
        const prevMetrics = JSON.parse(previousRun.metrics_json);
        const prevMentions = Math.round((prevMetrics.mentionRate / 100) * totalRuns); // Approximation
        const sig = MetricsService.calculateDeltaSignificance(totalMentions, totalRuns, prevMentions, totalRuns);
        deltaSignificance = {
          isSignificant: sig.isSignificant,
          pValue: sig.pValue,
          previousAnalysisId: previousRun.id
        };
      }
    }

    const finalAggregatedMetrics = {
      ...aggregatedMetrics,
      deltaSignificance
    };

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
      JSON.stringify(finalAggregatedMetrics),
      JSON.stringify(recommendations),
      id
    );
    
    console.log(`[AUDIT] Analysis ${id} completed. Total tokens: ~${Math.ceil(totalCost * 100000)}, Est Cost: $${totalCost.toFixed(4)}`);
  }

  private calculateCitationAnalytics(results: PromptResult[], competitors: string[]) {
    const domainCounts: Record<string, number> = {};
    const compCitationCounts: Record<string, number> = {};
    competitors.forEach(c => compCitationCounts[c] = 0);
    let totalCitations = 0;

    results.forEach(res => {
      res.runs.forEach(run => {
        run.parsed.citations.forEach(cit => {
          totalCitations++;
          domainCounts[cit.domain] = (domainCounts[cit.domain] || 0) + 1;
          // Heuristic: if citation mentions brand or competitor
          competitors.forEach(comp => {
            if (cit.url.toLowerCase().includes(comp.toLowerCase())) {
              compCitationCounts[comp]++;
            }
          });
        });
      });
    });

    const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    const topDomainConcentration = totalCitations === 0 ? 0 : (sortedDomains[0]?.[1] || 0) / totalCitations;

    const competitorCitationShare: Record<string, number> = {};
    Object.entries(compCitationCounts).forEach(([name, count]) => {
      competitorCitationShare[name] = totalCitations === 0 ? 0 : (count / totalCitations) * 100;
    });

    return {
      competitorCitationShare,
      topDomainConcentration,
      authorityGapIndex: 1 - topDomainConcentration, // Heuristic
    };
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
      projectId: row.project_id,
      previousAnalysisId: row.previous_analysis_id,
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
