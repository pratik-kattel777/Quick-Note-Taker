window.addEventListener('DOMContentLoaded', async () => {

    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('status');

    // Load saved note on startup
    const savedNote = await window.electronAPI.loadNote();
    textarea.value = savedNote;
    let lastSavedText = textarea.value; // track last saved state

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
});

