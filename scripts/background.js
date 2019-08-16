"use strict"; 

var siteMacro = {

    database: {},
    status: {},

    badgeAndTitle: function(tabId, badge, title) {
        siteMacro.status[tabId] = badge;
        if(chrome.browserAction.setBadgeText) {
            chrome.browserAction.setBadgeText({text: badge, tabId: tabId});
            chrome.browserAction.setTitle({title: title, tabId: tabId });
        } else {
            chrome.browserAction.setTitle({title: (badge != null ? (badge + " ") : "") + chrome.i18n.getMessage("extensionName"), tabId: tabId });
        }
    },

    setTabStatus: function(tabId, status) {
        siteMacro.badgeAndTitle(tabId, chrome.i18n.getMessage("badge"+status), chrome.i18n.getMessage("status"+status));
    },

    tabUpdated: function(tabId, changeInfo, tab) {
        if(changeInfo.status != "complete") return;
        if(!tab.url) return;
        if(siteMacro.getKey(tab.url)) 
            chrome.tabs.executeScript(tabId, {file: "/scripts/replay.js"}, () => { });
        else 
            siteMacro.setTabStatus(tabId, "Idle");
    },

    getKey: function(url) {
        if(siteMacro.database.prefix) {
            for(var prefix in siteMacro.database.prefix) {
                if(url.startsWith(prefix)) url = siteMacro.database.prefix[prefix];
            }
        }

        var key = "data/" + url;
        if(key in siteMacro.database) {
            return key;
        }
        return null;
    },

    clicked: function(tab) {
        switch(siteMacro.status[tab.id]) {
        case chrome.i18n.getMessage("badgeRecording"):
            siteMacro.cancelMacro(tab.id);
            break;
        case chrome.i18n.getMessage("badgeActive"):
        case chrome.i18n.getMessage("badgeFailed") :
        case chrome.i18n.getMessage("badgeCompleted"):
        case chrome.i18n.getMessage("badgeThrottled"):
            siteMacro.deleteMacro(tab.url);
            siteMacro.setTabStatus(tab.id, "Idle");
            break;
        default:
            siteMacro.recordMacro(tab.url, tab.id);
            break;
        };
    }, 

    message: function(msg, sender) {
        if(msg.command == "replay") {
            siteMacro.replayMacro(sender.url, sender.tab.id);
        } else if(msg.command == "add") {
            siteMacro.createMacro(msg.url, msg.steps);
            siteMacro.setTabStatus(sender.tab.id, "Recorded");
        } else if(msg.command == "delete") {
            siteMacro.deleteMacro(msg.url);
        } else if(msg.command == "cancel") {   
            siteMacro.cancelMacro(sender.tab.id);
        } else if(msg.command == "addPrefix") {
            siteMacro.createPrefix(msg.prefix, msg.url);
        } else if(msg.command == "deletePrefix") {
            siteMacro.deletePrefix(msg.prefix);
        }
    },


    replayMacro: function(url, tabId) {
        var key = siteMacro.getKey(url);
        if(key in siteMacro.database) {
            var data = siteMacro.database[key];
            if(Date.now() - data.last < 10000) {
                siteMacro.setTabStatus(tabId, "Throttled");
                return;
            } 
            
            siteMacro.setTabStatus(tabId, "Active");

            data.last = Date.now();
            siteMacro.database[key].last = Date.now();
            chrome.storage.local.set({key: siteMacro.database[key]});

            chrome.tabs.sendMessage(tabId, data.steps, (resp) => {
                switch(resp) {
                case chrome.i18n.getMessage("badgeFailed"):
                    siteMacro.setTabStatus(tabId, "Failed");
                    break;
                case chrome.i18n.getMessage("badgeCompleted"):
                    siteMacro.setTabStatus(tabId, "Completed");
                    break;
                }
            });
        } else {
            siteMacro.setTabStatus(tabId, "Idle");
        }
    },

    createPrefix: function(prefix, url) {
        if(!siteMacro.database.prefix) siteMacro.database.prefix = {};
        siteMacro.database.prefix[prefix] = url;
        chrome.storage.local.set({"prefix": siteMacro.database.prefix});
        siteMacro.registerContentScript(prefix + "*");
    },

    deletePrefix: function(prefix) {
        if(!siteMacro.database.prefix) siteMacro.database.prefix = {};
        delete siteMacro.database.prefix[prefix];
        chrome.storage.local.set({"prefix": siteMacro.database.prefix});
    },

    createMacro: function(url, steps) {
        console.log("SiteMacro: Received steps for " + url);
        var data = {}, key = "data/" + url;
        data[key] = {steps: steps, created: Date.now(), last: Date.now() - 15000};
        siteMacro.database[key] = data[key];
        chrome.storage.local.set(data, () => {});
        siteMacro.registerContentScript(url);
    },

    deleteMacro: function(url) {
        var key = "data/" + url;
        chrome.storage.local.remove(key);
        delete siteMacro.database[key];
        if(siteMacro.database.prefix) {
            for(var key in siteMacro.database.prefix) {
                if(siteMacro.database.prefix[key] == url) {
                    delete siteMacro.database.prefix[key];
                    chrome.storage.local.set({"prefix": siteMacro.database.prefix});     
                }
            }
        }
    },

    recordMacro: function(url, tabId) {
        chrome.permissions.request({origins: [url]}, granted => {
            if(!granted) siteMacro.cancelMacro(tabId);
        });
  
        chrome.tabs.executeScript(tabId, {file: "/scripts/record.js"}, () => {
            siteMacro.setTabStatus(tabId, "Recording");
        });
    },

    cancelMacro: function(tabId) {
        chrome.tabs.sendMessage(tabId, "cancel", () => {
            siteMacro.setTabStatus(tabId, "Idle");
        });
    },

    checkDatabase: function() {
        var origins = [];
        if(siteMacro.database) for(var key in siteMacro.database) {
            if(key.startsWith("data/")) {
                origins.push(key.substr(5));
            }
        }

        if(siteMacro.database.prefix) for(var key in siteMacro.database.prefix) {
            origins.push(key + "*");
        }

        for(var i = 0; i < origins.length; i++) {
            siteMacro.registerContentScript(origins[i]);
        }

        chrome.permissions.contains({origins: origins}, result => {
            if(!result) chrome.tabs.create({url: chrome.runtime.getURL("permissions.htm")});
        });
    },

    registerContentScript: function(url) {
        if(chrome.contentScripts) 
            chrome.contentScripts.register({js: [{file: 'scripts/replay.js' }], matches: [ url ]});
    },

    init: function() {
        chrome.tabs.onUpdated.addListener(siteMacro.tabUpdated);
        chrome.browserAction.onClicked.addListener(siteMacro.clicked);
        chrome.runtime.onMessage.addListener(siteMacro.message);
        chrome.storage.local.get(null, data => { siteMacro.database = data; siteMacro.checkDatabase(); });
    }
};

siteMacro.init();