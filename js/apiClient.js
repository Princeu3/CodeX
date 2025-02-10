import { delay } from './utils.js';

/**
 * Returns the active editor code.
 */
function getActiveEditorCode() {
  return monaco.editor.getModels().map(model => model.getValue()).join("\n");
}

/**
 * Provides a system prompt based on the selected model.
 */
export function getSystemPromptForModel(modelId) {
  const basePrompt = `You are an AI assistant integrated into an online code editor.
Your role is to help with code and engage in friendly conversation.
Guidelines:
- Provide focused code help.
- Engage conversationally.
- Ask clarifying questions if needed.
You have access to the latest code. Use it only if relevant.`;

  const prompts = {
    'anthropic/claude-3-sonnet': `${basePrompt}\nYou are Claude 3 Sonnet.`,
    'gpt-4-turbo': `${basePrompt}\nYou are GPT-4 Turbo.`,
    'gpt-3.5-turbo': `${basePrompt}\nYou are GPT-3.5 Turbo.`,
    default: `${basePrompt}\nYou are Llama 3.2.`
  };

  return prompts[modelId] || prompts.default;
}

/**
 * Calls the OpenRouter API to get a response.
 */
export async function getLLMResponse(question, container, attempt = 0) {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1000;
  const apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  // Get model and code context.
  const $modelSelector = container.getElement().find('#model-selector');
  const selectedModel = $modelSelector.val() || "meta-llama/llama-3.2-11b-vision-instruct";
  const activeCode = getActiveEditorCode();
  const systemPrompt = getSystemPromptForModel(selectedModel);

  const payload = {
    model: selectedModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `User Question: ${question}\n\nActive Code:\n${activeCode}` }
    ]
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "HTTP-Referer": "http://localhost:8080",
        "X-Title": "Judge0 IDE",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("API response:", data);

    let reply = "";
    if (data.choices && data.choices[0]?.message) {
      const msg = data.choices[0].message;
      if (typeof msg.content === "string") {
        reply = msg.content;
      } else if (Array.isArray(msg.content)) {
        reply = msg.content
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join("\n");
      }
    }

    if (!reply.trim() && attempt < MAX_ATTEMPTS) {
      console.warn(`Empty reply. Retrying attempt ${attempt + 1}...`);
      await delay(RETRY_DELAY_MS);
      return await getLLMResponse(question, container, attempt + 1);
    }

    return reply || "No reply received.";
  } catch (error) {
    console.error("getLLMResponse error:", error);
    return "Error: Unable to get model response.";
  }
} 