// chatbot.js

export default function initChatbot(glInstance) {
    glInstance.registerComponent('chatbot', function (container, state) {
      // Add the "dark" class so dark-mode CSS is applied.
      container.getElement().html(`
        <div class="chatbot-container dark">
          <div class="chat-log" id="chat-log"></div>
          <div class="chat-input">
            <input type="text" id="chat-input-field" placeholder="Ask a question about code issues..." />
            <button id="chat-send-btn">Send</button>
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
      // Pass both the question and the active tab code to the LLM.
      getLLMResponse(question).then(response => {
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
            htmlSegments += `<div class="chat-text">${(typeof marked !== "undefined") ? marked.parse(textSegment) : textSegment}</div>`;
          }
          // Extract language (if provided) and code content.
          const language = match[1] || "";
          const codeContent = match[2];
          // Render the code block in its own container with a copy button.
          htmlSegments += `<div class="chat-code">
            <pre><code class="language-${language}">${escapeHtml(codeContent)}</code></pre>
            <button class="copy-code-btn" onclick="copyCodeToClipboard(this)">Copy Code</button>
          </div>`;
          lastIndex = match.index + match[0].length;
        }
        // Append any remaining text after the last code block.
        const remainingText = message.substring(lastIndex);
        if (remainingText.trim().length > 0) {
          htmlSegments += `<div class="chat-text">${(typeof marked !== "undefined") ? marked.parse(remainingText) : remainingText}</div>`;
        }
        messageHtml = `<div class="chat-message ${sender}">${htmlSegments}</div>`;
      } else {
        // If no code blocks, render the message normally as markdown.
        messageHtml = `<div class="chat-message ${sender}">${(typeof marked !== "undefined") ? marked.parse(message) : message}</div>`;
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
  async function getLLMResponse(question, attempt = 0) {
    const MAX_ATTEMPTS = 3; // Max retry attempts
    const RETRY_DELAY_MS = 1000; // 1 second delay for retry

    const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    
    const activeCode = getActiveEditorCode(); // Get active code from Monaco editor

    const payload = {
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
        messages: [
            {
                role: "system",
                content: [
                    { type: "text", text: "You are an AI assistant inside an online IDE. Help debug, explain, and improve code." }
                ]
            },
            {
                role: "user",
                content: [
                    { type: "text", text: `User Question: ${question}\n\nActive Code:\n${activeCode}` }
                ]
            }
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
            throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        const data = await response.json();
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
            return await getLLMResponse(question, attempt + 1);
        }

        return reply || "No reply received.";
    } catch (error) {
        console.error("Error in getLLMResponse:", error);
        return "Error: Unable to get a response from the model.";
    }
}