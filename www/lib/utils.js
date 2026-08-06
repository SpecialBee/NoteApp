// Pure helper functions with no dependency on app state (no reference to `index`, `sb`,
// `currentId`, or any DOM element variable) — safe to load before app.js.
// colorForTag/depthOf/depthBucket depend on constants.js, so load this AFTER that file.
// Pulled out of index.html as part of splitting the single-file app into pieces.

// escapes both text-node and attribute-value special chars (", ') so this is safe to use
// anywhere the result lands in an HTML string, including quoted attributes like data-link="..."
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function serialOf(idx){ return '#' + String(idx+1).padStart(4,'0'); }
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function formatDate(ts){
  if(!ts) return '';
  const d = new Date(ts); const now = new Date();
  if(d.toDateString() === now.toDateString()) return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  return (d.getMonth()+1) + '/' + d.getDate();
}

function extractTags(content){
  const set = new Set(); const re = /(^|\s)#([a-zA-Z0-9가-힣_-]{1,24})/g; let m;
  while((m = re.exec(content))) set.add(m[2]);
  return Array.from(set);
}
function extractLinks(content){
  const set = new Set(); const re = /\[\[([^\]\n]+)\]\]/g; let m;
  while((m = re.exec(content))) set.add(m[1].trim());
  return Array.from(set);
}

function hexToRgb(hex){
  const n = parseInt(hex.replace('#',''), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
function mixHex(hexA, hexB, weightB){
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const rgb = a.map((c,i) => Math.round(c + (b[i]-c) * weightB));
  return '#' + rgb.map(c => c.toString(16).padStart(2,'0')).join('');
}

function csvEscape(v){
  const s = (v===null||v===undefined) ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}
function parseCsv(text){
  const rows=[]; let row=[], cur='', inQ=false;
  text = text.replace(/^﻿/,'');
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQ){
      if(ch==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else inQ=false; }
      else cur+=ch;
    } else {
      if(ch==='"') inQ=true;
      else if(ch===','){ row.push(cur); cur=''; }
      else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if(ch==='\r'){ /* skip */ }
      else cur+=ch;
    }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r => r.length && !(r.length===1 && r[0]===''));
}

function genPropId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function detectNoteType(content){
  const c = (content||'').trimStart();
  if(c.startsWith('```canvas')) return 'canvas';
  if(c.startsWith('```table')) return 'table';
  return 'note';
}
function isCanvasNote(note){ return note.type ? note.type==='canvas' : (note.content||'').trimStart().startsWith('```canvas'); }
function isTableNote(note){ return note.type ? note.type==='table' : (note.content||'').trimStart().startsWith('```table'); }

function noteColor(note){ const c=(note.properties||[]).find(p=>p.id==='__color'); return c?c.value:null; }

function parseTableContent(content){
  const m = (content||'').match(/```table\n?([\s\S]*?)```/);
  if(!m) return { columns:[], rows:[] };
  try { return JSON.parse(m[1].trim()) || { columns:[], rows:[] }; }
  catch { return { columns:[], rows:[] }; }
}

function colorForTag(tag){
  if(!tag) return 'var(--ink-faint)';
  let hash = 0;
  for(let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// fake-3D depth: each note gets a stable pseudo-random depth (0=far, 1=near) from
// its id, so the "layer" a note sits on doesn't shuffle every time the graph redraws
function depthOf(id){
  let hash = 0;
  for(let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  // avalanche mix so similarly-suffixed ids (e.g. sequential ids) still spread across depth buckets.
  // XOR returns a signed int32, so the final XOR can flip the sign bit back on - force unsigned
  // before the modulo, or a negative hash silently makes depthBucket() return undefined.
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x45d9f3b) >>> 0; hash ^= hash >>> 16;
  hash = hash >>> 0;
  return (hash % 1000) / 1000;
}
function depthBucket(z){ return DEPTH_BUCKETS.find(b => z >= b.min) || DEPTH_BUCKETS[DEPTH_BUCKETS.length-1]; }
