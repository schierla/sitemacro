var siteMacroRecord = {
  steps: [],
  counter: null,
  root: null,
  paddingtop: null,
  paddingbottom: null,

  isSiteMacroUi: function (e) {
    if (
      e == siteMacroRecord.root.parentNode ||
      e == siteMacroRecord.root.parentNode.parentNode
    )
      return true;
    while (e) {
      if (e == siteMacroRecord.root) return true;
      e = e.parentNode;
    }
    return false;
  },

  updateSteps: function () {
    const steps = siteMacroRecord.steps.length;
    siteMacroRecord.counter.innerHTML =
      steps == 0
        ? chrome.i18n.getMessage("popup0Step")
        : steps == 1
        ? chrome.i18n.getMessage("popup1Step")
        : chrome.i18n.getMessage("popupNStep", [steps]);
  },

  clicked: function (e) {
    if (siteMacroRecord.isSiteMacroUi(e.target)) return;
    siteMacroRecord.steps.push(
      siteMacroRecord.fillTarget({ type: "click" }, e.target)
    );
    siteMacroRecord.updateSteps();
  },

  changed: function (e) {
    if (siteMacroRecord.isSiteMacroUi(e.target)) return;
    siteMacroRecord.steps.push(
      siteMacroRecord.fillTarget(
        { type: "change", value: e.target.value },
        e.target
      )
    );
    siteMacroRecord.updateSteps();
  },

  fillTarget: function (obj, elem) {
    if (elem.innerText) obj.text = elem.innerText;
    if (elem.name) obj.name = elem.name;
    obj.target = siteMacroRecord.buildXPath(elem);
    return obj;
  },

  addDelay: function (e) {
    var duration = prompt(chrome.i18n.getMessage("pageRecordDuration"), "1000");
    if (!duration) return;
    siteMacroRecord.steps.push({ type: "wait", duration: duration });
    siteMacroRecord.updateSteps();
  },

  addCloseTab: function (e) {
    siteMacroRecord.steps.push({ type: "close" });
    siteMacroRecord.updateSteps();
    siteMacroRecord.accept();
    chrome.runtime.sendMessage({ command: "closeTab" });
  },

  unloaded: function (e) {
    siteMacroRecord.accept();
  },

  message: function (msg) {
    if (msg.command == "cancel") {
      siteMacroRecord.cleanup();
    }
  },

  accept: function () {
    chrome.runtime.sendMessage({
      command: "add",
      url: window.location.href,
      steps: siteMacroRecord.steps,
    });
    siteMacroRecord.cleanup();
  },

  abort: function () {
    chrome.runtime.sendMessage({
      command: "cancel",
      url: window.location.href,
    });
    siteMacroRecord.cleanup();
  },

  cleanup: function () {
    window.removeEventListener("click", siteMacroRecord.clicked, true);
    window.removeEventListener("change", siteMacroRecord.changed, true);
    window.removeEventListener("unload", siteMacroRecord.unloaded);
    chrome.runtime.onMessage.removeListener(siteMacroRecord.message);
    document.body.removeChild(siteMacroRecord.root);
    document.body.style.paddingTop = siteMacroRecord.paddingtop;
    document.body.style.paddingBottom = siteMacroRecord.paddingbottom;
  },

  buildXPath: function (t) {
    var path = "";
    if (t.id != "") return 'id("' + t.id + '")';
    while (t.nodeName != "HTML") {
      var c = t.parentNode.firstChild;
      var num = 1;
      while (c != t) {
        if (c.nodeName == t.nodeName) num++;
        c = c.nextSibling;
      }
      path = "/" + t.nodeName.toLowerCase() + "[" + num + "]" + path;
      t = t.parentNode;
      if (t.id != "") return 'id("' + t.id + '")' + path;
    }
    path = "/" + t.nodeName.toLowerCase() + path;
    return path;
  },

  redDiv: function () {
    var div = document.createElement("sitemacrodiv");
    div.style.display = "block";
    div.style.position = "fixed";
    div.style.left = "0px";
    div.style.width = "100vw";
    div.style.background = "#700";
    div.style.lineHeight = "1.5rem";
    div.style.fontSize = "1rem";
    div.style.textAlign = "center";
    div.style.paddingTop = "0.1rem";
    div.style.zIndex = 9999;
    div.style.color = "#fff";
    div.style.fontWeight = "bold";
    div.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecording"))
    );
    div.style.transition = "height 0.3s ease";
    return div;
  },

  showRecording: function () {
    var div1 = siteMacroRecord.redDiv();
    div1.style.top = "0px";
    div1.style.height = "100vh";

    var counter = document.createElement("span");
    counter.appendChild(
      document.createTextNode(chrome.i18n.getMessage("popup0Step"))
    );
    div1.appendChild(document.createTextNode(" ("));
    div1.appendChild(counter);
    div1.appendChild(document.createTextNode(")"));
    counter.style.lineHeight = "1.7rem";

    var ok = document.createElement("button");
    ok.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecordOk"))
    );
    ok.style.float = "right";
    ok.style.marginRight = "2rem";
    ok.style.height = "1.7rem";
    div1.appendChild(ok);
    ok.addEventListener("click", siteMacroRecord.accept);

    var cancel = document.createElement("button");
    cancel.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecordCancel"))
    );
    cancel.style.float = "right";
    cancel.style.marginRight = "0.5rem";
    cancel.style.height = "1.7rem";
    div1.appendChild(cancel);
    cancel.addEventListener("click", siteMacroRecord.abort);

    var div2 = siteMacroRecord.redDiv();
    div2.style.bottom = "0px";

    var actions = document.createElement("select");
    actions.style.float = "right";
    actions.style.marginRight = "2rem";
    actions.style.height = "1.7rem";
    div2.appendChild(actions);

    var addaction = document.createElement("option");
    addaction.value = "actions";
    addaction.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecordAddStep"))
    );
    actions.appendChild(addaction);

    var wait = document.createElement("option");
    wait.value = "wait";
    wait.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecordWait"))
    );
    actions.appendChild(wait);

    var closetab = document.createElement("option");
    closetab.value = "closetab";
    closetab.appendChild(
      document.createTextNode(chrome.i18n.getMessage("pageRecordCloseTab"))
    );
    actions.appendChild(closetab);

    actions.addEventListener("change", function (e) {
      if (actions.value == "closetab") siteMacroRecord.addCloseTab();
      else if (actions.value == "wait") siteMacroRecord.addDelay();
      actions.value = "actions";
    });
    actions.value = "actions";

    var root = document.createElement("sitemacroroot");
    root.appendChild(div1);
    root.appendChild(div2);
    siteMacroRecord.counter = counter;
    siteMacroRecord.root = root;

    document.body.appendChild(root);
    siteMacroRecord.paddingtop = document.body.style.paddingTop;
    siteMacroRecord.paddingbottom = document.body.style.paddingBottom;
    document.body.style.paddingTop = "1.7rem";
    document.body.style.paddingBottom = "1.7rem";

    setTimeout(() => {
      div1.style.height = "1.9rem";
      div2.style.height = "1.9rem";
    }, 50);
  },
};

window.addEventListener("click", siteMacroRecord.clicked, true);
window.addEventListener("change", siteMacroRecord.changed, true);
window.addEventListener("beforeunload", siteMacroRecord.unloaded);
siteMacroRecord.showRecording();
chrome.runtime.onMessage.addListener(siteMacroRecord.message);
