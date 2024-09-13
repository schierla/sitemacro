var siteMacroReplay = {
    started: false,
    message: function(message, sender, response) {
        if(message.command != "replay") return false;
        if(siteMacroReplay.started) return false;
        siteMacroReplay.started = true;
        siteMacroReplay.execute(message.steps, response);
        return true;
    }, 
    execute: function(steps, response) {
        if(steps.length == 0) {
            response(chrome.i18n.getMessage("badgeCompleted"));
            siteMacroReplay.started = false;
        } else {
            var step = steps.shift();
            if(step.type == "click") {
                var elem = siteMacroReplay.elem(step.target);
                if(!siteMacroReplay.checkElem(step, elem)) {
                    response(chrome.i18n.getMessage("badgeFailed")); 
                    siteMacroReplay.started = false;
                    return; 
                }
                var event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                elem.dispatchEvent(event);
            } else if(step.type == "change") {
                var elem = siteMacroReplay.elem(step.target);
                if(!siteMacroReplay.checkElem(step, elem)) {
                    response(chrome.i18n.getMessage("badgeFailed")); 
                    siteMacroReplay.started = false;
                    return; 
                }
                elem.value = step.value;
            } else if(step.type == "wait") {
                setTimeout(() => {siteMacroReplay.execute(steps, response); }, step.duration);
                return;
            } else if(step.type == "close") {
                response(chrome.i18n.getMessage("badgeCompleted"));
                siteMacroReplay.started = false;
                chrome.runtime.sendMessage({command: "closeTab"});
            } else {
                console.log("SiteMacro: Invalid step type " + step.type);
            }
            setTimeout(() => {siteMacroReplay.execute(steps, response); }, 10);
        }
    },
    elem: function(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }, 
    checkElem: function(obj, elem) {
        if(elem == null) { 
            console.log("SiteMacro: Did not find element with path " + obj.target); 
            return false; 
        } else if(obj.name && elem.name?.trim() != obj.name.trim()) {
            console.log("SiteMacro: Element with path " + obj.target + " has name '" + elem.name + "' instead of '" + obj.name + "'"); 
            return false;
        } else if(obj.text && elem.innerText?.trim() != obj.text.trim()) {
            console.log("SiteMacro: Element with path " + obj.target + " has text '" + elem.innerText + "' instead of '" + obj.text + "'"); 
            return false; 
        }
        return true;
    }
}

chrome.runtime.onMessage.addListener(siteMacroReplay.message);
