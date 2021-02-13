const {ipcRenderer} = require("electron"),
  output = document.querySelector("#output"),
  tabsContainer = document.querySelector("#tabs"),
  errorContainer = document.querySelector("#errors"),
  launchButton = document.querySelector("#launch-button");

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
    createErrorNotice("Application was not launched. Install the application first.", {
      time: 10e3
    });
  } else {
    ipcRenderer.invoke("closeWindow");
  }
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
