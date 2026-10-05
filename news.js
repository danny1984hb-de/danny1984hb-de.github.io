(() => {
'use strict';
const origin = 'https://github.drb-digital.de';
const ns = 'http://www.w3.org/2005/Atom';
const list = document.getElementById('news-list');
const status = document.getElementById('news-status');
const retry = document.getElementById('news-retry');
const detail = document.getElementById('news-article');
if (!list || !status || !retry) return;
const requested = new URLSearchParams(location.search).get('artikel');
const slug = detail ? requested : null;
const localURL = slug => 'news.html?artikel=' + encodeURIComponent(slug);
let busy = false;
function url(value) { try { return new URL(value, origin); } catch { return null; } }
function articleSlug(value) {
  const u = url(value);
  if (!u || u.origin !== origin || u.username || u.password) return null;
  const match = u.pathname.match(/^\/news\/([^/]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
const node = (tag, cls, text) => {
  const el = document.createElement(tag); el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const field = (entry, name) => Array.from(entry.children).find(n => n.namespaceURI === ns && n.localName === name)?.textContent.trim() || '';
function textOnly(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  t.content.querySelectorAll('script,style,iframe,object,embed').forEach(n => n.remove());
  return t.content.textContent.replace(/\s+/g, ' ').trim();
}
function parse(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length || xml.documentElement.localName !== 'feed' || xml.documentElement.namespaceURI !== ns) throw new Error('Invalid feed');
  const posts = [], seen = new Set();
  for (const entry of Array.from(xml.documentElement.children).filter(n => n.namespaceURI === ns && n.localName === 'entry')) {
    const link = Array.from(entry.children).find(n => n.namespaceURI === ns && n.localName === 'link' && (!n.getAttribute('rel') || n.getAttribute('rel') === 'alternate'));
    const id = articleSlug(link?.getAttribute('href') || field(entry, 'id'));
    const title = field(entry, 'title');
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const rawSummary = textOnly(field(entry, 'summary'));
    posts.push({ slug: id, title, summary: rawSummary.length > 280 ? rawSummary.slice(0, 277) + '…' : rawSummary, content: field(entry, 'content'), date: field(entry, 'published') || field(entry, 'updated') });
  }
  return posts;
}
// Rebuild an allowlisted DOM; never insert feed HTML directly into the page.
function safeContent(html) {
  const template = document.createElement('template'); template.innerHTML = html;
  const allowed = new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','H2','H3','H4','HR','TABLE','THEAD','TBODY','TR','TH','TD','FIGURE','FIGCAPTION']);
  const forbidden = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','LINK','META','BASE','TEMPLATE']);
  function clean(source, target) {
    for (const child of source.childNodes) {
      if (child.nodeType === 3) { target.append(document.createTextNode(child.textContent)); continue; }
      if (child.nodeType !== 1 || forbidden.has(child.tagName)) continue;
      let el;
      if (child.tagName === 'A') {
        const u = url(child.getAttribute('href') || '');
        if (u && ['https:','http:','mailto:'].includes(u.protocol) && !u.username && !u.password) {
          if (u.origin === origin) {
            const id = articleSlug(u.href);
            if (id) { el = document.createElement('a'); el.href = localURL(id); }
          } else { el = document.createElement('a'); el.href = u.href; el.rel = 'noopener noreferrer'; }
        }
      } else if (child.tagName === 'IMG') {
        const u = url(child.getAttribute('src') || '');
        if (u && u.protocol === 'https:' && u.origin === origin && !u.username && !u.password) {
          el = document.createElement('img'); el.src = u.href; el.alt = child.getAttribute('alt') || ''; el.loading = 'lazy';
        }
      } else if (allowed.has(child.tagName)) el = document.createElement(child.tagName.toLowerCase());
      if (el) { clean(child, el); target.append(el); }
      else if (child.tagName !== 'IMG') clean(child, target);
    }
  }
  const fragment = document.createDocumentFragment(); clean(template.content, fragment); return fragment;
}
function dateNode(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const t = node('time','news-date',new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(d));
  t.dateTime = d.toISOString(); return t;
}
function previewImage(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,style,iframe,object,embed,svg,math,template').forEach(n => n.remove());
  for (const source of template.content.querySelectorAll('img[src]')) {
    const src = source.getAttribute('src').trim();
    if (!src) continue;
    const u = url(src);
    if (!u || u.protocol !== 'https:' || u.origin !== origin || u.username || u.password) continue;
    const image = node('img', 'news-preview');
    image.src = u.href;
    image.alt = source.getAttribute('alt') || '';
    image.width = 640; image.height = 360;
    image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    return image;
  }
  return null;
}
function card(post) {
  const article = node('article','news-card');
  const image = previewImage(post.content); if (image) article.append(image);
  const time = dateNode(post.date); if (time) article.append(time);
  article.append(node('h2','',post.title));
  if (post.summary) article.append(node('p','news-summary',post.summary));
  const link = node('a','text-link','Weiterlesen →'); link.href = localURL(post.slug);
  article.append(link); return article;
}
function render(posts) {
  if (slug !== null) {
    list.hidden = true; detail.hidden = false;
    const heading = document.getElementById('news-title');
    const post = posts.find(p => p.slug === slug);
    if (!post) {
      heading.textContent = 'Beitrag nicht verfügbar';
      status.textContent = 'Dieser Beitrag ist nicht mehr im aktuellen News-Feed enthalten oder wurde entfernt.';
      return;
    }
    heading.textContent = post.title; document.title = post.title + ' — DRB-Digital';
    document.querySelector('meta[name="description"]')?.setAttribute('content',post.summary);
    const time = dateNode(post.date); if (time) detail.append(time);
    const body = node('div','news-content'); body.append(safeContent(post.content));
    if (!body.textContent.trim() && !body.querySelector('img')) body.textContent = post.summary || 'Für diesen Beitrag ist noch kein Text vorhanden.';
    detail.append(body); status.textContent = ''; return;
  }
  const limit = Number(list.dataset.limit) || 10;
  list.replaceChildren(...posts.slice(0,limit).map(card));
  status.textContent = posts.length ? '' : 'Aktuell sind noch keine Neuigkeiten veröffentlicht.';
}
async function loadNews() {
  if (busy) return;
  busy = true; retry.hidden = true;
  list.setAttribute('aria-busy','true'); status.textContent = 'News werden geladen …';
  if (detail) detail.replaceChildren();
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),10000);
  try {
    const response = await fetch(origin + '/api/atom',{credentials:'omit',headers:{Accept:'application/atom+xml, application/xml'},signal:controller.signal,cache:'no-cache'});
    if (!response.ok) throw new Error('HTTP');
    render(parse(await response.text()));
  } catch {
    status.textContent = 'Die News sind gerade nicht erreichbar. Bitte versuche es erneut.';
    retry.hidden = false;
  } finally { clearTimeout(timeout); busy = false; list.setAttribute('aria-busy','false'); }
}
retry.addEventListener('click',loadNews); loadNews();
})();