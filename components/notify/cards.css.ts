// design/abn-animasyonlar.html "Bildirimler" bölümündeki .nf-* kuralları aynen (sahne/kontrol kuralları hariç).
// Renkler --n-* değişkenlerinden gelir; Overlay bunları aktif temadan doldurur.

export const NF_CSS = `
.nf-stack{position:fixed;right:16px;bottom:16px;width:360px;display:flex;flex-direction:column;gap:10px;font-family:"Urbanist",ui-rounded,"Segoe UI",system-ui,sans-serif;--spring:cubic-bezier(.34,1.5,.6,1);--out:cubic-bezier(.22,1,.36,1)}
.nf-stack.top{bottom:auto;top:16px}
.nf{position:relative;border-radius:20px;background:var(--n-surface);color:var(--n-text);box-shadow:0 0 0 1px var(--n-line),0 18px 40px rgba(0,0,0,.35);overflow:hidden;touch-action:pan-y;user-select:none;cursor:pointer;
  animation:nfIn .5s var(--spring) both;transition:transform .35s var(--out),opacity .25s ease,margin .35s var(--out)}
.nf::before{content:"";position:absolute;inset:0;background:var(--n-glow,none);pointer-events:none}
.nf.out{animation:nfOut .25s ease forwards}
.nf.drag{transition:none}
@keyframes nfIn{from{opacity:0;transform:translateX(40px) scale(.96)}to{opacity:1;transform:none}}
@keyframes nfOut{to{opacity:0;transform:translateX(24px)}}
.nf.pulse{animation:nfPulse .45s var(--spring)}
@keyframes nfPulse{0%{transform:none}40%{transform:scale(1.025)}100%{transform:none}}
.reduced .nf,.reduced .nf-more{animation:nfFade .3s ease both}
.reduced .nf.out{animation:nfFadeOut .25s ease forwards}
.reduced .nf.pulse{animation:none}
@keyframes nfFade{from{opacity:0}to{opacity:1}}
@keyframes nfFadeOut{to{opacity:0}}
.nf-row{position:relative;display:flex;gap:12px;align-items:flex-start;padding:14px 14px 12px}
.nf-av{position:relative;flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
.nf-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.nf-badge{position:absolute;right:-4px;bottom:-4px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--n-badge);background-image:var(--n-badgeimg,none);color:var(--n-badgefg);box-shadow:0 0 0 2.5px var(--n-surface)}
.nf-badge svg{width:11px;height:11px}
.nf-main{flex:1;min-width:0}
.nf-top{display:flex;align-items:baseline;gap:5px;font-size:12.5px;color:var(--n-muted);white-space:nowrap}
.nf-top b{font-size:14px;font-weight:800;color:var(--n-text)}
.nf-top .ch{overflow:hidden;text-overflow:ellipsis;min-width:0}
.nf-top time{margin-left:auto;flex:none;font-size:11.5px}
.nf-txt{margin-top:2px;font-size:13.5px;line-height:1.4;color:var(--n-text2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nf-txt em{font-style:normal;font-weight:800;color:var(--n-accent)}
.nf-count{display:inline-block;margin-top:5px;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--n-chip);color:var(--n-text2)}
.nf-x{position:absolute;right:10px;top:10px;width:24px;height:24px;border-radius:50%;border:0;background:var(--n-chip);color:var(--n-muted);font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .2s ease}
.nf:hover .nf-x{opacity:1}
.nf:hover .nf-top time{visibility:hidden}
.nf-act{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s var(--out)}
.nf:hover .nf-act,.nf.replying .nf-act{grid-template-rows:1fr}
.nf-act>div{overflow:hidden}
.nf-btns{display:flex;gap:6px;padding:0 14px 12px 66px}
.nf-btns button{height:30px;border:0;border-radius:999px;padding:0 12px;font:inherit;font-size:12.5px;font-weight:800;background:var(--n-chip);color:var(--n-text);cursor:pointer}
.nf-btns button.pri{background:var(--n-a1);background-image:var(--n-btnimg,none);color:var(--n-a1ink);box-shadow:var(--n-hl,none)}
.nf-reply{display:none;gap:6px;padding:0 14px 12px 66px}
.nf.replying .nf-reply{display:flex}
.nf.replying .nf-btns{display:none}
.nf-reply input{flex:1;min-width:0;height:34px;border-radius:12px;border:0;padding:0 12px;font:inherit;font-size:13px;background:var(--n-chip);color:var(--n-text);outline:2px solid transparent}
.nf-reply input:focus{outline-color:var(--n-a1)}
.nf-reply button{height:34px;border:0;border-radius:12px;padding:0 12px;font:inherit;font-size:12.5px;font-weight:800;background:var(--n-a1);background-image:var(--n-btnimg,none);color:var(--n-a1ink);cursor:pointer}
.nf-sent{display:none;padding:0 14px 12px 66px;font-size:12.5px;font-weight:800;color:var(--n-accent)}
.nf.sent .nf-sent{display:block}.nf.sent .nf-reply{display:none!important}
.nf-timer{position:absolute;left:0;right:0;bottom:0;height:3px;background:transparent}
.nf-timer span{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--n-a1),var(--n-a2));transform-origin:left}
.nf.mention{box-shadow:inset 3px 0 0 var(--n-a1),0 0 0 1px var(--n-line),0 18px 40px rgba(0,0,0,.35)}
.nf.ann{background:var(--n-a2);background-image:var(--n-annimg,none);color:var(--n-a2ink)}
.nf.ann .nf-top,.nf.ann .nf-top b,.nf.ann .nf-txt{color:var(--n-a2ink)}
.nf.ann .nf-top{opacity:.85}
.nf.ann .nf-x{background:rgba(0,0,0,.15);color:var(--n-a2ink)}
.nf.ann .nf-btns button{background:rgba(0,0,0,.14);color:var(--n-a2ink)}
.nf.ann::before{display:none}
.nf.heart{border-radius:999px}
.nf.heart .nf-row{align-items:center;padding:8px 14px 8px 8px;gap:10px}
.nf.heart .nf-av{width:34px;height:34px;font-size:13px}
.nf.heart .nf-txt{margin:0;font-size:13px;-webkit-line-clamp:1}
.nf.heart .nf-act{display:none}
.nf-more{align-self:flex-end;font-size:12.5px;font-weight:800;padding:6px 12px;border-radius:999px;background:var(--n-surface);color:var(--n-text);box-shadow:0 0 0 1px var(--n-line),0 10px 24px rgba(0,0,0,.3);animation:nfIn .4s var(--spring) both;cursor:pointer}
.nf-sum .avs{display:flex;margin-top:6px}.nf-sum .avs i{width:22px;height:22px;border-radius:50%;margin-right:-6px;box-shadow:0 0 0 2px var(--n-surface);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;font-weight:800}
`;

export const ICON: Record<string, string> = {
  msg: 'M4 5h16v11H8l-4 4z',
  mention: 'M16 12a4 4 0 1 1-1.2-2.8M16 8v5a2 2 0 0 0 4 0v-1a8 8 0 1 0-3.1 6.3',
  heart: 'M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.5 0 5.6 3.5 4.4 6.8C19.5 15.9 12 20.5 12 20.5z',
  task: 'M5 12l4 4 10-10',
  ann: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  poll: 'M5 19V11M12 19V5M19 19v-6',
};
