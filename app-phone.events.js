/* =========================================================================
 * app-phone.events.js — events, save, edit & delete, and due hints (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { fmtDDMMYYYY, copyToClipboard } = window.PhoneShared;

  function computeNextDueFromUI() {
    const datePicked = document.getElementById('ph_reschedule_date')?.value;
    if (datePicked) return datePicked;

    const sel = Array.from(document.querySelectorAll('input[name="ph_reschedule"]')).find(r=>r.checked);
    const val = sel && sel.value;
    if (!val || val === 'none') return '';

    const today = new Date();
    const p = (n)=>String(n).padStart(2,'0');
    const toISO = (d)=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    const addDays = (n)=>{ const d=new Date(today); d.setDate(d.getDate()+n); return d; };

    if (val === '1w')  return toISO(addDays(7));
    if (val === '2w')  return toISO(addDays(14));
    if (val === '3w')  return toISO(addDays(21));
    if (val === '4w')  return toISO(addDays(28));
    return '';
  }

  function setDueBadgeText(text){
    const badge = document.getElementById('ph_due_badge');
    if (!badge) return;
    if (text){
      badge.textContent = `will set next due: ${text}`;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  }

  function updateRescheduleHint() {
    const d = computeNextDueFromUI();
    const hint = document.getElementById('ph_reschedule_hint');
    if (hint) hint.textContent = d ? `→ will set next due: ${d}` : '';
    setDueBadgeText(d);
  }

  function fillDueHint(followup_due) {
    const h = document.getElementById('phone-due-hint');
    if (!h) return;
    h.textContent = followup_due ? `— next due ${fmtDDMMYYYY(followup_due)}` : '';
  }

  function setPhoneChip(phone){
    const chip = document.getElementById('ph_phone_chip');
    const call = document.getElementById('ph_call_phone');
    const copy = document.getElementById('ph_copy_phone');
    const display = phone || '—';
    if (chip) chip.textContent = display;
    if (call) call.href = phone ? `tel:${phone}` : '#';
    if (copy) copy.onclick = async ()=>{ if (phone){ const ok = await copyToClipboard(phone); if (ok) copy.textContent='✅'; setTimeout(()=>copy.textContent='📋',800); } };
  }

  function fillFormFromRow(r){
    const set = (id,val)=>{ const el=document.getElementById(id); if (el) el.value = (val==null?'':String(val)); };
    set('ph_diarrhea',  r.diarrhea);
    set('ph_mucositis', r.mucositis);
    set('ph_neutropenia', r.neutropenia);
    set('ph_fever', r.fever);

    set('ph_hosp', r.hospitalization);
    set('ph_hosp_due_tox', r.hospitalization_due_tox);
    set('ph_delay', r.delay);
    set('ph_stop', r.stop);
    set('ph_dose_mod', r.dose_modification);
    document.getElementById('ph_dose_red') && (document.getElementById('ph_dose_red').value = (r.dose_reduction_pct==null?'':r.dose_reduction_pct));

    set('ph_other_name', r.other_tox_name);
    set('ph_other_grade', r.other_tox_grade);

    const dpSel = document.getElementById('ph_dpyd_present');
    const dpInp = document.getElementById('ph_dpyd_type');
    if (dpSel && !dpSel.disabled) dpSel.value = r.dpyd_present || '';
    if (dpInp && !dpInp.disabled) dpInp.value = r.dpyd_type || '';

    document.getElementById('ph_notes') && (document.getElementById('ph_notes').value = r.notes || '');
  }

  function setEditHint(on, dateText){
    const hint = document.getElementById('ph_edit_hint');
    const btn  = document.getElementById('btn-save-phone');
    if (!hint || !btn) return;
    if (on){
      hint.textContent = `Editing existing entry (${dateText || ''}) — saving will update this log`;
      btn.textContent  = 'Save Changes';
    } else {
      hint.textContent = '';
      btn.textContent  = 'Save Phone Follow-up';
    }
  }

  function makeWireEvents({ getState, setState, setPrevOtherFromLatest, refreshPrev, setDpydLockUI }) {
    async function deleteRow(row){
      if (!window.SheetsAPI || !window.SheetsAPI.deletePhoneLog){
        alert('Delete is not available in this deployment.');
        return;
      }
      const ok = confirm('Delete this phone follow-up permanently?');
      if (!ok) return;
      try{
        const res = await window.SheetsAPI.deletePhoneLog({ id: row.id, log_id: row.log_id, call_time: row.call_time });
        if (!(res && (res.ok !== false))) { alert('Failed to delete.'); return; }
        const st = getState();
        await refreshPrev(st);
        setPrevOtherFromLatest(st.id, null, null);
        setEditHint(false);
        alert('Deleted.');
      }catch(e){
        console.error(e); alert('Delete failed, see console.');
      }
    }

    function enterEdit(row){
      const st = getState();
      st.editLogId = row.log_id || row.id;
      st.editCallTime = row.call_time || '';
      setState(st);
      fillFormFromRow(row);
      setEditHint(true, fmtDDMMYYYY(row.call_time));
    }

    return function wireEvents() {
      const state = getState();
      const close = () => window.PhoneUI && window.PhoneUI.close();
      document.getElementById('btn-close-phone')?.addEventListener('click', close);
      document.getElementById('btn-close-phone-2')?.addEventListener('click', close);

      const nm = document.getElementById('ph_patient_name'); if (nm) nm.textContent = state.name || '—';
      const title = document.getElementById('ph_title'); if (title && state.name) title.textContent = `Phone Assessment — ${state.name}`;
      fillDueHint(state.followup_due);

      Array.from(document.querySelectorAll('input[name="ph_reschedule"]')).forEach(r => r.addEventListener('change', updateRescheduleHint));
      const dt = document.getElementById('ph_reschedule_date'); if (dt) dt.addEventListener('change', updateRescheduleHint);
      updateRescheduleHint();

      document.getElementById('btn-save-phone')?.addEventListener('click', async () => {
        try {
          if (!window.SheetsAPI || !window.SheetsAPI.savePhoneLog) { alert('SheetsAPI.savePhoneLog is not available.'); return; }

          const nextDue = computeNextDueFromUI();
          const current = getState();
          const editing = !!current.editLogId;

          const log = {
            id: current.id,
            name: current.name || '',
            call_time: editing && current.editCallTime ? current.editCallTime : new Date().toISOString(),
            log_id: editing ? current.editLogId : window.PhoneShared.uuid(),

            diarrhea:    document.getElementById('ph_diarrhea').value || '',
            mucositis:   document.getElementById('ph_mucositis').value || '',
            neutropenia: document.getElementById('ph_neutropenia').value || '',
            fever:       document.getElementById('ph_fever').value || '',

            hospitalization: document.getElementById('ph_hosp').value || '',
            hospitalization_due_tox: document.getElementById('ph_hosp_due_tox').value || '',
            delay:        document.getElementById('ph_delay').value || '',
            stop:         document.getElementById('ph_stop').value || '',
            dose_modification: document.getElementById('ph_dose_mod').value || '',
            dose_reduction_pct: (function(){
              const v = document.getElementById('ph_dose_red').value;
              return v==='' ? '' : Number(v);
            })(),

            other_tox_name:  document.getElementById('ph_other_name').value.trim(),
            other_tox_grade: document.getElementById('ph_other_grade').value || '',

            dpyd_present: document.getElementById('ph_dpyd_present').value || '',
            dpyd_type:    document.getElementById('ph_dpyd_type').value.trim(),

            notes: document.getElementById('ph_notes').value.trim(),
            next_due: nextDue || '',
          };

          const res = await window.SheetsAPI.savePhoneLog(log);
          if (!(res && (res.ok !== false))) { console.error('[phone] savePhoneLog response', res); alert('Failed to save phone follow-up.'); return; }

          if (nextDue && window.SheetsAPI.saveAssessment) {
            await window.SheetsAPI.saveAssessment({ id: current.id, followup_due: nextDue });
          }

          if (!current.dpydLocked) {
            const dpydPresent = (document.getElementById('ph_dpyd_present').value || '');
            const dpydType    = (document.getElementById('ph_dpyd_type').value || '').trim();
            if ((dpydPresent && dpydPresent !== '—') || dpydType) {
              await window.SheetsAPI.saveAssessment({ id: current.id, dpyd_present: dpydPresent, dpyd_type: dpydType });
              setDpydLockUI(dpydPresent, dpydType, current);
              setState(current);
            }
          }

          await refreshPrev(current);
          setPrevOtherFromLatest(current.id, current.editLogId, current.editCallTime);

          current.editLogId = null;
          current.editCallTime = null;
          setState(current);
          setEditHint(false);
          setDueBadgeText(''); // إخفاء البادج بعد الحفظ

          alert('Saved.');
        } catch (err) { console.error(err); alert('Save failed, see console.'); }
      });

      window.PhoneParts = window.PhoneParts || {};
      window.PhoneParts.eventsAPI = { enterEdit, deleteRow, setPhoneChip };
    };
  }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.events = { computeNextDueFromUI, updateRescheduleHint, fillDueHint, makeWireEvents };
})();
