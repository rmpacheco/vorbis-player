const { app, BrowserWindow, globalShortcut, ipcMain, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

// Dynamic import for ESM module
let Store;
let store;

async function initializeStore() {
  const module = await import('electron-store');
  Store = module.default;
  store = new Store();
}

let mainWindow;
let tray;
let isQuitting = false;

// Window state management
let windowState = {
  width: 1024,
  height: 1186,
  x: undefined,
  y: undefined,
  isMaximized: false,
  isAlwaysOnTop: false
};

function createWindow() {
  // Create the browser window with transparent support
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    transparent: true,
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    alwaysOnTop: windowState.isAlwaysOnTop,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false, // Disabled to allow Spotify OAuth with reCAPTCHA
      allowRunningInsecureContent: true, // Allow mixed content
      webviewTag: true, // Enable webview tag
      plugins: true, // Enable plugins for Widevine
      experimentalFeatures: true // Enable experimental features for DRM
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
    titleBarStyle: 'hidden',
    vibrancy: 'under-window', // macOS only
    visualEffectState: 'active', // macOS only
    titleBarOverlay: false
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    // Temporarily enable DevTools in production to debug
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Restore maximized state if it was maximized
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
  });

  // Handle permission requests (allow all for Spotify)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all permissions for Spotify OAuth
    callback(true);
  });

  // Enable Widevine DRM for Spotify playback
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, origin) => {
    // Allow protected media identifier for DRM content
    if (permission === 'protectedMediaIdentifier') {
      return true;
    }
    return true;
  });

  // Remove CSP headers for Spotify OAuth
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    // Remove CSP headers that might block resources
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    
    callback({ responseHeaders });
  });

  // Handle window state changes
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      windowState.width = bounds.width;
      windowState.height = bounds.height;
      if (store) {
        store.set('windowState.width', bounds.width);
        store.set('windowState.height', bounds.height);
      }
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      windowState.x = bounds.x;
      windowState.y = bounds.y;
      if (store) {
        store.set('windowState.x', bounds.x);
        store.set('windowState.y', bounds.y);
      }
    }
  });

  mainWindow.on('maximize', () => {
    windowState.isMaximized = true;
    if (store) store.set('windowState.isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    windowState.isMaximized = false;
    if (store) store.set('windowState.isMaximized', false);
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle external links and popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Spotify OAuth and challenge popups to stay within Electron
    if (url.includes('spotify.com') || url.includes('challenge.spotify.com') || 
        url.includes('google.com') || url.includes('facebook.com') || url.includes('apple.com')) {
      // Handle authentication popups in the main window instead of new windows
      mainWindow.loadURL(url);
      return { action: 'deny' };
    }
    
    // For other URLs, open externally
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Handle new window creation (legacy handler)
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    
    // Handle auth-related URLs in the main window
    if (navigationUrl.includes('spotify.com') || navigationUrl.includes('challenge.spotify.com') ||
        navigationUrl.includes('google.com') || navigationUrl.includes('facebook.com') || 
        navigationUrl.includes('apple.com')) {
      mainWindow.loadURL(navigationUrl);
    } else {
      shell.openExternal(navigationUrl);
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Vorbis Player',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Toggle Always on Top',
      type: 'checkbox',
      checked: windowState.isAlwaysOnTop,
      click: (menuItem) => {
        toggleAlwaysOnTop(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      accelerator: 'MediaPlayPause',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'play-pause');
      }
    },
    {
      label: 'Next Track',
      accelerator: 'MediaNextTrack',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'next-track');
      }
    },
    {
      label: 'Previous Track',
      accelerator: 'MediaPreviousTrack',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'previous-track');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Vorbis Player');
  
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcuts() {
  // Register media key shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('global-shortcut', 'play-pause');
  });
  
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('global-shortcut', 'next-track');
  });
  
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('global-shortcut', 'previous-track');
  });
  
  // Register custom shortcuts
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    toggleAlwaysOnTop(!windowState.isAlwaysOnTop);
  });
}

function toggleAlwaysOnTop(alwaysOnTop) {
  windowState.isAlwaysOnTop = alwaysOnTop;
  if (store) store.set('windowState.isAlwaysOnTop', alwaysOnTop);
  mainWindow.setAlwaysOnTop(alwaysOnTop);
  
  // Update tray menu
  if (tray) {
    const contextMenu = tray.getContextMenu();
    const alwaysOnTopItem = contextMenu.getMenuItemById('always-on-top');
    if (alwaysOnTopItem) {
      alwaysOnTopItem.checked = alwaysOnTop;
    }
  }
}

