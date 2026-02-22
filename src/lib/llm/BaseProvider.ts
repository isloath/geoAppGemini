import { LLMResponse } from '../types';
import { CitationService } from '../services/CitationService';

export abstract class BaseLLMProvider {
  abstract name: string;
  abstract model: string;

  abstract generate(prompt: string): Promise<string>;

  /**
   * Hardened Two-Pass Parser
   */
  protected async parseResponse(
    raw: string, 
    brand: string, 
    competitors: string[], 
    aliases: string[] = []
  ): Promise<LLMResponse['parsed']> {
    const lowerRaw = raw.toLowerCase();
    const allBrandNames = [brand, ...aliases].map(a => a.toLowerCase());
    
    // Pass 1: Brand Detection (Prose + Lists)
    const brandMentioned = allBrandNames.some(name => lowerRaw.includes(name));
    
    // Competitor Detection
    const competitorsMentioned = competitors.filter(c => 
      lowerRaw.includes(c.toLowerCase())
    );

    // Pass 2: Structured Extraction (Rank & Citations)
    let rank: number | undefined = undefined;
    const competitorRanks: Record<string, number> = {};

    // Extract ranks for all brands (target + competitors)
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const match = lines[i].match(/^(\d+)[.)]/);
      const listRank = match ? parseInt(match[1]) : undefined;

      // Check target brand
      if (allBrandNames.some(name => line.includes(name))) {
        if (listRank) rank = listRank;
        else if (line.includes('recommend') || line.includes('suggest')) {
          rank = rank || (i < 5 ? i + 1 : undefined);
        }
      }

      // Check competitors
      competitors.forEach(comp => {
        if (line.includes(comp.toLowerCase())) {
          if (listRank) competitorRanks[comp] = listRank;
        }
      });
    }

    // Citation Extraction
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = Array.from(new Set(raw.match(urlRegex) || []));
    const citations = await CitationService.verifyCitations(urls, brand);

    return {
      brandMentioned,
      rank,
      competitorsMentioned,
      competitorRanks,
      citations,
    };
  }
}
