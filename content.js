//The "Eyes" of the extension
console.log("Student Buddy Pro: Content Script Active");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getText") {
        // Grab the first 2000 characters of the page
        const pageText = document.body.innerText.slice(0, 2000);
        sendResponse({ text: pageText });
    }
});