if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw-installer.js', { type: 'module' }).catch(function (err) {
    console.log("sw", err);
  });
}