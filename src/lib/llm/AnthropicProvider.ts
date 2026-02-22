import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './BaseProvider';

export class AnthropicProvider extends BaseLLMProvider {
  name = 'anthropic';
  model = 'claude-3-5-sonnet-20240620';
  private client: Anthropic;

  constructor() {
    super();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key',
    });
  }

  async generate(prompt: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return `Mock Anthropic response for: ${prompt.substring(0, 50)}... High visibility for brand.`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return (response.content[0] as any).text || '';
  }
}
