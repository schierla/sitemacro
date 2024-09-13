import { h, text, app } from "./hyperapp/index.js";

const manageMacros = function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.htm") });
};
const close = function () {
  window.close();
};
const recordMacro = function (_, { tabId, url }) {
  chrome.runtime.sendMessage({ command: "record", url: url, tabId: tabId });
  chrome.permissions.request({ origins: [url] });
};
const deleteMacro = function (_, { tabId, url }) {
  chrome.runtime.sendMessage({ command: "delete", url, tabId: tabId });
};
const executeMacro = function (_, { tabId, url }) {
  chrome.runtime.sendMessage({
    command: "execute",
    tabId: tabId,
    url: url,
  });
};
const grantPermission = function (_, { url }) {
  chrome.permissions.request({ origins: [url] });
};

const RecordMacro = (state) => [
  state,
  [recordMacro, { tabId: state.tabId, url: state.url }],
  close,
];
const DeleteMacro = (state, url) => [
  state,
  [deleteMacro, { url, tabId: state.tabId }],
];
const ExecuteMacro = (state, url) => [
  state,
  [executeMacro, { url, tabId: state.tabId }],
];
const GrantPermission = (state, url) => [
  state,
  [grantPermission, { url: url }],
  close,
];
const ManageMacros = (state) => [state, manageMacros, close];
const SetDatabase = (state, database) => ({ ...state, database });
const SetTab = (state, { url, tabId }) => ({ ...state, url, tabId });
const SetGranted = (state, granted) => ({ ...state, granted });
const SetState = (state, tabState) => ({ ...state, state: tabState });

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

const tabSubscription = [
  (dispatch, _) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      requestAnimationFrame(() =>
        dispatch([SetTab, { url: tabs[0].url, tabId: tabs[0].id }])
      );
      chrome.permissions.contains({ origins: [tabs[0].url] }, (granted) =>
        requestAnimationFrame(() => dispatch([SetGranted, granted]))
      );
      const port = chrome.runtime.connect();
      port.onMessage.addListener((state) => {
        requestAnimationFrame(() => dispatch([SetState, state]));
      });
      port.postMessage({ tabId: tabs[0].id });
    });
  },
  {},
];

app({
  init: { database: {}, url: "", tabId: -1, granted: false, state: "Idle" },
  view: (state) => {
    var keys = [];
    var count = 0;
    var hasPrefixMacro = false;
    var hasExactMacro = false;
    for (var key in state.database) if (key.startsWith("data/")) count++;
    if ("data/" + state.url in state.database) {
      const keyState = state.granted
        ? chrome.i18n.getMessage("stateEnabled")
        : chrome.i18n.getMessage("stateDisabled");
      keys.push({
        type: chrome.i18n.getMessage("exactMacro"),
        url: state.url,
        state: keyState,
      });
      hasExactMacro = true;
    }
    if (state.database.prefix) {
      for (var prefix in state.database.prefix) {
        if (
          state.url.startsWith(prefix) &&
          state.database.prefix[prefix] != state.url
        ) {
          const keyState = state.granted
            ? hasPrefixMacro || hasExactMacro
              ? chrome.i18n.getMessage("stateSuppressed")
              : chrome.i18n.getMessage("stateEnabled")
            : chrome.i18n.getMessage("stateDisabled");
          keys.push({
            type: chrome.i18n.getMessage("prefixMacro"),
            url: state.database.prefix[prefix],
            state: keyState,
          });
          hasPrefixMacro = true;
        }
      }
    }

    const stepText = (url) => {
      const steps = (state.database["data/" + url]?.steps ?? []).length;
      return steps == 0
        ? chrome.i18n.getMessage("popup0Step")
        : steps == 1
        ? chrome.i18n.getMessage("popup1Step")
        : chrome.i18n.getMessage("popupNStep", [steps]);
    };
    const countText =
      count == 0
        ? chrome.i18n.getMessage("popup0Macro")
        : count == 1
        ? chrome.i18n.getMessage("popup1Macro")
        : chrome.i18n.getMessage("popupNMacro", [count]);

    return h("main", {}, [
      h("div", { className: "card" }, [
        h("div", { className: "macro" }, [
          h(
            "div",
            { className: "title" },
            text(chrome.i18n.getMessage("popupStatus"))
          ),
        ]),
        h(
          "div",
          { className: "status" },
          text(chrome.i18n.getMessage("status" + state.state))
        ),
      ]),
      ...keys.map((key) =>
        h("div", { className: "card" }, [
          h("div", { className: "macro" }, [
            h("div", { className: "title", title: key.url }, text(key.type)),
            h("div", { className: "steps" }, text(stepText(key.url))),
          ]),
          h("div", { className: "status" }, text(key.state)),
          h("div", { className: "actions" }, [
            h(
              "button",
              { onclick: [ExecuteMacro, key.url] },
              text(chrome.i18n.getMessage("popupExecute"))
            ),
            !state.granted &&
              h(
                "button",
                { onclick: [GrantPermission, key.url] },
                text(chrome.i18n.getMessage("popupEnable"))
              ),
            h(
              "button",
              { onclick: [DeleteMacro, key.url] },
              text(chrome.i18n.getMessage("popupDelete"))
            ),
          ]),
        ])
      ),
      h("div", { className: "card" }, [
        h("div", { className: "macro" }, [
          h(
            "div",
            { className: "title" },
            text(chrome.i18n.getMessage("popupMore"))
          ),
          h("div", { className: "steps" }, text(countText)),
        ]),
        h("div", { className: "actions" }, [
          state.url &&
            state.url.startsWith("http") &&
            state.state != "Recording" &&
            h(
              "button",
              { onclick: RecordMacro },
              text(chrome.i18n.getMessage("popupRecord"))
            ),
          h(
            "button",
            { onclick: ManageMacros },
            text(chrome.i18n.getMessage("popupManage"))
          ),
        ]),
      ]),
    ]);
  },
  node: document.getElementById("app"),
  subscriptions: () => [databaseSubscription, tabSubscription],
});
