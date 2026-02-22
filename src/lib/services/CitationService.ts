import { Citation } from '../types';

export class CitationService {
  /**
   * Async verifier for citations.
   * In a real production environment, this would use a headless browser or a proxy.
   * For this pass, we implement a robust normalization and mock verification logic.
   */
  static async verifyCitations(urls: string[], brand: string): Promise<Citation[]> {
    const citations: Citation[] = [];

    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        
        // Mocking async verification
        // In reality: await fetch(url) and check for brand in text
        const isAlive = true;
        const mentionsBrand = true; // Simplified for MVP

        citations.push({
          url,
          domain,
          isAlive,
          mentionsBrand,
          verifiedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`Invalid URL found: ${url}`);
      }
    }

    return citations;
  }

  static normalizeDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}
