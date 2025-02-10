// chatbot.js

import { getLLMResponse } from './apiClient.js';
import { escapeHtml } from './utils.js';
import { copyCodeToClipboard } from './copy.js';

// Expose copy function for inline onclick usage.
window.copyCodeToClipboard = copyCodeToClipboard;

const AVAILABLE_MODELS = [
    {
        id: "meta-llama/llama-3.2-11b-vision-instruct",
        name: "Llama 3.2 11B",
        description: "Balanced performance and speed"
    },
    {
        id: "deepseek/deepseek-r1-distill-llama-70b:free",
        name: "DeepSeek R1",
        description: "Reasoning Model, Slow, Might be down sometimes"
    },
    {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash",
        description: "Powerful general-purpose model"
    },
    {
        id: "google/gemini-2.0-pro-exp-02-05:free",
        name: "Gemini 2.0 Pro",
        description: "Powerful general-purpose model"
    },

    {
        id: "qwen/qwen2.5-vl-72b-instruct:free",
        name: "Qwen 2.5 VL 72B",
        description: "Powerful"
    },

    {
        id: "mistralai/mistral-7b-instruct:free",
        name: "Mistral 7B",
        description: "Balanced performance and speed"
    },
];

export default function initChatbot(glInstance) {
    glInstance.registerComponent('chatbot', function(container) {
        // Render UI
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
    
        const $element = container.getElement();
        const $inputField = $element.find('#chat-input-field');
    
        // Send message on button click or Enter key.
        $element.on('click', '#chat-send-btn', () => sendUserMessage(container));
    
        // ...or by pressing the Enter key.
        $inputField.on('keydown', (e) => {
          if (e.key === "Enter") {
            // Prevent newline insertion
            e.preventDefault();
            sendUserMessage(container);
          }
        });
    
        // Add this after initializing the container
        const $modelSelector = $element.find('#model-selector');
    
        // Handle model selection.
        $modelSelector.on('change', function() {
            const selectedModel = $(this).val();
            const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
            
            // Optionally show a notification about model change
            appendChatMessage('bot', `Switched to ${modelInfo.name}. ${modelInfo.description}`, container);
            
            // You could also store the preference in localStorage
            localStorage.setItem('preferred_model', selectedModel);
        });
    
        // Load saved model preference.
        const savedModel = localStorage.getItem('preferred_model');
        if (savedModel && AVAILABLE_MODELS.some(m => m.id === savedModel)) {
            $modelSelector.val(savedModel);
        }
    
        // Update the chatbot container styles
        $element.addClass('chatbot-wrapper');
    });
}

/**
 * Sends the user message and processes the response.
 */
function sendUserMessage(container) {
  const $element = container.getElement();
  const $inputField = $element.find('#chat-input-field');
  const question = $inputField.val().trim();
  if (question) {
    appendChatMessage('user', question, container);
    $inputField.val('');
    getLLMResponse(question, container)
      .then(response => appendChatMessage('bot', response, container))
      .catch(err => {
        console.error(err);
        appendChatMessage('bot', 'Error: Unable to get response.', container);
      });
  }
}

/**
 * Appends a new message to the chat log.
 * For bot messages, if the response contains code blocks (in markdown),
 * the code blocks are extracted and rendered in separate code containers with copy buttons.
 */
function appendChatMessage(sender, message, container) {
  const $chatLog = container.getElement().find('#chat-log');
  let html = "";

  if (sender === 'bot') {
    // Process code blocks if any.
    if (message.includes("```")) {
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let lastIndex = 0;
      let segments = "";
      let match;
      while ((match = codeBlockRegex.exec(message)) !== null) {
        const textSegment = message.substring(lastIndex, match.index);
        if (textSegment.trim()) {
          segments += `<div class="chat-text prose prose-invert">${
            typeof marked !== "undefined" ? marked.parse(textSegment) : textSegment
          }</div>`;
        }
        const language = match[1] || "";
        const codeContent = match[2];
        segments += `
          <div class="chat-code">
              <pre><code class="language-${language}">${escapeHtml(codeContent)}</code></pre>
              <button class="copy-code-btn" onclick="copyCodeToClipboard(this)">
                  <i class="copy icon"></i> Copy
              </button>
          </div>`;
        lastIndex = match.index + match[0].length;
      }
      const remaining = message.substring(lastIndex);
      if (remaining.trim()) {
        segments += `<div class="chat-text prose prose-invert">${
          typeof marked !== "undefined" ? marked.parse(remaining) : remaining
        }</div>`;
      }
      html = `<div class="chat-message ${sender}">${segments}</div>`;
    } else {
      // If no code blocks, render the message normally as markdown.
      html = `<div class="chat-message ${sender} prose prose-invert">${(typeof marked !== "undefined") ? marked.parse(message) : message}</div>`;
    }
  } else {
    // For user messages, display as plain text.
    html = `<div class="chat-message ${sender}">${message}</div>`;
  }
  $chatLog.append(html);
  $chatLog.scrollTop($chatLog[0].scrollHeight);
}

