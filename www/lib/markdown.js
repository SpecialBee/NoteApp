// Pure markdown -> HTML renderer, extracted so the note editor's read/write preview and the
// public read-only share page (share.html) can render identically without share.html having
// to load the whole app. No dependency on app state: wikilink validity is decided by an
// optional injected resolver (findNoteByTitle in the main app) rather than a note index this
// file would otherwise need to own. escapeHtml comes from utils.js, loaded before this file.

// parses a block of consecutive "- " / "1. " list lines (indent = nesting depth, 2 spaces per level)
// into a tree, then renders properly nested <ul>/<ol> html (sub-lists live inside their parent <li>)
function buildListHtml(block){
  const lines = block.replace(/\n$/, '').split('\n');
  const items = lines.map(line => {
    const m = line.match(/^([ \t]*)(-|\d+\.)[ \t]+(.*)$/);
    const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
    const ordered = m[2] !== '-';
    // keep the number the user actually typed, not just "this is ordered" — see renderList
    return { depth, ordered, num: ordered ? parseInt(m[2], 10) : null, text: m[3] };
  });

  const root = [];
  const stack = [{ depth: -1, list: root }];
  items.forEach(item => {
    while(stack.length && stack[stack.length - 1].depth >= item.depth) stack.pop();
    const node = { ordered: item.ordered, num: item.num, text: item.text, children: [] };
    stack[stack.length - 1].list.push(node);
    stack.push({ depth: item.depth, list: node.children });
  });

  function renderList(nodes){
    let html = '', i = 0;
    while(i < nodes.length){
      const ordered = nodes[i].ordered;
      // A bare <ol> always renumbers from 1. Anything that ends one list and starts another —
      // a blank line between items, or a "- " bullet in between — therefore restarted the
      // count, so a note written 1. / 2. / 3. with gaps rendered as 1. / 1. / 1.
      // Emitting the typed starting number as `start` keeps the sequence, and matches how
      // standard markdown treats the first number of an ordered list.
      const startNum = ordered ? nodes[i].num : null;
      let run = '';
      while(i < nodes.length && nodes[i].ordered === ordered){
        run += '<li>' + nodes[i].text + renderList(nodes[i].children) + '</li>';
        i++;
      }
      if(ordered) html += (startNum && startNum !== 1 ? `<ol start="${startNum}">` : '<ol>') + run + '</ol>';
      else html += '<ul>' + run + '</ul>';
    }
    return html;
  }
  return renderList(root);
}

