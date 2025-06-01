# StackGPT Chrome Extension

## Features
- Highlight and save snippets from ChatGPT conversations.
- Minimalist sidebar that matches ChatGPT's UI (adapts to light/dark mode, uses ChatGPT's CSS variables).
- Sidebar lists saved snippets with timestamps and conversation titles.
- "Cleanup with AI" (currently a placeholder) and export options for snippets.
- Non-intrusive design: sidebar is toggleable and visually blends with ChatGPT.

## How to Use
1. **Load the extension:**
   - Go to `chrome://extensions` in Chrome.
   - Enable "Developer mode" (top right).
   - Click "Load unpacked" and select this folder.
2. **On ChatGPT:**
   - Select any text in the chat area. A "Save snippet" button will appear near your selection.
   - Click the button to save the snippet (with conversation title and timestamp).
   - Click the sidebar tab (middle right edge) to open the sidebar and view your saved snippets.
   - Use "Cleanup with AI" (currently just trims whitespace) or "Export" to download all snippets.

## Technical Notes
- The sidebar and buttons use ChatGPT's CSS variables (e.g., `--bg-primary`, `--text-secondary`) for seamless integration.
- Theme (light/dark) is detected automatically and the sidebar updates if the user switches themes.
- "Cleanup with AI" is a placeholder—integrate with OpenAI API for real AI-powered formatting.

## Privacy
- Snippets are stored locally in your browser (localStorage). No data is sent anywhere. 