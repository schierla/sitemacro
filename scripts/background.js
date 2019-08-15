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

    tabUpdated: function(tabId, changeInfo, tab) {
        if(changeInfo.status != "complete") return;
        var url = tab.url;
        if(siteMacro.database.prefix) {
            for(var prefix in siteMacro.database.prefix) {
                if(tab.url.startsWith(prefix)) url = siteMacro.database.prefix[prefix];
            }
        }

        var key = "data/" + url;
        if(key in siteMacro.database) {
            var data = siteMacro.database[key];
            if(Date.now() - data.last < 10000) {
                siteMacro.badgeAndTitle(tabId, chrome.i18n.getMessage("badgeThrottled"), chrome.i18n.getMessage("statusThrottled"));
                return;
            } 
            
            siteMacro.badgeAndTitle(tabId, chrome.i18n.getMessage("badgeActive"), chrome.i18n.getMessage("statusActive"));
            
            chrome.tabs.executeScript(tabId, {file: "/scripts/replay.js"}, () => {
                chrome.tabs.sendMessage(tabId, data.steps, (resp) => {
                    switch(resp) {
                    case chrome.i18n.getMessage("badgeFailed"):
                        siteMacro.badgeAndTitle(tabId, resp, chrome.i18n.getMessage("statusFailed"));
                        break;
                    case chrome.i18n.getMessage("badgeCompleted"):
                        siteMacro.badgeAndTitle(tabId, resp, chrome.i18n.getMessage("statusCompleted"));
                        break;
                    }
                });
            });
            data.last = Date.now();
            siteMacro.database[key].last = Date.now();
            chrome.storage.local.set({key: siteMacro.database[key]});
        } else {
            siteMacro.badgeAndTitle(tabId, chrome.i18n.getMessage("badgeIdle"), chrome.i18n.getMessage("statusIdle"));
        }
    },

    clicked: function(tab) {
        switch(siteMacro.status[tab.id]) {
        case chrome.i18n.getMessage("badgeRecording"):
            chrome.tabs.sendMessage(tab.id, "cancel", () => {
                if(chrome.runtime.lastError) return;
                siteMacro.badgeAndTitle(tab.id, chrome.i18n.getMessage("badgeIdle"), chrome.i18n.getMessage("statusIdle"));         
            });
            break;
        case chrome.i18n.getMessage("badgeActive"):
        case chrome.i18n.getMessage("badgeFailed") :
        case chrome.i18n.getMessage("badgeCompleted"):
        case chrome.i18n.getMessage("badgeThrottled"):
            var key = "data/" + tab.url;
            delete siteMacro.database[key];
            chrome.storage.local.remove(key, () => {
                siteMacro.badgeAndTitle(tab.id, chrome.i18n.getMessage("badgeIdle"), chrome.i18n.getMessage("statusIdle"));         
            });
            break;
        default:
            chrome.permissions.request({origins: [tab.url]}, granted => {
                if(!granted) {
                    chrome.tabs.sendMessage(tab.id, "cancel", () => {
                        siteMacro.badgeAndTitle(tab.id, chrome.i18n.getMessage("badgeIdle"), chrome.i18n.getMessage("statusIdle"));
                        if(chrome.runtime.lastError) return;
                    });
                }
            });
      
            chrome.tabs.executeScript(tab.id, {file: "/scripts/record.js"}, () => {
                if(chrome.runtime.lastError) return;
                siteMacro.badgeAndTitle(tab.id, chrome.i18n.getMessage("badgeRecording"), chrome.i18n.getMessage("statusRecording"));         
            });
            break;
        };
    }, 

    message: function(msg, sender) {
        if(msg.command == "add") {
            console.log("SiteMacro: Received steps for " + msg.url);
            var data = {}, key = "data/" + msg.url;
            data[key] = {steps: msg.steps, created: Date.now(), last: Date.now() - 15000};
            siteMacro.database[key] = data[key];
            chrome.storage.local.set(data, () => {
                siteMacro.badgeAndTitle(sender.tab.id, chrome.i18n.getMessage("badgeRecorded"), chrome.i18n.getMessage("statusRecorded"));
            });
        } else if(msg.command == "delete") {
            var key = "data/" + msg.url;
            chrome.storage.local.remove(key);
            delete siteMacro.database[key];
        } else if(msg.command == "cancel") {   
            siteMacro.badgeAndTitle(sender.tab.id, chrome.i18n.getMessage("badgeIdle"), chrome.i18n.getMessage("statusIdle"));
        } else if(msg.command == "addPrefix") {
            if(!siteMacro.database.prefix) siteMacro.database.prefix = {};
            siteMacro.database.prefix[msg.prefix] = msg.url;
            chrome.storage.local.set({"prefix": siteMacro.database.prefix});
        } else if(msg.command == "deletePrefix") {
            if(!siteMacro.database.prefix) siteMacro.database.prefix = {};
            delete siteMacro.database.prefix[msg.prefix];
            chrome.storage.local.set({"prefix": siteMacro.database.prefix});
        }
    },

    checkPermissions: function() {
        var origins = [];
        if(siteMacro.database) for(var key in siteMacro.database) {
            if(key.startsWith("data/")) {
                origins.push(key.substr(5));
            }
        }
        if(siteMacro.database.prefix) for(var key in siteMacro.database.prefix) {
            origins.push(key + "*");
        }
        chrome.permissions.contains({origins: origins}, result => {
            if(!result) chrome.tabs.create({url: chrome.runtime.getURL("permissions.htm")});
        });
    },

    init: function() {
        chrome.tabs.onUpdated.addListener(siteMacro.tabUpdated);
        chrome.browserAction.onClicked.addListener(siteMacro.clicked);
        chrome.runtime.onMessage.addListener(siteMacro.message);
        chrome.storage.local.get(null, data => { siteMacro.database = data; siteMacro.checkPermissions(); });
    }
};

siteMacro.init();