// resolveWikilink(title) -> truthy if the title matches a real note, used only to style a
// [[link]] as valid vs. dangling. Omit it (share.html has no note index to check against) and
// every wikilink renders in its plain "known" style.
function renderNoteMarkdown(content, resolveWikilink){
  let s = escapeHtml(content || '');
  let taskCounter = 0;

  // fenced code blocks first
  s = s.replace(/```([\s\S]*?)```/g, (full, code) => `<pre><code>${code.trim()}</code></pre>`);

  s = s.replace(/\[\[([^\]\n]+)\]\]/g, (full, title) => {
    // O(1) map lookup, not a scan of every note — this runs per wikilink on every keystroke
    const known = resolveWikilink ? !!resolveWikilink(title) : true;
    const cls = known ? 'wikilink' : 'wikilink missing';
    return `<span class="${cls}" data-link="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</span>`;
  });

  // must run before the plain link regex below — without consuming the leading "!", that
  // regex would still match the "[alt](url)" part of an image and turn it into a link with a
  // stray "!" left in front of it
  s = s.replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, (full, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" class="md-img">`);

  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (full, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);

  s = s.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  s = s.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  s = s.replace(/(?:^&gt; .*(?:\n|$))+/gm, block => {
    const lines = block.trim().split('\n').map(l => l.replace(/^&gt;\s?/, ''));
    const calloutMatch = lines[0].match(/^\[!(note|tip|warning|danger)\]\s*(.*)$/i);
    if(calloutMatch){
      const type = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2] || (type.charAt(0).toUpperCase() + type.slice(1));
      const body = lines.slice(1).join('<br>');
      return `<div class="callout callout-${type}"><div class="callout-title">${title}</div>${body ? ('<div class="callout-body">' + body + '</div>') : ''}</div>\n`;
    }
    return '<blockquote>' + lines.join('<br>') + '</blockquote>\n';
  });

  s = s.replace(/(?:^- \[[ xX]\] .*(?:\n|$))+/gm, block => {
    const items = block.trim().split('\n').map(line => {
      const mm = line.match(/^- \[([ xX])\] (.*)$/);
      const checked = mm[1].toLowerCase() === 'x';
      const idx = taskCounter++;
      return `<li class="task"><label><input type="checkbox" class="taskbox" data-idx="${idx}" ${checked ? 'checked' : ''}><span>${mm[2]}</span></label></li>`;
    }).join('');
    return '<ul class="tasklist">' + items + '</ul>\n';
  });

  s = s.replace(/(?:^[ \t]*(?:-|\d+\.)[ \t]+.*(?:\n|$))+/gm, block => buildListHtml(block) + '\n');

  let tableIdx = -1;
  s = s.replace(/(?:^\|.*\|[ \t]*\n?)+/gm, block => {
    const lines = block.trim().split('\n');
    if(lines.length < 2 || !/^\|?[\s:|-]+\|?$/.test(lines[1])) return block;
    tableIdx++;
    const tIdx = tableIdx;
    const parseRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    // column alignment, standard markdown separator syntax (:--- / :---: / ---:)
    const aligns = parseRow(lines[1]).map(seg => {
      if(/^:.*:$/.test(seg)) return 'center';
      if(/:$/.test(seg)) return 'right';
      if(/^:/.test(seg)) return 'left';
      return '';
    });
    // per-cell background color, a small non-standard extension: a leading
    // {{bg:#hex}} marker (curly braces survive escapeHtml, unlike <!-- --> or [[ ]])
    // that this renderer strips and turns into the cell's background style.
    const cellHtml = (raw, ci) => {
      const bgm = raw.match(/^\{\{bg:(#[0-9a-fA-F]{3,8})\}\}([\s\S]*)$/);
      const bg = bgm ? bgm[1] : '';
      const text = bgm ? bgm[2] : raw;
      const styles = [];
      if(aligns[ci]) styles.push('text-align:' + aligns[ci]);
      if(bg) styles.push('background:' + bg);
      return { attr: styles.length ? ` style="${styles.join(';')}"` : '', text };
    };
    const header = parseRow(lines[0]);
    const rows = lines.slice(2).map(parseRow);
    let table = `<div class="tbl-wrap"><table data-tidx="${tIdx}"><thead><tr>` + header.map((h, ci) => {
      const { attr, text } = cellHtml(h, ci);
      return `<th data-row="0" data-col="${ci}"${attr}>${text}</th>`;
    }).join('') + '</tr></thead><tbody>';
    rows.forEach((r, ri) => {
      table += '<tr>' + r.map((c, ci) => {
        const { attr, text } = cellHtml(c, ci);
        return `<td data-row="${ri + 1}" data-col="${ci}"${attr}>${text}</td>`;
      }).join('') + '</tr>';
    });
    table += '</tbody></table></div>';
    return table + '\n';
  });

  s = s.replace(/^---\s*$/gm, '<hr>');

  s = s.split('\n').map(line => {
    const t = line.trim();
    if(!t) return '';
    if(/^<(h1|h2|h3|h4|ul|ol|li|blockquote|pre|table|div|hr)/.test(t)) return t;
    const depth = Math.floor(line.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length / 2);
    return depth > 0 ? `<p style="margin-left:${depth * 22}px">${t}</p>` : '<p>' + t + '</p>';
  }).join('\n');
  return s || '<p style="color:var(--ink-faint);font-style:italic;">내용 없음</p>';
}
