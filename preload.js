const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveNote: (text) => ipcRenderer.invoke('save-note', text),
    loadNote: () => ipcRenderer.invoke('load-note'),
    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    newNote: () => ipcRenderer.invoke('new-note'),
    openFile: () => ipcRenderer.invoke('open-file'),
    smartSave: (text, FilePath) => ipcRenderer.invoke('smart-save', text, FilePath),
    onMenuAction: (channel, callback) => ipcRenderer.on(channel, callback),
    // Temporary: forward renderer errors to main so they appear in the terminal for debugging
    logError: (err) => ipcRenderer.invoke('renderer-error', err),

    getNotes: () => ipcRenderer.invoke('get-all-notes'),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id)
});