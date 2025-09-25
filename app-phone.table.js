/* =========================================================================
 * app-phone.table.js — previous phone follow-ups table (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { $, el, fmtDDMMYYYY, dmyToSortable } = window.PhoneShared;
  const { dpydCompact } = (window.PhoneParts && window.PhoneParts.dpyd) || {};

  let handlers = { onEdit: null, onDelete: null };

  function actionsCell(row){
    const wrap = el('div', { class:'flex items-center gap-1' });
    const edit = el('button', { class:'btn btn-sm', title:'Edit' }, '✏️');
    edit.addEventListener('click', (ev)=>{ ev.stopPropagation(); handlers.onEdit && handlers.onEdit(row); });

    const del = el('button', { class:'btn btn-danger btn-sm', title:'Delete' }, '🗑️');
    del.addEventListener('click', (ev)=>{ ev.stopPropagation(); handlers.onDelete && handlers.onDelete(row); });

    wrap.appendChild(edit);
    wrap.appendChild(del);
    return wrap;
  }

  function fillPrevTable(rows) {
    const tb = $('#ph_prev_tbody');
    tb.innerHTML = '';
    if (!rows || !rows.length) {
      tb.appendChild(el('tr', null, el('td', { colspan: 10 }, 'No phone follow-ups yet.')));
      return;
    }
    rows.forEach(r => {
      const tr = el('tr', null,
        el('td', null, fmtDDMMYYYY(r.call_time)),
        el('td', null, r.diarrhea || '—'),
        el('td', null, r.mucositis || '—'),
        el('td', null, r.neutropenia || '—'),
        el('td', null, r.fever || '—'),
        el('td', null, dpydCompact && dpydCompact(r.dpyd_present, r.dpyd_type) || '—'),
        el('td', null, r.other_tox_name || '—'),
        el('td', null, r.other_tox_grade || '—'),
        el('td', null, r.next_due ? fmtDDMMYYYY(r.next_due) : '—'),
        el('td', null, actionsCell(r))
      );
      tr.addEventListener('click', ()=> openPrevRowModal(r));
      tb.appendChild(tr);
    });
  }

  function openPrevRowModal(r){
    const wrap = el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, `Phone follow-up — ${fmtDDMMYYYY(r.call_time)}`),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px;' },
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Symptoms')),
              el('p', null, `Diarrhea: ${r.diarrhea || '—'}`),
              el('p', null, `Mucositis: ${r.mucositis || '—'}`),
              el('p', null, `Neutropenia: ${r.neutropenia || '—'}`),
              el('p', null, `Fever: ${r.fever || '—'}`),
              el('p', null, `Other toxicity: ${r.other_tox_name || '—'} (${r.other_tox_grade || '—'})`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'DPYD & Decisions')),
              el('p', null, `DPYD: ${dpydCompact && dpydCompact(r.dpyd_present, r.dpyd_type) || '—'}`),
              el('p', null, `Hospitalization: ${r.hospitalization || '—'}`),
              el('p', null, `Hospitalization due tox: ${r.hospitalization_due_tox || '—'}`),
              el('p', null, `Delay: ${r.delay || '—'}`),
              el('p', null, `Stop: ${r.stop || '—'}`),
              el('p', null, `Dose modification: ${r.dose_modification || '—'}`),
              el('p', null, `Dose reduction (%): ${r.dose_reduction_pct ?? '—'}`),
              el('p', null, `Next due: ${r.next_due ? fmtDDMMYYYY(r.next_due) : '—'}`),
              el('p', null, `Notes: ${r.notes || ''}`)
            )
          )
        ),
        el('div', { class:'modal-footer' },
          el('button', { class:'btn', onclick: close }, 'Close')
        )
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);
  }

  async function refreshPrev(state) {
    try {
      if (!window.SheetsAPI || !window.SheetsAPI.fetchPhoneLogs) return;
      const rows = await window.SheetsAPI.fetchPhoneLogs(state.id);
      rows.sort((a,b) => dmyToSortable(b.call_time).localeCompare(dmyToSortable(a.call_time)));
      fillPrevTable(rows);
    } catch (e) { console.warn('[phone] fetchPhoneLogs failed', e); }
  }

  function setHandlers(h){ handlers = Object.assign({ onEdit:null,onDelete:null }, h||{}); }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.table = { fillPrevTable, openPrevRowModal, refreshPrev, setHandlers };
})();
