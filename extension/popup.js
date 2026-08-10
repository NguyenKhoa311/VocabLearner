document.getElementById('open-web-app').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://vocalhelper.web.app' }); 
});
