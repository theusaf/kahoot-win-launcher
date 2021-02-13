const {ipcRenderer} = require("electron"),
  output = document.querySelector("#output"),
  tabsContainer = document.querySelector("#tabs"),
  errorContainer = document.querySelector("#errors");

function createErrorNotice(error, options){

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
  const scripts = output.querySelector("script");
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
