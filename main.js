const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

const notesFilePath = path.join(app.getPath('userData'), 'notes.json');
let tray = null;
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    return mainWindow;
}

app.whenReady().then(() => {
    const win = createWindow();

    // ✅ FIXED: Use 'before-close' to save data, but allow quit
    win.on('before-close', async () => {
        console.log('App closing, saving any pending data...');
        // Any final cleanup here
    });

    // ✅ FIXED: Remove close prevention - let window close normally
    win.on('close', (event) => {
        // Don't prevent close on app quit
        if (app.isQuiting) {
            mainWindow = null;
            return;
        }
        // Only hide on regular close (not quit)
        event.preventDefault();
        win.hide();
    });

    // Tray setup
    const trayIconPath = path.join(__dirname, 'Tray-Icon.png');
    try {
        if (fs.existsSync(trayIconPath)) {
            tray = new Tray(trayIconPath);
        } else {
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
            const img = nativeImage.createFromDataURL(dataUrl);
            tray = new Tray(img);
        }

        tray.on('double-click', () => {
            if (mainWindow && mainWindow.isVisible()) {
                mainWindow.hide();
            } else if (mainWindow) {
                mainWindow.show();
            }
        });

        const trayMenu = Menu.buildFromTemplate([
            { 
                label: 'Show App', 
                click: () => { 
                    if (mainWindow) mainWindow.show(); 
                } 
            },
            { 
                label: 'Quit', 
                click: () => { 
                    app.isQuiting = true;  // ✅ Set flag for graceful quit
                    app.quit(); 
                } 
            }
        ]);
        tray.setToolTip('Quick Note Taker');
        tray.setContextMenu(trayMenu);
    } catch (err) {
        console.error('Tray creation failed:', err);
    }

    // App Menu
    const isMac = process.platform === 'darwin';
    const menuTemplate = [
        ...(isMac ? [{ 
            label: app.name, 
            submenu: [ 
                { role: 'about' }, 
                { type: 'separator' }, 
                { role: 'quit' } 
            ] 
        }] : []),
        {
            label: 'File',
            submenu: [
                { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu-new-note'); } },
                { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu-open-file'); } },
                { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu-save'); } },
                { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu-save-as'); } },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { 
                    app.isQuiting = true;
                    app.quit(); 
                } }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    app.on('activate', () => { 
        if (BrowserWindow.getAllWindows().length === 0) createWindow(); 
    });
});

// ✅ FIXED: Proper lifecycle management
app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ✅ FIXED: Clean up before quit
app.on('before-quit', () => {
    console.log('App before-quit event triggered');
    app.isQuiting = true;
    
    // Destroy tray to release resources
    if (tray) {
        tray.destroy();
        tray = null;
    }
    
    // Close main window if still open
    if (mainWindow) {
        mainWindow = null;
    }
});

// --- IPC HANDLERS ---

ipcMain.handle('save-note', async (event, text) => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(filePath, text, 'utf-8');
    return { success: true };
});

ipcMain.handle('load-note', async () => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
});

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

ipcMain.handle('new-note', async () => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Discard Changes', 'Cancel'],
        defaultId: 1,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Start a new note anyway?'
    });
    return { confirmed: result.response === 0 };
});

ipcMain.handle('open-file', async (event) => {
    const result = await dialog.showOpenDialog({
        title: 'Open File',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (result.canceled) {
        return { success: false };
    }
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
});

ipcMain.handle('smart-save', async (event, text, currentFilePath) => {
    const targetPath = currentFilePath || path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(targetPath, text, 'utf-8');
    return { success: true, filePath: targetPath };
});

ipcMain.handle('renderer-error', async (event, err) => {
    console.error('Renderer reported error:', err);
    return { received: true };
});

// Settings helpers
function readAllNotes() {
    if (!fs.existsSync(notesFilePath)) return [];
    const raw = fs.readFileSync(notesFilePath, 'utf-8');
    return JSON.parse(raw);
}

function writeAllNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

ipcMain.handle('get-all-notes', async () => {
    return readAllNotes();
});

ipcMain.handle('delete-note', async (event, id) => {
    const notes = readAllNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    writeAllNotes(filteredNotes);
    return { success: true };
});

ipcMain.handle('save-note-json', async (event, note) => {
    const notes = readAllNotes();
    const index = notes.findIndex(n => n.id === note.id);
    const now = new Date().toISOString();
    if (index === -1) {
        notes.push({ ...note, createdAt: now, updatedAt: now });
    } else {
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }
    writeAllNotes(notes);
    return { success: true };
});

// Settings file
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
    if (!fs.existsSync(settingsFilePath)) {
        return { fontSize: 16, darkMode: false };
    }
    const raw = fs.readFileSync(settingsFilePath, 'utf-8');
    return JSON.parse(raw);
}

function writeSettings(settings) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
}

ipcMain.handle('get-settings', async () => {
    return readSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
    const current = readSettings();
    const updated = { ...current, ...settings };
    writeSettings(updated);
    return { success: true };
});

// Debounce timer for auto-saving notes
let debounceTimer;
function saveCurrentNote() {
    // Logic to save the current note
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.webContents.send('menu-save');
    }
}

// Debounce wrapper
function debounceSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveCurrentNote, 5000);
}

// Listen for note changes and trigger debounce
ipcMain.on('note-changed', (event) => {
    debounceSave();
});