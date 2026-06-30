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

  function getPlatformConfig(platform) {
    const configs = {
      chatgpt: { label: 'ChatGPT', defaultFavicon: 'https://chatgpt.com/favicon.ico' },
      claude:  { label: 'Claude',  defaultFavicon: 'https://claude.ai/favicon.ico' },
      gemini:  { label: 'Gemini',  defaultFavicon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg' },
      grok:    { label: 'Grok',    defaultFavicon: 'https://grok.com/images/favicon.ico' },
    };
    return configs[platform || getPlatform()] || configs.chatgpt;
  }

  // --- UTILITIES ---
  function getTheme() {
    try {
      const root = document.documentElement;
      if (root.classList.contains('dark') || root.classList.contains('dark-theme')) return 'dark';
      if (root.classList.contains('light') || root.classList.contains('light-theme')) return 'light';
      const attr = root.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      const candidates = [document.body, root];
      for (const el of candidates) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && !bg.match(/rgba\(0,\s*0,\s*0,\s*0\)/) && bg !== 'transparent') {
          const rgb = bg.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const b = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return b < 128 ? 'dark' : 'light';
          }
        }
      }
      return 'light';
    } catch (e) {
      return 'light';
    }
  }

  function getCSSVars() {
    const isDark = getTheme() === 'dark';
    return isDark
      ? { bg: '#212121', text: '#ececec', textSecondary: '#999', border: '#424242', shadow: '0 4px 32px rgba(0,0,0,0.5)', radius: '12px', font: 'Inter, sans-serif', cardBg: '#2f2f2f', hoverBg: '#3a3a3a' }
      : { bg: '#fff', text: '#222', textSecondary: '#666', border: '#e5e5e5', shadow: '0 4px 32px rgba(0,0,0,0.15)', radius: '12px', font: 'Inter, sans-serif', cardBg: '#f5f5f5', hoverBg: '#ebebeb' };
  }

  function saveSnippet(snippet, cb) {
    chrome.storage.local.get(SNIPPET_KEY, (result) => {
      try {
        const snippets = result[SNIPPET_KEY] || [];
        snippets.push(snippet);
        chrome.storage.local.set({ [SNIPPET_KEY]: snippets }, cb || (() => {}));
      } catch (e) {
        console.error('Save snippet error:', e);
        showSidebarError('Failed to save snippet.');
        if (cb) cb();
      }
    });
  }

  function loadSnippets(callback) {
    chrome.storage.local.get(SNIPPET_KEY, (result) => {
      try {
        callback(result[SNIPPET_KEY] || []);
      } catch (e) {
        console.error('Load snippet error:', e);
        showSidebarError('Failed to load snippets.');
        callback([]);
      }
    });
  }

  function saveAll(snippets, cb) {
    chrome.storage.local.set({ [SNIPPET_KEY]: snippets }, cb || (() => {}));
  }

  function migrateFromLocalStorage() {
    try {
      const data = localStorage.getItem(SNIPPET_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.length > 0) {
          chrome.storage.local.get(SNIPPET_KEY, (result) => {
            if (!result[SNIPPET_KEY] || result[SNIPPET_KEY].length === 0) {
              chrome.storage.local.set({ [SNIPPET_KEY]: parsed });
            }
            localStorage.removeItem(SNIPPET_KEY);
          });
        }
      }
    } catch (e) {}
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
      <div class="sgpt-drop-zone">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
        Drop to save snippet
      </div>
      <div class="sgpt-search-container">
        <svg class="sgpt-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
        <input type="text" class="sgpt-search-input" placeholder="Search">
      </div>
      <div class="sgpt-snippet-list"></div>
      <div class="sgpt-sidebar-footer">
        <button class="sgpt-delete-all-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Delete All</span>
        </button>
        <button class="sgpt-export-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Export</span>
        </button>
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
    const root = document.documentElement;
    root.style.setProperty('--sgpt-bg', cssVars.bg);
    root.style.setProperty('--sgpt-text', cssVars.text);
    root.style.setProperty('--sgpt-text-secondary', cssVars.textSecondary);
    root.style.setProperty('--sgpt-border', cssVars.border);
    root.style.setProperty('--sgpt-card-bg', cssVars.cardBg);
    root.style.setProperty('--sgpt-hover', cssVars.hoverBg);
    sidebar.style.transform = 'translateX(100%)';
    document.body.appendChild(sidebar);
    sidebar.querySelector('.sgpt-close-btn').onclick = () => toggleSidebar(false);
    sidebar.querySelector('.sgpt-export-btn').onclick = exportSnippets;
    renderSnippets();
    sidebar.addEventListener('dragenter', (e) => {
      if (!document.querySelector('.sgpt-snippet-item.dragging') && Array.from(e.dataTransfer.types).includes('text/plain')) {
        sidebar.querySelector('.sgpt-drop-zone').classList.add('active');
      }
    });
    sidebar.addEventListener('dragover', (e) => e.preventDefault());
    sidebar.addEventListener('dragleave', (e) => {
      if (!sidebar.contains(e.relatedTarget)) {
        sidebar.querySelector('.sgpt-drop-zone').classList.remove('active');
      }
    });
    sidebar.addEventListener('drop', (e) => {
      e.preventDefault();
      if (document.querySelector('.sgpt-snippet-item.dragging')) return;
      const dropZone = sidebar.querySelector('.sgpt-drop-zone');
      dropZone.classList.remove('active');
      const text = e.dataTransfer.getData('text/plain');
      if (text && text.trim()) {
        const snippet = { text: text.trim(), title: getConversationTitle(), date: Date.now(), source: getPlatform() };
        saveSnippet(snippet, () => {
          renderSnippets();
          toggleSidebar(true);
        });
      }
    });
    sidebar.querySelector('.sgpt-search-input').addEventListener('input', (e) => {
      _searchTerm = e.target.value;
      applyFilter();
    });
  }

  // --- Sidebar Toggle State ---
  let sidebarVisible = false;
  let _searchTerm = '';
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

  function applyFilter() {
    const items = document.querySelectorAll('.sgpt-snippet-item');
    const search = _searchTerm.toLowerCase().trim();
    items.forEach(item => {
      const text = item.querySelector('.sgpt-snippet-text').textContent.toLowerCase();
      item.classList.toggle('filtered-out', search && !text.includes(search));
    });
  }

  function createToggleButton() {
    if (document.getElementById('sgpt-sidebar-tab-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'sgpt-sidebar-tab-btn';
    btn.setAttribute('aria-label', 'Show saved snippets');
    btn.title = 'Show saved snippets';
    btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="12" height="16" rx="3" fill="var(--sgpt-bg)" stroke="var(--sgpt-text)" stroke-width="2"/><path d="M9 8h6M9 12h6M9 16h3" stroke="var(--sgpt-text)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    Object.assign(btn.style, {
      position: 'fixed',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      zIndex: 10000,
      background: 'var(--sgpt-bg)',
      color: 'var(--sgpt-text)',
      border: '1.5px solid var(--sgpt-border)',
      borderRadius: '16px 0 0 16px',
      width: '44px',
      height: '64px',
      boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: '0',
      outline: 'none',
      transition: 'background 0.2s',
    });
    btn.onmouseenter = () => { if (!btn.classList.contains('sgpt-dragover')) btn.style.background = 'var(--sgpt-hover)'; };
    btn.onmouseleave = () => { if (!btn.classList.contains('sgpt-dragover')) btn.style.background = 'var(--sgpt-bg)'; };
    btn.onclick = () => toggleSidebar();
    btn.addEventListener('dragover', (e) => {
      if (!document.querySelector('.sgpt-snippet-item.dragging') && Array.from(e.dataTransfer.types).includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        btn.classList.add('sgpt-dragover');
        btn.style.background = 'var(--sgpt-hover)';
      }
    });
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('sgpt-dragover');
      btn.style.background = 'var(--sgpt-bg)';
    });
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.querySelector('.sgpt-snippet-item.dragging')) return;
      btn.classList.remove('sgpt-dragover');
      btn.style.background = 'var(--sgpt-bg)';
      const text = e.dataTransfer.getData('text/plain');
      if (text && text.trim()) {
        const snippet = { text: text.trim(), title: getConversationTitle(), date: Date.now(), source: getPlatform() };
        saveSnippet(snippet, () => {
          renderSnippets();
          toggleSidebar(true);
        });
      }
    });
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
    loadSnippets((snippets) => {
      list.innerHTML = '';
      const titleEl = sidebar.querySelector('.sgpt-sidebar-title');
      if (!snippets.length) {
        if (titleEl) titleEl.textContent = 'Snippets';
        list.innerHTML = '<div class="sgpt-empty-state">Select text on the page to save your first snippet</div>';
        let copyBtn = sidebar.querySelector('.sgpt-copy-to-chat-btn');
        if (copyBtn) copyBtn.remove();
        return;
      }
      if (titleEl) titleEl.textContent = 'Snippets (' + snippets.length + ')';
      let dragSrcEl = null;
      let dragSrcIdx = null;
      let dropIndicator = null;
      let dragScrollInterval = null;

      function initDragScroll(dir) {
        stopDragScroll();
        dragScrollInterval = setInterval(() => { list.scrollTop += dir * 6; }, 16);
      }
      function stopDragScroll() {
        if (dragScrollInterval) { clearInterval(dragScrollInterval); dragScrollInterval = null; }
      }

      function findDropTarget(y) {
        const items = list.querySelectorAll('.sgpt-snippet-item:not(.dragging)');
        let best = null;
        for (const item of items) {
          const r = item.getBoundingClientRect();
          if (y < r.top + r.height / 2) return { el: item, after: false };
          best = { el: item, after: true };
        }
        return best;
      }

      function placeIndicator(y) {
        const target = findDropTarget(y);
        if (!target) { hideIndicator(); return; }
        if (!dropIndicator) {
          dropIndicator = document.createElement('div');
          dropIndicator.className = 'sgpt-drop-indicator';
        }
        if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
        target.el.parentNode.insertBefore(dropIndicator, target.after ? target.el.nextSibling : target.el);
      }
      function hideIndicator() {
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
      }

      function handleDragStart(e) {
        dragSrcEl = e.currentTarget;
        dragSrcIdx = +e.currentTarget.getAttribute('data-idx');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcIdx);
        dragSrcEl.classList.add('dragging');
      }

      function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        placeIndicator(e.clientY);

        const r = list.getBoundingClientRect();
        if (e.clientY < r.top + 30) initDragScroll(-1);
        else if (e.clientY > r.bottom - 30) initDragScroll(1);
        else stopDragScroll();
      }

      function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        stopDragScroll();
        document.querySelector('.sgpt-drop-zone').classList.remove('active');
        if (!dropIndicator || !dropIndicator.parentNode) {
          hideIndicator();
          if (!dragSrcEl) {
            const text = e.dataTransfer.getData('text/plain');
            if (text && text.trim()) {
              saveSnippet({ text: text.trim(), title: getConversationTitle(), date: Date.now(), source: getPlatform() }, () => {
                renderSnippets();
                toggleSidebar(true);
              });
            }
          }
          return;
        }
        if (!dragSrcEl) {
          const toIdx = [...dropIndicator.parentNode.children].indexOf(dropIndicator);
          hideIndicator();
          const text = e.dataTransfer.getData('text/plain');
          if (text && text.trim()) {
            const snippet = { text: text.trim(), title: getConversationTitle(), date: Date.now(), source: getPlatform() };
            chrome.storage.local.get(SNIPPET_KEY, (result) => {
              const all = result[SNIPPET_KEY] || [];
              all.splice(toIdx, 0, snippet);
              chrome.storage.local.set({ [SNIPPET_KEY]: all }, () => {
                renderSnippets();
                toggleSidebar(true);
              });
            });
          }
          return;
        }
        const parent = dropIndicator.parentNode;
        const refNode = dropIndicator.nextSibling;
        const toIdx = [...parent.children].indexOf(dropIndicator);
        hideIndicator();
        if (dragSrcIdx === toIdx || dragSrcIdx === toIdx - 1) return;
        const moved = snippets.splice(dragSrcIdx, 1)[0];
        snippets.splice(toIdx > dragSrcIdx ? toIdx - 1 : toIdx, 0, moved);
        const movedNode = dragSrcEl;
        movedNode.parentNode.removeChild(movedNode);
        parent.insertBefore(movedNode, refNode);
        [...parent.children].forEach((el, i) => el.setAttribute('data-idx', i));
        dragSrcEl = null;
        dragSrcIdx = null;
        saveAll(snippets);
      }

      function handleDragEnd(e) {
        stopDragScroll();
        document.querySelectorAll('.sgpt-snippet-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
        hideIndicator();
        dragSrcEl = null;
      }

      function handleDragLeave(e) {
        if (!list.contains(e.relatedTarget)) hideIndicator();
      }

      if (list._dragReady) {
        list.removeEventListener('dragover', list._handlers.dragover);
        list.removeEventListener('drop', list._handlers.drop);
        list.removeEventListener('dragleave', list._handlers.dragleave);
      }
      list._handlers = { dragover: handleDragOver, drop: handleDrop, dragleave: handleDragLeave };
      list.addEventListener('dragover', list._handlers.dragover);
      list.addEventListener('drop', list._handlers.drop);
      list.addEventListener('dragleave', list._handlers.dragleave);
      list._dragReady = true;
      snippets.forEach((snip, idx) => {
        const item = document.createElement('div');
        item.className = 'sgpt-snippet-item';
        item.setAttribute('data-idx', idx);
        item.setAttribute('draggable', 'true');
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
          const i = +e.currentTarget.parentNode.getAttribute('data-idx');
          snippets.splice(i, 1);
          saveAll(snippets, renderSnippets);
        };
        const textDiv = document.createElement('div');
        textDiv.className = 'sgpt-snippet-text';
        textDiv.innerText = snip.text;
        const srcCfg = getPlatformConfig(snip.source);
        const badge = document.createElement('div');
        badge.className = 'sgpt-llm-badge';
        badge.title = 'Saved from ' + srcCfg.label;
        badge.innerHTML = `<img src="${srcCfg.defaultFavicon}" width="14" height="14" alt=""> <span>${srcCfg.label}</span>`;
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('click', function(e) {
          if (e.target === xBtn || badge.contains(e.target)) return;
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
        item.appendChild(xBtn);
        item.appendChild(textDiv);
        item.appendChild(badge);
        list.appendChild(item);
      });
      if (_searchTerm) applyFilter();
      let footer = sidebar.querySelector('.sgpt-sidebar-footer');
      let copyBtn = footer.querySelector('.sgpt-copy-to-chat-btn');
      if (!copyBtn) {
        copyBtn = document.createElement('button');
        copyBtn.className = 'sgpt-copy-to-chat-btn';
        copyBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy to Chat</span>';
        copyBtn.style.marginRight = '8px';
        copyBtn.onclick = () => {
          loadSnippets((allSnippets) => {
            const text = allSnippets.map(s => s.text).join('\n\n');
            let input = document.querySelector('div#prompt-textarea[contenteditable="true"]');
            if (!input) {
              input = document.querySelector('div[contenteditable="true"]');
            }
            if (!input) {
              input = Array.from(document.querySelectorAll('div[role="textbox"]')).find(el => el.isContentEditable && el.offsetParent !== null);
            }
            if (!input) {
              input = Array.from(document.querySelectorAll('textarea')).find(el => el.offsetParent !== null);
            }
            if (input) {
              if (input.tagName === 'TEXTAREA') {
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
              } else if (input.isContentEditable) {
                input.innerText = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
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
          });
        };
        footer.insertBefore(copyBtn, footer.firstChild);
      }
      const deleteBtn = footer.querySelector('.sgpt-delete-all-btn');
      if (deleteBtn) {
        deleteBtn.disabled = !snippets.length;
        if (!deleteBtn._listener) {
          deleteBtn._listener = true;
          const defaultHTML = deleteBtn.innerHTML;
          deleteBtn.onclick = () => {
            if (deleteBtn.classList.contains('confirm')) {
              saveAll([], () => renderSnippets());
              deleteBtn.innerHTML = defaultHTML;
              deleteBtn.classList.remove('confirm');
            } else {
              deleteBtn.innerHTML = 'Confirm?';
              deleteBtn.classList.add('confirm');
              setTimeout(() => {
                if (deleteBtn.classList.contains('confirm')) {
                  deleteBtn.innerHTML = defaultHTML;
                  deleteBtn.classList.remove('confirm');
                }
              }, 2500);
            }
          };
        }
      }
    });
  }

  function exportSnippets() {
    loadSnippets((snippets) => {
      try {
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
    });
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
      const root = document.documentElement;
      root.style.setProperty('--sgpt-bg', cssVars.bg);
      root.style.setProperty('--sgpt-text', cssVars.text);
      root.style.setProperty('--sgpt-text-secondary', cssVars.textSecondary);
      root.style.setProperty('--sgpt-border', cssVars.border);
      root.style.setProperty('--sgpt-card-bg', cssVars.cardBg);
      root.style.setProperty('--sgpt-hover', cssVars.hoverBg);
    } catch (e) {
      console.error('Theme sync error:', e);
    }
  }

  // --- SELECTION HANDLING ---
  let _selectionTimer = null;
  function onSelection(e) {
    if (_selectionTimer) return;
    _selectionTimer = setTimeout(() => { _selectionTimer = null; }, 150);
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
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
        background: 'var(--sgpt-bg)',
        color: 'var(--sgpt-text)',
        border: '1px solid var(--sgpt-border)',
        borderRadius: '8px',
        padding: '4px 12px',
        fontSize: '1rem',
        boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
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
        saveBtn.remove();
        saveBtn = null;
        sel.removeAllRanges();
        saveSnippet(snippet, () => {
          renderSnippets();
          toggleSidebar(true);
        });
      });

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
        border-bottom: 1px solid var(--sgpt-border);
        flex-shrink: 0;
      }
      #${SIDEBAR_ID} .sgpt-close-btn {
        background: none; border: none; width: 32px; height: 32px;
        cursor: pointer; color: var(--sgpt-text-secondary);
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
        transition: box-shadow 0.18s, background 0.18s, transform 0.18s, opacity 0.18s;
        background: var(--sgpt-card-bg);
        border-radius: 10px;
        margin-bottom: 0.6em;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        z-index: 1;
      }
      #${SIDEBAR_ID} .sgpt-snippet-item:hover {
        background: var(--sgpt-hover);
      }
      #${SIDEBAR_ID} .sgpt-snippet-item.dragging {
        opacity: 0.4;
        background: var(--sgpt-card-bg);
        box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        transform: scale(1.02) rotate(0.5deg);
        cursor: grabbing;
        z-index: 2;
      }

      /* --- Drop Zone Overlay --- */
      #${SIDEBAR_ID} .sgpt-drop-zone {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 6px;
        background: rgba(128,128,128,0.04);
        backdrop-filter: blur(3px);
        border: 2px dashed var(--sgpt-text-secondary);
        border-radius: 14px;
        margin: 4px;
        z-index: 100;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        font-size: 0.95em;
        color: var(--sgpt-text-secondary);
      }
      #${SIDEBAR_ID} .sgpt-drop-zone.active {
        opacity: 1;
      }

      /* --- Search Input --- */
      #${SIDEBAR_ID} .sgpt-search-container {
        position: relative;
        padding: 0.4em 0.75em;
        flex-shrink: 0;
      }
      #${SIDEBAR_ID} .sgpt-search-icon {
        position: absolute;
        left: 1.25em;
        top: 50%;
        transform: translateY(-50%);
        color: var(--sgpt-text-secondary);
        pointer-events: none;
      }
      #${SIDEBAR_ID} .sgpt-search-input {
        width: 100%;
        padding: 0.45em 0.6em 0.45em 2em;
        border: 1px solid var(--sgpt-border);
        border-radius: 8px;
        background: var(--sgpt-card-bg);
        color: var(--sgpt-text);
        font-size: 0.9em;
        outline: none;
        box-sizing: border-box;
      }
      #${SIDEBAR_ID} .sgpt-search-input::placeholder {
        color: var(--sgpt-text-secondary);
      }
      #${SIDEBAR_ID} .sgpt-search-input:focus {
        border-color: var(--sgpt-text-secondary);
      }
      #${SIDEBAR_ID} .sgpt-snippet-item.filtered-out {
        display: none;
      }

      /* --- Drop Indicator --- */
      #${SIDEBAR_ID} .sgpt-drop-indicator {
        height: 3px;
        background: var(--sgpt-text);
        border-radius: 3px;
        animation: sgpt-drop-indicator-fadein 0.12s ease-out;
        pointer-events: none;
        flex-shrink: 0;
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
        color: var(--sgpt-text-secondary);
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

      /* --- Snippet Text --- */
      #${SIDEBAR_ID} .sgpt-snippet-text {
        outline: none;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.95em;
        line-height: 1.5;
        color: var(--sgpt-text);
        white-space: pre-wrap;
        word-break: break-word;
        padding: 0.2em 0;
        -webkit-user-select: none;
        user-select: none;
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
        color: var(--sgpt-text-secondary);
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
      #${SIDEBAR_ID} .sgpt-export-btn,
      #${SIDEBAR_ID} .sgpt-delete-all-btn {
        background: transparent;
        color: var(--sgpt-text-secondary);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 0.85em;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.15s, color 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      #${SIDEBAR_ID} .sgpt-copy-to-chat-btn:hover,
      #${SIDEBAR_ID} .sgpt-export-btn:hover {
        background: var(--sgpt-hover);
        color: var(--sgpt-text);
      }
      #${SIDEBAR_ID} .sgpt-delete-all-btn:hover:not(:disabled) {
        background: #fef2f2;
        color: #dc2626;
      }
      #${SIDEBAR_ID} .sgpt-delete-all-btn.confirm {
        background: #fef2f2;
        color: #dc2626;
        font-weight: 600;
      }
      #${SIDEBAR_ID} .sgpt-delete-all-btn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      #${SIDEBAR_ID} .sgpt-delete-all-btn {
        margin-right: auto;
      }

      /* --- Empty State --- */
      #${SIDEBAR_ID} .sgpt-empty-state {
        color: var(--sgpt-text-secondary);
        padding: 2em 1em;
        text-align: center;
        font-size: 0.9em;
        line-height: 1.5;
      }

      /* --- Toggle Button Drag Over --- */
      #sgpt-sidebar-tab-btn.sgpt-dragover {
        border-color: var(--sgpt-text) !important;
        box-shadow: 0 0 0 2px var(--sgpt-text-secondary), 0 4px 32px rgba(0,0,0,0.15) !important;
      }

      /* --- Footer --- */
      #${SIDEBAR_ID} .sgpt-sidebar-footer {
        padding: 0.6em 0.75em;
        border-top: 1px solid var(--sgpt-border);
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
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
      }
    } catch (e) {
      console.error('Theme observer error:', e);
    }
  }

  // --- MAIN ---
  function main() {
    try {
      injectStyles();
      migrateFromLocalStorage();
      createSidebar();
      createToggleButton();
      document.addEventListener('selectionchange', onSelection);
      observeThemeChanges();
      syncTheme();
      document.addEventListener('mousedown', (e) => {
        if (saveBtn && e.target !== saveBtn && !saveBtn.contains(e.target)) hideSaveBtn();
      });
      document.addEventListener('click', (e) => {
        if (!sidebarVisible) return;
        const sidebar = document.getElementById(SIDEBAR_ID);
        if (!sidebar) return;
        if (sidebar.contains(e.target)) return;
        if (e.target.closest('#sgpt-sidebar-tab-btn')) return;
        toggleSidebar(false);
      });
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