"use strict";

var siteMacro = {
  database: {},
  status: {},
  connections: {},

  setBadgeAndStatus: function (tabId, status, badge) {
    siteMacro.status[tabId] = status;
    if (tabId in siteMacro.connections) {
      for (const port of siteMacro.connections[tabId]) {
        port.postMessage(status);
      }
    }
    if (chrome.action) {
      chrome.action.setBadgeText({ text: badge, tabId: tabId });
    } else if (chrome.browserAction.setBadgeText) {
      chrome.browserAction.setBadgeText({ text: badge, tabId: tabId });
    }
  },

  setTabStatus: function (tabId, status) {
    siteMacro.setBadgeAndStatus(
      tabId,
      status,
      chrome.i18n.getMessage("badge" + status)
    );
  },

  injectReplayScript: function (tabId, callback) {
    if (chrome.scripting) {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["/scripts/replay.js"],
        },
        callback
      );
    } else {
      chrome.tabs.executeScript(
        tabId,
        { file: "/scripts/replay.js" },
        callback
      );
    }
  },

  tabUpdated: function (tabId, changeInfo, tab) {
    if (changeInfo.status != "complete") return;
    if (!tab.url) {
      siteMacro.setTabStatus(tabId, "Idle");
      return;
    }
    if (siteMacro.getKey(tab.url)) {
      siteMacro.injectReplayScript(tabId, () => {
        siteMacro.replayMacro(tab.url, tab.id, false);
      });
    } else {
      siteMacro.setTabStatus(tabId, "Idle");
    }
  },

  getKey: function (url) {
    var key = "data/" + url;
    if (key in siteMacro.database) {
      return key;
    }

    if (siteMacro.database.prefix) {
      for (var prefix in siteMacro.database.prefix) {
        if (url.startsWith(prefix)) url = siteMacro.database.prefix[prefix];
      }
    }

    var key = "data/" + url;
    if (key in siteMacro.database) {
      return key;
    }
    return null;
  },

  message: function (msg, sender, callback) {
    if (msg.command == "add") {
      siteMacro.createMacro(msg.url, msg.steps);
      siteMacro.setTabStatus(sender.tab.id, "Recorded");
    } else if (msg.command == "delete") {
      siteMacro.deleteMacro(msg.url);
      if (msg.tabId) siteMacro.setTabStatus(msg.tabId, "Idle");
    } else if (msg.command == "cancel") {
      siteMacro.cancelMacro(sender.tab.id);
    } else if (msg.command == "addPrefix") {
      siteMacro.createPrefix(msg.prefix, msg.url);
    } else if (msg.command == "deletePrefix") {
      siteMacro.deletePrefix(msg.prefix);
    } else if (msg.command == "closeTab") {
      chrome.tabs.remove(sender.tab.id);
    } else if (msg.command == "record") {
      siteMacro.recordMacro(msg.url, msg.tabId);
    } else if ((msg.command = "execute")) {
      siteMacro.injectReplayScript(msg.tabId, () => {
        siteMacro.replayMacro(msg.url, msg.tabId, true);
      });
    }
  },

  connect: function (port) {
    port.onMessage.addListener((message) => {
      if (!(message.tabId in siteMacro.connections)) {
        siteMacro.connections[message.tabId] = [];
      }
      siteMacro.connections[message.tabId].push(port);
      port.postMessage(siteMacro.status[message.tabId] ?? "Idle");
      port.onDisconnect.addListener(() => {
        siteMacro.connections[message.tabId].splice(
          siteMacro.connections[message.tabId].indexOf(port),
          1
        );
      });
    });
  },

  replayMacro: function (url, tabId, force = false) {
    var key = siteMacro.getKey(url);
    if (siteMacro.status[tabId] == "Active") return;
    if (key in siteMacro.database) {
      var data = siteMacro.database[key];
      if (!force && Date.now() - data.last < 10000) {
        siteMacro.setTabStatus(tabId, "Throttled");
        return;
      }

      siteMacro.setTabStatus(tabId, "Active");

      data.last = Date.now();
      siteMacro.database[key].last = Date.now();
      const update = {}; 
      update[key] = siteMacro.database[key];
      chrome.storage.local.set(update);

      chrome.tabs.sendMessage(
        tabId,
        { command: "replay", steps: data.steps },
        (resp) => {
          switch (resp) {
            case chrome.i18n.getMessage("badgeFailed"):
              siteMacro.setTabStatus(tabId, "Failed");
              break;
            case chrome.i18n.getMessage("badgeCompleted"):
              siteMacro.setTabStatus(tabId, "Completed");
              break;
          }
        }
      );
    } else {
      siteMacro.setTabStatus(tabId, "Idle");
    }
  },

  createPrefix: function (prefix, url) {
    if (!siteMacro.database.prefix) siteMacro.database.prefix = {};
    siteMacro.database.prefix[prefix] = url;
    chrome.storage.local.set({ prefix: siteMacro.database.prefix });
    siteMacro.registerContentScript(prefix + "*");
  },

  deletePrefix: function (prefix) {
    if (!siteMacro.database.prefix) siteMacro.database.prefix = {};
    delete siteMacro.database.prefix[prefix];
    chrome.storage.local.set({ prefix: siteMacro.database.prefix });
  },

  createMacro: function (url, steps) {
    console.log("SiteMacro: Received steps for " + url);
    var data = {},
      key = "data/" + url;
    data[key] = { steps: steps, created: Date.now(), last: Date.now() - 15000 };
    siteMacro.database[key] = data[key];
    chrome.storage.local.set(data, () => {});
    siteMacro.registerContentScript(url);
  },

  deleteMacro: function (url) {
    var key = "data/" + url;
    chrome.storage.local.remove(key);
    delete siteMacro.database[key];
    if (siteMacro.database.prefix) {
      for (var key in siteMacro.database.prefix) {
        if (siteMacro.database.prefix[key] == url) {
          delete siteMacro.database.prefix[key];
          chrome.storage.local.set({ prefix: siteMacro.database.prefix });
        }
      }
    }
  },

  recordMacro: function (url, tabId) {
    if (chrome.scripting) {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["/scripts/record.js"] },
        () => {
          siteMacro.setTabStatus(tabId, "Recording");
        }
      );
    } else {
      chrome.tabs.executeScript(tabId, { file: "/scripts/record.js" }, () => {
        siteMacro.setTabStatus(tabId, "Recording");
      });
    }
  },

  cancelMacro: function (tabId) {
    chrome.tabs.sendMessage(tabId, { command: "cancel" }, () => {
      siteMacro.setTabStatus(tabId, "Idle");
    });
  },

  checkDatabase: function () {
    var origins = [];
    if (siteMacro.database)
      for (var key in siteMacro.database) {
        if (key.startsWith("data/")) {
          origins.push(key.substr(5));
        }
      }

    if (siteMacro.database.prefix)
      for (var key in siteMacro.database.prefix) {
        origins.push(key + "*");
      }

    for (var i = 0; i < origins.length; i++) {
      siteMacro.registerContentScript(origins[i]);
    }
  },

  registerContentScript: function (url) {
    if (chrome.contentScripts)
      chrome.contentScripts.register({
        js: [{ file: "scripts/replay.js" }],
        matches: [url.replace(/#.*$/, "")],
      });
  },

  init: function () {
    chrome.tabs.onUpdated.addListener(siteMacro.tabUpdated);
    chrome.runtime.onMessage.addListener(siteMacro.message);
    chrome.runtime.onConnect.addListener(siteMacro.connect);
    chrome.storage.local.get(null, (data) => {
      siteMacro.database = data;
      siteMacro.checkDatabase();
    });
  },
};

siteMacro.init();
