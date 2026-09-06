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
    return chrome.i18n.getMessage("stepClose");
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
const saveSteps = (_, { url, steps }) => {
  chrome.runtime.sendMessage({ command: "update", url, steps });
};

const stepTypeLabel = function (type) {
  if (type == "click") return chrome.i18n.getMessage("optionTypeClick");
  if (type == "change") return chrome.i18n.getMessage("optionTypeChange");
  if (type == "wait") return chrome.i18n.getMessage("optionTypeWait");
  if (type == "close") return chrome.i18n.getMessage("optionTypeClose");
};

const stepField = function (label, index, field, value, inputType) {
  return h("label", { className: `field field-${field}` }, [
    text(label),
    h("input", {
      type: inputType || "text",
      value: value || "",
      name: field,
      onchange: (_, e) => [
        SetStepField,
        { index, field, value: e.target.value },
      ],
    }),
  ]);
};

const stepRow = function (step, index, count) {
  return h("li", { className: "step-row" }, [
    h("div", { className: "step-type" }, text(stepTypeLabel(step.type))),
    h(
      "div",
      { className: "step-fields" },
      [
        (step.type == "click" || step.type == "change") &&
          stepField(
            chrome.i18n.getMessage("optionFieldPath"),
            index,
            "target",
            step.target
          ),
        (step.type == "click" || step.type == "change") &&
          stepField(
            chrome.i18n.getMessage("optionFieldName"),
            index,
            "name",
            step.name
          ),
        (step.type == "click" || step.type == "change") &&
          stepField(
            chrome.i18n.getMessage("optionFieldText"),
            index,
            "text",
            step.text
          ),
        step.type == "change" &&
          stepField(
            chrome.i18n.getMessage("optionFieldValue"),
            index,
            "value",
            step.value
          ),
        step.type == "wait" &&
          stepField(
            chrome.i18n.getMessage("optionFieldDuration"),
            index,
            "duration",
            step.duration,
            "number"
          ),
      ]
    ),
    h("div", { className: "step-actions" }, [
      h(
        "button",
        {
          disabled: index == 0,
          title: chrome.i18n.getMessage("optionMoveUp"),
          onclick: [MoveStep, { index, dir: -1 }],
        },
        text("↑")
      ),
      h(
        "button",
        {
          disabled: index == count - 1,
          title: chrome.i18n.getMessage("optionMoveDown"),
          onclick: [MoveStep, { index, dir: 1 }],
        },
        text("↓")
      ),
      h(
        "button",
        {
          title: chrome.i18n.getMessage("optionRemoveStep"),
          onclick: [RemoveStep, index],
        },
        text("✕")
      ),
    ]),
  ]);
};

const findPrefix = function (database, url) {
  var prefix = "";
  if (database.prefix) {
    for (var key in database.prefix) {
      if (database.prefix[key] == url) {
        prefix = key;
      }
    }
  }
  return prefix;
};

const initialOpenUrl =
  new URLSearchParams(window.location.search).get("open") || "";

const SetDatabase = (state, database) => {
  if (state.openRequested && "data/" + state.openRequested in database) {
    return SelectPage({ ...state, database }, state.openRequested);
  }
  return { ...state, database };
};
const SelectPage = (state, url) => {
  const prefix = findPrefix(state.database, url);
  return {
    ...state,
    url,
    prefix,
    oldPrefix: prefix,
    importStatus: "",
    editing: false,
    editSteps: null,
  };
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

const StartEditSteps = (state) => ({
  ...state,
  editing: true,
  editSteps: state.database["data/" + state.url].steps.map((s) => ({ ...s })),
});
const CancelEdit = (state) => ({ ...state, editing: false, editSteps: null });
const SetStepField = (state, { index, field, value }) => ({
  ...state,
  editSteps: state.editSteps.map((s, i) => {
    if (i != index) return s;
    const step = { ...s };
    if (value == "" && (field == "name" || field == "text")) {
      delete step[field];
    } else {
      step[field] = value;
    }
    return step;
  }),
});
const MoveStep = (state, { index, dir }) => {
  const target = index + dir;
  if (target < 0 || target >= state.editSteps.length) return state;
  const editSteps = state.editSteps.slice();
  [editSteps[index], editSteps[target]] = [editSteps[target], editSteps[index]];
  return { ...state, editSteps };
};
const RemoveStep = (state, index) => ({
  ...state,
  editSteps: state.editSteps.filter((_, i) => i != index),
});
const AddStep = (state, type) => ({
  ...state,
  editSteps: [
    ...state.editSteps,
    type == "wait" ? { type: "wait", duration: "1000" } : { type: "close" },
  ],
});
const SaveSteps = (state) => [
  { ...state, editing: false, editSteps: null },
  [saveSteps, { url: state.url, steps: state.editSteps }],
];

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
  init: {
    database: {},
    url: "",
    oldPrefix: "",
    prefix: "",
    importStatus: "",
    editing: false,
    editSteps: null,
    openRequested: initialOpenUrl,
  },
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
              state.editing &&
              h("div", { className: "body" }, [
                h("ol", { className: "steps editing" }, [
                  ...state.editSteps.map((step, index) =>
                    stepRow(step, index, state.editSteps.length)
                  ),
                  h("li", { className: "add-step-row" }, [
                    h(
                      "select",
                      {
                        className: "add-step",
                        onchange: (s, e) => {
                          const type = e.target.value;
                          e.target.value = "addstep";
                          return type == "addstep" ? s : [AddStep, type];
                        },
                      },
                      [
                        h(
                          "option",
                          { value: "addstep" },
                          text(chrome.i18n.getMessage("optionAddStep"))
                        ),
                        h(
                          "option",
                          { value: "wait" },
                          text(chrome.i18n.getMessage("optionInsertWait"))
                        ),
                        h(
                          "option",
                          { value: "close" },
                          text(chrome.i18n.getMessage("optionCloseTab"))
                        ),
                      ]
                    ),
                  ]),
                ]),
              ]),
            url == state.url &&
              !state.editing &&
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
              h(
                "div",
                { className: "actions" },
                state.editing
                  ? [
                      h(
                        "button",
                        { onclick: SaveSteps },
                        text(chrome.i18n.getMessage("optionSaveSteps"))
                      ),
                      h(
                        "button",
                        { onclick: CancelEdit },
                        text(chrome.i18n.getMessage("optionCancelEdit"))
                      ),
                    ]
                  : [
                      state.prefix != state.oldPrefix &&
                        h(
                          "button",
                          { onclick: SaveMacro },
                          text(chrome.i18n.getMessage("optionSave"))
                        ),
                      h(
                        "button",
                        { onclick: StartEditSteps },
                        text(chrome.i18n.getMessage("optionEditSteps"))
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
                    ]
              ),
          ])
        ),
    ]);
  },
  node: document.getElementById("app"),
  subscriptions: () => [databaseSubscription],
});
