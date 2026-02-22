import OpenAI from 'openai';
import { BaseLLMProvider } from './BaseProvider';

export class OpenAIProvider extends BaseLLMProvider {
  name = 'openai';
  model = 'gpt-4o';
  private client: OpenAI;

  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    });
  }

  async generate(prompt: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      return `Mock OpenAI response for: ${prompt.substring(0, 50)}... Mentioning brand in position 2.`;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  }
}
