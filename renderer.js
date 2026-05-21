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

  // State
  let notes = [];
  let currentNoteId = null;
  let lastSavedContent = '';

  // NEW: Render the note list in the sidebar
  function renderNoteList() {
    noteList.innerHTML = ''; // clear existing list

    notes.forEach(note => {
      const item = document.createElement('div');

      item.className =
        'note-item' + (note.id === currentNoteId ? ' active' : '');

      item.innerHTML = `
        <button class="note-item-delete" data-id="${note.id}">×</button>
        <div class="note-item-title">
          ${note.title || 'Untitled'}
        </div>
        <div class="note-item-date">
          ${new Date(note.updatedAt).toLocaleDateString()}
        </div>
      `;

      // Click note to open it
      item.addEventListener('click', async (e) => {

        if (e.target.classList.contains('note-item-delete'))
          return;

        await switchNote(note.id);

      });

      // Delete button
      item
        .querySelector('.note-item-delete')
        .addEventListener('click', async (e) => {

          e.stopPropagation();

          await deleteNote(note.id);

        });

      noteList.appendChild(item);
    });
  }

  // NEW: Switch to a different note
  // (with unsaved changes warning)
  async function switchNote(id) {

    // Check for unsaved changes first
    if (textarea.value !== lastSavedContent) {

      const result =
        await window.electronAPI.newNote();

      // user cancelled — stay on current note
      if (!result.confirmed)
        return;
    }

    // Load the selected note
    const note =
      notes.find(n => n.id === id);

    if (!note)
      return;

    currentNoteId = note.id;

    titleInput.value =
      note.title || '';

    textarea.value =
      note.content || '';

    lastSavedContent =
      note.content || '';

    statusEl.textContent = '';

    // refresh sidebar to show active state
    renderNoteList();
  }

// Save current note
async function saveCurrentNote() {

  if (!currentNoteId)
    return;

  const note = {
    id: currentNoteId,
    title: titleInput.value || 'Untitled',
    content: textarea.value
  };

  await window.electronAPI.saveNoteJson(note);

  lastSavedContent = textarea.value;

  // Update the note in the local array too
  const index =
    notes.findIndex(n => n.id === currentNoteId);

  if (index !== -1) {

    notes[index] = {
      ...notes[index],
      ...note,
      updatedAt: new Date().toISOString()
    };

  }

  renderNoteList();

  statusEl.textContent =
    `Saved at ${new Date().toLocaleTimeString()}`;
}


// NEW: Delete a note
async function deleteNote(id) {

  const result =
    await window.electronAPI.newNote(); // reuse warning dialog

  if (!result.confirmed)
    return;

  await window.electronAPI.deleteNote(id);

  notes =
    notes.filter(n => n.id !== id);

  // If we deleted the current note, clear the editor
  if (currentNoteId === id) {

    currentNoteId = null;

    titleInput.value = '';

    textarea.value = '';

    lastSavedContent = '';

    statusEl.textContent = 'Note deleted.';
  }

  renderNoteList();
}


// UPDATED: New Note button - creates a new note in JSON storage
newNoteBtn.addEventListener('click', async () => {

  if (textarea.value !== lastSavedContent) {

    const result =
      await window.electronAPI.newNote();

    if (!result.confirmed)
      return;
  }

  // Create a new note object
  const newNote = {
    id: Date.now().toString(),
    title: 'Untitled',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await window.electronAPI.saveNoteJson(newNote);

  notes.unshift(newNote); // add to the top of the list

  currentNoteId = newNote.id;

  titleInput.value = '';

  textarea.value = '';

  lastSavedContent = '';

  renderNoteList();

  titleInput.focus(); // move cursor to title field

  statusEl.textContent = 'New note created.';
});

// UPDATED: Save button
saveBtn.addEventListener('click', async () => {

  await saveCurrentNote();

});


// UPDATED: Auto-save with debounce
textarea.addEventListener('input', () => {

  statusEl.textContent = 'Unsaved changes...';

  clearTimeout(debounceTimer);

  debounceTimer =
    setTimeout(saveCurrentNote, 5000);

});


// Also auto-save when title changes
titleInput.addEventListener('input', () => {

  clearTimeout(debounceTimer);

  debounceTimer =
    setTimeout(saveCurrentNote, 5000);

});


// UPDATED: Load all notes on startup
notes = await window.electronAPI.getNotes();

if (notes.length > 0) {

  // Open the most recently updated note
  const mostRecent =
    notes.reduce((a, b) =>

      new Date(a.updatedAt) >
      new Date(b.updatedAt)

        ? a
        : b
    );

  await switchNote(mostRecent.id);

} else {

  // No notes yet — trigger New Note automatically
  newNoteBtn.click();

}

renderNoteList();

function updateWordCount() {

    const text = textarea.value;
    const character = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const wordCountEl = document.getElementById('word-count');
    wordCountEl.textContent = `Word Count: ${words} | Character Count: ${character}`;
}

//call when user types
textarea.addEventListener('input',() => {
    updateWordCount();
    statusEl.textContent = 'Unsaved changes...';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveCurrentNote, 5000);
});
//call when note is loaded
async function switchNote(id) {
    // ... existing code...
    textarea.value = note.content || '';
    updateWordCount(); 
}
//NEW: font size control
const fontIncreaseBtn = document.getElementById('font-increase');
const fontDecreaseBtn = document.getElementById('font-decrease');
let currentFontSize = 16; // default font size in px

