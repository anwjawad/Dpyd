(function(){
  'use strict';

  function pad2(n){ return String(n).padStart(2,'0'); }
  function normalizeToDMY(v){
    if (!v) return '';
    if (typeof v==='string'){
      const s=v.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      const m1=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m1) return `${m1[3]}/${m1[2]}/${m1[1]}`;
      const m2=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if (m2){ const a=+m2[1], b=+m2[2], y=m2[3]; if (b>12 && a>=1&&a<=12) return `${pad2(b)}/${pad2(a)}/${y}`; return `${pad2(a)}/${pad2(b)}/${y}`; }
      try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
      return s;
    }
    try{ const d=new Date(v); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
    return String(v);
  }

  function injectFirst5FU(noteText){
    const modal = document.querySelector('.modal') || document.querySelector('[data-phone-modal], .phone-modal, .modal-wrap .modal');
    if (!modal) return;
    const body = modal.querySelector('.modal-body') || modal;
    let placeholder = modal.querySelector('#first5fu-note');
    if (!placeholder){
      placeholder = document.createElement('div');
      placeholder.id = 'first5fu-note';
      placeholder.style.cssText = 'margin-bottom:8px;color:#b00020;font-weight:600;';
      body.prepend(placeholder);
    }
    placeholder.textContent = `1st date 5FU: ${noteText}`;
  }

  // Patch PhoneUI.open لإظهار الملاحظة دون المساس بالمنطق
  function tryPatch(){
    if (!window.PhoneUI || !window.PhoneUI.open || window.PhoneUI.__patched_for_first5fu) return;
    const origOpen = window.PhoneUI.open.bind(window.PhoneUI);
    window.PhoneUI.open = function(opts){
      const res = origOpen(opts);
      const raw = (opts && (opts.first_date_5fu || (opts.row && opts.row.first_date_5fu))) || '';
      const dmy = normalizeToDMY(raw);
      if (dmy) injectFirst5FU(dmy);
      return res;
    };
    window.PhoneUI.__patched_for_first5fu = true;
    console.log('[ext] PhoneUI patched to show 1st date 5FU note.');
  }

  tryPatch();
  document.addEventListener('DOMContentLoaded', tryPatch);
  window.addEventListener('load', tryPatch);
  const iv = setInterval(function(){ tryPatch(); if (window.PhoneUI && window.PhoneUI.__patched_for_first5fu) clearInterval(iv); }, 300);

})();
