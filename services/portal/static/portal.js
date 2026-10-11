const grid = document.querySelector('#app-grid');
let apps = [], category = 'Todas';
function node(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
function render() {
  const query = document.querySelector('#search').value.trim().toLocaleLowerCase('es');
  const visible = apps.filter(a => (category === 'Todas' || a.category === category) && `${a.name} ${a.description} ${a.category}`.toLocaleLowerCase('es').includes(query));
  grid.replaceChildren();
  document.querySelector('#app-count').textContent = `${visible.length} ${visible.length === 1 ? "aplicación" : "aplicaciones"} para explorar`;
  for (const a of visible) {
    const card = node('article', '', 'app-card'); card.dataset.id = a.id;
    const top = node('div', '', 'card-top'); top.append(node('span', a.icon, 'app-icon'), node('span', a.access, 'access'));
    const bottom = node('div', '', 'card-bottom'); const link = node('a', 'Abrir aplicación ↗'); link.href = a.url; link.setAttribute('aria-label', `Abrir ${a.name}`);
    bottom.append(node('span', a.category), link);
    card.append(top, node('h3', a.name), node('p', a.label, 'card-label'), node('p', a.description, 'card-description'), bottom); grid.append(card);
  }
  if (!visible.length) grid.append(node('p', 'No encontramos aplicaciones con esa búsqueda. Prueba con otro nombre.'));
}
document.querySelectorAll('[data-category]').forEach(b => b.addEventListener('click', () => {
  category = b.dataset.category;
  document.querySelectorAll('[data-category]').forEach(other => { other.classList.toggle('selected', other === b); other.setAttribute('aria-pressed', String(other === b)); }); render();
}));
document.querySelector('#search').addEventListener('input', render);
fetch('/api/apps').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => { apps = data; render(); }).catch(() => grid.replaceChildren(node('p', 'No se pudo cargar el catálogo. Recarga la página para intentar de nuevo.')));
let authenticated = false, sessionRun = 0, leaving = false;
const loginLink = document.querySelector('#login');
function updateAccessLink() {
  loginLink.href = authenticated ? '/session/account' : `/session/login?${new URLSearchParams({return_to: location.pathname + location.search + location.hash})}`;
  loginLink.textContent = authenticated ? 'Mi cuenta SARA ↗' : 'Iniciar sesión ↗';
}
updateAccessLink();
loginLink.addEventListener('click', updateAccessLink);
window.addEventListener('hashchange', updateAccessLink);
async function session() {
  if (leaving) return;
  const run = ++sessionRun;
  try {
    let r = await fetch('/session/me');
    if (r.status === 401) {
      const renewed = await fetch('/session/refresh', {method:'POST'});
      r = renewed.ok ? await fetch('/session/me') : renewed;
    }
    if (run !== sessionRun) return;
    if (r.ok) {
      const {user} = await r.json();
      if (run !== sessionRun) return;
      authenticated = true;
      document.querySelector('#welcome').textContent = `Hola, ${user.name || user.email || 'bienvenido'}. Esta es tu cuenta SARA en todas las aplicaciones.`;
      document.querySelector('#logout').hidden = false;
      document.querySelector('#session-retry').hidden = true;
    } else if (r.status === 401 || r.status === 403) {
      authenticated = false;
      document.querySelector('#welcome').textContent = 'Una cuenta SARA para tus herramientas académicas.';
      document.querySelector('#logout').hidden = true;
      document.querySelector('#session-retry').hidden = true;
    } else {
      document.querySelector('#welcome').textContent = 'El servicio de acceso no responde por ahora. Puedes volver a comprobar tu sesión.';
      document.querySelector('#session-retry').hidden = false;
    }
    updateAccessLink();
  } catch {
    if (run !== sessionRun) return;
    document.querySelector('#welcome').textContent = 'No pudimos conectar con el servicio de acceso. Puedes volver a intentarlo.';
    document.querySelector('#session-retry').hidden = false;
  }
}
session();
document.querySelector('#session-retry').addEventListener('click', session);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void session(); });
document.querySelector('#logout').addEventListener('click', async (event) => {
  leaving = true;
  ++sessionRun;
  event.target.disabled = true;
  try { const r = await fetch('/session/logout', {method:'POST'}); if (!r.ok) throw Error(); location.reload(); }
  catch { document.querySelector('#welcome').textContent = 'No se pudo confirmar el cierre de sesión. Intenta de nuevo.'; event.target.disabled = false; leaving = false; }
});
const conversation = document.querySelector('#conversation');
document.querySelector('#chat-form').addEventListener('submit', async event => {
  event.preventDefault(); const input = document.querySelector('#question'); const question = input.value.trim(); if (!question) return;
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  conversation.append(node('p', question, 'user-message')); const answer = node('p', 'Consultando…', 'bot-message'); conversation.append(answer); conversation.scrollTop = conversation.scrollHeight; input.value = '';
  try {
    const r = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messages:[{role:'user',content:question}],stream:false})});
    const data = await r.json(); if (!r.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'No se pudo obtener una respuesta.');
    answer.textContent = data.message.content.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    for (const source of data.sources || []) {
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:' || !(url.hostname === 'ucol.mx' || url.hostname.endsWith('.ucol.mx'))) continue;
        const link = node('a', source.title); link.href = url.href; link.className = 'source-link'; answer.append(document.createElement('br'), link);
      } catch { /* Ignore malformed source links. */ }
    }
  } catch(error) { answer.textContent = `${error.message} Intenta de nuevo en un momento.`; }
  finally { button.disabled = false; conversation.scrollTop = conversation.scrollHeight; input.focus(); }
});
