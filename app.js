const electron = require("electron"),
  path = require("path"),
  fs = require("fs"),
  dmg = require("dmg"),
  {app, BrowserWindow, ipcMain, shell} = electron,
  MAIN_PATH = path.join((electron.app || electron.remote.app).getPath("appData"),"Kahoot Winner"),
  config = {
    databaseDownloaded: false,
    applicationDownloaded: false,
    currentApplicationVersion: null,
    lastApplicationUpdateCheck: null,
    lastDatabaseUpdateTime: null,
    settings: {
      keepLauncherOpen: false,
      PORT: 2000
    }
  };

function updateMetadata(data={}) {
  Object.assign(config, data);
  fs.writeFile(path.join(MAIN_PATH, "launcher_metadata.json"), JSON.stringify(config, null, 2), () => {});
}

function getExecutableExtension(){
  const operatingSystem = process.platform;
  switch (operatingSystem) {
    case "darwin": {
      return "app";
    }
    case "win32": {
      return "exe";
    }
    default: {
      return "AppImage";
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    center: true,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile(path.join(__dirname, "assets/ui/index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("getView", (event, view) => {
  return new Promise((resolve) => {
    fs.readFile(path.join(__dirname, "assets/views", view + ".html"), "utf8", (error, data) => {
      if (error) {
        resolve(`<b>Failed to fetch view</b><br><span>${error}</span>`);
        return;
      }
      resolve(data);
    });
  });
});

ipcMain.handle("getMetadata", () => {
  return config;
});

ipcMain.handle("launchApp", () => {
  return new Promise((resolve) => {
    fs.writeFile(path.join(MAIN_PATH, ".env"), `PORT=${config.settings.PORT || 2000}`, () => {
      if (config.applicationDownloaded) {
        shell.openPath(path.join(MAIN_PATH, `Kahoot Winner.${getExecutableExtension()}`));
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
});

ipcMain.handle("updateSettings", (event, settings) => {
  Object.assign(config.settings, settings);
  updateMetadata();
});

ipcMain.handle("closeWindow", () => {
  if (options.settings.keepLauncherOpen) {
    return;
  }
  app.quit();
});

fs.mkdir(MAIN_PATH, () => {
  // Check files and update metadata
  fs.readFile(path.join(MAIN_PATH, "launcher_metadata.json"), "utf8", (error, data) => {
    if (error) {
      return updateMetadata();
    }
    Object.assign(config, JSON.parse(data));
    fs.stat(path.join(MAIN_PATH, `Kahoot Winner.${getExecutableExtension()}`), (error) => {
      if (error) {
        updateMetadata({
          applicationDownloaded: false
        });
      }
    });
  });
});
