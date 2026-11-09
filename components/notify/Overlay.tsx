// Bildirim penceresi (Tauri "bildirim"). Kartlar design/abn-animasyonlar.html "Masaüstü bildirimleri"
// bloğunun birebir karşılığı: aynı .nf-* CSS'i, aynı zamanlayıcı / duraklatma / sürükleyip kapatma /
// yığın / gruplama mantığı. Bu pencere sadece webview'de çalıştığı için kartlar düz DOM ile çiziliyor.
// Pencere yığının boyuna göre ölçülür; kart yokken ekran dışına çekilir (tıklamalar arkaya geçer).

import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Controls';
import { useAuth } from '@/lib/auth';
import { invoke, isDesktop, listenDesktop, notifyDemo } from '@/lib/desktop';
import { startFeed } from '@/lib/notify/feed';
import { getPrefs, muteRoom } from '@/lib/notify/prefs';
import { blip, primeAudio } from '@/lib/notify/sounds';
import { clearNotices, useNotices, type Notice } from '@/lib/notify/store';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useTeam } from '@/lib/team';
import { glowCss, linearCss } from '@/theme/gradients';
import { useTheme } from '@/theme/ThemeProvider';

import { ICON, NF_CSS } from './cards.css';

type Card = HTMLDivElement & {
  _t?: ReturnType<typeof setTimeout>;
  _left?: number;
  _start?: number;
  _paused?: boolean;
  _gone?: boolean;
  _room?: string;
  _at?: number;
  _n?: number;
};

type Opts = {
  cls?: string;
  person?: Pick<Profile, 'full_name' | 'avatar_url' | 'avatar_color'> | null;
  icon: keyof typeof ICON;
  title: string;
  ch?: string;
  text: string; // HTML (kaçışlı)
  extra?: string;
  btns?: string;
  ms: number;
  snd?: 'msg' | 'mention';
  replyTo?: string;
  onOpen?: () => void;
  onRead?: () => void;
  onReply?: (text: string) => Promise<void>;
  roomId?: string;
};

function esc(t: string) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

const BTN_MSG =
  '<button type="button" class="pri" data-a="reply">Yanıtla</button><button type="button" data-a="read">Okundu</button><button type="button" data-a="mute">Sessize al ▾</button>';
const BTN_MUTE =
  '<button type="button" data-a="m1">1 saat</button><button type="button" data-a="m8">8 saat</button><button type="button" data-a="mx">Bu sohbeti</button>';

