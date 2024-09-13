import { h, text, app } from "./hyperapp/index.js";

const elemName = function (step) {
  if (step.name) {
    return chrome.i18n.getMessage("elemName", [step.target, step.name]);
  } else if (step.text) {
    return chrome.i18n.getMessage("elemText", [step.target, step.text]);
  } else {
    return chrome.i18n.getMessage("elemPath", [step.target]);
  }
};

const stepText = function (step) {
  if (step.type == "click") {
    return chrome.i18n.getMessage("stepClick", elemName(step));
  } else if (step.type == "change") {
    return chrome.i18n.getMessage("stepChange", [step.value, elemName(step)]);
  } else if (step.type == "wait") {
    return chrome.i18n.getMessage("stepWait", [step.duration]);
  } else if (step.type == "close") {
    return document.createTextNode(chrome.i18n.getMessage("stepClose"));
  }
};

var downloadToFile = function (filename, content) {
  var element = document.createElement("a");
  element.setAttribute(
    "href",
    URL.createObjectURL(new Blob([content], { type: "application/json" }))
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const exportMacro = function (_, { database, url, prefix }) {
  const key = "data/" + url;
  downloadToFile(
    "macro_" + url.replace(/[^a-zA-Z0-9]+/g, "_") + ".json",
    JSON.stringify({
      url: url,
      prefix: prefix == "" ? undefined : prefix,
      steps: database[key].steps,
    })
  );
};
const deleteMacro = (_, { url }) => {
  chrome.runtime.sendMessage({ command: "delete", url });
};
const saveMacro = (_, { database, url, oldPrefix, prefix }) => {
  if (database.prefix && oldPrefix in database.prefix) {
    chrome.runtime.sendMessage({
      command: "deletePrefix",
      prefix: oldPrefix,
    });
  }
  if (prefix != "") {
    chrome.runtime.sendMessage({
      command: "addPrefix",
      prefix: prefix,
      url: url,
    });
    chrome.permissions.request({ origins: [prefix + "*"] });
  }
};
const importMacro = (dispatch, { database }) => {
  const input = document.createElement("input");
  input.type = "file";
  document.body.appendChild(input);
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    dispatch([SetImportStatus, ""]);
    var reader = new FileReader();
    reader.onload = (progress) => {
      try {
        var data = JSON.parse(progress.target.result);
        if (!data.url) throw "No URL given";
        if (!data.steps) throw "No steps given";
        if ("data/" + data.url in database)
          throw "Macro for this URL already exists";
        chrome.runtime.sendMessage(
          {
            command: "add",
            url: data.url,
            steps: data.steps,
          },
          () => {
            var prefix = data.prefix && data.prefix != "" ? data.prefix : false;
            chrome.permissions.request(
              { origins: prefix ? [data.url, data.prefix + "*"] : [data.url] },
              () => {
                if (prefix) {
                  chrome.runtime.sendMessage(
                    {
                      command: "addPrefix",
                      prefix: data.prefix,
                      url: data.url,
                    },
                    () => {
                      dispatch([SetImportStatus, "Import successful."]);
                    }
                  );
                } else {
                  dispatch([SetImportStatus, "Import successful."]);
                }
              }
            );
          }
        );
      } catch (e) {
        dispatch([SetImportStatus, "Error importing:\n" + e]);
      }
    };
    reader.readAsText(file);
  });
  input.click();
  document.body.removeChild(input);
};
const openPage = (_, { url }) => {
  chrome.tabs.create({ url });
};

