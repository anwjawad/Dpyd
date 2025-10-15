(function(){
  'use strict';

  /* --------- Helpers --------- */
  function $(sel, root){ return (root||document).querySelector(sel); }
  function el(tag, attrs, ...children){
    const n = document.createElement(tag);
    if (attrs && typeof attrs === 'object'){
      for (const [k,v] of Object.entries(attrs||{})){
        if (k === 'class' || k === 'className') n.className = v || '';
        else if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
        else if (k in n) n[k] = v;
        else n.setAttribute(k, v);
      }
    }
    for (const c of children){
      if (c == null) continue;
      if (Array.isArray(c)) c.forEach(ci=>n.appendChild(textOrNode(ci)));
      else n.appendChild(textOrNode(c));
    }
    return n;
  }
  function textOrNode(x){ return (typeof x==='string' || typeof x==='number') ? document.createTextNode(String(x)) : (x || document.createTextNode('')); }
  function toText(v){ if (v==null) return ''; try { return String(v).trim(); } catch { return ''+v; } }
  function pad2(n){ return String(n).padStart(2,'0'); }

  /* --------- Date normalize DMY --------- */
  function normalizeToDMY(val){
    if (val == null || val === '') return '';
    if (typeof val === 'string'){
      const s = val.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)){
        try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
        const m0=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m0) return `${pad2(+m0[3])}/${pad2(+m0[2])}/${m0[1]}`;
      }
      let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m) return `${pad2(+m[3])}/${pad2(+m[2])}/${m[1]}`;
      m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if(m){ const a=+m[1], b=+m[2], y=m[3]; if (b>12 && a>=1 && a<=12) return `${pad2(b)}/${pad2(a)}/${y}`; return `${pad2(a)}/${pad2(b)}/${y}`; }
    }
    try{ const d=new Date(val); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
    return String(val);
  }

  /* =========================
     Saved Assessments — UI
     ========================= */

  // عدّاد أعلى كارد الجدول
  function ensureSavedAssessmentsBadge(){
    const titleFlex = document.querySelector('.table-card .card-title .flex');
    if (!titleFlex) return null;

    let b = document.getElementById('sa_count_badge');
    if (!b){
      b = el('span', {
        id: 'sa_count_badge',
        class: 'badge',
        'aria-live': 'polite',
        'aria-label': 'Assessed patients count: —',
        style: { marginLeft: '6px' }
      }, '—');
      titleFlex.appendChild(b);
    }
    return b;
  }
  function updateSavedAssessmentsBadge(val){
    const b = ensureSavedAssessmentsBadge();
    if (!b) return;
    const text = (val === null || val === undefined) ? '—' : String(val);
    b.textContent = text;
    b.setAttribute('aria-label', `Assessed patients count: ${text}`);
  }

  // أعمدة الجدول
  function headersSpec(){
    return [
      { key:'name',            title:'Name' },                 // sticky
      { key:'id',              title:'ID' },
      { key:'followup_due',    title:'Next phone follow-up' },
      { key:'first_date_5fu',  title:'1st date 5FU' },
      { key:'mucositis_grade',   title:'Mucositis' },
      { key:'diarrhea_grade',    title:'Diarrhea' },
      { key:'neutropenia_grade', title:'Neutropenia' },
      { key:'_dpyd',           title:'DPYD' },
      { key:'other_tox_name',  title:'Other tox' },
      { key:'other_tox_grade', title:'Other grade' },
      { key:'_actions',        title:'Actions' },
    ];
  }

  function makeTableHost(host){
    const scroll = el('div', { class:'sa-scroll-host', style:{ overflow:'auto', borderRadius:'var(--radius)', border:'1px solid var(--border)', flex:'1 1 auto' }});
    const table = el('table', { class:'table', id:'sa_table', style:{ minWidth:'900px', width:'100%' } });
    const thead = el('thead', null, el('tr', null, ...headersSpec().map((h,i)=>{
      const th = el('th', null, h.title);
      if (i === 0){
        th.style.position = 'sticky';
        th.style.left = '0';
        th.style.zIndex = '3';
        th.style.background = 'var(--table-header)';
        th.style.whiteSpace = 'nowrap';
      }
      return th;
    })));
    const tbody = el('tbody', { id: 'sa_tbody' }, el('tr', null, el('td', { colspan: headersSpec().length }, 'Loading…')));

    table.appendChild(thead); table.appendChild(tbody);
    scroll.appendChild(table);
    host.innerHTML = '';
    host.appendChild(scroll);

    return { table, tbody, scroll };
  }

  function dpydCellValue(r){
    const present = toText(r.dpyd_present);
    const type    = toText(r.dpyd_type);
    if (!present && !type) return '—';
    if (present && type)   return `${present} (${type})`;
    return present || type || '—';
  }

  /* ---------- Edit minimal modal (same as قبل) ---------- */
  function openEditAssessmentModal(row, onSave){
    const old = { ...row };

    // Small helpers
    function field(label, id, val){
      return el('div', { class:'form-group' },
        el('label', { for: `edit_${id}` }, label),
        el('input', { id:`edit_${id}`, type:'text', value: val })
      );
    }
    function dateField(label, id, val){
      return el('div', { class:'form-group' },
        el('label', { for: `edit_${id}` }, label),
        el('input', { id:`edit_${id}`, type:'date', value: toYMDFromDMY(val) })
      );
    }
    function selectWithOther(label, idBase, options, current){
      const w = el('div', { class:'form-group' });
      const lab = el('label', { for: `edit_${idBase}_select` }, label);
      const sel = el('select', { id: `edit_${idBase}_select` },
        el('option', { value:'' }, 'Select…'),
        ...options.map(o => el('option', { value:o }, o)),
        el('option', { value:'Other' }, 'Other')
      );
      const inp = el('input', { id:`edit_${idBase}_other`, type:'text', placeholder:'Type here…', style:'display:none;margin-top:.4rem' });

      // Prefill
      (function prefill(){
        const set = new Set(options.map(String));
        if (current && set.has(String(current))) {
          sel.value = String(current);
          inp.style.display = 'none';
          inp.value = '';
        } else if (current) {
          sel.value = 'Other';
          inp.style.display = '';
          inp.value = String(current);
        } else {
          sel.value = '';
          inp.style.display = 'none';
          inp.value = '';
        }
      })();

      sel.addEventListener('change', function(){
        inp.style.display = (sel.value === 'Other') ? '' : 'none';
      });

      w.appendChild(lab);
      w.appendChild(sel);
      w.appendChild(inp);
      return { wrap:w, sel, inp };
    }
    function toYMDFromDMY(v){
      if (!v) return '';
      const s = String(v).trim();
      const mDMY = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mDMY) return `${mDMY[3]}-${mDMY[2]}-${mDMY[1]}`;
      const mYMD = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mYMD) return s;
      try{ const d=new Date(s); if(!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }catch(_){}
      return '';
    }

    // Build content grid first
    const grid = el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px;' });
    grid.appendChild(field('Name','name', old.name || ''));
    grid.appendChild(field('Phone','phone', old.phone || ''));

    const REGIMEN_OPTIONS = [
      'FOLFIRI','FOLFOXIRI','CapOx / XELOX','FUFOL (De Gramont)',
      'TPF','PF','FOLFIRINOX','Capecitabine','FOLFOX'
    ];
    const reg = selectWithOther('Regimen','regimen', REGIMEN_OPTIONS, old.regimen || '');
    grid.appendChild(reg.wrap);

    grid.appendChild(field('Stage','stage', old.stage || ''));

    const DX_OPTIONS = ['Colon','Rectal','Gastric','Pancreatic','Breast','Head & Neck','Lung'];
    const dx = selectWithOther('Cancer type','diagnosis', DX_OPTIONS, old.diagnosis || '');
    grid.appendChild(dx.wrap);

    grid.appendChild(dateField('Assessment date','assessment_date', old.assessment_date || ''));

    // Create modal without referencing a variable in its own initializer
    const modalEl = el('div', { class:'modal-wrap', id:'edit_assessment_modal' },
      el('div', { class:'modal-overlay', id:'edit_close_overlay' }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, 'Edit assessment record'),
            el('button', { class:'btn btn-icon', id:'edit_close_btn', title:'Close' }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          grid,
          el('small', { id:'edit_error', class:'muted', style:{color:'#ffb3b3'} }, '')
        ),
        el('div', { class:'modal-footer' },
          el('button', { class:'btn', id:'edit_close_btn2' }, 'Cancel'),
          el('button', { id:'edit_save_btn', class:'btn btn-primary', disabled:true }, 'Save')
        )
      )
    );

    // Append to DOM
    document.body.appendChild(modalEl);

    // Close helper
    function closeModal(){
      if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    }

    // Wire close buttons AFTER element exists
    modalEl.querySelector('#edit_close_overlay')?.addEventListener('click', closeModal);
    modalEl.querySelector('#edit_close_btn')?.addEventListener('click', closeModal);
    modalEl.querySelector('#edit_close_btn2')?.addEventListener('click', closeModal);

    // Getter for current values
    modalEl.__getValues = function(){
      const get = (o)=> o.sel.value === 'Other' ? (o.inp.value || '').trim() : (o.sel.value || '');
      return {
        name: toText($('#edit_name',modalEl).value),
        phone: toText($('#edit_phone',modalEl).value),
        regimen: get(reg),
        stage: toText($('#edit_stage',modalEl).value),
        diagnosis: get(dx),
        assessment_date: normalizeToDMY($('#edit_assessment_date',modalEl).value) || old.assessment_date || ''
      };
    };

    const btn = $('#edit_save_btn', modalEl);
    const err = $('#edit_error', modalEl);

    function currentPatch(){
      const vals = modalEl.__getValues ? modalEl.__getValues() : {};
      const patch = {
        name: toText(vals.name),
        phone: toText(vals.phone),
        regimen: toText(vals.regimen),
        stage: toText(vals.stage),
        diagnosis: toText(vals.diagnosis),
        assessment_date: normalizeToDMY(vals.assessment_date) || old.assessment_date || ''
      };
      const changed = {};
      Object.keys(patch).forEach(k=>{
        const newVal = patch[k] || '';
        const oldVal = (k==='assessment_date') ? normalizeToDMY(old.assessment_date||'') : toText(old[k]||'');
        if (newVal !== oldVal) changed[k] = newVal;
      });
      return changed;
    }

    function onInputChange(){
      const changed = currentPatch();
      btn.disabled = Object.keys(changed).length === 0;
      err.textContent = '';
    }
    modalEl.addEventListener('input', onInputChange);
    modalEl.addEventListener('change', onInputChange);

    btn.addEventListener('click', async ()=>{
      const changed = currentPatch();
      if (Object.keys(changed).length === 0) return;

      btn.disabled = true;
      err.textContent = '';

      try{
        await onSave(changed);
        closeModal();
        alert('Record updated successfully.');
      }catch(e){
        btn.disabled = false;
        err.textContent = 'Failed to update record, please try again.';
      }
    });
  }

  /* ---------- Render table rows ---------- */
  function renderRows(tbody, rows, api){
    tbody.innerHTML = '';
    if (!rows || !rows.length){
      tbody.appendChild(el('tr', null, el('td', { colspan: headersSpec().length }, 'No assessments.')));
      return;
    }
    rows.forEach(r=>{
      const tds = [];
      headersSpec().forEach((h, i)=>{
        if (h.key === '_actions'){
          const callBtn = el('button', { class:'btn btn-sm', title:'Phone', onclick:(ev)=>{ev.stopPropagation(); window.tryOpenPhone && window.tryOpenPhone(r);} }, '📞');
          const editBtn = el('button', {
              class:'btn btn-sm',
              title:'Edit',
              'aria-label': `Edit record for ${r.name || 'patient'}`,
              onclick:(ev)=>{ ev.stopPropagation(); api && api.onEdit && api.onEdit(r); }
            }, '✏️');
          const delBtn  = el('button', { class:'btn btn-danger btn-sm', title:'Delete', onclick:(ev)=>{ev.stopPropagation(); window.tryDeleteAssessment && window.tryDeleteAssessment(r.id);} }, '🗑️');
          tds.push(el('td', null, el('div', { class:'flex items-center gap-1' }, callBtn, editBtn, delBtn)));
          return;
        }
        if (h.key === '_dpyd'){
          tds.push(el('td', null, dpydCellValue(r)));
          return;
        }
        let val = r[h.key] ?? '';
        if (h.key === 'followup_due' || h.key === 'first_date_5fu' || h.key === 'assessment_date') val = normalizeToDMY(val);
        const td = el('td', null, String(val || ''));
        if (i === 0){
          td.style.position = 'sticky';
          td.style.left = '0';
          td.style.zIndex = '2';
          td.style.background = 'var(--table-row)';
          td.style.whiteSpace = 'nowrap';
          td.style.fontWeight = '700';
          td.style.color = 'var(--accent)';
        }
        tds.push(td);
      });
      const tr = el('tr', null, ...tds);
      tr.addEventListener('click', ()=> openRowDetailsModal(r));
      tbody.appendChild(tr);
    });
  }

  /* ---------- Filters (inside table card) ---------- */
  function buildSavedHeader(toolbarHost){
    const wrap = el('div', { class: 'table-header' });

    // بحث عام
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'220px'} },
      el('label', null, 'Filter by name / ID / phone'),
      el('input', { id:'sa_q', type:'text', placeholder:'e.g., John or 1234', autocomplete:'off' })
    ));

    // تاريخ (followup_due)
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'180px'} },
      el('label', null, 'Review date'),
      el('input', { id:'sa_date', type:'date' })
    ));

    // اليوم
    wrap.appendChild(el('label', { class:'filter-chip', title:'Show only rows due today' },
      el('input', { id:'sa_today', type:'checkbox', style:{marginRight:'6px'} }),
      'Today’s follow-up'
    ));

    // خلال أسبوع
    wrap.appendChild(el('label', { class:'filter-chip', title:'Show rows due in next 7 days' },
      el('input', { id:'sa_due7', type:'checkbox', style:{marginRight:'6px'} }),
      'Next 7 days'
    ));

    // DPYD
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'160px'} },
      el('label', null, 'DPYD'),
      el('select', { id:'sa_dpyd' },
        el('option', { value:'' }, 'Any'),
        el('option', { value:'yes' }, 'Yes'),
        el('option', { value:'no' }, 'No')
      )
    ));

    // شدّة السمية (أعلى G)
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'160px'} },
      el('label', null, 'Toxicity ≥'),
      el('select', { id:'sa_severity' },
        el('option', { value:'' }, 'Any'),
        el('option', { value:'1' }, 'G1'),
        el('option', { value:'2' }, 'G2'),
        el('option', { value:'3' }, 'G3'),
        el('option', { value:'4' }, 'G4')
      )
    ));

    if (toolbarHost) { toolbarHost.innerHTML=''; toolbarHost.appendChild(wrap); }
  }

  function dmyToSortable(s){
    const m = String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}${m[2]}${m[1]}` : '99999999';
  }
  function isTodayDMY(s){
    const d=new Date(); const t=`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
    return dmyToSortable(s)===dmyToSortable(t);
  }
  function isWithinNextDaysDMY(s, days){
    const m = String(normalizeToDMY(s)||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const d = new Date(+m[3], +m[2]-1, +m[1]);
    const now = new Date(); now.setHours(0,0,0,0);
    const last = new Date(now); last.setDate(now.getDate()+days);
    return d >= now && d <= last;
  }
  function parseYesNo(v){
    const s = String(v||'').trim().toLowerCase();
    if (!s) return '';
    if (s==='yes' || s==='y' || s==='true') return 'yes';
    if (s==='no'  || s==='n' || s==='false') return 'no';
    return s; // أي نص آخر
  }
  function gradeToNum(g){
    const m = String(g||'').trim().toUpperCase().match(/^G([0-4])$/);
    return m ? (+m[1]) : 0;
  }
  function rowMaxGrade(row){
    const list = [
      gradeToNum(row.mucositis_grade),
      gradeToNum(row.diarrhea_grade),
      gradeToNum(row.neutropenia_grade),
      gradeToNum(row.other_tox_grade),
      gradeToNum(row.toxicity) // لو موجود
    ];
    return Math.max.apply(null, list);
  }

  function rowMatchesFilters(row, filters){
    if (filters.q){
      const q = filters.q.toLowerCase();
      const hay = [row.name, row.id, row.phone].map(x=>String(x||'').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    if (filters.date){
      const ymd = filters.date;
      const dmy = normalizeToDMY(ymd);
      if (row.followup_due !== dmy) return false;
    }
    if (filters.today){ if (!isTodayDMY(row.followup_due)) return false; }
    if (filters.due7){ if (!isWithinNextDaysDMY(row.followup_due, 7)) return false; }

    if (filters.dpyd){
      const p = parseYesNo(row.dpyd_present);
      if (filters.dpyd === 'yes'){
        if (!(p==='yes' || toText(row.dpyd_type))) return false;
      } else if (filters.dpyd === 'no'){
        if (p==='yes' || toText(row.dpyd_type)) return false;
      }
    }

    if (filters.severity){
      const thr = +filters.severity;
      if (rowMaxGrade(row) < thr) return false;
    }
    return true;
  }

  function sortByDueThenName(rows){
    rows.sort((a,b)=>{
      const A = dmyToSortable(normalizeToDMY(a.followup_due));
      const B = dmyToSortable(normalizeToDMY(b.followup_due));
      if (A === B) return String(a.name||'').localeCompare(String(b.name||''));
      return A.localeCompare(B);
    });
    return rows;
  }

  // تفاصيل الصف
  function openRowDetailsModal(row){
    const wrap = el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, `Patient — ${row.name || '—'}`),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px;' },
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Basics')),
              el('p', null, `ID: ${row.id || '—'}`),
              el('p', null, `Phone: ${row.phone || '—'}`),
              el('p', null, `Sex: ${row.sex || '—'}`),
              el('p', null, `Age: ${row.age || '—'}`),
              el('p', null, `DPYD: ${row.dpyd_present || row.dpyd_type ? ( (row.dpyd_present||'') + (row.dpyd_type?` (${row.dpyd_type})`:'') ) : '—'}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Treatment')),
              el('p', null, `Regimen: ${row.regimen || '—'}`),
              el('p', null, `Stage: ${row.stage || '—'}`),
              el('p', null, `Cancer type: ${row.diagnosis || '—'}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Overall toxicity & notes')),
              el('p', null, `Overall toxicity: ${row.toxicity || '—'}`),
              el('p', null, `Notes: ${row.notes || ''}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Dates')),
              el('p', null, `Assessment date: ${normalizeToDMY(row.assessment_date) || '—'}`),
              el('p', null, `Next phone follow-up: ${normalizeToDMY(row.followup_due) || '—'}`),
              el('p', { style:'color:#b00020;font-weight:600;' }, `1st date 5FU: ${normalizeToDMY(row.first_date_5fu)||'—'}`)
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

  /* ---------- Main render ---------- */
  function renderSavedAssessments(hostSelectors, rawRows){
    // اكتشاف الـhosts الجديدة أولًا
    let tableHost = null;
    let toolbar   = null;

    const tableCandidates = [];
    if (hostSelectors && hostSelectors.table) tableCandidates.push(hostSelectors.table);
    tableCandidates.push('#saved-assessments','#saved_assessments','#saved_table','#saved-table');
    for (const sel of tableCandidates){ tableHost = $(sel); if (tableHost) break; }

    const toolbarCandidates = [];
    if (hostSelectors && hostSelectors.toolbar) toolbarCandidates.push(hostSelectors.toolbar);
    toolbarCandidates.push('#saved-filters','#saved_filters','#saved-toolbar','#saved_toolbar');
    for (const sel of toolbarCandidates){ toolbar = $(sel); if (toolbar) break; }

    // لو لم نجد الحاويات — نتوقف بهدوء
    if (!tableHost){ console.warn('[renderSavedAssessments] table host not found'); return; }
    if (!toolbar){ console.warn('[renderSavedAssessments] filters host not found'); }

    // تطبيع الصفوف
    const rows = (rawRows || []).map(r => {
      const c = Object.assign({}, r);
      c.assessment_date = normalizeToDMY(c.assessment_date);
      c.followup_due    = normalizeToDMY(c.followup_due);
      c.first_date_5fu  = normalizeToDMY(c.first_date_5fu);
      c.dpyd_present    = toText(c.dpyd_present);
      c.dpyd_type       = toText(c.dpyd_type);
      return c;
    });

    // بناء الفلاتر داخل الكارد نفسه
    if (toolbar) buildSavedHeader(toolbar);

    const { tbody } = makeTableHost(tableHost);

    // التقاط عناصر الفلترة
    const q       = toolbar && toolbar.querySelector('#sa_q');
    const date    = toolbar && toolbar.querySelector('#sa_date');
    const today   = toolbar && toolbar.querySelector('#sa_today');
    const due7    = toolbar && toolbar.querySelector('#sa_due7');
    const dpydSel = toolbar && toolbar.querySelector('#sa_dpyd');
    const sevSel  = toolbar && toolbar.querySelector('#sa_severity');

    updateSavedAssessmentsBadge('—');

    function apply(){
      const filters = {
        q: (q && q.value || '').trim(),
        date: (date && date.value || '').trim(),
        today: !!(today && today.checked),
        due7: !!(due7 && due7.checked),
        dpyd: (dpydSel && dpydSel.value) || '',
        severity: (sevSel && sevSel.value) || ''
      };
      const filtered = rows.filter(r => rowMatchesFilters(r, filters));
      sortByDueThenName(filtered);
      renderRows(tbody, filtered, api);
      updateSavedAssessmentsBadge(filtered.length);
    }

    const api = {
      onEdit: (row)=> {
        const oldRow = { ...row };
        openEditAssessmentModal(row, async (patch)=>{
          const idx = rows.findIndex(r=> String(r.id) === String(row.id));
          if (idx < 0) throw new Error('Row not found');

          const updated = { ...rows[idx], ...patch };
          if (patch.assessment_date) updated.assessment_date = normalizeToDMY(patch.assessment_date);
          rows[idx] = updated;
          apply();

          try{
            if (!window.SheetsAPI || !window.SheetsAPI.updateAssessmentFields){
              throw new Error('SheetsAPI.updateAssessmentFields not available');
            }
            await window.SheetsAPI.updateAssessmentFields(row.id, patch);
          }catch(e){
            rows[idx] = oldRow;
            apply();
            throw e;
          }
        });
      }
    };

    if (q)       q.addEventListener('input',  apply);
    if (date)    date.addEventListener('change', apply);
    if (today)   today.addEventListener('change', apply);
    if (due7)    due7.addEventListener('change', apply);
    if (dpydSel) dpydSel.addEventListener('change', apply);
    if (sevSel)  sevSel.addEventListener('change', apply);

    apply();
  }

  /* ---------- Public API ---------- */
  const DomHelpers = { renderSavedAssessments, normalizeToDMY };
  if (typeof window!=='undefined') window.DomHelpers = DomHelpers;
  if (typeof module!=='undefined' && module.exports) module.exports = DomHelpers;

  // لا تشغيل لأي ريزاين/زووم هنا — التحكم بالحجم صار CSS `resize: both`
})();
