export interface LLMProvider {
  id: string;
  name: string;
  providerType: 'openrouter' | 'groq' | 'together' | 'navy' | 'custom_openai';
  apiKey: string;
  baseUrl: string;
  modelName: string;
  priority: number;
  isActive: boolean;
}

export async function callLLM(
  providers: LLMProvider[],
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const sortedProviders = providers
    .filter(p => p.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const provider of sortedProviders) {
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(`Provider ${provider.name} failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error(`LLM provider ${provider.name} failed:`, error);
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}
