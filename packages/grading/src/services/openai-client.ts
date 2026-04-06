import OpenAI from 'openai';
import { z } from 'zod';

export class OpenAIGradingClient {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.NIBRAS_AI_API_KEY,
      baseURL: process.env.NIBRAS_AI_BASE_URL || 'https://api.openai.com/v1',
    });
  }

  /**
   * Sends a prompt to OpenAI and validates the response against a Zod schema.
   */
  async gradeWithSchema<T extends z.ZodType>(
    prompt: string,
    schema: T,
    model = process.env.NIBRAS_AI_MODEL || 'gpt-4o-mini'
  ): Promise<z.infer<T>> {
    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, // Forces JSON response
      temperature: 0.1, // Low temperature for consistent grading
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    try {
      const parsed = JSON.parse(content);
      // Validate against the schema (e.g., ExamGradingSchema)
      return schema.parse(parsed);
    } catch (error) {
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }
}
