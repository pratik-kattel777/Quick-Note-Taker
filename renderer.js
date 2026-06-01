// Global error forwarding (temporary) — forwards renderer errors to main so they appear in the terminal
window.addEventListener('error', (e) => {
    const err = {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error && e.error.stack
    };
    try {
        if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(err);
    } catch (ignore) {}
    console.error('Window error forwarded:', err);
});

window.addEventListener('unhandledrejection', (e) => {
    const err = { reason: (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason) };
    try {
        if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(err);
    } catch (ignore) {}
    console.error('Unhandled rejection forwarded:', err);
});

window.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const titleInput = document.getElementById('note-title');
  const saveBtn = document.getElementById('save');
  const saveAsBtn = document.getElementById('save-as');
  const openFileBtn = document.getElementById('open-file');
  const newNoteBtn = document.getElementById('new-note');
  const noteList = document.getElementById('notes-list');
  const statusEl = document.getElementById('save_status');
  const fontIncreaseBtn = document.getElementById('font-increase');
  const fontDecreaseBtn = document.getElementById('font-decrease');
  const darkModeBtn = document.getElementById('dark-mode-toggle');
  const wordCountEl = document.getElementById('word-count');
  const searchInput = document.getElementById('search');
  const favoriteBtn = document.getElementById('favorite-btn');
  const favoritesFilterBtn = document.getElementById('favorites-filter');

  // State
  let notes = [];
  let currentNoteId = null;
  let lastSavedContent = '';
  let debounceTimer;
  let currentFontSize = 16;
  let isDarkMode = false;
  let filterValue = '';
  let showOnlyFavorites = false;

  // ===== HELPER FUNCTIONS =====

  function showNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icon.png',
        ...options
      });
    }
  }

  async function requestNotificationPermission() {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
      } catch (err) {
        console.error('Failed to request notification permission:', err);
      }
    }
  }

  // ✅ Toggle favorite for current note
  async function toggleFavorite() {
    if (!currentNoteId) return;

    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    note.isFavorite = !note.isFavorite;
    await window.electronAPI.saveNoteJson(note);

    const status = note.isFavorite ? 'added to' : 'removed from';
    showNotification('Favorite Updated', { body: `Note ${status} favorites` });
    
    updateFavoriteButton();
    renderNoteList();
  }

  // ✅ Update favorite button appearance
  function updateFavoriteButton() {
    if (!favoriteBtn) return;

    const note = notes.find(n => n.id === currentNoteId);
    if (note && note.isFavorite) {
      favoriteBtn.textContent = '⭐ Favorited';
      favoriteBtn.classList.add('favorited');
    } else {
      favoriteBtn.textContent = '☆ Favorite';
      favoriteBtn.classList.remove('favorited');
    }
  }

  function renderNoteList() {
    noteList.innerHTML = '';
    
    // Filter by search and favorites
    let filtered = notes;

    if (showOnlyFavorites) {
      filtered = filtered.filter(n => n.isFavorite);
    }

    if (filterValue.trim() !== '') {
      filtered = filtered.filter(n =>
        (n.title || '').toLowerCase().includes(filterValue.toLowerCase()) ||
        (n.content || '').toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    // Sort: favorites first, then by date
    filtered.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return b.isFavorite ? 1 : -1;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (filtered.length === 0) {
      noteList.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">No notes found</div>';
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item' + (note.id === currentNoteId ? ' active' : '');
      const star = note.isFavorite ? '⭐' : '☆';
      item.innerHTML = `
        <button class="note-item-delete" data-id="${note.id}">×</button>
        <div class="note-item-content">
          <div class="note-item-title">${star} ${note.title || 'Untitled'}</div>
          <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
        </div>
      `;

      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('note-item-delete')) return;
        await switchNote(note.id);
      });

      item.querySelector('.note-item-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteNote(note.id);
      });

      noteList.appendChild(item);
    });
  }

  async function switchNote(id) {
    if (textarea.value !== lastSavedContent) {
      const result = await window.electronAPI.newNote();
      if (!result.confirmed) return;
    }

    const note = notes.find(n => n.id === id);
    if (!note) return;

    currentNoteId = note.id;
    titleInput.value = note.title || '';
    textarea.value = note.content || '';
    lastSavedContent = note.content || '';
    statusEl.textContent = '';
    updateWordCount();
    renderNoteList();
    updateFavoriteButton();
    showNotification('Note Opened', { body: note.title || 'Untitled' });
  }

  async function saveCurrentNote() {
    if (!currentNoteId) return;

    const note = {
      id: currentNoteId,
      title: titleInput.value || 'Untitled',
      content: textarea.value
    };

    await window.electronAPI.saveNoteJson(note);
    lastSavedContent = textarea.value;

    const index = notes.findIndex(n => n.id === currentNoteId);
    if (index !== -1) {
      notes[index] = {
        ...notes[index],
        ...note,
        updatedAt: new Date().toISOString()
      };
    }

    renderNoteList();
    statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
    showNotification('Note Saved', { body: `"${note.title}" has been saved` });
  }

  async function deleteNote(id) {
    const result = await window.electronAPI.newNote();
    if (!result.confirmed) return;

    const deletedNote = notes.find(n => n.id === id);
    await window.electronAPI.deleteNote(id);
    notes = notes.filter(n => n.id !== id);

    if (currentNoteId === id) {
      currentNoteId = null;
      titleInput.value = '';
      textarea.value = '';
      lastSavedContent = '';
      statusEl.textContent = 'Note deleted.';
      updateFavoriteButton();
    }

    renderNoteList();
    showNotification('Note Deleted', { body: `"${deletedNote?.title || 'Note'}" has been deleted` });
  }

  function updateWordCount() {
    const text = textarea.value;
    const character = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    wordCountEl.textContent = `Word Count: ${words} | Character Count: ${character}`;
  }

  function applyFontSize(size) {
    currentFontSize = Math.min(32, Math.max(10, size));
    textarea.style.fontSize = `${currentFontSize}px`;
  }

  function applyDarkMode(enabled) {
    isDarkMode = enabled;
    if (enabled) {
      document.body.classList.add('dark-mode');
      if (darkModeBtn) darkModeBtn.textContent = '☀️ Light Mode';
    } else {
      document.body.classList.remove('dark-mode');
      if (darkModeBtn) darkModeBtn.textContent = '🌙 Dark Mode';
    }
  }

  // ===== EVENT LISTENERS =====

  // Font controls
  fontIncreaseBtn.addEventListener('click', async () => {
    applyFontSize(currentFontSize + 2);
    try {
      await window.electronAPI.saveSettings({ fontSize: currentFontSize });
      showNotification('Font Increased', { body: `Font size: ${currentFontSize}px` });
    } catch (err) {
      console.error('Failed to save font size:', err);
    }
  });

  fontDecreaseBtn.addEventListener('click', async () => {
    applyFontSize(currentFontSize - 2);
    try {
      await window.electronAPI.saveSettings({ fontSize: currentFontSize });
      showNotification('Font Decreased', { body: `Font size: ${currentFontSize}px` });
    } catch (err) {
      console.error('Failed to save font size:', err);
    }
  });

  // Dark mode toggle
  if (darkModeBtn) {
    darkModeBtn.addEventListener('click', async () => {
      applyDarkMode(!isDarkMode);
      try {
        await window.electronAPI.saveSettings({ darkMode: isDarkMode });
        showNotification('Theme Changed', { body: isDarkMode ? 'Dark Mode Enabled' : 'Light Mode Enabled' });
      } catch (err) {
        console.error('Failed to save dark mode setting:', err);
      }
    });
  }

  // ✅ Favorite button
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async () => {
      await toggleFavorite();
    });
  }

  // ✅ Favorites filter button
  if (favoritesFilterBtn) {
    favoritesFilterBtn.addEventListener('click', () => {
      showOnlyFavorites = !showOnlyFavorites;
      if (showOnlyFavorites) {
        favoritesFilterBtn.classList.add('active');
        favoritesFilterBtn.textContent = '⭐ Favorites (ON)';
      } else {
        favoritesFilterBtn.classList.remove('active');
        favoritesFilterBtn.textContent = '☆ All Notes';
      }
      renderNoteList();
    });
  }

  // New note button
  newNoteBtn.addEventListener('click', async () => {
    if (textarea.value !== lastSavedContent) {
      const result = await window.electronAPI.newNote();
      if (!result.confirmed) return;
    }

    const newNote = {
      id: Date.now().toString(),
      title: 'Untitled',
      content: '',
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await window.electronAPI.saveNoteJson(newNote);
    notes.unshift(newNote);
    currentNoteId = newNote.id;
    titleInput.value = '';
    textarea.value = '';
    lastSavedContent = '';
    renderNoteList();
    updateFavoriteButton();
    titleInput.focus();
    statusEl.textContent = 'New note created.';
    showNotification('New Note Created', { body: 'Ready to write!' });
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    await saveCurrentNote();
  });

  // Save As button
  saveAsBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.saveAs(textarea.value);
    if (result.success) {
      lastSavedContent = textarea.value;
      statusEl.textContent = `Saved to: ${result.filePath}`;
      showNotification('Note Exported', { body: result.filePath });
    } else {
      statusEl.textContent = 'Save As cancelled';
    }
  });

  // Open file button
  openFileBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.openFile();
    if (result.success) {
      textarea.value = result.content;
      lastSavedContent = result.content;
      statusEl.textContent = `Opened file: ${result.filePath}`;
      updateWordCount();
      showNotification('File Opened', { body: result.filePath });
    } else {
      statusEl.textContent = 'Open file cancelled';
    }
  });

  // Textarea input (auto-save + word count)
  textarea.addEventListener('input', () => {
    statusEl.textContent = 'Unsaved changes...';
    updateWordCount();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveCurrentNote, 5000);
  });

  // Title input (auto-save)
  titleInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveCurrentNote, 5000);
  });

  // Search input listener
  searchInput.addEventListener('input', () => {
    filterValue = searchInput.value;
    renderNoteList();
  });

  // Window close
  window.addEventListener('beforeunload', async () => {
    if (textarea.value !== lastSavedContent) {
      await saveCurrentNote();
    }
  });

  // Menu actions
  if (window.electronAPI && window.electronAPI.onMenuAction) {
    window.electronAPI.onMenuAction('menu-new-note', () => newNoteBtn.click());
    window.electronAPI.onMenuAction('menu-open-file', () => openFileBtn.click());
    window.electronAPI.onMenuAction('menu-save', () => saveBtn.click());
    window.electronAPI.onMenuAction('menu-save-as', () => saveAsBtn.click());
  }

  // ===== STARTUP =====

  await requestNotificationPermission();
  showNotification('Quick Note Taker', { body: 'App started successfully!' });

  try {
    const settings = await window.electronAPI.getSettings();
    applyFontSize(settings.fontSize || 16);
    applyDarkMode(settings.darkMode || false);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  notes = await window.electronAPI.getNotes();
  if (notes.length > 0) {
    const mostRecent = notes.reduce((a, b) =>
      new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
    );
    await switchNote(mostRecent.id);
  } else {
    newNoteBtn.click();
  }

  renderNoteList();
});