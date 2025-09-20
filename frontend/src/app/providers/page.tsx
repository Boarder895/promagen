'use client';

import * as React from 'react';
import PROVIDERS from '@/lib/providers';
import { fetchProviders, getApiBase, type RemoteProvider, checkHealth } from '@/lib/api';

/**
 * ALL FREE FEATURES in one file:
 * - saved views (localStorage)
 * - column picker + simple reorder
 * - cmd/ctrl-K fuzzy search overlay
 * - side-by-side compare (prod vs staging / custom)
 * - inline field edit & "copy env patch"
 * - light schema validator (runtime) + optional Zod note
 * - duplicate highlighting
 * - accessibility improvements
 * - print stylesheet
 *
 * Drop this file in place, run `npm run dev` and open /providers
 */

/* -------------------- small helpers -------------------- */
const norm = (v: unknown) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v));

type Row = {
  id: string;
  name: string;
  href: string;
  slogan?: string;
  kind: string | string[];
  icon?: string;
  tags?: string[];
  rel?: string;
};

/* UI columns and keys */
const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'icon', label: 'Icon' },
  { key: 'kind', label: 'Kinds' },
  { key: 'tags', label: 'Tags' },
  { key: 'href', label: 'Href' },
  { key: 'slogan', label: 'Slogan' },
  { key: 'rel', label: 'Rel' },
  { key: 'drift', label: 'Drift' },
];

/* localStorage keys */
const LS_KEYS = {
  SAVED_VIEWS: 'providers.savedViews',
  ACTIVE_VIEW: 'providers.activeView',
  COLUMNS_PREF: 'providers.columns',
  VIEW_STATE: 'providers.viewState',
};

/* small fuzzy score (cheap, no deps) */
function fuzzyScore(a: string, b: string) {
  // lower is better; we want higher score for better match — invert at use
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 100;
  if (a.includes(b)) return 60 + (b.length / a.length) * 40;
  if (a.startsWith(b)) return 80 + (b.length / a.length) * 20;
  let score = 0;
  let bi = 0;
  for (let ai = 0; ai < a.length && bi < b.length; ai++) {
    if (a[ai] === b[bi]) { score += 1; bi++; }
  }
  return score;
}

/* simple runtime validator (use Zod for stronger validation if you want) */
function validateProvidersShape(list: unknown[]): string[] {
  const errs: string[] = [];
  if (!Array.isArray(list)) { errs.push('Payload is not an array'); return errs; }
  list.forEach((p, i) => {
    if (typeof p !== 'object' || p === null) { errs.push(`item[${i}] not object`); return; }
    const id = (p as any).id;
    const name = (p as any).name;
    const href = (p as any).href;
    const kind = (p as any).kind;
    if (!id || typeof id !== 'string') errs.push(`item[${i}].id missing or not string`);
    if (!name || typeof name !== 'string') errs.push(`item[${i}].name missing or not string`);
    if (!href || typeof href !== 'string') errs.push(`item[${i}].href missing or not string`);
    if (!(typeof kind === 'string' || Array.isArray(kind))) errs.push(`item[${i}].kind missing or not string/array`);
  });
  return errs;
}