/** Kart motoru: tasarım dosyasındaki make / remove / startTimer / pause / resume / layout. */
function createEngine(stack: HTMLDivElement, onChange: () => void) {
  let cards: Card[] = [];
  let more: HTMLDivElement | null = null;

  function remove(c: Card) {
    if (c._gone) return;
    c._gone = true;
    clearTimeout(c._t);
    c.classList.add('out');
    setTimeout(() => {
      c.remove();
      cards = cards.filter((x) => x !== c);
      layout();
    }, 250);
  }
  function startTimer(c: Card, ms: number) {
    if (!ms) return;
    const bar = c.querySelector('.nf-timer span') as HTMLElement;
    c._left = ms;
    c._start = performance.now();
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = 'transform ' + ms + 'ms linear';
    bar.style.transform = 'scaleX(0)';
    c._t = setTimeout(() => remove(c), ms);
  }
  function pause(c: Card) {
    if (!c._left || c._paused) return;
    c._paused = true;
    clearTimeout(c._t);
    c._left -= performance.now() - (c._start ?? 0);
    const bar = c.querySelector('.nf-timer span') as HTMLElement;
    const cur = getComputedStyle(bar).transform;
    bar.style.transition = 'none';
    bar.style.transform = cur;
  }
  function resume(c: Card) {
    if (!c._paused || c.classList.contains('replying')) return;
    c._paused = false;
    const bar = c.querySelector('.nf-timer span') as HTMLElement;
    c._start = performance.now();
    bar.style.transition = 'transform ' + c._left + 'ms linear';
    bar.style.transform = 'scaleX(0)';
    c._t = setTimeout(() => remove(c), c._left);
  }
  function layout() {
    const live = cards.filter((c) => !c._gone);
    live.forEach((c, i) => (c.style.display = i >= live.length - 3 ? '' : 'none'));
    const hidden = Math.max(0, live.length - 3);
    if (hidden && !more) {
      more = document.createElement('div');
      more.className = 'nf-more';
      stack.insertBefore(more, stack.firstChild);
      more.addEventListener('click', () => {
        invoke('open_merkez', { path: '/bildirimler' }).catch(() => {});
        cards.filter((c) => !c._gone).slice(0, -3).forEach(remove);
      });
    }
    if (more) {
      if (!hidden) {
        more.remove();
        more = null;
      } else more.textContent = '+' + hidden + ' bildirim daha';
    }
    onChange();
  }

  function avatarHtml(o: Opts) {
    const p = o.person;
    const inner = p?.avatar_url
      ? `<img src="${esc(p.avatar_url)}" alt="">`
      : esc((p?.full_name ?? 'A').charAt(0).toUpperCase());
    const bg = p?.avatar_color ?? 'var(--n-a1)';
    return `<div class="nf-av" style="background:${esc(bg)};color:#0E0E10">${inner}<span class="nf-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[o.icon]}"/></svg></span></div>`;
  }

  function make(o: Opts): Card {
    const c = document.createElement('div') as Card;
    c.className = 'nf' + (o.cls ? ' ' + o.cls : '');
    c._room = o.roomId;
    c._at = Date.now();
    c._n = 1;
    c.innerHTML =
      '<div class="nf-row">' +
      avatarHtml(o) +
      '<div class="nf-main"><div class="nf-top"><b>' +
      esc(o.title) +
      '</b><span class="ch">' +
      esc(o.ch || '') +
      '</span><time>şimdi</time></div><div class="nf-txt">' +
      o.text +
      '</div>' +
      (o.extra || '') +
      '</div>' +
      '<button class="nf-x" type="button" aria-label="Kapat">×</button></div>' +
      (o.btns
        ? '<div class="nf-act"><div><div class="nf-btns">' +
          o.btns +
          '</div><div class="nf-reply"><input type="text" aria-label="Yanıt" placeholder="' +
          esc((o.replyTo || '') + "'ye yanıt yaz…") +
          '"><button type="button">Gönder</button></div><div class="nf-sent">Gönderildi ✓</div></div></div>'
        : '') +
      (o.ms ? '<div class="nf-timer"><span></span></div>' : '');
    stack.appendChild(c);
    cards.push(c);
    layout();

    c.querySelector('.nf-x')!.addEventListener('click', (e) => {
      e.stopPropagation();
      remove(c);
    });
    c.addEventListener('mouseenter', () => pause(c));
    c.addEventListener('mouseleave', () => resume(c));
    c.addEventListener('click', () => {
      if (c.classList.contains('replying') || moved) return;
      o.onOpen?.();
      remove(c);
    });
    const btnBox = c.querySelector('.nf-btns');
    btnBox?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'reply') {
        c.classList.add('replying');
        pause(c);
        invoke('notif_focus').catch(() => {});
        const inp = c.querySelector('.nf-reply input') as HTMLInputElement;
        setTimeout(() => inp.focus(), 50);
      } else if (a === 'mute') {
        btnBox.innerHTML = BTN_MUTE;
      } else if (a === 'm1' || a === 'm8' || a === 'mx') {
        if (o.roomId) muteRoom(o.roomId, a === 'm1' ? 3600e3 : a === 'm8' ? 8 * 3600e3 : Infinity);
        remove(c);
      } else if (a === 'open') {
        o.onOpen?.();
        remove(c);
      } else {
        o.onRead?.();
        remove(c);
      }
    });
    const inp = c.querySelector('.nf-reply input') as HTMLInputElement | null;
    const send = c.querySelector('.nf-reply button');
    const doSend = () => {
      const text = inp?.value.trim();
      if (!text) return;
      (o.onReply ? o.onReply(text) : Promise.resolve())
        .then(() => {
          c.classList.add('sent');
          setTimeout(() => remove(c), 1000);
        })
        .catch(() => {
          if (inp) inp.placeholder = 'Gönderilemedi, tekrar dene';
        });
    };
    if (inp && send) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSend();
        if (e.key === 'Escape') {
          c.classList.remove('replying');
          resume(c);
        }
        e.stopPropagation();
      });
      send.addEventListener('click', (e) => {
        e.stopPropagation();
        doSend();
      });
      inp.addEventListener('click', (e) => e.stopPropagation());
    }
    // sağa sürükleyince kapanır
    let sx: number | null = null;
    let dx = 0;
    let moved = false;
    c.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button,input')) return;
      sx = e.clientX;
      dx = 0;
      moved = false;
      c.classList.add('drag');
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (sx === null) return;
      dx = Math.max(0, e.clientX - sx);
      if (dx > 4) moved = true;
      c.style.transform = 'translateX(' + dx + 'px)';
      c.style.opacity = String(1 - dx / 300);
    });
    const up = () => {
      if (sx === null) return;
      sx = null;
      c.classList.remove('drag');
      if (dx > 100) remove(c);
      else {
        c.style.transform = '';
        c.style.opacity = '';
      }
      setTimeout(() => (moved = false), 0);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    startTimer(c, o.ms);
    blip(o.snd);
    return c;
  }

  /** Aynı sohbetten 10 sn içinde gelen mesaj: mevcut kartı güncelle. */
  function group(roomId: string, textHtml: string, ms: number): boolean {
    const g = cards.find((c) => !c._gone && c._room === roomId && Date.now() - (c._at ?? 0) < 10_000);
    if (!g) return false;
    g._at = Date.now();
    g._n = (g._n ?? 1) + 1;
    g.querySelector('.nf-txt')!.innerHTML = textHtml;
    let cnt = g.querySelector('.nf-count');
    if (!cnt) {
      cnt = document.createElement('span');
      cnt.className = 'nf-count';
      g.querySelector('.nf-main')!.appendChild(cnt);
    }
    cnt.textContent = g._n + ' yeni mesaj';
    g.classList.remove('pulse');
    void g.offsetWidth;
    g.classList.add('pulse');
    clearTimeout(g._t);
    g._paused = false;
    startTimer(g, ms);
    blip('msg');
    return true;
  }

  return { make, group, clear: () => cards.forEach(remove) };
}

