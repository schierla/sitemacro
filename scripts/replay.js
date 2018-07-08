var siteMacroReplay = {
    message: function(steps, sender, response) {
        for(var i=0; i<steps.length; i++) {
            var step = steps[i]; 
            if(step.type == "click") {
                var event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                var elem = siteMacroReplay.elem(step.target);
                if(elem == null || elem.innerText != step.text || elem.value != step.value) {console.log("Failed at step " + i); response("-"); return; }
                elem.dispatchEvent(event);
            } else if(step.type == "change") {
                var elem = siteMacroReplay.elem(step.target);
                if(elem == null || elem.innerText != step.text) {console.log("Failed at step " + i); response("-"); return; }
                elem.value = step.value;
            }
        }
        response("+");
    }, 
    elem: function(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
}

chrome.runtime.onMessage.addListener(siteMacroReplay.message);