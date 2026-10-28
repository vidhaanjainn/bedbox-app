// Inline (plain ES5, no dependencies) script injected into every page by the
// root layout. If the React app hasn't started within 10s - blocked/slow
// script download, an old cached copy, a crash before React mounts - a visible
// message appears instead of a blank/black screen, with two recovery buttons.
// PwaInstallCapture calls window.__bbBooted() once React is running, which
// cancels it (or removes the message if it already appeared).
export const BOOT_WATCHDOG = `(function(){
  var booted=false, errs=[];
  window.addEventListener('error',function(e){errs.push(String((e&&e.message)||'script error'))});
  window.addEventListener('unhandledrejection',function(e){errs.push(String((e&&e.reason&&e.reason.message)||e.reason||'rejection'))});
  window.__bbBooted=function(){booted=true;var el=document.getElementById('bb-boot-fail');if(el&&el.parentNode)el.parentNode.removeChild(el)};
  function show(){
    if(booted||document.getElementById('bb-boot-fail'))return;
    var el=document.createElement('div');el.id='bb-boot-fail';
    el.setAttribute('style','position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;background:#070d1a;color:#e8eaf0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center;font-family:-apple-system,system-ui,sans-serif');
    var btn='padding:12px 20px;border-radius:12px;border:0;font-size:14px;font-weight:700;margin:6px;';
    el.innerHTML='<div style="font-size:18px;font-weight:700;margin-bottom:10px">TheBedBox is taking too long to start</div>'
      +'<div style="font-size:14px;opacity:.7;max-width:320px;line-height:1.5;margin-bottom:18px">This is usually a slow connection or an old saved copy of the app. Your data is safe.</div>'
      +'<div><button id="bb-boot-reload" style="'+btn+'background:#00d4c8;color:#04120f">Reload</button>'
      +'<button id="bb-boot-reset" style="'+btn+'background:rgba(255,255,255,.1);color:#e8eaf0">Reset app and reload</button></div>'
      +'<div style="font-size:11px;opacity:.45;margin-top:14px;max-width:320px;word-break:break-word">'+(errs[0]||'')+'</div>';
    document.body.appendChild(el);
    document.getElementById('bb-boot-reload').onclick=function(){location.reload()};
    document.getElementById('bb-boot-reset').onclick=function(){
      var done=function(){try{localStorage.removeItem('bb-sb-route')}catch(e){}location.replace(location.pathname)};
      try{
        var jobs=[];
        if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}));
        if(window.caches&&caches.keys)jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}));
        Promise.all(jobs).then(done,done);
      }catch(e){done()}
    };
  }
  setTimeout(show,10000);
})();`