/* -------------------- component -------------------- */
export default function ProvidersAdminPage() {
  // API bases
  const defaultApiBase = getApiBase();
  const [apiBase, setApiBase] = React.useState<string>(defaultApiBase);
  const [stagingBase, setStagingBase] = React.useState<string>('https://promagen-api.fly.dev');

  // data state
  const [server, setServer] = React.useState<RemoteProvider[] | null>(null);
  const [serverStaging, setServerStaging] = React.useState<RemoteProvider[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // UI state
  const [query, setQuery] = React.useState('');
  const [showSearchOverlay, setShowSearchOverlay] = React.useState(false);
  const [activeColumns, setActiveColumns] = React.useState<string[]>(
    () => JSON.parse(localStorage.getItem(LS_KEYS.COLUMNS_PREF) || 'null') || ALL_COLUMNS.map(c => c.key)
  );
  const [savedViews, setSavedViews] = React.useState<Record<string, any>>(
    () => JSON.parse(localStorage.getItem(LS_KEYS.SAVED_VIEWS) || '{}')
  );
  const [activeView, setActiveView] = React.useState<string | null>(
    () => localStorage.getItem(LS_KEYS.ACTIVE_VIEW) || null
  );
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');
  const [showDriftOnly, setShowDriftOnly] = React.useState(false);
  const [editing, setEditing] = React.useState<{ id: string; field: string } | null>(null);
  const [inlineEdits, setInlineEdits] = React.useState<Record<string, Partial<Row>>>({});
  const [toast, setToast] = React.useState<string | null>(null);
  const [validateErrors, setValidateErrors] = React.useState<string[]>([]);

  // duplicates highlight
  const [dupIds, setDupIds] = React.useState<Set<string>>(new Set());
  const [dupNames, setDupNames] = React.useState<Set<string>>(new Set());

  // load initial
  React.useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------------------- data actions -------------------- */
  async function reload(base = apiBase) {
    setError(null);
    try {
      const list = await fetchProviders(base);
      setServer(list.length ? list : []);
      // basic validation
      const errs = validateProvidersShape(list);
      setValidateErrors(errs);
      // dup checks
      computeDupChecks(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch providers');
      setServer([]);
    }
  }

  async function reloadStaging(base = stagingBase) {
    try {
      const list = await fetchProviders(base);
      setServerStaging(list);
    } catch {
      setServerStaging([]);
    }
  }

  /* -------------------- duplication -------------------- */
  function computeDupChecks(list: RemoteProvider[]|null) {
    if (!list) { setDupIds(new Set()); setDupNames(new Set()); return; }
    const idCount = new Map<string, number>();
    const nameCount = new Map<string, number>();
    for (const p of list) {
      idCount.set(p.id, (idCount.get(p.id) || 0) + 1);
      nameCount.set(p.name, (nameCount.get(p.name) || 0) + 1);
    }
    setDupIds(new Set([...idCount.entries()].filter(([k,v]) => v>1).map(([k])=>k)));
    setDupNames(new Set([...nameCount.entries()].filter(([k,v]) => v>1).map(([k])=>k)));
  }

  /* -------------------- saved views -------------------- */
  function saveView(name: string) {
    const view = {
      query, sortKey, sortDir, showDriftOnly, columns: activeColumns
    };
    const next = { ...savedViews, [name]: view };
    setSavedViews(next);
    localStorage.setItem(LS_KEYS.SAVED_VIEWS, JSON.stringify(next));
    localStorage.setItem(LS_KEYS.ACTIVE_VIEW, name);
    setActiveView(name);
    notify(`Saved view "${name}"`);
  }
  function applyView(name: string) {
    const v = savedViews[name];
    if (!v) return;
    setQuery(v.query || '');
    setSortKey(v.sortKey || 'name');
    setSortDir(v.sortDir || 'asc');
    setShowDriftOnly(!!v.showDriftOnly);
    setActiveColumns(v.columns || ALL_COLUMNS.map(c=>c.key));
    localStorage.setItem(LS_KEYS.ACTIVE_VIEW, name);
    setActiveView(name);
    notify(`Applied view "${name}"`);
  }
  function deleteView(name: string) {
    const copy = { ...savedViews }; delete copy[name];
    setSavedViews(copy);
    localStorage.setItem(LS_KEYS.SAVED_VIEWS, JSON.stringify(copy));
    if (activeView === name) { localStorage.removeItem(LS_KEYS.ACTIVE_VIEW); setActiveView(null); }
    notify(`Deleted view "${name}"`);
  }

  /* -------------------- columns picker -------------------- */
  function toggleColumn(col: string) {
    const next = activeColumns.includes(col) ? activeColumns.filter(c=>c!==col) : [...activeColumns, col];
    setActiveColumns(next);
    localStorage.setItem(LS_KEYS.COLUMNS_PREF, JSON.stringify(next));
  }
  function moveColumn(col: string, dir: 'left'|'right') {
    const idx = activeColumns.indexOf(col);
    if (idx === -1) return;
    const swap = (i:number, j:number) => {
      const arr = [...activeColumns];
      const t = arr[i]; arr[i]=arr[j]; arr[j]=t;
      setActiveColumns(arr); localStorage.setItem(LS_KEYS.COLUMNS_PREF, JSON.stringify(arr));
    };
    if (dir==='left' && idx>0) swap(idx, idx-1);
    if (dir==='right' && idx<activeColumns.length-1) swap(idx, idx+1);
  }

  /* -------------------- inline edit & env patch -------------------- */
  function beginEdit(id: string, field: string) { setEditing({id, field}); }
  function commitEdit(id: string, field: string, value: any) {
    setInlineEdits(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [field]: value } }));
    setEditing(null);
  }
  function copyEnvPatchForRow(id: string) {
    const rowOrig = (server || []).find(s=>s.id===id);
    const edit = inlineEdits[id] || {};
    const merged = { ...(rowOrig || {}), ...edit };
    // produce small patch example lines (env-style)
    const lines: string[] = [];
    lines.push(`# Provider ${id}`);
    lines.push(`PROVIDER_${id.toUpperCase()}_NAME="${merged.name || ''}"`);
    lines.push(`PROVIDER_${id.toUpperCase()}_HREF="${merged.href || ''}"`);
    const text = lines.join('\n');
    copyToClipboard(text);
    notify('Env patch copied for provider '+id);
  }
  function copyToClipboard(text: string) {
    if (!navigator?.clipboard) {
      // fallback: create element
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      return;
    }
    navigator.clipboard.writeText(text).catch(()=>{});
  }

  /* -------------------- fuzzy search overlay -------------------- */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k') {
        e.preventDefault(); setShowSearchOverlay(s => !s);
      }
      if (e.key === 'Escape') setShowSearchOverlay(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* -------------------- small UX -------------------- */
  function notify(msg: string) { setToast(msg); setTimeout(()=>setToast(null), 2500); }

  /* -------------------- derived lists -------------------- */
  const mergedList: (RemoteProvider & { _edited?: Partial<Row> })[] = React.useMemo(() => {
    if (!server) return [];
    const arr = server.map(s => ({ ...s, _edited: inlineEdits[s.id] || undefined }));
    return arr;
  }, [server, inlineEdits]);

  // apply query & sort & drift filter
  const filteredSorted = React.useMemo(() => {
    let list = mergedList.slice();
    if (query) {
      const q = query.trim().toLowerCase();
      list = list.map(p => ({ p, score:
        Math.max(
          fuzzyScore(p.name || '', q),
          fuzzyScore(p.id || '', q),
          fuzzyScore((p.tags||[]).join(' '), q),
          fuzzyScore((Array.isArray(p.kind)?p.kind.join(' '):p.kind||''), q)
        )
      }))
      .filter(x => x.score > 0)
      .sort((a,b)=>b.score-a.score)
      .map(x => x.p);
    }
    // mark drift: simple compare with local PROVIDERS by id
    list = list.map(item => {
      const lp = (PROVIDERS as any[]).find(p=>p.id===item.id);
      (item as any)._drift = !lp || JSON.stringify(lp) !== JSON.stringify({ ...item, ...((item as any)._edited||{})});
      return item;
    });
    if (showDriftOnly) list = list.filter(i => (i as any)._drift);
    // sort by key
    list.sort((a,b)=>{
      const A = String((a as any)[sortKey] ?? '').toLowerCase();
      const B = String((b as any)[sortKey] ?? '').toLowerCase();
      if (A === B) return 0;
      const cmp = A.localeCompare(B);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [mergedList, query, sortKey, sortDir, showDriftOnly]);

  /* -------------------- print stylesheet injection (simple) -------------------- */
  React.useEffect(()=> {
    const style = document.createElement('style');
    style.id = 'providers-print-styles';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #providers-print-area, #providers-print-area * { visibility: visible; }
        #providers-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return ()=> { document.head.removeChild(style); };
  }, []);

  /* -------------------- side-by-side compare toggles -------------------- */
  const [compareStaging, setCompareStaging] = React.useState(false);

  /* -------------------- UI render -------------------- */
  return (
    <main id="providers-print-area" style={{ padding: 16, maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Providers — admin (free features bundle)</h1>

      {/* top row: controls */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={()=> reload(apiBase)} aria-label="refresh" style={btn}>Refresh</button>

        <label style={label}>
          <input type="checkbox" checked={showDriftOnly} onChange={(e)=> setShowDriftOnly(e.target.checked)} /> Show drift only
        </label>

        <label style={label}>
          <input type="checkbox" checked={compareStaging} onChange={(e)=> {
            const on = e.target.checked; setCompareStaging(on);
            if (on) reloadStaging(stagingBase);
            else setServerStaging(null);
          }} /> Compare staging
        </label>

        <input placeholder="Quick search (or Ctrl/Cmd-K)" value={query} onChange={(e)=> setQuery(e.target.value)} aria-label="quick search" style={{padding:8,borderRadius:8,border:'1px solid #ddd', minWidth:220}} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { copyToClipboard(JSON.stringify(filteredSorted.map(p=> ({id:p.id, name:p.name})), null,2)); notify('IDs copied'); }} style={btn}>Copy IDs</button>
          <button onClick={() => copyToClipboard(JSON.stringify(PROVIDERS, null,2))} style={btn}>Copy Local JSON</button>
          <button onClick={() => copyToClipboard(JSON.stringify(server || [], null,2))} style={btn} disabled={!server}>Copy Live JSON</button>

          {/* saved views */}
          <select value={activeView || ''} onChange={(e)=> { if(e.target.value) applyView(e.target.value); }} style={{padding:6}}>
            <option value=''>Saved view…</option>
            {Object.keys(savedViews).map(k=> <option key={k} value={k}>{k}</option>)}
          </select>
          <button onClick={() => {
            const name = prompt('Save view as…')?.trim();
            if (name) saveView(name);
          }} style={btn}>Save view</button>
          <button onClick={() => {
            if (!activeView) return notify('No active view');
            if (confirm('Delete saved view "'+activeView +'"?')) deleteView(activeView);
          }} style={btn} className="no-print">Delete view</button>
        </div>
      </div>

      {/* columns picker */}
      <div style={{ marginTop: 10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:13, color:'#444' }}>Columns:</div>
        {ALL_COLUMNS.map(c => (
          <label key={c.key} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={activeColumns.includes(c.key)} onChange={()=> toggleColumn(c.key)} />
            <span style={{ fontSize:13 }}>{c.label}</span>
            {activeColumns.includes(c.key) && (
              <>
                <button onClick={()=> moveColumn(c.key,'left')} style={tinyBtn} aria-label={`move ${c.key} left`}>◀</button>
                <button onClick={()=> moveColumn(c.key,'right')} style={tinyBtn} aria-label={`move ${c.key} right`}>▶</button>
              </>
            )}
          </label>
        ))}
      </div>

      {/* validation & dup badges */}
      <div style={{ marginTop: 10, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:13 }}>{server ? `Live providers: ${server.length}` : 'Live providers: -'}</div>
        {validateErrors.length ? <div style={{ color:'#b91c1c' }}>Schema errors: {validateErrors.length}</div> : <div style={{ color:'#166534' }}>Schema OK</div>}
        {dupIds.size > 0 && <div style={{ color:'#b45309' }}>Duplicate IDs: {Array.from(dupIds).slice(0,3).join(', ')}{dupIds.size>3?` +${dupIds.size-3}`:''}</div>}
        {dupNames.size > 0 && <div style={{ color:'#b45309' }}>Duplicate names: {Array.from(dupNames).slice(0,3).join(', ')}{dupNames.size>3?` +${dupNames.size-3}`:''}</div>}
      </div>

      {/* table / main content */}
      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table role="table" style={{ width: '100%', borderCollapse:'separate', borderSpacing:0 }}>
          <thead>
            <tr>
              {activeColumns.map(colKey => (
                <th key={colKey} style={thStyle} onClick={()=> { if (colKey === sortKey) setSortDir(s=> s==='asc'?'desc':'asc'); setSortKey(colKey); }}>
                  {ALL_COLUMNS.find(c=>c.key===colKey)?.label} {sortKey===colKey ? (sortDir==='asc'?'▲':'▼') : ''}
                </th>
              ))}
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredSorted.map(row => {
              const isDupId = dupIds.has(row.id);
              const isDupName = dupNames.has(row.name);
              return (
                <tr key={row.id} style={{ background: (row as any)._drift ? '#fff8e6' : 'transparent' }}>
                  {activeColumns.map(colKey => {
                    if (colKey === 'id') return <td style={tdStyle}><code>{row.id}</code>{isDupId && <span style={{color:'#b91c1c', marginLeft:6}}>dup</span>}</td>;
                    if (colKey === 'name') return <td style={tdStyle}><span>{row.name}</span>{isDupName && <span style={{color:'#b91c1c', marginLeft:6}}>dup</span>}</td>;
                    if (colKey === 'icon') return <td style={tdStyle}>{row.icon ? <img src={row.icon} alt={`${row.name} logo`} style={{height:20,width:20}} /> : '—'}</td>;
                    if (colKey === 'kind') return <td style={tdStyle}>{Array.isArray(row.kind) ? row.kind.join(', ') : row.kind}</td>;
                    if (colKey === 'tags') return <td style={tdStyle}>{(row.tags || []).join?.(', ') ?? '—'}</td>;
                    if (colKey === 'href') return <td style={tdStyle}><a href={row.href} target="_blank" rel="noopener noreferrer">{row.href}</a></td>;
                    if (colKey === 'slogan') {
                      const editingThis = editing && editing.id===row.id && editing.field==='slogan';
                      const localEdit = inlineEdits[row.id]?.slogan;
                      return <td style={tdStyle}>
                        {editingThis ? <input autoFocus defaultValue={localEdit ?? row.slogan ?? ''} onBlur={(e)=> commitEdit(row.id,'slogan',e.currentTarget.value)} /> : <span onDoubleClick={()=> beginEdit(row.id,'slogan')}>{localEdit ?? row.slogan ?? '—'}</span>}
                      </td>;
                    }
                    if (colKey === 'rel') return <td style={tdStyle}><code>{row.rel ?? '—'}</code></td>;
                    if (colKey === 'drift') return <td style={tdStyle}>{(row as any)._drift ? <span style={{color:'#92400e'}}>drift</span> : <span style={{color:'#166534'}}>ok</span>}</td>;
                    return <td style={tdStyle}>—</td>;
                  })}
                  <td style={tdStyle}>
                    <button onClick={()=> copyEnvPatchForRow(row.id)} style={tinyBtn}>Copy env</button>
                    <button onClick={()=> { setEditing({id: row.id, field: 'slogan'}); }} style={tinyBtn}>Edit</button>
                    <button onClick={()=> { setQuery(row.id); notify('Filtered to '+row.id); }} style={tinyBtn}>Filter</button>
                    <button onClick={()=> {
                      // open diff modal: simple JSON diff in new window for now
                      const lp = (PROVIDERS as any[]).find(p=>p.id===row.id) || {};
                      const rp = row || {};
                      const w = window.open('', '_blank', 'noopener');
                      if (w) {
                        w.document.title = `diff:${row.id}`;
                        w.document.body.innerHTML = `<pre style="font-family: monospace; white-space: pre-wrap;">LOCAL:\n${JSON.stringify(lp,null,2)}\n\nLIVE:\n${JSON.stringify(rp,null,2)}</pre>`;
                      }
                    }} style={tinyBtn}>Diff</button>
                  </td>
                </tr>
              );
            })}
            {filteredSorted.length === 0 && <tr><td colSpan={activeColumns.length+1} style={{ padding: 16, textAlign:'center', color:'#666' }}>No providers match</td></tr>}
          </tbody>
        </table>
      </div>

      {/* staging compare split */}
      {compareStaging && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
          <div>
            <h3 style={{ margin: '4px 0' }}>Live ({apiBase})</h3>
            <pre style={{ background:'#f7f7f7', padding:8, borderRadius:8, maxHeight:320, overflow:'auto' }}>{JSON.stringify(server || [], null, 2)}</pre>
          </div>
          <div>
            <h3 style={{ margin: '4px 0' }}>Staging ({stagingBase})</h3>
            <pre style={{ background:'#f7f7f7', padding:8, borderRadius:8, maxHeight:320, overflow:'auto' }}>{JSON.stringify(serverStaging || [], null, 2)}</pre>
          </div>
        </div>
      )}

      {/* search overlay */}
      {showSearchOverlay && (
        <div role="dialog" aria-modal="true" style={overlayStyle} onClick={()=> setShowSearchOverlay(false)}>
          <div style={{ background:'white', padding:12, borderRadius:8, width:'min(900px,96%)' }} onClick={(e)=> e.stopPropagation()}>
            <div style={{ display:'flex', gap:8 }}>
              <input autoFocus placeholder="Search providers (fuzzy)..." value={query} onChange={(e)=> setQuery(e.target.value)} style={{flex:1,padding:8}} />
              <button onClick={()=> setShowSearchOverlay(false)} style={btn}>Close</button>
            </div>
            <div style={{ marginTop:8 }}>
              {filteredSorted.slice(0,20).map(p => <div key={p.id} style={{ padding:6, borderBottom:'1px solid #eee' }}>
                <strong>{p.name}</strong> <code style={{ marginLeft: 8 }}>{p.id}</code> — {Array.isArray(p.kind) ? p.kind.join(', ') : p.kind}
              </div>)}
            </div>
          </div>
        </div>
      )}

      {/* small toast */}
      {toast && <div role="status" aria-live="polite" style={{ position:'fixed', right:20, bottom:20, background:'#0f172a', color:'white', padding:'8px 12px', borderRadius:8 }}>{toast}</div>}

      {/* footer: quick hints */}
      <div style={{ marginTop:16, color:'#666', fontSize:13 }}>
        <div>Tips: <kbd>Ctrl/Cmd-K</kbd> opens quick search. Double-click a slogan to edit. Use "Copy env" to get a small patch line for that provider.</div>
        <div style={{ marginTop:6 }}>Optional: for stronger validation, install <code>zod</code> and replace <code>validateProvidersShape</code> with a zod schema server-side verification as needed.</div>
      </div>
    </main>
  );
}

/* -------------------- styles -------------------- */
const btn: React.CSSProperties = { padding: '6px 10px', borderRadius:8, border:'1px solid #d1d5db', background:'#f3f4f6', cursor:'pointer' };
const tinyBtn: React.CSSProperties = { padding: '4px 8px', marginLeft:6, borderRadius:6, border:'1px solid #d1d5db', background:'#fff' };
const label: React.CSSProperties = { display:'inline-flex', gap:6, alignItems:'center', padding:'6px', border:'1px solid #eee', borderRadius:8, background:'#fafafa' };
const thStyle: React.CSSProperties = { textAlign:'left', padding:8, borderBottom:'1px solid #e6e6e6', background:'#fafafa', cursor:'pointer' };
const tdStyle: React.CSSProperties = { padding:8, borderBottom:'1px solid #f1f1f1' };
const overlayStyle: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 };
