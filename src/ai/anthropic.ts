import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import type { DraftRequest } from './prompt';
import type { Send } from './engine';

/**
 * The single network call in the app. The SDK is loaded on first use so it
 * never weighs on the first page load. maxRetries is 0 because the engine
 * handles retries itself (and tests them).
 */
export function anthropicSend<R extends MessageCreateParamsNonStreaming = DraftRequest>(apiKey: string): Send<R> {
  return async (request) => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 60_000 });
    const message = await client.messages.create(request);
    const tool = message.content.find((block) => block.type === 'tool_use');
    return {
      toolInput: tool && tool.type === 'tool_use' ? tool.input : undefined,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  };
}

/** Checks a key without generating anything (listing models costs nothing). */
export async function checkApiKey(apiKey: string): Promise<'ok' | 'invalid' | 'network'> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 20_000 });
    await client.models.list({ limit: 1 });
    return 'ok';
  } catch (error) {
    const status = (error as { status?: number }).status;
    return status === 401 || status === 403 ? 'invalid' : 'network';
  }
}