type Engine = ReturnType<typeof createEngine>;
type Person = Opts['person'];

/** Bir Notice'i türüne göre karta çevirir (dosyadaki MAKERS). */
function showNotice(e: Engine, n: Notice, person: Person, me: Profile | null) {
  const p = getPrefs();
  const ms = p.duration * 1000;
  const name = person?.full_name ?? 'ABN Merkez';
  const first = name.split(' ')[0];
  const body = p.preview ? esc(n.text) : 'Yeni mesaj';
  const open = () => invoke('open_merkez', { path: n.link ?? '/' }).catch(() => {});
  const read = () => {
    if (n.notificationId)
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.notificationId).then(() => {});
  };
  const reply = async (text: string) => {
    if (!n.roomId || !me) return;
    const { error } = await supabase.from('messages').insert({ room_id: n.roomId, author_id: me.id, body: text });
    if (error) throw error;
  };
  if (n.kind === 'mesaj' || n.kind === 'anma') {
    const mention = n.kind === 'anma';
    let html = body;
    if (mention && p.preview && me) html = html.replace(new RegExp('@' + me.username, 'gi'), (m) => `<em>${m}</em>`);
    if (n.imagePath && p.preview && !n.text) html = '📷 Görsel';
    if (n.roomId && !mention && e.group(n.roomId, html, ms)) return;
    e.make({
      cls: mention ? 'mention' : undefined,
      person,
      icon: mention ? 'mention' : 'msg',
      title: name,
      ch: mention ? 'seni andı ' + (n.channel ?? '') : n.channel,
      text: html,
      btns: BTN_MSG,
      ms,
      snd: mention ? 'mention' : 'msg',
      replyTo: first,
      onOpen: open,
      onRead: read,
      onReply: reply,
      roomId: n.roomId,
    });
    return;
  }
  if (n.kind === 'kalp') {
    e.make({ cls: 'heart', person, icon: 'heart', title: '', text: esc(n.text), ms: 3000, onOpen: open });
    return;
  }
  if (n.kind === 'duyuru') {
    e.make({
      cls: 'ann',
      person,
      icon: 'ann',
      title: 'Duyuru',
      ch: '· ABN',
      text: esc(n.text),
      btns: '<button type="button" data-a="open">Aç</button><button type="button" data-a="read">Tamam</button>',
      ms: 0,
      onOpen: open,
      onRead: read,
    });
    return;
  }
  if (n.kind === 'oylama') {
    e.make({
      person,
      icon: 'poll',
      title: 'Oylama sonuçlandı',
      text: esc(n.text),
      btns: '<button type="button" class="pri" data-a="open">Sonucu gör</button>',
      ms,
      snd: 'msg',
      onOpen: open,
    });
    return;
  }
  e.make({
    person,
    icon: 'task',
    title: n.kind === 'gorev' ? 'Yeni görev' : n.kind === 'istek' ? 'İsteğe cevap' : name,
    text: esc(n.text),
    btns: '<button type="button" class="pri" data-a="open">Görüntüle</button><button type="button" data-a="read">Okundu</button>',
    ms,
    snd: 'msg',
    onOpen: open,
    onRead: read,
  });
}

