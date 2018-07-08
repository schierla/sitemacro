var siteMacroReplay = {
    message: function(steps, sender, response) {
        for(var i=0; i<steps.length; i++) {
            var step = steps[i]; 
            if(step.type == "click") {
                var event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                var elem = siteMacroReplay.elem(step.target);
                if(!siteMacroReplay.checkElem(step, elem)) {console.log("SiteMacro: Failed at step " + i); response(chrome.i18n.getMessage("badgeFailed")); return; }
                elem.dispatchEvent(event);
            } else if(step.type == "change") {
                var elem = siteMacroReplay.elem(step.target);
                if(!siteMacroReplay.checkElem(step, elem)) {console.log("SiteMacro: Failed at step " + i); response(chrome.i18n.getMessage("badgeFailed")); return; }
                elem.value = step.value;
            }
        }
        response(chrome.i18n.getMessage("badgeCompleted"));
    }, 
    elem: function(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }, 
    checkElem: function(obj, elem) {
        if(elem == null) { 
            console.log("SiteMacro: Did not find element with path " + obj.target); 
            return false; 
        } else if(obj.name && elem.name != obj.name) {
            console.log("SiteMacro: Element with path " + obj.target + " has name '" + elem.name + "' instead of '" + obj.name + "'"); 
            return false;
        } else if(obj.text && elem.innerText != obj.text) {
            console.log("SiteMacro: Element with path " + obj.target + " has text '" + elem.innerText + "' instead of '" + obj.text + "'"); 
            return false; 
        }
        return true;
    }
}

chrome.runtime.onMessage.addListener(siteMacroReplay.message);