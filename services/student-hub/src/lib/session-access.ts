type SessionUser = { id: string; name?: string | null; email?: string | null };

/** Same-origin portal session controls shared by every academic page. */
export function setupSessionAccess() {
  const root = document.querySelector<HTMLElement>('[data-sara-session]');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const status = root.querySelector<HTMLElement>('[data-sara-status]')!;
  const logout = root.querySelector<HTMLButtonElement>('[data-sara-logout]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-sara-retry]')!;
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-sara-access-link]')];
  const lifecycle = new AbortController();
  let user: SessionUser | null = null;
  let epoch = 0, leaving = false, checking = false;
  let request: AbortController | null = null;

  function updateLinks() {
    const destination = location.pathname + location.search + location.hash;
    const loginUrl = `/session/login?${new URLSearchParams({ return_to: destination })}`;
    for (const link of links) {
      link.href = user ? '/session/account' : loginUrl;
      link.textContent = user
        ? link.dataset.accountLabel || 'Mi cuenta SARA ↗'
        : link.dataset.loginLabel || 'Iniciar sesión';
      if (user) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    }
    logout.hidden = !user;
  }
  function renderSession() {
    status.textContent = user ? `Hola, ${user.name || user.email || 'bienvenido'}.` : 'Tu cuenta SARA';
    retry.hidden = true;
    updateLinks();
  }
  function unavailable(message = 'No pudimos comprobar tu acceso. Intenta de nuevo.') {
    const greeting = user ? `Hola, ${user.name || user.email || 'bienvenido'}. ` : '';
    status.textContent = greeting + message;
    retry.hidden = false;
  }
  const isCurrent = (run: number) => run === epoch && !lifecycle.signal.aborted;

  async function revalidate() {
    if (leaving || checking || lifecycle.signal.aborted) return;
    const run = ++epoch;
    checking = true;
    retry.disabled = true;
    const controller = new AbortController();
    request = controller;
    const options: RequestInit = { credentials: 'same-origin', cache: 'no-store', signal: controller.signal };
    try {
      let response = await fetch('/session/me', options);
      if (!isCurrent(run)) return;
      if (response.status === 401) {
        // Browser supplies the same-origin Origin header on this POST.
        const renewed = await fetch('/session/refresh', { ...options, method: 'POST' });
        if (!isCurrent(run)) return;
        response = renewed.ok ? await fetch('/session/me', options) : renewed;
      }
      if (!isCurrent(run)) return;
      if (response.ok) {
        const data = await response.json();
        if (!isCurrent(run)) return;
        if (!data.user || typeof data.user.id !== 'string') throw new Error('Invalid session');
        user = data.user;
        renderSession();
      } else if (response.status === 401 || response.status === 403) {
        user = null;
        renderSession();
      } else {
        // A temporary Identity failure does not revoke an existing profile.
        unavailable();
      }
    } catch (error) {
      if (isCurrent(run) && (error as Error).name !== 'AbortError') unavailable();
    } finally {
      if (isCurrent(run)) {
        checking = false;
        retry.disabled = false;
        if (request === controller) request = null;
      }
    }
  }

  async function endSession() {
    if (leaving || !user) return;
    leaving = true;
    const run = ++epoch;
    request?.abort();
    checking = false;
    logout.disabled = true;
    retry.disabled = true;
    const controller = new AbortController();
    request = controller;
    try {
      const response = await fetch('/session/logout', {
        method: 'POST', credentials: 'same-origin', signal: controller.signal,
      });
      if (!isCurrent(run)) return;
      if (!response.ok) throw new Error('Logout unavailable');
      user = null;
      renderSession();
      status.textContent = 'Sesión cerrada en este portal.';
    } catch (error) {
      if (isCurrent(run) && (error as Error).name !== 'AbortError') {
        unavailable('No se pudo confirmar el cierre de sesión. Intenta salir de nuevo.');
      }
    } finally {
      if (isCurrent(run)) {
        leaving = false;
        logout.disabled = false;
        retry.disabled = false;
        if (request === controller) request = null;
      }
    }
  }

  const events = { signal: lifecycle.signal };
  // Recompute at the click: catalog filters update the query with replaceState.
  for (const link of links) link.addEventListener('click', updateLinks, events);
  window.addEventListener('hashchange', updateLinks, events);
  window.addEventListener('popstate', updateLinks, events);
  logout.addEventListener('click', () => { void endSession(); }, events);
  retry.addEventListener('click', () => { void revalidate(); }, events);
  const onVisible = () => { if (!document.hidden) void revalidate(); };
  document.addEventListener('visibilitychange', onVisible, events);
  window.addEventListener('pageshow', onVisible, events);
  const timer = setInterval(onVisible, 60000);
  const dispose = () => {
    ++epoch;
    request?.abort();
    clearInterval(timer);
    lifecycle.abort();
  };
  document.addEventListener('astro:before-swap', dispose, { ...events, once: true });
  updateLinks();
  void revalidate();
}
