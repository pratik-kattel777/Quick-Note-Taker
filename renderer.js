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
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('status');

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
    //New: Save As button 
    const saveAsBtn = document.getElementById('save-as');
    saveAsBtn.addEventListener('click', async () => {
      const result = await window.electronAPI.saveAs(textarea.value);
      if (result.success) {
        lastSavedText = textarea.value; // Update last saved state
        statusEl.textContent = `Saved to: ${result.filePath}`;
      } else {
        statusEl.textContent = 'Save As cancelled';
      } 
    });  


    const newNoteBtn = document.getElementById('new-note');
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
    const openFileBtn = document.getElementById('open-file');


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


