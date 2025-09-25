(function(){
  'use strict';

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

  // Normalizer موحّد لعرض التواريخ
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

  // مواصفات الأعمدة — ننقل Phone/Regimen/Stage/Cancer type/Assessment date للمودال فقط
  function headersSpec(){
    return [
      { key:'name',            title:'Name' },                 // (Sticky + highlight)
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
    const scroll = el('div', { class:'sa-scroll-host', style:{ overflow:'auto', maxHeight:'420px', borderRadius:'var(--radius)', border:'1px solid var(--border)' }});
    const table = el('table', { class:'table', id:'sa_table', style:{ minWidth:'1100px' } });
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

  function renderRows(tbody, rows){
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
          const delBtn  = el('button', { class:'btn btn-danger btn-sm', title:'Delete', onclick:(ev)=>{ev.stopPropagation(); window.tryDeleteAssessment && window.tryDeleteAssessment(r.id);} }, '🗑️');
          tds.push(el('td', null, el('div', { class:'flex items-center gap-1' }, callBtn, delBtn)));
          return;
        }
        if (h.key === '_dpyd'){
          tds.push(el('td', null, dpydCellValue(r)));
          return;
        }
        let val = r[h.key] ?? '';
        if (h.key === 'followup_due' || h.key === 'first_date_5fu') val = normalizeToDMY(val);
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

  // ===== شريط الأدوات والفلاتر =====
  function buildSavedHeader(toolbarHost){
    const wrap = el('div', { class: 'table-header' });
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'220px'} },
      el('label', null, 'Filter by name / ID / phone'),
      el('input', { id:'sa_q', type:'text', placeholder:'e.g., John or 1234', autocomplete:'off' })
    ));
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'180px'} },
      el('label', null, 'Review date'),
      el('input', { id:'sa_date', type:'date' })
    ));
    wrap.appendChild(el('label', { class:'filter-chip', title:'Show only rows due today' },
      el('input', { id:'sa_today', type:'checkbox', style:{marginRight:'6px'} }),
      'Today’s follow-up'
    ));
    if (toolbarHost) { toolbarHost.innerHTML=''; toolbarHost.appendChild(wrap); }
  }

  function dmyToSortable(s){ const m = String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}${m[2]}${m[1]}` : '99999999'; }
  function isTodayDMY(s){ const d=new Date(); const t=`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; return dmyToSortable(s)===dmyToSortable(t); }

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

  // تفاصيل الصف — نعرض Phone/Regimen/Stage/Cancer type/Assessment date هنا
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

  function renderSavedAssessments(hostSelectors, rawRows){
    let toolbar = $(hostSelectors.toolbar || '#saved_toolbar') || createToolbarAuto();
    let tableHost = $(hostSelectors.table || '#saved_table') || createTableAuto();

    const rows = (rawRows || []).map(r => {
      const c = Object.assign({}, r);
      c.assessment_date = normalizeToDMY(c.assessment_date);
      c.followup_due    = normalizeToDMY(c.followup_due);
      c.first_date_5fu  = normalizeToDMY(c.first_date_5fu);
      c.dpyd_present    = toText(c.dpyd_present);
      c.dpyd_type       = toText(c.dpyd_type);
      return c;
    });

    buildSavedHeader(toolbar);
    const { tbody } = makeTableHost(tableHost);

    const q     = toolbar.querySelector('#sa_q');
    const date  = toolbar.querySelector('#sa_date');
    const today = toolbar.querySelector('#sa_today');

    function apply(){
      const filters = {
        q: (q && q.value || '').trim(),
        date: (date && date.value || '').trim(),
        today: !!(today && today.checked),
      };
      const filtered = rows.filter(r => rowMatchesFilters(r, filters));
      sortByDueThenName(filtered);
      renderRows(tbody, filtered);
    }

    if (q)     q.addEventListener('input',  apply);
    if (date)  date.addEventListener('change', apply);
    if (today) today.addEventListener('change', apply);

    apply();
  }

  function createToolbarAuto(){ const host = el('div', { id:'saved_toolbar', class:'header-bar container' }); document.body.prepend(host); return host; }
  function createTableAuto(){ const host = el('div', { id:'saved_table', class:'container mt-2' }); document.body.appendChild(host); return host; }

  const DomHelpers = { renderSavedAssessments, normalizeToDMY };
  if (typeof window!=='undefined') window.DomHelpers = DomHelpers;
  if (typeof module!=='undefined' && module.exports) module.exports = DomHelpers;
})();
