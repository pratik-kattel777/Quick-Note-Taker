const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Disabling hardware acceleration can help with rendering issues on some systems
app.disableHardwareAcceleration();

// notes file path (use correct key 'userData')
const notesFilePath = path.join(app.getPath('userData'), 'notes.json');

// tray reference (created when app is ready)
let tray = null;

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
    return win;
}
app.whenReady().then(() => {
    // create main window and attach handlers
    const win = createWindow();
    win.on('close', (event) => {
        // prevent quitting the app and hide window instead
        event.preventDefault();
        win.hide();
    });

    // Create system tray icon. If the external icon is missing, fall back to an embedded tiny image
    const trayIconPath = path.join(__dirname, 'Tray-Icon.png');
    try {
        if (fs.existsSync(trayIconPath)) {
            tray = new Tray(trayIconPath);
        } else {
            // 1x1 transparent PNG data URL as a safe fallback
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
            const img = nativeImage.createFromDataURL(dataUrl);
            tray = new Tray(img);
        }
            tray.on('double-click', () => {
                const w = BrowserWindow.getAllWindows()[0];
                if (w && w.isVisible()) w.hide(); else if (w) w.show();
            });
            const trayMenu = Menu.buildFromTemplate([
                { label: 'Show App', click: () => { const w = BrowserWindow.getAllWindows()[0]; if (w) w.show(); } },
                { label: 'Quit', click: () => { app.quit(); } }
            ]);
            tray.setToolTip('Quick Note Taker');
            tray.setContextMenu(trayMenu);
    } catch (err) {
        console.error('Tray creation failed (maybe unsupported on this platform):', err);
    }

    // NEW: App Menu
    const isMac = process.platform === 'darwin';
    const menuTemplate = [
        ...(isMac ? [{ label: app.name, submenu: [ { role: 'about' }, { type: 'separator' }, { role: 'quit' } ] }] : []),
        {
            label: 'File',
            submenu: [
                { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => { BrowserWindow.getFocusedWindow().webContents.send('menu-new-note'); } },
                { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => { BrowserWindow.getFocusedWindow().webContents.send('menu-open-file'); } },
                { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => { BrowserWindow.getFocusedWindow().webContents.send('menu-save'); } },
                { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => { BrowserWindow.getFocusedWindow().webContents.send('menu-save-as'); } },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit(); } }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
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
// (duplicate incorrect save-as handler removed)

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
// NEW: Open file handler
ipcMain.handle('open-file', async (event) => {
    const result = await dialog.showOpenDialog({
        title: 'openFile',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (result.canceled) {
        return { success: false };
    }
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
});
//UPDATED: Smart Save Handeler
ipcMain.handle('smart-save', async (event, text, currentFilePath) => {
    const targetPath = currentFilePath || path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(targetPath, text, 'utf-8');
    return { success: true, filePath: targetPath };
});

// Temporary: receive renderer error reports and print them to the main process console
ipcMain.handle('renderer-error', async (event, err) => {
    console.error('Renderer reported error:', err);
    return { received: true };
});
// NEW: System tray is created in the main whenReady initializer above
//NEW: Helper - read all notes from the JSON file
function readAllNotes() {
    if (!fs.existsSync(notesFilePath)) {
        return [];
    }
    const raw = fs.readFileSync(notesFilePath, 'utf-8');
    return JSON.parse(raw);
}
//NEW: Helper - write all notes to the JSON file
function writeAllNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes), 'utf-8');
}
//NEW: Get all notes 
ipcMain.handle('get-all-notes', async () => {
    return readAllNotes();
});

//NEW: delete a note
ipcMain.handle('delete-note', async (event, id) => {
    const notes = readAllNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    writeAllNotes(filteredNotes);
    return { success: true };
});
//NEW: save a note 
ipcMain.handle('save-note-json', async (event, note) => {
    const notes = readAllNotes();
    const index = notes.findIndex(n=>n.id === note.id);
    const now = new Date().toISOString();
    if(index === -1){
        //note doesn't exist yet, create new
        notes.push({ ...note, createdAt: now, updatedAt: now });
    } else {
        //note exists, update it
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }
    writeAllNotes(notes);
    return { success: true };
});