// Pure canvas-card parsing/geometry helpers, shared by the interactive canvas editor
// (index.html's cev* code) and the read-only public share page (share.html), which has
// no cevGenId/cevIdCounter of its own — parseCanvasLegacy takes an optional id generator
// and falls back to a plain unique-enough one when none is given.

function parseCanvasContent(content, genId){
  const match = (content||'').match(/```canvas\n?([\s\S]*?)```/);
  if(!match) return { elements:[], connectors:[] };
  const raw0 = match[1].trim();
  if(raw0.startsWith('{')){
    try{
      const o = JSON.parse(raw0);
      return { elements: Array.isArray(o.elements)?o.elements:[], connectors: Array.isArray(o.connectors)?o.connectors:[] };
    }catch{ return { elements:[], connectors:[] }; }
  }
  return parseCanvasLegacy(match[1], genId);
}

// legacy @-directive format (pre-JSON canvases still load)
function parseCanvasLegacy(raw, genId){
  genId = genId || ((prefix) => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  const elements = [], connectors = [];
  const lines = raw.split('\n');
  let cur = null, textLines = [];
  const flush = () => {
    if(cur){
      const t = textLines.join('\n').trim();
      if(cur.type==='section') cur.label = t || '섹션';
      else cur.text = t;
      elements.push(cur); cur=null; textLines=[];
    }
  };
  for(const line of lines){
    if(line.startsWith('@sticky')){ flush(); const p=line.split(' '); cur={id:p[1],type:'sticky',x:+p[2],y:+p[3],w:+p[4]||200,h:+p[5]||160,color:p[6]||'#FFE066',text:''}; }
    else if(line.startsWith('@section')){ flush(); const p=line.split(' '); cur={id:p[1],type:'section',x:+p[2],y:+p[3],w:+p[4]||300,h:+p[5]||200,color:p[6]||'#82C4F8',label:''}; }
    else if(line.startsWith('@rect')){ flush(); const p=line.split(' '); cur={id:p[1],type:'rect',x:+p[2],y:+p[3],w:+p[4]||180,h:+p[5]||100,color:p[6]||'#E8E8E8',text:''}; }
    else if(line.startsWith('@circle')){ flush(); const p=line.split(' '); cur={id:p[1],type:'circle',x:+p[2],y:+p[3],r:+p[4]||60,color:p[5]||'#E8E8E8',text:''}; }
    else if(line.startsWith('@diamond')){ flush(); const p=line.split(' '); cur={id:p[1],type:'diamond',x:+p[2],y:+p[3],w:+p[4]||100,h:+p[5]||100,color:p[6]||'#E8E8E8',text:''}; }
    else if(line.startsWith('@text')){ flush(); const p=line.split(' '); cur={id:p[1],type:'text',x:+p[2],y:+p[3],w:120,h:30,color:'',text:''}; }
    else if(line.startsWith('@arrow ')){ flush(); const p=line.split(' '); const li=p.indexOf('|'); connectors.push({id:genId('c'),type:'arrow',from:p[1],to:p[2],fromSide:p[3]||null,toSide:p[4]||null,label:li>0?p.slice(li+1).join(' ').trim():''}); }
    else if(line.startsWith('@dashed-arrow ')){ flush(); const p=line.split(' '); const li=p.indexOf('|'); connectors.push({id:genId('c'),type:'dashed-arrow',from:p[1],to:p[2],fromSide:p[3]||null,toSide:p[4]||null,label:li>0?p.slice(li+1).join(' ').trim():''}); }
    else if(line.startsWith('@dashed ')){ flush(); const p=line.split(' '); const li=p.indexOf('|'); connectors.push({id:genId('c'),type:'dashed',from:p[1],to:p[2],fromSide:p[3]||null,toSide:p[4]||null,label:li>0?p.slice(li+1).join(' ').trim():''}); }
    else if(line.startsWith('@line ')){ flush(); const p=line.split(' '); if(p[1]&&isNaN(+p[1])){ const li=p.indexOf('|'); connectors.push({id:genId('c'),type:'line',from:p[1],to:p[2],fromSide:p[3]||null,toSide:p[4]||null,label:li>0?p.slice(li+1).join(' ').trim():''}); } else connectors.push({id:genId('c'),type:'line',x1:+p[1],y1:+p[2],x2:+p[3],y2:+p[4],label:''}); }
    else if(cur){ textLines.push(line.startsWith('\\@') ? line.slice(1) : line); }
  }
  flush();
  return { elements, connectors };
}

function cevElCenter(edata){ if(edata.type==='circle') return {x:edata.x,y:edata.y}; return {x:edata.x+(edata.w||120)/2,y:edata.y+(edata.h||80)/2}; }
function cevElBorderPt(edata, dir){
  if(edata.type==='circle'){ const r=edata.r||60; return {x:edata.x+dir.dx*r,y:edata.y+dir.dy*r}; }
  const hw=(edata.w||120)/2,hh=(edata.h||80)/2,cx=edata.x+hw,cy=edata.y+hh;
  const abs=(v)=>v<0?-v:v;
  if(abs(dir.dx)<0.001) return {x:cx,y:cy+(dir.dy>0?hh:-hh)};
  if(abs(dir.dy)<0.001) return {x:cx+(dir.dx>0?hw:-hw),y:cy};
  const t=Math.min(hw/abs(dir.dx),hh/abs(dir.dy));
  return {x:cx+dir.dx*t,y:cy+dir.dy*t};
}
function cevConnPoints(fromEl, toEl){
  const fc=cevElCenter(fromEl),tc=cevElCenter(toEl),dx=tc.x-fc.x,dy=tc.y-fc.y,len=Math.sqrt(dx*dx+dy*dy)||1;
  const dir={dx:dx/len,dy:dy/len};
  return {x1:cevElBorderPt(fromEl,dir).x,y1:cevElBorderPt(fromEl,dir).y,x2:cevElBorderPt(toEl,{dx:-dir.dx,dy:-dir.dy}).x,y2:cevElBorderPt(toEl,{dx:-dir.dx,dy:-dir.dy}).y};
}

function cevGetAnchorPos(edata, side){
  if(edata.type==='circle'){
    const r=edata.r||60;
    if(side==='n') return {x:edata.x,     y:edata.y-r};
    if(side==='s') return {x:edata.x,     y:edata.y+r};
    if(side==='w') return {x:edata.x-r,   y:edata.y};
    if(side==='e') return {x:edata.x+r,   y:edata.y};
    return {x:edata.x, y:edata.y};
  }
  const w=edata.w||120, h=edata.h||80;
  const cx=edata.x+w/2, cy=edata.y+h/2;
  if(side==='n') return {x:cx,          y:edata.y};
  if(side==='s') return {x:cx,          y:edata.y+h};
  if(side==='w') return {x:edata.x,     y:cy};
  if(side==='e') return {x:edata.x+w,   y:cy};
  return {x:cx, y:cy};
}

function cevSideDir(side){
  if(side==='n') return {x:0,  y:-1};
  if(side==='s') return {x:0,  y:1};
  if(side==='w') return {x:-1, y:0};
  if(side==='e') return {x:1,  y:0};
  return {x:1, y:0};
}

function cevClosestSide(edata, cx, cy){
  let best='w', bestDist=Infinity;
  for(const s of ['n','s','e','w']){
    const p=cevGetAnchorPos(edata,s);
    const d=(cx-p.x)**2+(cy-p.y)**2;
    if(d<bestDist){ bestDist=d; best=s; }
  }
  return best;
}

function cevBezierPath(p1, fromSide, p2, toSide){
  const dist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2);
  const offset=Math.max(40, Math.min(dist*0.42, 160));
  const d1=cevSideDir(fromSide), d2=cevSideDir(toSide);
  const cp1x=p1.x+d1.x*offset, cp1y=p1.y+d1.y*offset;
  const cp2x=p2.x+d2.x*offset, cp2y=p2.y+d2.y*offset;
  return {
    path:`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`,
    midX:0.125*p1.x+0.375*cp1x+0.375*cp2x+0.125*p2.x,
    midY:0.125*p1.y+0.375*cp1y+0.375*cp2y+0.125*p2.y
  };
}

function cevShadeColor(hex, pct){
  try{ let n=parseInt((hex||'#9CA3AF').replace(/^var\(.*\)/,'#9CA3AF').slice(1),16); if(isNaN(n)) n=0x9CA3AF; const r=Math.max(0,Math.min(255,(n>>16)+pct)),g=Math.max(0,Math.min(255,((n>>8)&0xff)+pct)),b=Math.max(0,Math.min(255,(n&0xff)+pct)); return `rgb(${r},${g},${b})`; }catch(e){ return '#9CA3AF'; }
}