function applyFontSize(size) {
    currentFontSize = Math.min(32, Math.max(10, size));
    textarea.style.fontSize = `${currentFontSize}px`;
}

fontIncreaseBtn.addEventListener('click', async () => {
    applyFontSize(currentFontSize + 2);
    await window.electronAPI.saveSettings({ fontSize: currentFontSize });
});

fontDecreaseBtn.addEventListener('click', async () => {
    applyFontSize(currentFontSize - 2);
    await window.electronAPI.saveSettings({ fontSize: currentFontSize });
});

//NEW: Load saved font size on startup
const settings = await window.electronAPI.getSettings();
applyFontSize(settings.fontSize || 16);

// Load saved note on startup
const savedNote = await window.electronAPI.loadNote();
textarea.value = savedNote;
let lastSavedText = textarea.value; // track last saved state
let currentFilePath = null;

async function autoSave() {
  const currentText = textarea.value;
  if (currentText !== lastSavedText) {
    try {
      await window.electronAPI.saveNote(textarea.value);
      lastSavedText = currentText;
      const now = new Date().toLocaleTimeString();
      statusEl.textContent = `Auto-saved at ${now}`;
    } catch (err) {
      console.error('Auto-save failed:', err);
      statusEl.textContent = 'Auto-save failed';
    }
  } else {
    statusEl.textContent = 'No changes to save';
  }
}
let debounceTimer;

// Auto-save on input change
textarea.addEventListener('input', () => {
  statusEl.textContent = 'Changes detected-auto-saving in 5 seconds...';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(autoSave, 5000); // Save after 5 seconds of inactivity
});

// Manual save on button click
saveBtn.addEventListener('click', autoSave);

// Save on window close if there are unsaved changes
window.addEventListener('beforeunload', async () => {
  const currentText = textarea.value;
  if (currentText !== lastSavedText) {
    await autoSave();
  }
});

// Save As button
saveAsBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.saveAs(textarea.value);
  if (result.success) {
  lastSavedText = textarea.value; // Update last saved state
  statusEl.textContent = `Saved to: ${result.filePath}`;
  } else {
  statusEl.textContent = 'Save As cancelled';
  } 
});  

newNoteBtn.addEventListener('click', async () => {
  if(textarea.value === lastSavedText){
    textarea.value = '';
    lastSavedText = '';
    statusEl.textContent = 'New note started';
    return;
  }
  const result = await window.electronAPI.newNote();
  if(result.confirmed){
    textarea.value = '';
    lastSavedText = '';
    statusEl.textContent = 'New note started';
  }
  else{
    statusEl.textContent = 'New note cancelled';
  }
});

openFileBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.openFile();
  if (result.success) {
    textarea.value = result.content;
    lastSavedText = result.content;
    currentFilePath = result.filePath;
    statusEl.textContent = `Opened file: ${result.filePath}`;
  } else {
    statusEl.textContent = 'Open file cancelled';
  }
});

saveBtn.addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.smartSave(textarea.value, currentFilePath);
    lastSavedText = textarea.value; // Update last saved state
    currentFilePath = result.filePath;
    statusEl.textContent = `Saved to: ${result.filePath}`;
  } catch (err) {
  console.error('Save failed:', err);
  statusEl.textContent = 'Save failed';
}
});

// Wire up application menu actions (use button references available in this scope)
if (window.electronAPI && window.electronAPI.onMenuAction) {
  window.electronAPI.onMenuAction('menu-new-note', async () => {
    newNoteBtn.click();
  });
  window.electronAPI.onMenuAction('menu-open-file', async () => {
    openFileBtn.click();
  });
  window.electronAPI.onMenuAction('menu-save', async () => {
    saveBtn.click();
  });
  window.electronAPI.onMenuAction('menu-save-as', async () => {
    saveAsBtn.click();
  });
}
});