/** "Deneme bildirimi gönder": her türden bir örnek, sırayla. */
function demoSequence(e: Engine, someone: Person, me: Profile | null) {
  const now = new Date().toISOString();
  const base = { actorId: null, link: '/', createdAt: now, count: 1 };
  const list: Notice[] = [
    { ...base, id: 'd1', kind: 'mesaj', text: 'Yüz ifadelerinin ikinci turu hazır, panoya attım. Bakabilir misin?', channel: '· #genel', roomId: 'demo' },
    { ...base, id: 'd2', kind: 'anma', text: `@${me?.username ?? 'sen'} cuma testinden önce yeni build'i atar mısın?`, channel: '· #genel', roomId: 'demo2' },
    { ...base, id: 'd3', kind: 'kalp', text: `${someone?.full_name?.split(' ')[0] ?? 'Ece'} paylaşımını beğendi` },
    { ...base, id: 'd4', kind: 'gorev', text: 'Sana "Kapı gıcırtısı sesi" görevi verildi.' },
    { ...base, id: 'd5', kind: 'duyuru', text: "Cuma 21:00 PaleMouth oynanış testi. Demoyu launcher'dan indirin." },
    { ...base, id: 'd6', kind: 'oylama', text: 'Kazanan: "Sessiz Ağız" başlığı (%62)' },
  ];
  list.forEach((n, i) => setTimeout(() => showNotice(e, n, someone, me), i * 1400));
  setTimeout(() => {
    e.make({
      cls: 'nf-sum',
      person: someone,
      icon: 'msg',
      title: 'Sen yokken 4 bildirim geldi',
      text: '3 kişi yazdı · 1 anma',
      btns: '<button type="button" class="pri" data-a="open">Hepsini gör</button><button type="button" data-a="read">Okundu</button>',
      ms: 8000,
      snd: 'msg',
      onOpen: () => invoke('open_merkez', { path: '/bildirimler' }).catch(() => {}),
    });
  }, list.length * 1400);
}

