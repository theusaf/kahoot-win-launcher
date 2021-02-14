const electron = require("electron"),
  path = require("path"),
  fs = require("fs-extra"),
  dmg = require("dmg"),
  semver = require("semver"),
  got = require("got"),
  downloadDatabase = require("./assets/util/downloadDatabase.js"),
  {app, BrowserWindow, ipcMain, shell} = electron,
  MAIN_PATH = path.join((electron.app || electron.remote.app).getPath("appData"),"Kahoot Winner"),
  config = {
    databaseDownloaded: false,
    databaseSize: null,
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

function getSize(file){
  return getStat(file).then((stat) => {
    if (stat.isFile()) {
      return stat.size;
    } else {
      return getFiles(file).then((files) => {
        const promises = files.map((f) => {
          return path.join(file, f);
        }).map(getSize);
        return Promise.all(promises);
      }).then((elementSizes) => {
        let total = 0;
        elementSizes.forEach((size) => {
          total += size;
        });
        return total;
      });
    }
  });
}

function getStat(file){
  return new Promise((resolve, reject) => {
    fs.stat(file, (err, stat) => {
      if (err) {return reject(err);}
      resolve(stat);
    });
  });
}

function getFiles(file){
  return new Promise((resolve, reject) => {
    fs.readdir(file, (err, stat) => {
      if (err) {return reject(err);}
      resolve(stat);
    });
  });
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

ipcMain.handle("getDatabaseSize", async () => {
  const size = config.databaseSize || await getSize(path.join(MAIN_PATH, "json-full"));
  if (size !== config.databaseSize) {
    updateMetadata({
      databaseSize: size
    });
  }
  return size;
});

ipcMain.handle("deleteDatabase", () => {
  return new Promise((resolve) => {
    updateMetadata({
      databaseDownloaded: false
    });
    fs.unlink(path.join(MAIN_PATH, "keys.json"), () => {
      fs.rmdir(path.join(MAIN_PATH, "json-full"), {recursive: true, force: true}, () => {
        updateMetadata({
          databaseSize: null,
          databaseDownloaded: false
        });
        resolve();
      });
    });
  });
});

ipcMain.handle("downloadDatabase", async () => {
  if (config.lastDatabaseUpdateTime === false) {
    throw "still downloading";
  }
  updateMetadata({
    lastDatabaseUpdateTime: false,
    databaseDownloaded: false,
    databaseSize: null
  });
  await downloadDatabase(MAIN_PATH);
  updateMetadata({
    lastDatabaseUpdateTime: Date.now(),
    databaseDownloaded: true,
    databaseSize: null
  });
  return;
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

ipcMain.handle("checkAppUpdates", () => {
  if (config.applicationDownloaded === 0) {
    return true;
  }
  updateMetadata({
    lastApplicationUpdateCheck: Date.now()
  });
  return got("https://raw.githubusercontent.com/theusaf/kahoot-win-launcher/master/metadata.json").json().then((info) => {
    const current = config.currentApplicationVersion;
    if (current !== null && (current === info.version || semver.gt(current, info.version))) {
      return false;
    }
    return info;
  }).catch(() => {
    return false;
  });
});

ipcMain.handle("downloadApplication", () => {
  if (config.applicationDownloaded === 0) {
    throw "Already downloading app";
  }
  config.applicationDownloaded = 0;
  return got("https://raw.githubusercontent.com/theusaf/kahoot-win-launcher/master/metadata.json").json().then((info) => {
    const ext = getExecutableExtension(),
      {releases, version} = info;
    let release;
    switch(ext){
      case "exe": {
        release = releases.windows;
        break;
      }
      case "app": {
        release = releases.mac;
        break;
      }
      case "AppImage": {
        release = releases.linux;
        break;
      }
    }
    return new Promise((resolve, reject) => {
      const temp = "_application." + (ext === "app" ? "dmg" : ext),
        stream = got.stream(release).pipe(fs.createWriteStream(path.join(MAIN_PATH, temp)));
      stream.on("error", (err) => {
        updateMetadata({
          applicationDownloaded: false
        });
        reject(err);
      });
      stream.on("finish", () => {
        if (ext === "app") {
          dmg.mount(path.join(MAIN_PATH, temp), (err, dir) => {
            if (err) {
              updateMetadata({
                applicationDownloaded: false
              });
              return reject(err);
            }
            fs.rmdir(path.join(MAIN_PATH, "Kahoot Winner.app"), {recursive: true, force: true}, () => {
              process.noAsar = true;
              fs.copy(path.join(dir, "Kahoot Winner.app"), path.join(MAIN_PATH, "Kahoot Winner.app"), (err) => {
                process.noAsar = false;
                if (err) {
                  updateMetadata({
                    applicationDownloaded: false
                  });
                  return reject(err);
                }
                fs.unlink(path.join(MAIN_PATH, temp), () => {});
                dmg.unmount(dir, () => {});
                updateMetadata({
                  applicationDownloaded: true,
                  currentApplicationVersion: version
                });
                resolve();
              });
            });
          });
          return;
        }
        fs.rename(path.join(MAIN_PATH, temp), path.join(MAIN_PATH, "Kahoot Winner." + ext), (err) => {
          if (err) {
            updateMetadata({
              applicationDownloaded: false
            });
            return reject(err);
          }
          updateMetadata({
            applicationDownloaded: true,
            currentApplicationVersion: version
          });
          resolve();
        });
      });
    });
  }).catch((e) => {
    console.log(e)
    updateMetadata({
      applicationDownloaded: false
    });
    throw "failed to get info";
  });
});

ipcMain.handle("updateSettings", (event, settings) => {
  Object.assign(config.settings, settings);
  updateMetadata();
});

ipcMain.handle("closeWindow", () => {
  if (config.settings.keepLauncherOpen) {
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
    if (config.lastDatabaseUpdateTime === false) {
      updateMetadata({
        lastDatabaseUpdateTime: null
      });
    }
    if (config.applicationDownloaded === 0) {
      updateMetadata({
        applicationDownloaded: false
      });
    }
    fs.stat(path.join(MAIN_PATH, `Kahoot Winner.${getExecutableExtension()}`), (error) => {
      if (error) {
        updateMetadata({
          applicationDownloaded: false,
          currentApplicationVersion: null
        });
      } else {
        updateMetadata({
          applicationDownloaded: true
        });
      }
    });
  });
});
