document.getElementById('open-web-app').addEventListener('click', () => {
  // TODO: Replace with deployed web app URL
  chrome.tabs.create({ url: 'http://localhost:5173' }); 
});
