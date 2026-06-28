// ==Snippet Saver Content Script==
console.log('Snippet Saver content script loaded');
(function() {
  // --- CONFIG ---
  const SIDEBAR_ID = 'chatgpt-snippet-sidebar';
  const SNIPPET_KEY = 'chatgpt_snippets_v1';

  // --- PLATFORM DETECTION ---
  function getPlatform() {
    const host = location.hostname;
    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('grok.com')) return 'grok';
    return 'chatgpt';
  }

  function getPlatformConfig() {
    const configs = {
      chatgpt: { label: 'ChatGPT', defaultFavicon: 'https://chatgpt.com/favicon.ico' },
      claude:  { label: 'Claude',  defaultFavicon: 'https://claude.ai/favicon.ico' },
      gemini:  { label: 'Gemini',  defaultFavicon: 'https://gemini.google.com/favicon.ico' },
      grok:    { label: 'Grok',    defaultFavicon: 'https://grok.com/favicon.ico' },
    };
    return configs[getPlatform()] || configs.chatgpt;
  }

  // --- UTILITIES ---
  function getTheme() {
    try {
      const root = document.documentElement;
      if (root.classList.contains('dark')) return 'dark';
      if (root.classList.contains('light')) return 'light';
      const attr = root.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      const bg = getComputedStyle(root).backgroundColor;
      if (bg) {
        const rgb = bg.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
          return brightness < 128 ? 'dark' : 'light';
        }
      }
      return 'light';
    } catch (e) {
      return 'light';
    }
  }

  function getCSSVars() {
    try {
      const style = getComputedStyle(document.documentElement);
      const isDark = getTheme() === 'dark';
      const defs = isDark
        ? { bg: '#212121', text: '#ececec', textSecondary: '#999', border: '#424242', shadow: '0 4px 32px rgba(0,0,0,0.5)', radius: '12px', font: 'Inter, sans-serif' }
        : { bg: '#fff', text: '#222', textSecondary: '#666', border: '#e5e5e5', shadow: '0 4px 32px rgba(0,0,0,0.15)', radius: '12px', font: 'Inter, sans-serif' };
      const tryVars = (names) => {
        for (const name of names) {
          const val = style.getPropertyValue(name);
          if (val) return val;
        }
        return null;
      };
      return {
        bg: tryVars(['--bg-primary', '--bg', '--background', '--surface']) || defs.bg,
        text: tryVars(['--text-primary', '--text', '--text-color', '--on-surface']) || defs.text,
        textSecondary: tryVars(['--text-secondary', '--text-muted', '--secondary-text']) || defs.textSecondary,
        border: tryVars(['--border-medium', '--border', '--border-color', '--outline']) || defs.border,
        shadow: tryVars(['--shadow-lg', '--shadow', '--elevation']) || defs.shadow,
        radius: tryVars(['--radius-lg', '--radius', '--border-radius']) || defs.radius,
        font: tryVars(['--font-sans', '--font', '--font-family']) || defs.font,
      };
    } catch (e) {
      return {
        bg: '#fff', text: '#222', textSecondary: '#666', border: '#e5e5e5', shadow: '0 4px 32px rgba(0,0,0,0.15)', radius: '12px', font: 'Inter, sans-serif'
      };
    }
  }

  function saveSnippet(snippet) {
    try {
      const snippets = JSON.parse(localStorage.getItem(SNIPPET_KEY) || '[]');
      snippets.push(snippet);
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
      if (h1 && h1.textContent.trim()) return h1.textContent.trim();
      return document.title.replace(/ - (ChatGPT|Claude|Gemini|Grok).*$/, '').trim() || 'Untitled';
    } catch (e) {
      return 'Untitled';
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
        <span class="sgpt-sidebar-title">Snippets</span>
        <button class="sgpt-close-btn" title="Close sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
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
    if (document.getElementById('sgpt-sidebar-tab-btn')) return;
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
    const titleEl = sidebar.querySelector('.sgpt-sidebar-title');
    if (!snippets.length) {
      if (titleEl) titleEl.textContent = 'Snippets';
      list.innerHTML = '<div class="sgpt-empty-state">Select text on the page to save your first snippet</div>';
      return;
    }
    if (titleEl) titleEl.textContent = 'Snippets (' + snippets.length + ')';
    // Drag-and-drop state
    let dragSrcIdx = null;
    let dropTargetIdx = null;
    let dropIndicator = null;
    function handleDragStart(e) {
      dragSrcIdx = +e.currentTarget.getAttribute('data-idx');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcIdx);
      e.currentTarget.classList.add('dragging');
      document.body.style.cursor = 'grabbing';
    }
    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const overIdx = +e.currentTarget.getAttribute('data-idx');
      if (dropTargetIdx !== overIdx) {
        dropTargetIdx = overIdx;
        showDropIndicator(overIdx, e.currentTarget);
      }
    }
    function handleDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
      hideDropIndicator();
    }
    function handleDrop(e) {
      e.preventDefault();
      const fromIdx = dragSrcIdx;
      const toIdx = dropTargetIdx;
      hideDropIndicator();
      document.body.style.cursor = '';
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
      hideDropIndicator();
      document.body.style.cursor = '';
    }
    function showDropIndicator(idx, targetElem) {
      hideDropIndicator();
      dropIndicator = document.createElement('div');
      dropIndicator.className = 'sgpt-drop-indicator';
      targetElem.parentNode.insertBefore(dropIndicator, targetElem);
    }
    function hideDropIndicator() {
      if (dropIndicator && dropIndicator.parentNode) {
        dropIndicator.parentNode.removeChild(dropIndicator);
      }
      dropIndicator = null;
      dropTargetIdx = null;
    }
    // Render each snippet
    snippets.forEach((snip, idx) => {
      const item = document.createElement('div');
      item.className = 'sgpt-snippet-item';
      item.setAttribute('data-idx', idx);
      item.setAttribute('draggable', 'true');
      // X button for delete (top-right)
      const xBtn = document.createElement('button');
      xBtn.className = 'sgpt-x-btn';
      xBtn.title = 'Delete snippet';
      xBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;
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
      // LLM source badge (bottom-left) — uses page favicon
      const platformCfg = getPlatformConfig();
      const badge = document.createElement('div');
      badge.className = 'sgpt-llm-badge';
      badge.title = 'Saved from ' + platformCfg.label;
      const faviconLink = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
      const iconUrl = faviconLink ? faviconLink.href : platformCfg.defaultFavicon;
      badge.innerHTML = `<img src="${iconUrl}" width="14" height="14" alt=""> <span>${platformCfg.label}</span>`;
      // Drag events
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('dragleave', handleDragLeave);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
      // Copy to clipboard on click (not on delete or edit)
      item.addEventListener('click', function(e) {
        if (e.target === xBtn || e.target === editable || badge.contains(e.target)) return;
        navigator.clipboard.writeText(snip.text).catch(err => console.error('Clipboard write failed:', err)).then(() => {
          item.classList.add('sgpt-snippet-copied');
          let tooltip = document.createElement('div');
          tooltip.textContent = 'Copied!';
          tooltip.style.position = 'absolute';
          tooltip.style.top = '8px';
          tooltip.style.right = '48px';
          tooltip.style.background = '#10a37f';
          tooltip.style.color = '#fff';
          tooltip.style.padding = '2px 10px';
          tooltip.style.borderRadius = '8px';
          tooltip.style.fontSize = '0.9em';
          tooltip.style.zIndex = '10';
          tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
          item.appendChild(tooltip);
          setTimeout(() => {
            item.classList.remove('sgpt-snippet-copied');
            if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
          }, 900);
        });
      });
      // Layout
      item.appendChild(xBtn);
      item.appendChild(editable);
      item.appendChild(badge);
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
      a.download = 'snippets_export.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Export error:', e);
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
        whiteSpace: 'nowrap',
        visibility: 'hidden',
      });
      document.body.appendChild(saveBtn);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const gap = 8;
      let top = window.scrollY + rect.bottom + gap;
      if (top + saveBtn.offsetHeight > window.innerHeight + window.scrollY - gap) {
        top = window.scrollY + rect.top - saveBtn.offsetHeight - gap;
      }
      saveBtn.style.visibility = 'visible';
      saveBtn.style.top = `${top}px`;
      saveBtn.style.left = `${window.scrollX + rect.left + rect.width/2 - saveBtn.offsetWidth/2}px`;

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
          source: getPlatform(),
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
        box-shadow: -4px 0 24px rgba(0,0,0,0.10);
      }

      /* --- Header --- */
      #${SIDEBAR_ID} .sgpt-sidebar-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75em 1em; font-weight: 600; font-size: 1.05em;
        border-bottom: 1px solid var(--border-medium,#e5e5e5);
        flex-shrink: 0;
      }
      #${SIDEBAR_ID} .sgpt-close-btn {
        background: none; border: none; width: 32px; height: 32px;
        cursor: pointer; color: var(--text-secondary,#888);
        border-radius: 8px; display: flex; align-items: center; justify-content: center;
        font-size: 1.3em; transition: background 0.15s;
      }
      #${SIDEBAR_ID} .sgpt-close-btn:hover {
        background: #fef2f2; color: #dc2626;
      }

      /* --- Snippet List --- */
      #${SIDEBAR_ID} .sgpt-snippet-list {
        flex: 1 1 auto; overflow-y: auto; padding: 0.75em;
        display: flex; flex-direction: column; gap: 0;
      }

      /* --- Snippet Item --- */
      #${SIDEBAR_ID} .sgpt-snippet-item {
        position: relative;
        padding: 1em 1em 2.4em 1em;
        cursor: grab;
        transition: box-shadow 0.18s, background 0.18s, transform 0.18s;
        background: var(--bg-secondary,#fff);
        border-radius: 10px;
        margin-bottom: 0.6em;
        border: 1px solid var(--border-medium,#e5e5e5);
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        z-index: 1;
      }
      #${SIDEBAR_ID} .sgpt-snippet-item:hover {
        border-color: var(--text-secondary,#888);
      }
      #${SIDEBAR_ID} .sgpt-snippet-item.dragging {
        opacity: 0.85;
        background: var(--bg-primary,#fff);
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
        transform: scale(1.03);
        cursor: grabbing;
        z-index: 2;
      }

      /* --- Drop Indicator --- */
      #${SIDEBAR_ID} .sgpt-drop-indicator {
        height: 0;
        border-top: 2.5px solid var(--text-primary,#222);
        margin: -0.3em 0 0.3em 0;
        border-radius: 2px;
        transition: border-color 0.18s, margin 0.18s;
        animation: sgpt-drop-indicator-fadein 0.18s;
      }
      @keyframes sgpt-drop-indicator-fadein {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* --- X Delete Button --- */
      #${SIDEBAR_ID} .sgpt-x-btn {
        position: absolute;
        top: 0.5em;
        right: 0.5em;
        width: 26px;
        height: 26px;
        background: transparent;
        border: none;
        color: var(--text-secondary,#888);
        cursor: pointer;
        z-index: 2;
        padding: 0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      #${SIDEBAR_ID} .sgpt-x-btn:hover {
        background: #fef2f2;
        color: #dc2626;
      }

      /* --- Editable Text --- */
      #${SIDEBAR_ID} .sgpt-snippet-editable {
        outline: none;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.95em;
        line-height: 1.5;
        color: var(--text-primary,#222);
        white-space: pre-wrap;
        word-break: break-word;
        padding: 0.2em 0;
        border-radius: 6px;
        transition: background 0.15s;
      }
      #${SIDEBAR_ID} .sgpt-snippet-editable:focus {
        background: var(--gray-100,#f3f4f6);
        padding: 0.2em 0.4em;
        margin: 0 -0.4em;
      }

      /* --- LLM Badge --- */
      #${SIDEBAR_ID} .sgpt-llm-badge {
        position: absolute;
        bottom: 0.4em;
        left: 0.8em;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75em;
        color: var(--text-secondary,#888);
        pointer-events: none;
      }
      #${SIDEBAR_ID} .sgpt-llm-badge img {
        border-radius: 3px;
      }
      #${SIDEBAR_ID} .sgpt-llm-badge span {
        line-height: 1;
      }

      /* --- Footer Buttons --- */
      #${SIDEBAR_ID} .sgpt-copy-to-chat-btn,
      #${SIDEBAR_ID} .sgpt-export-btn {
        background: transparent;
        color: var(--text-primary,#222);
        border: 1px solid var(--border-medium,#e5e5e5);
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 0.9em;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      #${SIDEBAR_ID} .sgpt-copy-to-chat-btn:hover,
      #${SIDEBAR_ID} .sgpt-export-btn:hover {
        background: rgba(128,128,128,0.12);
        border-color: var(--text-primary,#222);
        color: var(--text-primary,#222);
      }

      /* --- Empty State --- */
      #${SIDEBAR_ID} .sgpt-empty-state {
        color: var(--text-secondary,#888);
        padding: 2em 1em;
        text-align: center;
        font-size: 0.9em;
        line-height: 1.5;
      }

      /* --- Footer --- */
      #${SIDEBAR_ID} .sgpt-sidebar-footer {
        padding: 0.6em 0.75em;
        border-top: 1px solid var(--border-medium,#e5e5e5);
        display: flex;
        gap: 0.4em;
        justify-content: flex-end;
        align-items: center;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function observeThemeChanges() {
    try {
      const root = document.documentElement;
      const observer = new MutationObserver(syncTheme);
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
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