export function NotifyOverlay() {
  const { profile } = useAuth();
  const { colors, theme } = useTheme();
  const team = useTeam();
  const notices = useNotices();
  const stackRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const teamRef = useRef(team);
  const meRef = useRef(profile);
  useEffect(() => {
    teamRef.current = team;
    meRef.current = profile;
  }, [team, profile]);

  // Kurulum: şeffaf zemin, CSS, yığın, ses bağlamı, pencere ölçüsü.
  useEffect(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
      if (el) el.style.background = 'transparent';
    }
    const style = document.createElement('style');
    style.textContent = NF_CSS;
    document.head.appendChild(style);
    const stack = document.createElement('div');
    stack.className = 'nf-stack';
    document.body.appendChild(stack);
    stackRef.current = stack;
    primeAudio();

    let last = -1;
    const fit = () => {
      const p = getPrefs();
      stack.classList.toggle('top', p.corner === 'sag-ust');
      stack.classList.toggle('reduced', matchMedia('(prefers-reduced-motion: reduce)').matches);
      const h = stack.childElementCount ? Math.ceil(stack.offsetHeight) + 32 : 0;
      if (h === last) return;
      last = h;
      if (isDesktop) invoke('notif_layout', { height: h, corner: p.corner }).catch(() => {});
    };
    const ro = new ResizeObserver(fit);
    ro.observe(stack);
    engineRef.current = createEngine(stack, () => setTimeout(fit, 0));
    const offDemo = listenDesktop('bildirim://deneme', () => {
      const t = teamRef.current;
      const someone = [...t.people.values()].find((x) => x.id !== t.meId) ?? null;
      if (engineRef.current) demoSequence(engineRef.current, someone, meRef.current);
    });
    fit();
    return () => {
      offDemo();
      ro.disconnect();
      stack.remove();
      style.remove();
    };
  }, []);

  // Tema renkleri → --n-* değişkenleri. Gradyanı olmayan temada gradyanlar düz renge düşer.
  useEffect(() => {
    const s = stackRef.current;
    if (!s) return;
    const g = theme.gradients;
    const vars: Record<string, string | null> = {
      surface: colors.surface,
      line: colors['line-2'],
      text: colors.text,
      text2: colors['text-2'],
      muted: colors.muted,
      chip: colors.chip,
      accent: colors['accent-text'],
      a1: colors.a1,
      a1ink: colors['a1-ink'],
      a2: colors.a2,
      a2ink: colors['a2-ink'],
      badge: colors['a1-ink'],
      badgefg: colors.a1,
      glow: g ? glowCss(g.bgGlow, 0.5) : null,
      btnimg: g ? linearCss(g.btnGradient) : null,
      annimg: g ? linearCss(g.annGradient) : null,
      badgeimg: g ? linearCss(g.badgeGradient) : null,
      hl: g ? g.highlight : null,
    };
    for (const [k, v] of Object.entries(vars)) {
      if (v) s.style.setProperty('--n-' + k, v);
      else s.style.removeProperty('--n-' + k);
    }
  }, [colors, theme]);

  // Realtime dinleme: oturum açıksa.
  useEffect(() => (profile && (isDesktop || notifyDemo) ? startFeed(profile) : undefined), [profile]);

  // Yeni bildirimleri karta çevir.
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !notices.length) return;
    for (const n of notices) showNotice(e, n, n.actorId ? team.person(n.actorId) : null, profile);
    clearNotices();
  }, [notices, team, profile]);

  if (!notifyDemo) return null;
  return (
    <View style={{ position: 'absolute', top: 16, left: 16 }}>
      <Button
        label="Deneme bildirimi"
        size="sm"
        onPress={() => {
          const someone = [...team.people.values()].find((x) => x.id !== team.meId) ?? null;
          if (engineRef.current) demoSequence(engineRef.current, someone, profile);
        }}
      />
    </View>
  );
}