const SetDatabase = (state, database) => ({ ...state, database });
const SelectPage = (state, url) => {
  var prefix = "";
  if (state.database.prefix) {
    for (var key in state.database.prefix) {
      if (state.database.prefix[key] == url) {
        prefix = key;
      }
    }
  }
  return { ...state, url, prefix, oldPrefix: prefix, importStatus: "" };
};
const ExportMacro = (state) => [
  state,
  [
    exportMacro,
    { database: state.database, url: state.url, prefix: state.prefix },
  ],
];
const DeleteMacro = (state) => [state, [deleteMacro, { url: state.url }]];
const OpenPage = (state) => [state, [openPage, { url: state.url }]];
const SaveMacro = (state) => [
  { ...state, url: "" },
  [
    saveMacro,
    {
      database: state.database,
      url: state.url,
      oldPrefix: state.oldPrefix,
      prefix: state.prefix,
    },
  ],
];
const ImportMacro = (state) => [
  { ...state, url: "" },
  [importMacro, { database: state.database }],
];
const SetPrefix = (state, prefix) => ({ ...state, prefix });
const SetImportStatus = (state, importStatus) => ({ ...state, importStatus });

const databaseSubscription = [
  (dispatch, _) => {
    chrome.storage.local.get(null, (database) => {
      requestAnimationFrame(() => dispatch([SetDatabase, database]));
    });
    chrome.storage.local.onChanged.addListener(() => {
      chrome.storage.local.get(null, (database) => {
        requestAnimationFrame(() => dispatch([SetDatabase, database]));
      });
    });
  },
  {},
];

app({
  init: { database: {}, url: "", oldPrefix: "", prefix: "", importStatus: "" },
  view: (state) => {
    return h("main", {}, [
      h("div", { className: "card" }, [
        h(
          "button",
          { type: "import", onclick: ImportMacro, className: "header" },
          text(chrome.i18n.getMessage("optionImport"))
        ),
        state.importStatus != "" &&
          h("div", { className: "status" }, text(state.importStatus)),
      ]),
      ...Object.keys(state.database)
        .filter((key) => key.startsWith("data/"))
        .map((key) => key.substring(5))
        .map((url) =>
          h("div", { className: "card" }, [
            h(
              "button",
              {
                className: "header",
                onclick: [SelectPage, url == state.url ? "" : url],
                title: url,
              },
              [
                h("div", {}, text(url)),
                h(
                  "div",
                  { className: "expand" },
                  text(url == state.url ? "-" : "+")
                ),
              ]
            ),
            url == state.url &&
              h("div", { className: "body" }, [
                h(
                  "ol",
                  { className: "steps" },
                  state.database["data/" + state.url].steps.map((step) =>
                    h("li", {}, text(stepText(step)))
                  )
                ),
                h("div", { className: "apply" }, [
                  h("label", { for: "type" }, [
                    text(chrome.i18n.getMessage("optionApplyTo")),
                    h(
                      "select",
                      {
                        onchange: (_, e) => [
                          SetPrefix,
                          e.target.value == "exact"
                            ? ""
                            : state.prefix || state.url,
                        ],
                      },
                      [
                        h(
                          "option",
                          { value: "exact" },
                          text(chrome.i18n.getMessage("optionExact"))
                        ),
                        h(
                          "option",
                          { value: "prefix", selected: state.prefix != "" },
                          text(chrome.i18n.getMessage("optionPrefix"))
                        ),
                      ]
                    ),
                  ]),
                  h("input", {
                    type: "text",
                    class: "prefix",
                    disabled: state.prefix == "",
                    onchange: (_, e) => [SetPrefix, e.target.value],
                    value: state.prefix == "" ? state.url : state.prefix,
                  }),
                ]),
              ]),
            url == state.url &&
              h("div", { className: "actions" }, [
                state.prefix != state.oldPrefix &&
                  h(
                    "button",
                    { onclick: SaveMacro },
                    text(chrome.i18n.getMessage("optionSave"))
                  ),
                h(
                  "button",
                  { onclick: ExportMacro },
                  text(chrome.i18n.getMessage("optionExport"))
                ),
                h(
                  "button",
                  { onclick: DeleteMacro },
                  text(chrome.i18n.getMessage("optionDelete"))
                ),
                h(
                  "button",
                  { onclick: OpenPage },
                  text(chrome.i18n.getMessage("optionOpen"))
                ),
              ]),
          ])
        ),
    ]);
  },
  node: document.getElementById("app"),
  subscriptions: () => [databaseSubscription],
});
