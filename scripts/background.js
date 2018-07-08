"use strict"; 

var siteMacro = {

    database: {},

    loaded: function (e) {
        var key = "data/" + e.url;
        if(key in siteMacro.database) {
            var data = siteMacro.database[key];
            if(Date.now() - data.last < 10000) {
                chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeThrottled"), tabId: e.tabId});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusThrottled"), tabId: e.tabId });
                return;
            } 
            
            chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeActive"), tabId: e.tabId});
            chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusActive"), tabId: e.tabId });
            
            chrome.tabs.executeScript(e.tabId, {file: "/scripts/replay.js"}, () => {
                chrome.tabs.sendMessage(e.tabId, data.steps, (resp) => {
                    switch(resp) {
                    case chrome.i18n.getMessage("badgeFailed"):
                        chrome.browserAction.setBadgeText({text: resp, tabId: e.tabId});
                        chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusFailed"), tabId: e.tabId });
                        break;
                    case chrome.i18n.getMessage("badgeCompleted"):
                        chrome.browserAction.setBadgeText({text: resp, tabId: e.tabId});
                        chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusCompleted"), tabId: e.tabId });                        
                        break;
                    }
                });
            });
            data.last = Date.now();
            siteMacro.database[key].last = Date.now();
            chrome.storage.local.set({key: siteMacro.database[key]});
        }
    }, 

    clicked: function(tab) {
        chrome.browserAction.getBadgeText({tabId: tab.id}, text => {
            switch(text) {
            case chrome.i18n.getMessage("badgeRecording"):
                chrome.tabs.sendMessage(tab.id, "cancel");
                chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeIdle"), tabId: tab.id});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusIdle"), tabId: tab.id });                
                break;
            case chrome.i18n.getMessage("badgeActive"):
            case chrome.i18n.getMessage("badgeFailed") :
            case chrome.i18n.getMessage("badgeCompleted"):
            case chrome.i18n.getMessage("badgeThrottled"):
                var key = "data/" + tab.url;
                chrome.storage.local.remove(key);
                delete siteMacro.database[key];
                chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeIdle"), tabId: tab.id});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusIdle"), tabId: tab.id });                
                break;
            default:
                chrome.tabs.executeScript(tab.id, {file: "/scripts/record.js"});
                chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeRecording"), tabId: tab.id});    
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusRecording"), tabId: tab.id });
                break;
            }
        });
    }, 

    message: function(msg, sender) {
        if(msg.command == "add") {
            console.log("SiteMacro: Received steps for " + msg.url);
            var data = {}, key = "data/" + msg.url;
            data[key] = {steps: msg.steps, created: Date.now(), last: Date.now() - 15000};
            chrome.storage.local.set(data, () => {});
            siteMacro.database[key] = data[key];
            chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeIdle"), tabId: sender.tab.id});
            chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusIdle"), tabId: sender.tab.id });      
        } else if(msg.command == "delete") {
            var key = "data/" + msg.url;
            chrome.storage.local.remove(key);
            delete siteMacro.database[key];
        } else if(msg.command == "cancel") {   
            chrome.browserAction.setBadgeText({text: chrome.i18n.getMessage("badgeIdle"), tabId: sender.tab.id});
            chrome.browserAction.setTitle({title: chrome.i18n.getMessage("statusIdle"), tabId: sender.tab.id });      
        }
    },

    init: function() {
        chrome.webNavigation.onDOMContentLoaded.addListener(siteMacro.loaded);
        chrome.browserAction.onClicked.addListener(siteMacro.clicked);
        chrome.runtime.onMessage.addListener(siteMacro.message);
        chrome.storage.local.get(null, data => { siteMacro.database = data; });
    }
};

siteMacro.init();