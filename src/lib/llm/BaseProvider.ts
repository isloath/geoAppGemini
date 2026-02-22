import { LLMResponse } from '../types';

export abstract class BaseLLMProvider {
  abstract name: string;
  abstract model: string;

  abstract generate(prompt: string): Promise<string>;

  protected async parseResponse(raw: string, brand: string, competitors: string[]): Promise<LLMResponse['parsed']> {
    const lowerRaw = raw.toLowerCase();
    const brandMentioned = lowerRaw.includes(brand.toLowerCase());
    
    const competitorsMentioned = competitors.filter(c => 
      lowerRaw.includes(c.toLowerCase())
    );

    // Naive rank extraction: look for numbered lists
    let rank: number | undefined = undefined;
    if (brandMentioned) {
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(brand.toLowerCase())) {
          const match = lines[i].match(/^(\d+)[.)]/);
          if (match) {
            rank = parseInt(match[1]);
            break;
          }
        }
      }
    }

    // Naive source extraction: look for URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const sources = raw.match(urlRegex) || [];

    return {
      brandMentioned,
      rank,
      competitorsMentioned,
      sources: Array.from(new Set(sources)),
    };
  }
}
