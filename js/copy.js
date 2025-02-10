/**
 * Copies code from a button's parent container.
 */
export function copyCodeToClipboard(button) {
  const codeContainer = button.parentElement;
  const codeText = codeContainer.querySelector('code').innerText;
  navigator.clipboard.writeText(codeText)
    .then(() => {
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = "Copy Code";
      }, 2000);
    })
    .catch(err => {
      console.error("Copy failed: ", err);
    });
} 