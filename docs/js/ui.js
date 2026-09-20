import { sortPlaces, likedBy, likers } from './model.js';
import { PERSONAS, byId } from './personas.js';

const HEART_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.2-4.4-9.2-8.6C1.2 8 3.2 4.6 6.6 4.6c2 0 3.5 1.1 4.4 2.4l1 1.4 1-1.4c.9-1.3 2.4-2.4 4.4-2.4 3.4 0 5.4 3.4 3.8 6.8C19.2 15.6 12 20 12 20z" stroke-linejoin="round"/></svg>';

const TRASH_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';

export function relativeTime(iso) {
  if (!iso) return 'never';
  const days = Math.round((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

const shortAddress = p => p.formatted.replace(/,\s*(USA|United States)$/i, '');

/* --------------------------- entry screen --------------------------- */

export function createEntry({ root, onPick }) {
  root.textContent = '';

  const card = document.createElement('div');
  card.className = 'entry-card';

  const h = document.createElement('h2');
  h.textContent = '你是哪一位？';
  const sub = document.createElement('p');
  sub.textContent = 'Pick who you are. Your likes are saved under this name, and you can switch any time.';
  card.append(h, sub);

  const choices = document.createElement('div');
  choices.className = 'entry-choices';

  for (const p of PERSONAS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'entry-choice ' + p.id;
    b.innerHTML =
      `<span class="entry-mark">${HEART_ICON}</span><span class="entry-name">${p.name}</span>`;
    b.addEventListener('click', () => onPick(p.id));
    choices.appendChild(b);
  }

  card.appendChild(choices);
  root.appendChild(card);

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; }
  };
}

/* ------------------------------- list ------------------------------- */

export function createList({ root, countEl, statusEl, onSelect, onToggleLike, onDelete }) {
  return {
    render(places, myId, status) {
      const live = sortPlaces(places, myId);
      const mine = live.filter(p => likedBy(p, myId)).length;

      countEl.textContent =
        `${live.length} place${live.length === 1 ? '' : 's'}` +
        (mine ? `, ${mine} liked by you` : '');

      statusEl.textContent =
        status === 'saving' ? 'Saving…' :
        status === 'error' ? 'Not saved' : 'Saved';

      if (!live.length) {
        root.innerHTML = '<p class="empty">No places yet. Add an address to start.</p>';
        return;
      }

      // Your own heart sits first, whichever persona you are.
      const ordered = [byId(myId), ...PERSONAS.filter(p => p.id !== myId)].filter(Boolean);

      root.textContent = '';
      for (const place of live) {
        const row = document.createElement('div');
        row.className = 'row' + (likedBy(place, myId) ? ' liked-me' : '');

        const hearts = document.createElement('div');
        hearts.className = 'hearts';
        for (const persona of ordered) {
          const on = likedBy(place, persona.id);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'hb ' + persona.id + (on ? ' on' : '');
          b.setAttribute('aria-pressed', String(on));
          b.setAttribute(
            'aria-label',
            (on ? 'Remove the like by ' : 'Like as ') + persona.name
          );
          b.title = persona.name;
          b.innerHTML = HEART_ICON;
          b.addEventListener('click', () => onToggleLike(place.id, persona.id));
          hearts.appendChild(b);
        }

        const addr = document.createElement('button');
        addr.type = 'button';
        addr.className = 'addr';
        const l1 = document.createElement('span');
        l1.className = 'l1';
        l1.textContent = shortAddress(place);
        const l2 = document.createElement('span');
        l2.className = 'l2';
        const names = likers(place).map(id => byId(id)?.name).filter(Boolean);
        l2.textContent = names.length
          ? `Liked by ${names.join(' 和 ')}`
          : `Added ${relativeTime(place.addedAt)}`;
        addr.append(l1, l2);
        addr.addEventListener('click', () => onSelect(place.id));

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'del';
        del.setAttribute('aria-label', 'Remove ' + shortAddress(place));
        del.innerHTML = TRASH_ICON;
        del.addEventListener('click', () => onDelete(place.id));

        row.append(hearts, addr, del);
        root.appendChild(row);
      }
    }
  };
}

/* ------------------------------ report ------------------------------ */

export function createReport({ panel, titleEl, metaEl, bodyEl, heartsEl, bannerEl, onToggleLike }) {
  return {
    open(place, myId, { banner = null, busy = false } = {}) {
      panel.classList.add('open');
      titleEl.textContent = shortAddress(place);
      metaEl.textContent =
        `Added ${relativeTime(place.addedAt)}. ` +
        (place.report
          ? `Report from ${relativeTime(place.report.generatedAt)}.`
          : 'No report yet.');

      const ordered = [byId(myId), ...PERSONAS.filter(p => p.id !== myId)].filter(Boolean);
      heartsEl.textContent = '';
      for (const persona of ordered) {
        const on = likedBy(place, persona.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'heart ' + persona.id + (on ? ' on' : '');
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', (on ? 'Remove the like by ' : 'Like as ') + persona.name);
        b.title = persona.name;
        b.innerHTML = HEART_ICON;
        b.addEventListener('click', () => onToggleLike(place.id, persona.id));
        heartsEl.appendChild(b);
      }

      bannerEl.innerHTML = banner ? `<p class="dedup">${banner}</p>` : '';

      if (busy) {
        bodyEl.innerHTML =
          '<p class="working"><span class="spin"></span>Running the analysis…</p>';
        return;
      }
      if (!place.report) {
        bodyEl.innerHTML = '<p class="empty">No report yet. Run the analysis to fetch one.</p>';
        return;
      }

      bodyEl.textContent = '';
      for (const s of place.report.sections) {
        const sec = document.createElement('section');
        sec.className = 'sec';

        const h = document.createElement('h3');
        h.textContent = s.title;
        sec.appendChild(h);

        if (s.body) {
          const p = document.createElement('p');
          p.textContent = s.body;
          sec.appendChild(p);
        }
        if (s.sources?.length) {
          const src = document.createElement('p');
          src.className = 'src';
          src.textContent = 'Source: ' + s.sources.map(x => x.label).join(', ');
          sec.appendChild(src);
        }
        if (s.gap) {
          const gap = document.createElement('p');
          gap.className = 'gap';
          gap.textContent = s.gap;
          sec.appendChild(gap);
        }
        bodyEl.appendChild(sec);
      }
    },
    close() {
      panel.classList.remove('open');
    }
  };
}

/* ------------------------------- toast ------------------------------ */

export function createToast(el, msgEl, actionEl) {
  let timer;
  return function toast(message, actionLabel, action) {
    msgEl.textContent = message;
    if (actionLabel) {
      actionEl.hidden = false;
      actionEl.textContent = actionLabel;
      actionEl.onclick = () => { action(); el.classList.remove('show'); };
    } else {
      actionEl.hidden = true;
    }
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 5500);
  };
}
