// ==ChatGPT Snippet Saver Content Script==
console.log('ChatGPT Snippet Saver content script loaded');
(function() {
  // --- CONFIG ---
  const SIDEBAR_ID = 'chatgpt-snippet-sidebar';
  const TOGGLE_BTN_ID = 'chatgpt-snippet-toggle-btn';
  const SNIPPET_KEY = 'chatgpt_snippets_v1';

  // --- UTILITIES ---
  function getTheme() {
    try {
      const root = document.documentElement;
      if (root.classList.contains('dark')) return 'dark';
      if (root.classList.contains('light')) return 'light';
      const gray800 = getComputedStyle(root).getPropertyValue('--gray-800');
      return gray800 ? 'dark' : 'light';
    } catch (e) {
      console.error('Theme detection error:', e);
      return 'light';
    }
  }

  function getCSSVars() {
    try {
      const style = getComputedStyle(document.documentElement);
      return {
        bg: style.getPropertyValue('--bg-primary') || '#fff',
        text: style.getPropertyValue('--text-primary') || '#222',
        textSecondary: style.getPropertyValue('--text-secondary') || '#666',
        border: style.getPropertyValue('--border-medium') || '#e5e5e5',
        shadow: style.getPropertyValue('--shadow-lg') || '0 4px 32px rgba(0,0,0,0.15)',
        radius: style.getPropertyValue('--radius-lg') || '12px',
        font: style.getPropertyValue('--font-sans') || 'Inter, sans-serif',
      };
    } catch (e) {
      console.error('CSS var detection error:', e);
      return {
        bg: '#fff', text: '#222', textSecondary: '#666', border: '#e5e5e5', shadow: '0 4px 32px rgba(0,0,0,0.15)', radius: '12px', font: 'Inter, sans-serif'
      };
    }
  }

  function saveSnippet(snippet) {
    try {
      const snippets = JSON.parse(localStorage.getItem(SNIPPET_KEY) || '[]');
      snippets.unshift(snippet);
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
    } catch (e) {
      console.error('Save snippet error:', e);
      showSidebarError('Failed to save snippet. localStorage may be blocked.');
    }
  }

  function loadSnippets() {
    try {
      return JSON.parse(localStorage.getItem(SNIPPET_KEY) || '[]');
    } catch (e) {
      console.error('Load snippet error:', e);
      showSidebarError('Failed to load snippets. localStorage may be blocked.');
      return [];
    }
  }

  function getConversationTitle() {
    try {
      const h1 = document.querySelector('h1');
      if (h1) return h1.textContent.trim();
      return document.title.replace(' - ChatGPT', '').trim();
    } catch (e) {
      return 'ChatGPT';
    }
  }

  // --- SIDEBAR UI ---
  function createSidebar() {
    if (document.getElementById(SIDEBAR_ID)) return;
    const cssVars = getCSSVars();
    const sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute('aria-label', 'Saved Snippets Sidebar');
    sidebar.innerHTML = `
      <div class="sgpt-sidebar-header">
        <span>Snippets</span>
        <button class="sgpt-close-btn" title="Close sidebar">&times;</button>
      </div>
      <div class="sgpt-snippet-list"></div>
      <div class="sgpt-sidebar-footer">
        <button class="sgpt-export-btn">Export</button>
      </div>
    `;
    Object.assign(sidebar.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      height: '100vh',
      width: '340px',
      maxWidth: '90vw',
      background: cssVars.bg,
      color: cssVars.text,
      boxShadow: cssVars.shadow,
      borderLeft: `1px solid ${cssVars.border}`,
      borderRadius: `${cssVars.radius} 0 0 ${cssVars.radius}`,
      fontFamily: cssVars.font,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s',
    });
    sidebar.style.transform = 'translateX(100%)';
    document.body.appendChild(sidebar);
    sidebar.querySelector('.sgpt-close-btn').onclick = () => toggleSidebar(false);
    sidebar.querySelector('.sgpt-export-btn').onclick = exportSnippets;
    renderSnippets();
  }

  // --- Sidebar Toggle State ---
  let sidebarVisible = false;
  function toggleSidebar(force) {
    let sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
      createSidebar();
      sidebar = document.getElementById(SIDEBAR_ID);
    }
    if (!sidebar) return;
    if (typeof force === 'boolean') {
      sidebarVisible = force;
    } else {
      sidebarVisible = !sidebarVisible;
    }
    if (sidebarVisible) {
      sidebar.classList.add('sgpt-sidebar-visible');
      sidebar.style.transform = 'translateX(0)';
    } else {
      sidebar.classList.remove('sgpt-sidebar-visible');
      sidebar.style.transform = 'translateX(100%)';
    }
  }

  function createToggleButton() {
    // Remove old button if present
    const oldBtn = document.getElementById(TOGGLE_BTN_ID);
    if (oldBtn) oldBtn.remove();
    if (document.getElementById('sgpt-sidebar-tab-btn')) return;
    // Create a vertical pill/tab button
    const btn = document.createElement('button');
    btn.id = 'sgpt-sidebar-tab-btn';
    btn.setAttribute('aria-label', 'Show saved snippets');
    btn.title = 'Show saved snippets';
    btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="12" height="16" rx="3" fill="var(--bg-primary,#fff)" stroke="var(--text-primary,#222)" stroke-width="2"/><path d="M9 8h6M9 12h6M9 16h3" stroke="var(--text-primary,#222)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    Object.assign(btn.style, {
      position: 'fixed',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      zIndex: 10000,
      background: 'var(--bg-primary, #fff)',
      color: 'var(--text-primary, #222)',
      border: '1.5px solid var(--border-medium, #e5e5e5)',
      borderRadius: '16px 0 0 16px',
      width: '44px',
      height: '64px',
      boxShadow: 'var(--shadow-lg, 0 4px 32px rgba(0,0,0,0.15))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: '0',
      outline: 'none',
      transition: 'background 0.2s',
    });
    btn.onmouseenter = () => { btn.style.background = 'var(--gray-100,#f3f4f6)'; };
    btn.onmouseleave = () => { btn.style.background = 'var(--bg-primary,#fff)'; };
    btn.onclick = () => toggleSidebar();
    document.body.appendChild(btn);
  }

  function showSidebarError(msg) {
    let sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
      createSidebar();
      sidebar = document.getElementById(SIDEBAR_ID);
    }
    const list = sidebar.querySelector('.sgpt-snippet-list');
    if (list) {
      list.innerHTML = `<div style="color:red;padding:1em;">${msg}</div>`;
    }
  }

  function renderSnippets() {
    let sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
      createSidebar();
      sidebar = document.getElementById(SIDEBAR_ID);
    }
    const list = sidebar.querySelector('.sgpt-snippet-list');
    let snippets;
    try {
      snippets = loadSnippets();
    } catch (e) {
      showSidebarError('Failed to load snippets. localStorage may be blocked.');
      return;
    }
    list.innerHTML = '';
    if (!snippets.length) {
      list.innerHTML = '<div style="color:var(--text-secondary,#888);padding:1em;">No snippets saved yet.</div>';
      return;
    }
    // Drag-and-drop state
    let dragSrcIdx = null;
    function handleDragStart(e) {
      dragSrcIdx = +e.currentTarget.getAttribute('data-idx');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcIdx);
      e.currentTarget.classList.add('dragging');
    }
    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drag-over');
    }
    function handleDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    }
    function handleDrop(e) {
      e.preventDefault();
      const fromIdx = dragSrcIdx;
      const toIdx = +e.currentTarget.getAttribute('data-idx');
      if (fromIdx === toIdx) return;
      // Reorder
      const moved = snippets.splice(fromIdx, 1)[0];
      snippets.splice(toIdx, 0, moved);
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
      renderSnippets();
    }
    function handleDragEnd(e) {
      document.querySelectorAll('.sgpt-snippet-item').forEach(item => {
        item.classList.remove('dragging', 'drag-over');
      });
    }
    // Render each snippet
    snippets.forEach((snip, idx) => {
      const item = document.createElement('div');
      item.className = 'sgpt-snippet-item';
      item.setAttribute('data-idx', idx);
      item.setAttribute('draggable', 'true');
      // Modern X button for delete
      const xBtn = document.createElement('button');
      xBtn.className = 'sgpt-x-btn';
      xBtn.title = 'Delete snippet';
      xBtn.innerHTML = '&times;';
      xBtn.onclick = (e) => {
        e.stopPropagation();
        snippets.splice(idx, 1);
        localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
        renderSnippets();
      };
      // Editable snippet text
      const editable = document.createElement('div');
      editable.className = 'sgpt-snippet-editable';
      editable.contentEditable = 'true';
      editable.spellcheck = true;
      editable.innerText = snip.text;
      editable.onblur = () => {
        if (editable.innerText !== snip.text) {
          snippets[idx].text = editable.innerText;
          localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
        }
      };
      // Drag events
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('dragleave', handleDragLeave);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
      // Layout
      item.appendChild(xBtn);
      item.appendChild(editable);
      list.appendChild(item);
    });
    // Add or update the Copy to Chat button in the footer
    let footer = sidebar.querySelector('.sgpt-sidebar-footer');
    let copyBtn = footer.querySelector('.sgpt-copy-to-chat-btn');
    if (!copyBtn) {
      copyBtn = document.createElement('button');
      copyBtn.className = 'sgpt-copy-to-chat-btn';
      copyBtn.textContent = 'Copy to Chat';
      copyBtn.style.marginRight = '8px';
      copyBtn.onclick = () => {
        const snippets = loadSnippets();
        const text = snippets.map(s => s.text).join('\n\n');
        // Try to find the ChatGPT chat textbox (prefer new ProseMirror input)
        let input = document.querySelector('div#prompt-textarea[contenteditable="true"]');
        if (!input) {
          // Fallback: any visible contenteditable div
          input = Array.from(document.querySelectorAll('div[role="textbox"]')).find(el => el.isContentEditable && el.offsetParent !== null);
        }
        if (!input) {
          // Fallback: any visible textarea
          input = Array.from(document.querySelectorAll('textarea')).find(el => el.offsetParent !== null);
        }
        if (input) {
          if (input.tagName === 'TEXTAREA') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            // Move cursor to end
            input.setSelectionRange(input.value.length, input.value.length);
          } else if (input.isContentEditable) {
            input.innerText = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            // Move caret to end for contenteditable
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } else {
          alert('Could not find the chat textbox.');
        }
      };
      footer.insertBefore(copyBtn, footer.firstChild);
    }
  }

  function exportSnippets() {
    try {
      const snippets = loadSnippets();
      const text = snippets.map(s => `---\n${s.title} (${new Date(s.date).toLocaleString()})\n${s.text}\n`).join('\n');
      const blob = new Blob([text], {type: 'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chatgpt_snippets.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Export error:', e);
    }
  }

  // --- AI Cleanup (placeholder) ---
  function aiCleanupSnippet(idx) {
    try {
      const snippets = loadSnippets();
      snippets[idx].text = snippets[idx].text.trim();
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
      renderSnippets();
      alert('AI cleanup coming soon!');
    } catch (e) {
      console.error('AI cleanup error:', e);
    }
  }

  // Delete a snippet by index
  function deleteSnippet(idx) {
    let snippets = loadSnippets();
    snippets.splice(idx, 1);
    localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
    // Remove from selected map
    if (window.sgptSelectedSnippets) delete window.sgptSelectedSnippets[idx];
    renderSnippets();
  }

  // Cleanup all selected snippets (placeholder: trim whitespace)
  function cleanupSelectedSnippets() {
    let snippets = loadSnippets();
    let changed = false;
    if (!window.sgptSelectedSnippets) return;
    Object.keys(window.sgptSelectedSnippets).forEach(idx => {
      if (window.sgptSelectedSnippets[idx]) {
        snippets[idx].text = snippets[idx].text.trim();
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
      renderSnippets();
      alert('Coming Soon!');
    }
  }

  // --- THEME SYNC ---
  function syncTheme() {
    try {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (!sidebar) return;
      const cssVars = getCSSVars();
      Object.assign(sidebar.style, {
        background: cssVars.bg,
        color: cssVars.text,
        boxShadow: cssVars.shadow,
        borderLeft: `1px solid ${cssVars.border}`,
        borderRadius: `${cssVars.radius} 0 0 ${cssVars.radius}`,
        fontFamily: cssVars.font,
      });
    } catch (e) {
      console.error('Theme sync error:', e);
    }
  }

  // --- SELECTION HANDLING ---
  function onSelection(e) {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      // Always show save button for any selection (not just inside <main>)
      showSaveButton(sel);
    } catch (e) {
      console.error('Selection error:', e);
    }
  }

  let saveBtn = null;
  function showSaveButton(sel) {
    try {
      if (saveBtn) saveBtn.remove();
      saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save snippet';
      Object.assign(saveBtn.style, {
        position: 'absolute',
        zIndex: 9999,
        background: 'var(--bg-primary, #fff)',
        color: 'var(--text-primary, #222)',
        border: '1px solid var(--border-medium, #e5e5e5)',
        borderRadius: '8px',
        padding: '4px 12px',
        fontSize: '1rem',
        boxShadow: 'var(--shadow-lg, 0 4px 32px rgba(0,0,0,0.15))',
        cursor: 'pointer',
        top: '0',
        left: '0',
        transform: 'translate(-50%, -150%)',
      });
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      saveBtn.style.top = `${window.scrollY + rect.top}px`;
      saveBtn.style.left = `${window.scrollX + rect.left + rect.width/2}px`;
      document.body.appendChild(saveBtn);

      // Use addEventListener for reliability
      saveBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = sel.toString();
        const snippet = {
          text,
          title: getConversationTitle(),
          date: Date.now(),
        };
        console.log('Saving snippet:', snippet);
        saveSnippet(snippet);
        renderSnippets();
        saveBtn.remove();
        saveBtn = null;
        sel.removeAllRanges();
        toggleSidebar(true);
      });

      // Remove if user clicks elsewhere
      setTimeout(() => {
        document.addEventListener('mousedown', hideSaveBtn, { once: true });
      }, 0);
    } catch (e) {
      console.error('Show save button error:', e);
    }
  }
  function hideSaveBtn() {
    if (saveBtn) {
      saveBtn.remove();
      saveBtn = null;
    }
  }

  // --- INIT ---
  function injectStyles() {
    if (document.getElementById('sgpt-sidebar-style')) return;
    const style = document.createElement('style');
    style.id = 'sgpt-sidebar-style';
    style.textContent = `
      #${SIDEBAR_ID} { box-sizing: border-box; }
      #${SIDEBAR_ID} {
        transition: transform 0.32s cubic-bezier(.4,0,.2,1), box-shadow 0.18s;
      }
      #${SIDEBAR_ID}.sgpt-sidebar-visible {
        box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      }
      #${SIDEBAR_ID} .sgpt-sidebar-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1em; font-weight: 600; border-bottom: 1px solid var(--border-medium,#e5e5e5);
      }
      #${SIDEBAR_ID} .sgpt-close-btn {
        background: none; border: none; font-size: 1.5em; cursor: pointer; color: var(--text-secondary,#888);}
      #${SIDEBAR_ID} .sgpt-snippet-list {
        flex: 1 1 auto; overflow-y: auto; padding: 1em; }
      #${SIDEBAR_ID} .sgpt-snippet-item {
        position: relative;
        padding: 1.5em 1.2em 1.2em 1.2em;
        min-height: 3.5em;
        cursor: grab;
        transition: box-shadow 0.18s, background 0.18s;
        background: var(--bg-secondary,#f7f7f8);
        border-radius: 12px;
        margin-bottom: 1em;
        box-shadow: var(--shadow-xs,0 1px 2px rgba(0,0,0,0.03));
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        /* Ensure space for X button */
        box-sizing: border-box;
      }
      #${SIDEBAR_ID} .sgpt-x-btn {
        position: absolute;
        top: 0.6em;
        right: 0.6em;
        width: 28px;
        height: 28px;
        background: #fff;
        border: none;
        font-size: 1.1em;
        color: #c00;
        cursor: pointer;
        z-index: 2;
        padding: 0;
        border-radius: 50%;
        box-shadow: 0 1px 4px 0 rgba(0,0,0,0.07);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.13s;
      }
      #${SIDEBAR_ID} .sgpt-x-btn:hover {
        background: #ffeaea;
        color: #a00;
        box-shadow: 0 2px 8px 0 rgba(220,0,0,0.13);
        transform: scale(1.13);
      }
      #${SIDEBAR_ID} .sgpt-snippet-editable {
        outline: none;
        border: none;
        background: var(--bg-secondary, var(--bg-primary, #222));
        font-family: inherit;
        font-size: 1.08em;
        color: var(--text-primary, #fff);
        min-height: 2.5em;
        white-space: pre-wrap;
        word-break: break-word;
        padding: 0.2em 0.1em 0.7em 0.1em;
        border-radius: 8px;
        transition: background 0.18s;
      }
      #${SIDEBAR_ID} .sgpt-snippet-editable:focus {
        background: var(--bg-secondary, var(--bg-primary, #222));
        color: var(--text-primary, #fff);
      }
      #${SIDEBAR_ID} .sgpt-copy-to-chat-btn,
      #${SIDEBAR_ID} .sgpt-export-btn {
        background: var(--bg-primary,#fff);
        color: var(--text-primary,#222);
        border: 1px solid var(--border-medium,#e5e5e5);
        border-radius: 999px;
        padding: 4px 16px;
        font-size: 1em;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.18s, color 0.18s, border 0.18s, transform 0.16s;
        margin-bottom: 0;
        box-shadow: none;
      }
      #${SIDEBAR_ID} .sgpt-copy-to-chat-btn:hover,
      #${SIDEBAR_ID} .sgpt-export-btn:hover {
        background: var(--gray-100,#f3f4f6);
        color: var(--text-primary,#222);
        border-color: var(--border-medium,#e5e5e5);
        transform: scale(1.06);
      }
      @keyframes sgpt-fadein {
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #${SIDEBAR_ID} .sgpt-snippet-meta {
        font-size: 0.97em; color: var(--text-secondary,#888); margin-bottom: 0.2em; display: flex; align-items: center; gap: 0.5em; justify-content: space-between;}
      #${SIDEBAR_ID} .sgpt-snippet-title { font-weight: 500; }
      #${SIDEBAR_ID} .sgpt-snippet-date { font-style: italic; font-size: 0.93em; }
      #${SIDEBAR_ID} .sgpt-snippet-text { font-family: inherit; font-size: 1.04em; margin: 0.2em 0 0.2em 0; white-space: pre-wrap; word-break: break-word; color: var(--text-primary,#222); }
      #${SIDEBAR_ID} .sgpt-snippet-actions { display: flex; gap: 0.5em; justify-content: flex-end; align-items: center; }

      /* Modern pill/ghost button style with animation */
      #${SIDEBAR_ID} .sgpt-cleanup-btn, #${SIDEBAR_ID} .sgpt-delete-btn, #${SIDEBAR_ID} .sgpt-cleanup-selected-btn {
        display: inline-flex; align-items: center; gap: 0.3em;
        background: var(--bg-primary,#fff);
        color: var(--text-primary,#222);
        border: 1px solid var(--border-medium,#e5e5e5);
        border-radius: 999px;
        padding: 4px 14px;
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.18s, color 0.18s, border 0.18s, transform 0.16s;
        box-shadow: none;
        outline: none;
      }
      #${SIDEBAR_ID} .sgpt-cleanup-btn:hover, #${SIDEBAR_ID} .sgpt-cleanup-selected-btn:hover, #${SIDEBAR_ID} .sgpt-delete-btn:hover {
        background: var(--gray-100,#f3f4f6);
        color: var(--accent,#10a37f);
        border-color: var(--accent,#10a37f);
        transform: scale(1.06);
      }
      #${SIDEBAR_ID} .sgpt-delete-btn {
        color: #c00;
        border-color: #f3d1d1;
        background: var(--bg-primary,#fff);
        padding: 4px 12px;
        transition: background 0.18s, color 0.18s, border 0.18s, transform 0.16s;
      }
      #${SIDEBAR_ID} .sgpt-delete-btn:hover {
        background: #ffeaea;
        color: #a00;
        border-color: #e57373;
        transform: scale(1.06);
      }
      /* Modern checkbox style */
      #${SIDEBAR_ID} .sgpt-select-checkbox {
        width: 1.25em; height: 1.25em; accent-color: var(--accent,#10a37f); border-radius: 6px; border: 1.5px solid var(--border-medium,#e5e5e5); margin-right: 10px; cursor: pointer; vertical-align: middle;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        transition: accent-color 0.18s, border 0.18s, box-shadow 0.18s;
      }
      #${SIDEBAR_ID} .sgpt-select-checkbox:focus {
        outline: 2px solid var(--accent,#10a37f);
        box-shadow: 0 0 0 2px var(--accent,#10a37f,0.15);
      }
      #${SIDEBAR_ID} .sgpt-sidebar-footer {
        padding: 0.75em 1em; border-top: 1px solid var(--border-medium,#e5e5e5); text-align: right; display: flex; gap: 0.5em; justify-content: flex-end; align-items: center;}
    `;
    document.head.appendChild(style);
  }

  function observeThemeChanges() {
    try {
      const root = document.documentElement;
      const observer = new MutationObserver(syncTheme);
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
      setInterval(syncTheme, 2000);
    } catch (e) {
      console.error('Theme observer error:', e);
    }
  }

  // --- MAIN ---
  function main() {
    try {
      injectStyles();
      createSidebar();
      createToggleButton();
      document.addEventListener('selectionchange', onSelection);
      observeThemeChanges();
      syncTheme();
      // Sidebar starts hidden
      toggleSidebar(false);
    } catch (e) {
      console.error('Main init error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    setTimeout(main, 500);
  }
})();

