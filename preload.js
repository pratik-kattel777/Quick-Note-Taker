const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    saveNote: (text) => ipcRenderer.invoke('save-note', text),
    loadNote: () => ipcRenderer.invoke('load-note'),
    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    smartSave: (text, currentFilePath) => ipcRenderer.invoke('smart-save', text, currentFilePath),
    openFile: () => ipcRenderer.invoke('open-file'),
    newNote: () => ipcRenderer.invoke('new-note'),

    // JSON notes operations
    getNotes: () => ipcRenderer.invoke('get-all-notes'),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Menu & errors
    onMenuAction: (channel, callback) => ipcRenderer.on(channel, callback),
    logError: (err) => ipcRenderer.invoke('renderer-error', err),
});