/* =========================================================================
 * app-phone.dpyd.js — DPYD helpers (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { $, el, toText, dmyToSortable } = window.PhoneShared;

  async function getCanonicalDpyd(id) {
    let dpyd_present = ''; let dpyd_type = '';
    try {
      if (window.SheetsAPI && window.SheetsAPI.fetchAssessments) {
        const all = await window.SheetsAPI.fetchAssessments();
        const rows = (all || []).filter(r => String(r.id||'') === String(id));
        rows.sort((a,b)=> String(b.assessment_date||'').localeCompare(String(a.assessment_date||'')));
        if (rows.length) {
          dpyd_present = rows[0].dpyd_present || '';
          dpyd_type    = rows[0].dpyd_type || '';
          if (dpyd_present || dpyd_type) return { dpyd_present, dpyd_type };
        }
      }
    } catch {}
    try {
      if (window.SheetsAPI && window.SheetsAPI.fetchPhoneLogs) {
        const logs = await window.SheetsAPI.fetchPhoneLogs(id);
        const filled = (logs || []).filter(r => (r.dpyd_present && r.dpyd_present !== '—') || (r.dpyd_type && r.dpyd_type !== ''));
        filled.sort((a,b)=> dmyToSortable(a.call_time).localeCompare(dmyToSortable(b.call_time)));
        if (filled.length) {
          dpyd_present = filled[0].dpyd_present || '';
          dpyd_type    = filled[0].dpyd_type || '';
        }
      }
    } catch {}
    return { dpyd_present, dpyd_type };
  }

  function setDpydLockUI(present, type, currentStateRef) {
    const sel = $('#ph_dpyd_present'); const inp = $('#ph_dpyd_type');
    const hintId = 'ph_dpyd_hint';
    let hint = document.getElementById(hintId);
    if (!hint) {
      hint = el('small', { id: hintId, class: 'muted' });
      const holder = sel && sel.parentElement;
      if (holder) holder.appendChild(hint);
    }
    if ((present && present !== '—') || (type && type !== '')) {
      if (sel) { sel.value = present || ''; sel.disabled = true; }
      if (inp) { inp.value = type || '';    inp.disabled = true; }
      if (hint) hint.textContent = 'Locked from first entry.';
      currentStateRef.dpydLocked  = true;
      currentStateRef.dpydPresent = present || '';
      currentStateRef.dpydType    = type || '';
    } else {
      if (sel) { sel.disabled = false; }
      if (inp) { inp.disabled = false; }
      if (hint) hint.textContent = '';
      currentStateRef.dpydLocked  = false;
      currentStateRef.dpydPresent = '';
      currentStateRef.dpydType    = '';
    }
  }

  function dpydCompact(present, type){
    const p = toText(present);
    const t = toText(type);
    if (!p && !t) return '—';
    if (p && t)   return `${p} (${t})`;
    return p || t || '—';
  }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.dpyd = { getCanonicalDpyd, setDpydLockUI, dpydCompact };
})();
