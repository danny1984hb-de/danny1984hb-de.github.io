(() => {
'use strict';
const origin = 'https://github.drb-digital.de';
const namespace = 'http://www.w3.org/2005/Atom';
const list = document.getElementById('news-list');
const status = document.getElementById('news-status');
const retry = document.getElementById('news-retry');
if (!list || !status || !retry) return;
let busy = false;
const safeURL = value => {
  try {
    const u = new URL(value, origin);
    return u.origin === origin && u.protocol === 'https:' && !u.username && !u.password && u.pathname.startsWith('/news/') ? u.href : null;
  } catch { return null; }
};
const node = (tag, className, text) => {
  const n = document.createElement(tag); n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};
const field = (entry, name) => Array.from(entry.children).find(n => n.namespaceURI === namespace && n.localName === name)?.textContent.trim() || '';
function parse(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length || xml.documentElement.localName !== 'feed' || xml.documentElement.namespaceURI !== namespace) throw new Error('Invalid feed');
  const posts = []; const seen = new Set();
  for (const entry of Array.from(xml.documentElement.children).filter(n => n.namespaceURI === namespace && n.localName === 'entry')) {
    const link = Array.from(entry.children).find(n => n.namespaceURI === namespace && n.localName === 'link' && (!n.getAttribute('rel') || n.getAttribute('rel') === 'alternate'));
    const url = safeURL(link?.getAttribute('href') || field(entry, 'id'));
    const title = field(entry, 'title');
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const summary = field(entry, 'summary').replace(/\s+/g, ' ');
    posts.push({ title, url, summary: summary.length > 280 ? summary.slice(0, 277) + '…' : summary, date: field(entry, 'published') || field(entry, 'updated') });
  }
  return posts;
}
function card(post) {
  const article = node('article', 'news-card');
  const date = new Date(post.date);
  if (!Number.isNaN(date.getTime())) {
    const time = node('time', 'news-date', new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(date));
    time.dateTime = date.toISOString(); article.append(time);
  }
  article.append(node('h2', '', post.title));
  if (post.summary) article.append(node('p', 'news-summary', post.summary));
  const link = node('a', 'text-link', 'Weiterlesen bei DRB-Digital ↗');
  link.href = post.url; article.append(link);
  return article;
}
async function loadNews() {
  if (busy) return;
  busy = true; retry.hidden = true;
  list.setAttribute('aria-busy', 'true'); status.textContent = 'News werden geladen …';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(origin + '/api/atom', { credentials: 'omit', headers: { Accept: 'application/atom+xml, application/xml' }, signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP error');
    const posts = parse(await response.text());
    list.replaceChildren(...posts.map(card));
    status.textContent = posts.length ? '' : 'Aktuell sind noch keine Neuigkeiten veröffentlicht.';
  } catch {
    status.textContent = 'Die News sind gerade nicht erreichbar. Bitte versuche es erneut oder öffne die News direkt bei DRB-Digital.';
    retry.hidden = false;
  } finally {
    clearTimeout(timeout); busy = false; list.setAttribute('aria-busy', 'false');
  }
}
retry.addEventListener('click', loadNews);
loadNews();
})();