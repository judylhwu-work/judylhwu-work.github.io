/* ─────────────────────────────────────────────────────────────────────────────
   Design Debug Panel  –  portfolio.judylhwu
   Toggle: backtick (`)   |   Inspect → click element → edit live
   ───────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SYSTEM = `You are a CSS design assistant for a portfolio website (plain HTML/CSS, no framework).

Design tokens:
- Primary green #278628 — nav "Judy Wu" text, back-links, labels, section h2s
- Border green  #5ca361 — nav bottom border
- Dark-mode green #75ec76 — labels and accents in dark mode
- Pink  #ff8ac3 — tags, gate submit background
- Light pink #ffc5e1 — hover backgrounds, tag fills
- Fonts: 'Karla' (display/headings), 'Public Sans' (body), 'Inter' (small-caps labels)

Respond with ONLY a css code block. No explanation unless explicitly asked. Keep changes minimal and targeted.`;

  // ── Module state ───────────────────────────────────────────────────────────
  let panel = null, visible = false;
  let inspectMode = false, selectedEl = null, hoverEl = null;
  let inspectBtn, elementBadge, controlsArea, chatHistory, chatInput, scratchEl, chatHintEl;
  let apiKey = sessionStorage.getItem('dbg-key') || '';
  let chatLog = []; // {role, content} history sent to API

  const originals = new Map(); // el → Map<prop, originalValue>
  const edits     = new Map(); // el → Map<prop, newValue>

  // ── Injected style elements ────────────────────────────────────────────────
  const hlStyle = mk('style');
  hlStyle.textContent = `
    .dbg-hover    { outline: 2px solid #75ec76 !important; outline-offset: 3px !important; cursor: crosshair !important; }
    .dbg-selected { outline: 2px solid #ff8ac3 !important; outline-offset: 3px !important; }
  `;
  const scStyle = mk('style');
  document.head.append(hlStyle, scStyle);

  // ── Utilities ──────────────────────────────────────────────────────────────
  function mk(tag)        { return document.createElement(tag); }
  function css(n, map)    { Object.assign(n.style, map); }

  function rgbToHex(rgb) {
    const m = rgb && rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m || (m[4] !== undefined && +m[4] === 0)) return null;
    return '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('');
  }

  function isTextEl(el) {
    const tags = new Set(['p','h1','h2','h3','h4','h5','h6','span','a','button',
      'label','li','td','th','strong','em','b','i','small','caption']);
    return tags.has(el.tagName.toLowerCase())
      || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  }

  function elLabel(el) {
    const tag = el.tagName.toLowerCase();
    const id  = el.id ? '#' + el.id : '';
    const cls = [...el.classList].filter(c => !c.startsWith('dbg-')).slice(0,3).map(c => '.'+c).join('');
    return tag + (id || cls) || tag;
  }

  function saveProp(el, prop, value) {
    if (!originals.has(el)) originals.set(el, new Map());
    if (!originals.get(el).has(prop)) {
      originals.get(el).set(prop, prop === '__text' ? el.textContent : el.style[prop]);
    }
    if (!edits.has(el)) edits.set(el, new Map());
    edits.get(el).set(prop, value);
    if (prop === '__text') el.textContent = value;
    else el.style[prop] = value;
  }

  // ── Inspect mode ───────────────────────────────────────────────────────────
  function startInspect() {
    inspectMode = true;
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('click', onClick, true);
    inspectBtn.textContent = 'Click an element…';
    css(inspectBtn, { background:'#1a2e1a', color:'#75ec76', borderColor:'#75ec76' });
  }

  function stopInspect() {
    inspectMode = false;
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('click', onClick, true);
    if (hoverEl) { hoverEl.classList.remove('dbg-hover'); hoverEl = null; }
    inspectBtn.textContent = 'Inspect element';
    css(inspectBtn, { background:'#2b303b', color:'#c8d0dc', borderColor:'#2b303b' });
  }

  function onHover(e) {
    if (panel && panel.contains(e.target)) return;
    if (hoverEl) hoverEl.classList.remove('dbg-hover');
    hoverEl = e.target;
    hoverEl.classList.add('dbg-hover');
  }

  function onClick(e) {
    if (panel && panel.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    stopInspect();
    pickEl(e.target);
  }

  function pickEl(target) {
    if (selectedEl) selectedEl.classList.remove('dbg-selected');
    selectedEl = target;
    selectedEl.classList.add('dbg-selected');
    renderControls(target);
  }

  function clearSelection() {
    if (selectedEl) selectedEl.classList.remove('dbg-selected');
    selectedEl = null;
    elementBadge.style.display = 'none';
    controlsArea.innerHTML = '';
    showHint();
  }

  function showHint() {
    const p = mk('p');
    p.textContent = 'Click "Inspect element", then click anything on the page.';
    css(p, { color:'#4d5563', fontSize:'11px', lineHeight:'1.6', margin:'0' });
    controlsArea.appendChild(p);
  }

  // ── Element controls ───────────────────────────────────────────────────────
  function renderControls(target) {
    const cs   = getComputedStyle(target);
    const text = isTextEl(target);

    elementBadge.textContent   = elLabel(target);
    elementBadge.style.display = 'block';
    controlsArea.innerHTML     = '';

    // Content
    if (target.childElementCount === 0 && target.textContent.trim()) {
      const orig = target.textContent;
      if (!originals.has(target)) originals.set(target, new Map());
      if (!originals.get(target).has('__text')) originals.get(target).set('__text', orig);
      controlsArea.appendChild(secBlock('Content', [
        taRow(orig, v => {
          if (!edits.has(target)) edits.set(target, new Map());
          edits.get(target).set('__text', v);
          target.textContent = v;
        }),
      ]));
    }

    // Colors
    const tc = text ? rgbToHex(cs.color) : null;
    const bg = rgbToHex(cs.backgroundColor);
    const bd = parseFloat(cs.borderTopWidth) > 0 ? rgbToHex(cs.borderTopColor) : null;
    const colRows = [];
    if (tc) colRows.push(colRow('Text',       tc,          v => saveProp(target, 'color', v)));
    colRows.push(       colRow('Background',  bg || '#fff', v => saveProp(target, 'backgroundColor', v), !bg));
    if (bd) colRows.push(colRow('Border',     bd,           v => saveProp(target, 'borderColor', v)));
    controlsArea.appendChild(secBlock('Colors', colRows));

    // Typography
    if (text) {
      const fs  = parseFloat(cs.fontSize);
      const lhR = cs.lineHeight;
      const lh  = lhR === 'normal' ? 1.5 : Math.round(parseFloat(lhR)/fs*100)/100;
      const ls  = parseFloat(cs.letterSpacing) || 0;
      controlsArea.appendChild(secBlock('Typography', [
        numRow('Font size',      fs,  'px',  8,  96, 1,    v => saveProp(target, 'fontSize', v+'px')),
        selRow('Weight', cs.fontWeight, ['100','200','300','400','500','600','700','800','900'],
               v => saveProp(target, 'fontWeight', v)),
        numRow('Line height',    lh,  '',    0.8, 3, 0.05, v => saveProp(target, 'lineHeight', String(v))),
        numRow('Letter spacing', ls,  'px', -2,  16, 0.5,  v => saveProp(target, 'letterSpacing', v+'px')),
      ]));
    }

    // Shape
    controlsArea.appendChild(secBlock('Shape', [
      numRow('Border radius', parseFloat(cs.borderTopLeftRadius)||0, 'px', 0, 64, 1,    v => saveProp(target, 'borderRadius', v+'px')),
      numRow('Opacity',       parseFloat(cs.opacity),                '',   0,  1, 0.05, v => saveProp(target, 'opacity', String(v))),
    ]));

    const back = chipBtn('← Re-inspect', '#2b2e36', '#9aa3b0');
    back.style.marginTop = '2px';
    back.onclick = () => { clearSelection(); startInspect(); };
    controlsArea.appendChild(back);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    if (!apiKey) { addChatBubble('system', 'Enter your Anthropic API key first.'); return; }

    chatInput.value = '';
    addChatBubble('user', msg);

    let ctx = `Page: ${location.pathname === '/' ? 'home' : location.pathname}`;
    if (selectedEl) {
      const cs = getComputedStyle(selectedEl);
      ctx += `\nSelected: ${elLabel(selectedEl)}, color: ${cs.color}, bg: ${cs.backgroundColor}, font-size: ${cs.fontSize}`;
    }

    chatLog.push({ role:'user', content: `${ctx}\n\nRequest: ${msg}` });
    const loadBubble = addChatBubble('assistant', '…');

    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM,
          messages: chatLog,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const reply = data.content[0].text;
      chatLog.push({ role:'assistant', content: reply });

      loadBubble.innerHTML = '';
      renderReply(loadBubble, reply);

      // auto-apply any css block
      const match = reply.match(/```css\n([\s\S]*?)```/);
      if (match) {
        scStyle.textContent = (scStyle.textContent + '\n' + match[1]).trim();
        if (scratchEl) scratchEl.value = scStyle.textContent;
      }
    } catch (err) {
      loadBubble.textContent = `Error: ${err.message}`;
      loadBubble.style.color = '#ff8888';
    }
  }

  function addChatBubble(role, text) {
    if (chatHintEl) { chatHintEl.remove(); chatHintEl = null; }
    const b = mk('div');
    b.textContent = text;
    css(b, {
      padding:'7px 9px', borderRadius:'7px', fontSize:'11px', lineHeight:'1.5',
      background: role==='user' ? '#1a2233' : role==='system' ? '#2a1b1b' : '#111827',
      color: role==='user' ? '#c8d0dc' : role==='system' ? '#ff8888' : '#a8d4a8',
      whiteSpace:'pre-wrap', wordBreak:'break-word',
    });
    chatHistory.appendChild(b);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return b;
  }

  function renderReply(el, text) {
    text.split(/(```css\n[\s\S]*?```)/g).forEach(part => {
      if (part.startsWith('```css')) {
        const pre = mk('pre');
        pre.textContent = part.replace(/^```css\n/, '').replace(/```$/, '');
        css(pre, { background:'#0d1017', border:'1px solid #2e3340', borderRadius:'4px',
          padding:'6px 8px', margin:'4px 0 0', fontSize:'10px', overflowX:'auto',
          color:'#75ec76', fontFamily:'monospace', whiteSpace:'pre' });
        el.appendChild(pre);
      } else if (part.trim()) {
        const span = mk('span'); span.textContent = part;
        el.appendChild(span);
      }
    });
  }

  // ── Control widgets ────────────────────────────────────────────────────────
  function secBlock(title, children) {
    const wrap = mk('div');
    const lbl  = mk('div'); lbl.textContent = title;
    css(lbl, { fontSize:'10px', fontWeight:'700', letterSpacing:'1.2px',
      textTransform:'uppercase', color:'#4d5563', marginBottom:'7px' });
    wrap.appendChild(lbl);
    const body = mk('div');
    css(body, { display:'flex', flexDirection:'column', gap:'6px' });
    children.forEach(c => body.appendChild(c));
    wrap.appendChild(body);
    return wrap;
  }

  function colRow(label, value, onChange, dimmed=false) {
    const row = mk('div'), lbl = mk('span'), right = mk('div');
    const sw  = mk('input'), hex = mk('span');
    css(row,   { display:'flex', alignItems:'center', justifyContent:'space-between' });
    css(right, { display:'flex', alignItems:'center', gap:'6px' });
    lbl.textContent = label;
    css(lbl, { color: dimmed ? '#3a3f4b' : '#6e7580' });
    sw.type = 'color'; sw.value = value;
    css(sw, { width:'24px', height:'20px', border:'1px solid #2e3340', borderRadius:'4px',
      padding:'0 1px', cursor:'pointer', background:'none', opacity: dimmed ? '0.3':'1' });
    hex.textContent = dimmed ? '—' : value;
    css(hex, { fontFamily:'monospace', fontSize:'11px', color:'#4d5563', width:'54px' });
    sw.addEventListener('input', e => {
      hex.textContent = e.target.value; sw.style.opacity='1'; lbl.style.color='#6e7580';
      onChange(e.target.value);
    });
    right.append(sw, hex); row.append(lbl, right);
    return row;
  }

  function numRow(label, value, unit, min, max, step, onChange) {
    const row=mk('div'), lbl=mk('span'), right=mk('div'), inp=mk('input');
    css(row,   { display:'flex', alignItems:'center', justifyContent:'space-between' });
    css(right, { display:'flex', alignItems:'center', gap:'4px' });
    lbl.textContent = label; lbl.style.color = '#6e7580';
    inp.type='number'; inp.value=Math.round(value*100)/100; inp.min=min; inp.max=max; inp.step=step;
    css(inp, { width:'48px', background:'#0d1017', border:'1px solid #2e3340', borderRadius:'4px',
      color:'#c8d0dc', fontFamily:'monospace', fontSize:'11px',
      padding:'2px 5px', textAlign:'right', outline:'none', boxSizing:'border-box' });
    inp.addEventListener('keydown', e => e.stopPropagation());
    inp.addEventListener('input', e => { const n=parseFloat(e.target.value); if(!isNaN(n)) onChange(n); });
    right.appendChild(inp);
    if (unit) { const u=mk('span'); u.textContent=unit; css(u,{color:'#4d5563',fontSize:'11px'}); right.appendChild(u); }
    row.append(lbl, right);
    return row;
  }

  function taRow(value, onChange) {
    const ta = mk('textarea'); ta.value = value;
    css(ta, { width:'100%', boxSizing:'border-box', minHeight:'52px',
      background:'#0d1017', border:'1px solid #2e3340', borderRadius:'6px',
      color:'#c8d0dc', fontFamily:'inherit', fontSize:'12px', lineHeight:'1.5',
      padding:'6px 8px', resize:'vertical', outline:'none', display:'block' });
    ta.addEventListener('keydown', e => e.stopPropagation());
    ta.addEventListener('input',   e => onChange(e.target.value));
    return ta;
  }

  function selRow(label, current, opts, onChange) {
    const row=mk('div'), lbl=mk('span'), sel=mk('select');
    css(row, { display:'flex', alignItems:'center', justifyContent:'space-between' });
    lbl.textContent=label; lbl.style.color='#6e7580';
    css(sel, { background:'#0d1017', border:'1px solid #2e3340', borderRadius:'4px',
      color:'#c8d0dc', fontSize:'11px', padding:'2px 4px', outline:'none', cursor:'pointer' });
    const norm = String(parseInt(current,10));
    opts.forEach(o => { const op=mk('option'); op.value=o; op.textContent=o; if(o===norm) op.selected=true; sel.appendChild(op); });
    sel.addEventListener('change', e => onChange(e.target.value));
    row.append(lbl, sel);
    return row;
  }

  function chipBtn(text, bg, color) {
    const b = mk('button'); b.textContent = text;
    css(b, { background:bg, border:`1px solid ${bg}`, borderRadius:'6px',
      color, fontFamily:'inherit', fontSize:'11px', padding:'4px 8px', cursor:'pointer' });
    return b;
  }

  function divider() {
    const hr = mk('hr');
    css(hr, { border:'none', borderTop:'1px solid #2e3340', margin:'0' });
    return hr;
  }

  function sectionLabel(text) {
    const d = mk('div'); d.textContent = text;
    css(d, { fontSize:'10px', fontWeight:'700', letterSpacing:'1.2px',
      textTransform:'uppercase', color:'#4d5563' });
    return d;
  }

  // ── Save / Reset ───────────────────────────────────────────────────────────
  function saveChanges() {
    const lines = [];
    edits.forEach((propMap, target) => {
      const cssLines = []; let textChange = null;
      propMap.forEach((v, prop) => {
        if (prop === '__text') textChange = v;
        else cssLines.push(`${prop.replace(/([A-Z])/g,'-$1').toLowerCase()}: ${v};`);
      });
      if (cssLines.length || textChange !== null) {
        lines.push(`/* ${elLabel(target)} */`);
        if (textChange !== null) lines.push(`/* text: "${textChange}" */`);
        cssLines.forEach(l => lines.push(l));
        lines.push('');
      }
    });
    const scratch = scratchEl ? scratchEl.value.trim() : '';
    if (scratch) { lines.push('/* css scratch */'); lines.push(scratch); lines.push(''); }
    const out = lines.join('\n').trim();
    if (!out) return;
    navigator.clipboard.writeText(out).then(() => {
      const btn = panel.querySelector('[data-action="save"]');
      if (btn) { const o=btn.textContent; btn.textContent='Copied ✓'; setTimeout(()=>btn.textContent=o, 1600); }
    }).catch(()=>{});
  }

  function resetAll() {
    originals.forEach((propMap, target) => {
      propMap.forEach((orig, prop) => {
        if (prop==='__text') target.textContent=orig; else target.style[prop]=orig;
      });
      target.classList.remove('dbg-selected','dbg-hover');
    });
    originals.clear(); edits.clear();
    scStyle.textContent = '';
    if (scratchEl) scratchEl.value = '';
    chatLog = [];
    if (chatHistory) {
      chatHistory.innerHTML = '';
      chatHintEl = mk('p');
      chatHintEl.textContent = apiKey ? 'Describe a change…' : 'Enter API key, then describe a change.';
      css(chatHintEl, { color:'#4d5563', fontSize:'11px', margin:'0' });
      chatHistory.appendChild(chatHintEl);
    }
    clearSelection();
  }

  // ── Panel construction ─────────────────────────────────────────────────────
  function buildPanel() {
    panel = mk('div'); panel.id = 'dbg-panel';
    css(panel, {
      position:'fixed', bottom:'20px', right:'20px', width:'280px',
      background:'#16191f', border:'1px solid #2e3340', borderRadius:'12px',
      fontFamily:"'Public Sans', system-ui, sans-serif", fontSize:'12px',
      color:'#c8d0dc', zIndex:'2147483647',
      boxShadow:'0 12px 40px rgba(0,0,0,0.65)', display:'none',
      maxHeight:'calc(100vh - 40px)', overflowY:'auto',
    });

    // header
    const head = mk('div');
    css(head, { display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'10px 14px', borderBottom:'1px solid #2e3340',
      position:'sticky', top:'0', background:'#16191f', zIndex:'1' });
    const title = mk('span'); title.textContent = '◆ Design Debug';
    css(title, { fontSize:'10px', fontWeight:'700', letterSpacing:'1.4px', textTransform:'uppercase', color:'#75ec76' });
    const closeBtn = mk('button'); closeBtn.textContent = '×';
    css(closeBtn, { background:'none', border:'none', color:'#4d5563', cursor:'pointer',
      fontSize:'16px', lineHeight:'1', padding:'0 2px', fontFamily:'inherit' });
    closeBtn.onclick = hide;
    head.append(title, closeBtn);
    panel.appendChild(head);

    // body
    const body = mk('div');
    css(body, { padding:'14px', display:'flex', flexDirection:'column', gap:'14px' });

    // ── 1. Inspect element ──
    inspectBtn = chipBtn('Inspect element', '#2b303b', '#c8d0dc');
    inspectBtn.onclick = () => { inspectMode ? stopInspect() : startInspect(); };
    body.appendChild(inspectBtn);

    // element badge
    elementBadge = mk('div');
    css(elementBadge, { fontFamily:'monospace', fontSize:'11px', color:'#75ec76',
      background:'#0d1017', border:'1px solid #2e3340', borderRadius:'4px',
      padding:'4px 8px', display:'none', wordBreak:'break-all', lineHeight:'1.4' });
    body.appendChild(elementBadge);

    // element controls
    controlsArea = mk('div');
    css(controlsArea, { display:'flex', flexDirection:'column', gap:'14px' });
    showHint();
    body.appendChild(controlsArea);

    // ── 2. Chat ──
    body.appendChild(divider());
    body.appendChild(sectionLabel('Chat'));

    // api key row
    const apiRow = mk('div');
    css(apiRow, { display: apiKey ? 'none' : 'flex', gap:'6px', alignItems:'center' });
    const apiInp = mk('input'); apiInp.type='password'; apiInp.placeholder='Anthropic API key'; apiInp.value=apiKey;
    css(apiInp, { flex:'1', background:'#0d1017', border:'1px solid #2e3340', borderRadius:'6px',
      color:'#c8d0dc', fontFamily:'monospace', fontSize:'11px', padding:'5px 8px', outline:'none', boxSizing:'border-box' });
    apiInp.addEventListener('keydown', e => e.stopPropagation());
    const setKeyBtn = chipBtn('Set', '#2b303b', '#9aa3b0');
    setKeyBtn.onclick = () => {
      apiKey = apiInp.value.trim();
      sessionStorage.setItem('dbg-key', apiKey);
      if (apiKey) { apiRow.style.display='none'; if(chatHintEl) chatHintEl.textContent='Describe a change…'; }
    };
    apiRow.append(apiInp, setKeyBtn);
    body.appendChild(apiRow);

    // chat history
    chatHistory = mk('div');
    css(chatHistory, { display:'flex', flexDirection:'column', gap:'6px',
      maxHeight:'160px', overflowY:'auto',
      background:'#0d1017', border:'1px solid #2e3340', borderRadius:'8px', padding:'8px' });
    chatHintEl = mk('p');
    chatHintEl.textContent = apiKey ? 'Describe a change…' : 'Enter API key above, then describe a change.';
    css(chatHintEl, { color:'#4d5563', fontSize:'11px', margin:'0' });
    chatHistory.appendChild(chatHintEl);
    body.appendChild(chatHistory);

    // chat input
    chatInput = mk('textarea');
    css(chatInput, { width:'100%', boxSizing:'border-box', height:'56px',
      background:'#0d1017', border:'1px solid #2e3340', borderRadius:'6px',
      color:'#c8d0dc', fontFamily:'inherit', fontSize:'12px',
      padding:'6px 8px', resize:'none', outline:'none', display:'block' });
    chatInput.placeholder = 'Make the nav text a darker green…';
    chatInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    body.appendChild(chatInput);

    const sendBtn = chipBtn('Send', '#1e2a1e', '#75ec76');
    sendBtn.style.alignSelf = 'flex-end';
    sendBtn.onclick = sendChat;
    body.appendChild(sendBtn);

    // ── 3. CSS Scratch ──
    body.appendChild(divider());
    body.appendChild(sectionLabel('CSS Scratch'));

    scratchEl = mk('textarea');
    css(scratchEl, { width:'100%', height:'64px', boxSizing:'border-box',
      background:'#0d1017', border:'1px solid #2e3340', borderRadius:'6px',
      color:'#c8d0dc', fontFamily:'monospace', fontSize:'11px',
      padding:'6px 8px', resize:'vertical', outline:'none', display:'block' });
    scratchEl.placeholder = '.nav-name { color: hotpink; }';
    scratchEl.addEventListener('keydown', e => e.stopPropagation());
    body.appendChild(scratchEl);

    const scratchBtns = mk('div');
    css(scratchBtns, { display:'flex', gap:'6px' });
    const applyBtn = chipBtn('Apply', '#1e2e1e', '#75ec76');
    const clearBtn = chipBtn('Clear', '#2b2e36', '#6e7580');
    applyBtn.onclick = () => { scStyle.textContent = scratchEl.value; };
    clearBtn.onclick = () => { scratchEl.value=''; scStyle.textContent=''; };
    scratchBtns.append(applyBtn, clearBtn);
    body.appendChild(scratchBtns);
    panel.appendChild(body);

    // ── footer ──
    const foot = mk('div');
    css(foot, { display:'flex', gap:'6px', padding:'0 14px 14px' });

    const resetBtn = chipBtn('Reset all changes', '#2a1b1b', '#ff8888');
    css(resetBtn, { flex:'1' });
    resetBtn.onclick = resetAll;

    const saveBtn = chipBtn('Save changes', '#1e2a1e', '#75ec76');
    saveBtn.dataset.action = 'save';
    css(saveBtn, { flex:'1' });
    saveBtn.onclick = saveChanges;

    foot.append(resetBtn, saveBtn);
    panel.appendChild(foot);
    document.body.appendChild(panel);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function show()   { if (!panel) buildPanel(); visible=true;  panel.style.display='block'; }
  function hide()   { visible=false; stopInspect(); if(panel) panel.style.display='none'; }
  function toggle() { visible ? hide() : show(); }

  document.addEventListener('keydown', e => {
    if (e.key==='`' && !e.ctrlKey && !e.metaKey && !e.altKey) toggle();
  });

})();
