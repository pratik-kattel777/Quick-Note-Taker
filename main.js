const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// Disabling hardware acceleration can help with rendering issues on some systems
app.disableHardwareAcceleration();

const path = require('node:path');
const fs = require('node:fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// Saves the note to the user's Documents folder
ipcMain.handle('save-note', async (event, text) => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(filePath, text, 'utf-8');
    return { success: true };
});

// Loads the note from the user's Documents folder
ipcMain.handle('load-note', async () => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
});

// Saves the note to a user-selected file
ipcMain.handle('save-as', async (event, text) => {
    const result = await dialog.showSaveDialog({
        title: 'Save Note As',
        defaultPath: 'note.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (!result.canceled) {
        fs.writeFileSync(result.filePath, text, 'utf-8');
        return { success: true, filePath: result.filePath };
    }
    return { success: false };
});

// NEW: Save AS handler
ipcMain.handle('save-as', async (event, text) => {
    const result = await dialog.showSaveDialog({
        defultPath: 'my note.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (result.canceled) {
        return { success: false };
    }
    fs.writeFileSync(result.filePath, text, 'utf-8');
    return { success: true, filePath: result.filePath };
});

// NEW: New note handler
ipcMain.handle('new-note', async () => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Discard Changes', 'Cancel'],
        defaultId: 1,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Start a new note any way?'
        });
    return { confirmed: result.response === 0 };
});