"use strict"; 

console.log("Activating SiteMacro");

var siteMacro = {

    database: {},

    loaded: function (e) {
        var key = "data/" + e.url;
        if(key in siteMacro.database) {
            var data = siteMacro.database[key];
            if(Date.now() - data.last < 15000) {
                chrome.browserAction.setBadgeText({text: "=", tabId: e.tabId});
                chrome.browserAction.setTitle({title: "SiteMacro: Not submitting form, page repeated too quickly.", tabId: e.tabId });
                return;
            } 
            
            chrome.browserAction.setBadgeText({text: "+", tabId: e.tabId});
            chrome.browserAction.setTitle({title: "SiteMacro: Filling form...", tabId: e.tabId });
            
            chrome.tabs.executeScript(e.tabId, {file: "/scripts/replay.js"}, () => {
                chrome.tabs.sendMessage(e.tabId, data.steps, (resp) => {
                    chrome.browserAction.setBadgeText({text: resp, tabId: e.tabId});
                    if(resp == "-") {
                        chrome.browserAction.setTitle({title: "SiteMacro: Failed to submit form, required element not found.", tabId: e.tabId });
                    } else if(resp == "+") {
                        chrome.browserAction.setTitle({title: "SiteMacro: Successfullly submitted form.", tabId: e.tabId });                        
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
            if(text == "*") {
                chrome.tabs.sendMessage(tab.id, "abort");
                chrome.browserAction.setBadgeText({text: "", tabId: tab.id});
                chrome.browserAction.setTitle({title: "SiteMacro", tabId: tab.id });                
                return;
            } else if(text == "+" || text == "-" || text == "=") {
                var key = "data/" + tab.url;
                chrome.storage.local.remove(key);
                delete siteMacro.database[key];
                chrome.browserAction.setBadgeText({text: "", tabId: tab.id});
                chrome.browserAction.setTitle({title: "SiteMacro", tabId: tab.id });                
                return;
            } else {
                console.log(tab.url);
                chrome.tabs.executeScript(tab.id, {file: "/scripts/page.js"});
                chrome.browserAction.setBadgeText({text: "*", tabId: tab.id});    
                chrome.browserAction.setTitle({title: "SiteMacro: Recording... Click to cancel.", tabId: tab.id });
            }
        });
    }, 

    message: function(msg) {
        console.log("Received steps for " + msg.url);
        var data = {}, key = "data/" + msg.url;
        data[key] = {steps: msg.steps, created: Date.now(), last: Date.now() - 15000};
        chrome.storage.local.set(data, () => {});
        siteMacro.database[key] = data[key];
    },

    init: function() {
        chrome.webNavigation.onDOMContentLoaded.addListener(siteMacro.loaded);
        chrome.browserAction.onClicked.addListener(siteMacro.clicked);
        chrome.runtime.onMessage.addListener(siteMacro.message);
        chrome.storage.local.get(null, data => { siteMacro.database = data; });
    }
};

siteMacro.init();