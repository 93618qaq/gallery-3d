/* 松風閣互動回饋，2026-11-06。
 * Sources: Aceternity magnetic-button / stateful-button (original TSX alongside this file).
 * Adaptation for existing vanilla HTML, rather than adding a React runtime.
 * Skills applied: awwwards-ui-design (hierarchy/state/reduced motion),
 * awwwards-motion §1/11 (spring physics/bounded magnetic return).
 * Actual operations remain owned by the existing page. No camera/model changes.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('feedback') === '0') return;
  const scope = document.currentScript?.dataset.scope || 'gallery';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const selectors = {
    gallery: '.btn,.tog,.chip,.pill,.wcard,.mcard,.hm-m,.hm-t,.hph,.ph,#lbx,.back,.step.done',
    frame: 'button:not(#saveimg),a.preview-toggle',
    exhibition: '#bar button,#realNav button'
  };
  const controlSelector = selectors[scope];
  const states = new WeakMap(), active = new Set(), pressed = new Set();
  let raf = 0, previous = 0, notificationTimer = 0;
  const status = document.createElement('div');
  status.id = 'sf-feedback-status';
  status.className = 'sf-feedback-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.append(status);

  function notify(message) {
    clearTimeout(notificationTimer);
    status.textContent = message;
    status.classList.add('visible');
    notificationTimer = setTimeout(() => status.classList.remove('visible'), 2600);
  }
  // Spring integration runs only while a control moves; no permanent animation loop.
  function wake(el) {
    active.add(el);
    if (!raf) { previous = performance.now(); raf = requestAnimationFrame(step); }
  }
  function step(now) {
    raf = 0;
    const dt = Math.min(0.024, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    for (const el of active) {
      const s = states.get(el);
      if (!el.isConnected) { active.delete(el); continue; }
      if (reduce.matches) {
        s.x = s.y = s.tx = s.ty = s.vx = s.vy = 0;
        s.scale = s.targetScale = 1; s.vs = 0;
      } else {
        for (const [p, v, t] of [['x','vx','tx'],['y','vy','ty'],['scale','vs','targetScale']]) {
          s[v] += (300 * (s[t] - s[p]) - 24 * s[v]) * dt;
          s[p] += s[v] * dt;
        }
      }
      el.style.translate = `${s.x.toFixed(3)}px ${s.y.toFixed(3)}px`;
      el.style.scale = s.scale.toFixed(4);
      const resting = Math.abs(s.tx-s.x)+Math.abs(s.ty-s.y)+Math.abs(s.targetScale-s.scale)*100+
        Math.abs(s.vx)+Math.abs(s.vy)+Math.abs(s.vs)*100 < 0.12;
      if (resting) {
        el.style.translate = s.tx || s.ty ? `${s.tx}px ${s.ty}px` : '';
        el.style.scale = s.targetScale === 1 ? '' : String(s.targetScale);
        if (!s.down && !s.hover) el.style.willChange = '';
        active.delete(el);
      }
    }
    if (active.size) raf = requestAnimationFrame(step);
  }
  function bind(el) {
    if (states.has(el)) return;
    const s = {x:0,y:0,tx:0,ty:0,vx:0,vy:0,scale:1,targetScale:1,vs:0,down:false,hover:false,rect:null};
    states.set(el,s); el.classList.add('sf-feedback-control');
    // Keep magnetic motion on compact CTAs: never move a photograph, a model canvas,
    // a full-width selection row or an existing transform-driven 3D layer.
    const magnetic = el.matches('.btn,.tog,#bar button,.cta,.ghost') && scope !== 'frame';
    el.addEventListener('pointerenter', () => {
      if (!fine.matches || reduce.matches || el.disabled) return;
      s.hover = true; s.rect = el.getBoundingClientRect();
      el.style.willChange = 'translate, scale';
    });
    el.addEventListener('pointermove', e => {
      if (!magnetic || !s.hover || !s.rect || e.buttons || reduce.matches || !fine.matches) return;
      const x = (e.clientX - s.rect.left - s.rect.width/2)*0.1;
      const y = (e.clientY - s.rect.top - s.rect.height/2)*0.1;
      const cap = Math.min(1, 7/Math.max(0.001,Math.hypot(x,y)));
      s.tx = x*cap; s.ty = y*cap; wake(el);
    }, {passive:true});
    el.addEventListener('pointerleave', () => {
      s.hover = false; s.tx = s.ty = 0; wake(el);
    });
    function press() {
      if (el.disabled) return;
      s.down = true; s.targetScale = reduce.matches ? 1 : 0.97;
      pressed.add(el);
      el.dataset.feedbackState = 'pressed'; wake(el);
    }
    function release() {
      if (!s.down) return;
      s.down = false; s.targetScale = 1; el.dataset.feedbackState = 'idle'; wake(el);
      pressed.delete(el);
    }
    el.addEventListener('pointerdown', e => { if(e.button === 0) press(); });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('blur', () => { s.hover=false; s.tx=s.ty=0; release(); wake(el); });
    s.release = release;
    el.addEventListener('keydown', e => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press();
    });
    el.addEventListener('keyup', e => { if(e.key === ' ' || e.key === 'Enter') release(); });
  }
  function scan(root = document) {
    if (root.matches?.(controlSelector)) bind(root);
    root.querySelectorAll?.(controlSelector).forEach(bind);
  }
  let pendingChoice = null;
  function reportChoice() {
    if (!pendingChoice) return;
    const {frameId,button} = pendingChoice;
    const selected = frameId ? [...document.querySelectorAll('.fcard')].find(el=>el.dataset.frame===frameId) : button;
    if (!selected?.isConnected || selected.getAttribute('aria-pressed') !== 'true') return;
    const label = (selected.querySelector('b,strong,.nm')?.textContent || selected.innerText).replace(/\s+/g,' ').trim();
    pendingChoice = null;
    if (label) notify('已選擇：'+label.slice(0,60));
  }
  scan();
  window.addEventListener('pointerup', () => {
    for (const el of pressed) states.get(el).release();
  }, {passive:true});
  window.addEventListener('blur', () => {
    for (const el of pressed) states.get(el).release();
  });
  reduce.addEventListener('change', () => {
    document.querySelectorAll('.sf-feedback-control').forEach(el => {
      const s=states.get(el);s.hover=false;s.tx=s.ty=0;s.release();wake(el);
    });
  });
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
      if (record.type === 'attributes' && record.target.id === 'savedlg' && record.target.open)
        notify('模擬圖已產生，請依畫面說明儲存圖片。');
      if (record.type === 'attributes' && record.attributeName === 'aria-pressed') reportChoice();
    }
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-pressed']});

  if (scope === 'frame') {
    document.addEventListener('click', event => {
      const b = event.target.closest('.fcard,.seg button,.modeseg button');
      if (!b || b.disabled) return;
      pendingChoice = {frameId:b.dataset.frame,button:b};
      // Frame selection awaits textures. Report the actual selected state, never a guessed timeout.
      requestAnimationFrame(reportChoice);
    }, {capture:true});
    document.addEventListener('change', event => {
      const input = event.target;
      if (!input.matches('input[type=checkbox]')) return;
      const label = input.closest('label')?.querySelector('span')?.textContent?.trim();
      if (label) notify((input.checked?'已開啟：':'已關閉：')+label.slice(0,35));
    });
  }

  if (scope === 'gallery') {
    const app = document.getElementById('app');
    let pageAnimation;
    if (app) new MutationObserver(() => {
      if (reduce.matches) return;
      pageAnimation?.cancel();
      pageAnimation = app.animate([
        {opacity:0.45,translate:'0 14px'}, {opacity:1,translate:'0 0'}
      ],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    }).observe(app,{childList:true});
    document.addEventListener('click', event => {
      if (!event.target.closest('[data-id],.hm-wall button,.hph')) return;
      requestAnimationFrame(() => {
        const dialog=document.getElementById('lb');
        if(dialog?.open && !reduce.matches) dialog.animate([
          {opacity:0,scale:0.96},{opacity:1,scale:1.006,offset:0.78},{opacity:1,scale:1}
        ],{duration:400,easing:'ease-out'});
      });
    });
  }
  // Narrow public surface for genuine state feedback from the 3D scene.
  window.songfongFeedback = Object.freeze({notify,scope,version:'2026-11-06.1'});
})();