// Add styles for new UI
(function injectModernSnippetStyles() {
  if (document.getElementById('sgpt-modern-snippet-style')) return;
  const style = document.createElement('style');
  style.id = 'sgpt-modern-snippet-style';
  style.textContent = `
    #${SIDEBAR_ID} .sgpt-snippet-item {
      position: relative;
      padding: 1.5em 1.2em 1.2em 1.2em;
      min-height: 3.5em;
      cursor: grab;
      transition: box-shadow 0.18s, background 0.18s;
      background: var(--bg-secondary,#fff);
      border-radius: 12px;
      margin-bottom: 1em;
      box-shadow: none;
      display: flex;
      flex-direction: column;
      gap: 0.5em;
      box-sizing: border-box;
    }
    #${SIDEBAR_ID} .sgpt-snippet-item.dragging {
      opacity: 0.5;
      background: var(--gray-100,#f3f4f6);
      box-shadow: none;
    }
    #${SIDEBAR_ID} .sgpt-snippet-item.drag-over {
      background: var(--gray-100,#f3f4f6);
      box-shadow: none;
    }
    #${SIDEBAR_ID} .sgpt-x-btn {
      position: absolute;
      top: 0.6em;
      right: 0.6em;
      width: 28px;
      height: 28px;
      background: var(--bg-primary,#fff);
      border: 1px solid var(--border-medium,#e5e5e5);
      font-size: 1.1em;
      color: var(--text-primary,#222);
      cursor: pointer;
      z-index: 2;
      padding: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.18s, color 0.18s, border 0.18s, transform 0.13s;
      box-shadow: none;
    }
    #${SIDEBAR_ID} .sgpt-x-btn:hover {
      background: var(--gray-100,#f3f4f6);
      color: var(--text-primary,#222);
      border-color: var(--text-primary,#222);
      transform: scale(1.13);
    }
    #${SIDEBAR_ID} .sgpt-snippet-editable {
      outline: none;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 1.08em;
      color: var(--text-primary,#222);
      min-height: 2.5em;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 0.2em 0.1em 0.7em 0.1em;
      border-radius: 8px;
      transition: background 0.18s;
    }
    #${SIDEBAR_ID} .sgpt-snippet-editable:focus {
      background: var(--gray-100,#f3f4f6);
      color: var(--text-primary,#222);
    }
    #${SIDEBAR_ID} .sgpt-copy-to-chat-btn {
      background: var(--bg-primary,#fff);
      color: var(--text-primary,#222);
      border: 1px solid var(--border-medium,#e5e5e5);
      border-radius: 999px;
      padding: 4px 16px;
      font-size: 1em;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.18s, color 0.18s, border 0.18s, transform 0.16s;
      margin-bottom: 0;
      box-shadow: none;
    }
    #${SIDEBAR_ID} .sgpt-copy-to-chat-btn:hover {
      background: var(--gray-100,#f3f4f6);
      color: var(--text-primary,#222);
      border-color: var(--text-primary,#222);
      transform: scale(1.06);
    }
  `;
  document.head.appendChild(style);
})(); 