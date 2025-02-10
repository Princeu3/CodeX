// chatbot.js

// Add this at the top of the file with other imports
const AVAILABLE_MODELS = [
    {
        id: "meta-llama/llama-3.2-11b-vision-instruct",
        name: "Llama 3.2 11B",
        description: "Balanced performance and speed"
    },
    {
        id: "anthropic/claude-3-sonnet",
        name: "Claude 3 Sonnet",
        description: "High performance code assistant"
    },
    {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Powerful general-purpose model"
    },
    {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Fast and efficient"
    }
];

export default function initChatbot(glInstance) {
    glInstance.registerComponent('chatbot', function (container, state) {
      // Add the "dark" class so dark-mode CSS is applied.
      container.getElement().html(`
        <div class="chatbot-container dark">
            <div class="chat-controls">
                <select id="model-selector" class="model-selector">
                    ${AVAILABLE_MODELS.map(model => `
                        <option value="${model.id}">
                            ${model.name} - ${model.description}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="chat-log" id="chat-log"></div>
            <div class="chat-input">
                <input type="text" 
                       id="chat-input-field" 
                       placeholder="Ask a question about code issues..."
                       class="placeholder-gray-500" />
                <button id="chat-send-btn">
                    <i class="paper plane icon"></i>
                    Send
                </button>
            </div>
        </div>
      `);
  
      const $inputField = container.getElement().find('#chat-input-field');
  
      // Allow sending the message via the send button...
      container.getElement().on('click', '#chat-send-btn', function () {
        sendUserMessage(container);
      });
  
      // ...or by pressing the Enter key.
      $inputField.on('keydown', function (e) {
        if (e.key === "Enter") {
          // Prevent newline insertion
          e.preventDefault();
          sendUserMessage(container);
        }
      });
  
      // Add this after initializing the container
      const $modelSelector = container.getElement().find('#model-selector');
  
      // Add this after initializing the model selector
      $modelSelector.on('change', function() {
          const selectedModel = $(this).val();
          const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
          
          // Optionally show a notification about model change
          appendChatMessage('bot', `Switched to ${modelInfo.name}. ${modelInfo.description}`);
          
          // You could also store the preference in localStorage
          localStorage.setItem('preferred_model', selectedModel);
      });
  
      // Load preferred model on startup
      const savedModel = localStorage.getItem('preferred_model');
      if (savedModel && AVAILABLE_MODELS.some(m => m.id === savedModel)) {
          $modelSelector.val(savedModel);
      }
  
      // Update the chatbot container styles
      container.getElement().addClass('chatbot-wrapper');
    });
  }
  
  /**
   * Reads the input, appends the user message, and triggers the LLM call.
   */
  function sendUserMessage(container) {
    const inputField = container.getElement().find('#chat-input-field');
    const question = inputField.val().trim();
    if (question) {
      appendChatMessage('user', question, container);
      inputField.val('');
      // Pass container to getLLMResponse
      getLLMResponse(question, container).then(response => {
        appendChatMessage('bot', response, container);
      }).catch(err => {
        console.error(err);
        appendChatMessage('bot', 'Error: Unable to get a response.', container);
      });
    }
  }

  /**
   * Appends a chat message to the chat log.
   * For bot messages, if the response contains code blocks (in markdown),
   * the code blocks are extracted and rendered in separate code containers with copy buttons.
   */
  function appendChatMessage(sender, message, container) {
    const chatLog = container.getElement().find('#chat-log');
    let messageHtml = "";
  
    if (sender === 'bot') {
      // Check if the message contains a code block (fenced with triple backticks)
      if (message.indexOf("```") !== -1) {
        // Use a regex to split the response into text and code segments.
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let htmlSegments = "";
  
        let match;
        while ((match = codeBlockRegex.exec(message)) !== null) {
          // Append the text before the code block
          const textSegment = message.substring(lastIndex, match.index);
          if (textSegment.trim().length > 0) {
            htmlSegments += `<div class="chat-text prose prose-invert">${(typeof marked !== "undefined") ? marked.parse(textSegment) : textSegment}</div>`;
          }
          // Extract language (if provided) and code content.
          const language = match[1] || "";
          const codeContent = match[2];
          // Render the code block in its own container with a copy button.
          htmlSegments += `
            <div class="chat-code">
                <pre><code class="language-${language}">${escapeHtml(codeContent)}</code></pre>
                <button class="copy-code-btn" onclick="copyCodeToClipboard(this)">
                    <i class="copy icon"></i> Copy
                </button>
            </div>`;
          lastIndex = match.index + match[0].length;
        }
        // Append any remaining text after the last code block.
        const remainingText = message.substring(lastIndex);
        if (remainingText.trim().length > 0) {
          htmlSegments += `<div class="chat-text prose prose-invert">${(typeof marked !== "undefined") ? marked.parse(remainingText) : remainingText}</div>`;
        }
        messageHtml = `<div class="chat-message ${sender}">${htmlSegments}</div>`;
      } else {
        // If no code blocks, render the message normally as markdown.
        messageHtml = `<div class="chat-message ${sender} prose prose-invert">${(typeof marked !== "undefined") ? marked.parse(message) : message}</div>`;
      }
    } else {
      // For user messages, display as plain text.
      messageHtml = `<div class="chat-message ${sender}">${message}</div>`;
    }
    chatLog.append(messageHtml);
    chatLog.scrollTop(chatLog[0].scrollHeight);
  }
  
  /**
   * Escapes HTML special characters in code content.
   */
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
  }
  
  /**
   * Global function to copy the code from a code container.
   */
  window.copyCodeToClipboard = function(button) {
    // Find the parent code container.
    const codeContainer = button.parentElement;
    // Get the text content from the <code> block.
    const codeText = codeContainer.querySelector('code').innerText;
    navigator.clipboard.writeText(codeText).then(() => {
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = "Copy Code";
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy code: ", err);
    });
  }
  
  //We can retrieve the code from all active tabs using:
  function getActiveEditorCode() {
    return monaco.editor.getModels().map(model => model.getValue()).join("\n");
}

  /**
   * Calls the OpenRouter API to get a response.
   */
  async function getLLMResponse(question, container, attempt = 0) {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 1000;

    const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    
    // Get the model selector from the container
    const $modelSelector = container.getElement().find('#model-selector');
    const selectedModel = $modelSelector.val() || "meta-llama/llama-3.2-11b-vision-instruct";
    
    const activeCode = getActiveEditorCode();

    // Get the system prompt for the selected model
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
                "Authorization": "Bearer sk-or-xxxx",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Judge0 IDE",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text(); // Read response text only once
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json(); // Read response JSON only once
        console.log("OpenRouter API response:", data);

        let reply = "";
        if (data.choices && data.choices[0] && data.choices[0].message) {
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

        // Retry if empty response
        if (!reply.trim() && attempt < MAX_ATTEMPTS) {
            console.warn(`Empty reply received. Retrying attempt ${attempt + 1} of ${MAX_ATTEMPTS}...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return await getLLMResponse(question, container, attempt + 1);
        }

        return reply || "No reply received.";
    } catch (error) {
        console.error("Error in getLLMResponse:", error);
        return "Error: Unable to get a response from the model.";
    }
}

function getSystemPromptForModel(modelId) {
    const basePrompt = `You are an AI assistant integrated into an online code editor.
Your main job is to help users with their code, but you should also be able to engage in casual conversation.

The following are your guidelines:
1. **If the user asks for coding help**:
   - Always consider the user's provided code.
   - Analyze the code and provide relevant help (debugging, optimization, explanation, etc.).
   - Make sure to be specific and clear when explaining things about their code.

2. **If the user asks a casual question or makes a casual statement**:
   - Engage in friendly, natural conversation.
   - Do not reference the user's code unless they bring it up or ask for help.
   - Be conversational and polite.

3. **If the user's message is ambiguous or unclear**:
   - Politely ask for clarification or more details to better understand the user's needs.
   - If the user seems confused about something, help guide them toward what they need.

4. **General Behavior**:
   - Always respond in a helpful, friendly, and professional tone.
   - Never assume the user's intent. If unsure, ask clarifying questions.
   - Keep the conversation flowing naturally, even if the user hasn't directly asked about their code.

You will always have access to the user's latest code.
Use this context only when relevant to the user's message.
If their message is unrelated to the code, focus solely on their conversational intent.`;
    
    // Add model-specific instructions
    switch(modelId) {
        case 'anthropic/claude-3-sonnet':
            return basePrompt + `\nYou are Claude 3 Sonnet, known for detailed code analysis and explanations.`;
        case 'gpt-4-turbo':
            return basePrompt + `\nYou are GPT-4 Turbo, capable of handling complex programming tasks.`;
        case 'gpt-3.5-turbo':
            return basePrompt + `\nYou are GPT-3.5 Turbo, optimized for quick and efficient responses.`;
        default:
            return basePrompt + `\nYou are Llama 3.2, balanced for both performance and speed.`;
    }
}