// IPC handlers
ipcMain.handle('window-controls', async (event, action) => {
  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.hide();
      break;
    case 'toggle-always-on-top':
      toggleAlwaysOnTop(!windowState.isAlwaysOnTop);
      break;
  }
});

ipcMain.handle('get-window-state', async () => {
  return {
    isMaximized: mainWindow.isMaximized(),
    isAlwaysOnTop: windowState.isAlwaysOnTop
  };
});

ipcMain.handle('show-notification', async (event, { title, body, icon }) => {
  // This will be implemented with proper notification service
  console.log('Notification:', { title, body, icon });
});

// App event handlers
app.whenReady().then(async () => {
  await initializeStore();
  
  // Load window state from store
  windowState = {
    width: store.get('windowState.width', 1024),
    height: store.get('windowState.height', 1186),
    x: store.get('windowState.x', undefined),
    y: store.get('windowState.y', undefined),
    isMaximized: store.get('windowState.isMaximized', false),
    isAlwaysOnTop: store.get('windowState.isAlwaysOnTop', false)
  };
  
  // Register protocol handler for OAuth callbacks
  app.setAsDefaultProtocolClient('vorbis-player');
  
  // Verify Widevine availability
  console.log('Widevine availability:', {
    widevineSupported: app.isDefaultProtocolClient('widevine'),
    pluginsEnabled: true
  });
  
  createWindow();
  createTray();
  registerGlobalShortcuts();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Security: Handle navigation
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow OAuth URLs (Spotify, Challenge, Google, Facebook, Apple)
    if (navigationUrl.includes('accounts.spotify.com') || 
        navigationUrl.includes('challenge.spotify.com') ||
        navigationUrl.includes('accounts.google.com') ||
        navigationUrl.includes('facebook.com/login') ||
        navigationUrl.includes('appleid.apple.com')) {
      // Temporarily disable transparency and dragging for OAuth auth
      if (mainWindow) {
        mainWindow.setBackgroundColor('#ffffff');
        mainWindow.setVibrancy(null);
        // Inject CSS to disable drag region on auth pages
        mainWindow.webContents.insertCSS(`
          body {
            -webkit-app-region: no-drag !important;
            user-select: auto !important;
          }
          * {
            -webkit-app-region: no-drag !important;
            pointer-events: auto !important;
          }
        `);
      }
      return;
    }
    
    // Allow local URLs and file protocol
    if (parsedUrl.origin === 'http://127.0.0.1:3000' || parsedUrl.origin === 'file://') {
      // Re-enable transparency and dragging when back to our app
      if (mainWindow && !navigationUrl.includes('accounts.spotify.com') && 
          !navigationUrl.includes('challenge.spotify.com') &&
          !navigationUrl.includes('accounts.google.com') &&
          !navigationUrl.includes('facebook.com') &&
          !navigationUrl.includes('appleid.apple.com')) {
        mainWindow.setBackgroundColor('#00000000');
        if (process.platform === 'darwin') {
          mainWindow.setVibrancy('under-window');
        }
        // Restore normal CSS for our app - selective dragging
        mainWindow.webContents.insertCSS(`
          body {
            -webkit-app-region: no-drag !important;
            user-select: none !important;
          }
          .drag-region, .app-header, .empty-space, .background-area {
            -webkit-app-region: drag !important;
          }
          button, input, select, textarea, [role="button"], [tabindex], 
          .slider, .control-button, .playlist-item, .settings-button,
          a, .clickable, .interactive, [onclick], .menu-item, 
          .dropdown, .modal, .dialog, .card, .list-item,
          div[role="button"], span[role="button"], li, ul, ol,
          .playlist-selection, .playlist-grid, .album-art {
            -webkit-app-region: no-drag !important;
            user-select: auto !important;
            pointer-events: auto !important;
          }
        `);
      }
      return;
    }
    
    // Prevent and open externally all other URLs
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle OAuth callback from browser
app.on('open-url', (event, url) => {
  event.preventDefault();
  // If the app receives an OAuth callback, load it in the main window
  if (url.startsWith('vorbis-player://auth/spotify/callback')) {
    const callbackUrl = url.replace('vorbis-player://', 'http://127.0.0.1:3000/');
    if (mainWindow) {
      mainWindow.loadURL(callbackUrl);
      mainWindow.show();
      mainWindow.focus();
    }
  }
});
