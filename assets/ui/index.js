const {ipcRenderer} = require("electron"),
  output = document.querySelector("#output"),
  tabsContainer = document.querySelector("#tabs"),
  errorContainer = document.querySelector("#errors"),
  launchButton = document.querySelector("#launch-button");

let launchFails = 0,
  launchTimeout;

function createErrorNotice(error, options){
  const div = document.createElement("div");
  div.innerHTML = `
    <span class="error-closer">x</span>
    <span class="error-content">${error}</span>
  `;
  div.className = `error ${options.notice ? "notice" : ""}`;
  const closer = div.querySelector(".error-closer");
  errorContainer.append(div);
  closer.addEventListener("click", () => {
    div.remove();
  });
  if (options.onclick) {
    div.addEventListener("click", options.onclick);
  }
  if (options.permanent) {
    return;
  }
  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => {
      div.remove();
    }, 500);
  }, (options.time || 7e3) - 500);
}

async function loadView(view){
  const html = await ipcRenderer.invoke("getView", view),
    currentActive = document.querySelector(".tab-active"),
    newActive = document.querySelector(`#tab-${view}`);
  if (currentActive) {
    currentActive.className = "";
  }
  newActive.className = "tab-active";
  output.innerHTML = html;
  const scripts = output.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i++) {
    eval(scripts[i].textContent);
  }
}

async function launchApp(){
  const launchedSuccessfully = await ipcRenderer.invoke("launchApp");
  if (!launchedSuccessfully) {
    const messages = [
      "There is no application to launch. Please install the app first.",
      "There is still no application to launch.",
      "You gotta stop trying this, man.",
      "THERE. IS. NO. APP.",
      "Hgnk!! FFrrggghhhH!1",
      "Never gonna give you up, never gonna let you down, neve gonna run around and desert you"
    ];
    clearTimeout(launchTimeout);
    createErrorNotice(messages[launchFails++] || messages[messages.length - 1], {
      time: 10e3
    });
    launchTimeout = setTimeout(() => {
      launchFails = 0;
    }, 2e3);
  } else {
    ipcRenderer.invoke("closeWindow");
  }
}

function formatDate(date){
  const year = date.getFullYear(),
    month = date.getMonth() + 1,
    day = date.getDate();
  return `${day}/${month}/${year}`;
}

window.addEventListener("load", () => {
  loadView("home");
});
tabsContainer.addEventListener("click", (event) => {
  const {target} = event;
  if (target.id !== "tabs") {
    loadView(target.id.match(/(?<=-).*/)[0]);
  }
});
launchButton.addEventListener("click", launchApp);
