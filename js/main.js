/* ============================================================
   CS CABLES — main.js
   Pricing (25% OFF on listed price) · reveal · carousel · cart
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const RUPEE = '₹';
  const fmt = n => n.toLocaleString('en-IN');

  /* ---------- Pricing: 25% OFF on the listed price ----------
     Listed price becomes the struck original; discounted price is shown
     as the live price; the cart charges the discounted amount.
     Runs BEFORE the carousel clones cards so clones inherit markup.        */
  const DISCOUNT = 0.25;
  const disc = orig => Math.floor(orig * (1 - DISCOUNT));
  const OFF = '25% OFF';

  function parseRupees(txt) {
    const m = (txt || '').replace(/[^0-9.]/g, '');
    return m ? Math.round(parseFloat(m)) : null;
  }

  function decoratePrices() {
    // Product cards / carousel cards
    $$('.product-price').forEach(el => {
      if (el.classList.contains('has-off')) return;
      const orig = parseRupees(el.textContent);
      if (!orig) return;
      const now = disc(orig);
      const per = el.querySelector('small') ? el.querySelector('small').textContent.trim() : '';
      el.classList.add('has-off');
      el.innerHTML =
        '<span class="price-line">' +
          '<s class="price-was">' + RUPEE + fmt(orig) + '</s>' +
          '<span class="price-off">' + OFF + '</span>' +
        '</span>' +
        '<span class="price-now"><span class="rupee">' + RUPEE + '</span>' + fmt(now) +
          (per ? ' <small>' + per + '</small>' : '') +
        '</span>';
      // Make the linked add button charge the discounted price
      const card = el.closest('.product-card');
      if (card) {
        const btn = $('[data-add]', card);
        if (btn) btn.dataset.price = String(now);
      }
    });

    // Series rows (home) — inline price with a <b>
    $$('.series-price').forEach(el => {
      if (el.dataset.off) return;
      const b = el.querySelector('b');
      if (!b) return;
      const orig = parseRupees(b.textContent);
      if (!orig) return;
      const now = disc(orig);
      b.textContent = RUPEE + fmt(now);
      const was = document.createElement('s');
      was.className = 'price-was';
      was.textContent = RUPEE + fmt(orig);
      const badge = document.createElement('span');
      badge.className = 'price-off';
      badge.textContent = OFF;
      b.parentNode.insertBefore(was, b);
      b.parentNode.insertBefore(badge, b.nextSibling);
      el.dataset.off = '1';
    });
  }

  /* ---------- Header scroll state ---------- */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    const toggle = $('.nav-toggle');
    const nav = $('.nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('.nav a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const els = $$('[data-reveal]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------- Center-focus infinite carousel ---------- */
  function initCarousel() {
    const track = $('.carousel-track.center-mode');
    if (!track) return;
    const originals = $$('.product-card', track);
    if (originals.length < 2) return;

    // Clone the set into 3 copies for a seamless infinite loop
    const setSize = originals.length;
    const frag = document.createDocumentFragment();
    for (let c = 0; c < 2; c++) {
      originals.forEach(card => frag.appendChild(card.cloneNode(true)));
    }
    track.appendChild(frag);

    let cards = $$('.product-card', track);
    let active = setSize;               // start in the middle set
    let cardW = 0, gap = 0;

    function measure() {
      // offsetWidth ignores the CSS scale() transform on the cards, so the
      // centering math uses the true layout width (fixes off-center active card).
      cardW = cards[0].offsetWidth;
      const cs = getComputedStyle(track);
      gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
    }

    function layout(animate) {
      measure();
      const step = cardW + gap;
      const wrapW = track.parentElement.getBoundingClientRect().width;
      const offset = (wrapW / 2) - (cardW / 2) - (active * step);
      track.style.transition = animate ? '' : 'none';
      track.style.transform = 'translateX(' + offset + 'px)';
      cards.forEach((card, i) => {
        const d = Math.abs(i - active);
        card.classList.toggle('is-center', d === 0);
        card.classList.toggle('near', d === 1);
      });
      if (!animate) { void track.offsetWidth; track.style.transition = ''; }
    }

    function normalize() {
      if (active >= setSize * 2) active -= setSize;
      else if (active < setSize) active += setSize;
      layout(false);
    }

    function go(dir) { active += dir; layout(true); }

    track.addEventListener('transitionend', normalize);

    // Controls
    const root = track.closest('.carousel-bleed') || document;
    const prev = $('.carousel-prev', root) || $('[data-carousel="prev"]');
    const next = $('.carousel-next', root) || $('[data-carousel="next"]');
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));

    // Click a side card to center it
    track.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (!card || card.classList.contains('is-center')) return;
      if (e.target.closest('[data-add]')) return; // let add-to-cart work
      const idx = cards.indexOf(card);
      if (idx > -1) { active = idx; layout(true); }
    });

    // Swipe
    let sx = 0, sy = 0, swiping = false;
    track.addEventListener('touchstart', (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
    }, { passive: true });
    track.addEventListener('touchend', (e) => {
      if (!swiping) return; swiping = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Autoplay (pause on hover)
    let timer = null;
    const AUTO = 4800;
    const start = () => { stop(); timer = setInterval(() => go(1), AUTO); };
    const stop = () => { if (timer) clearInterval(timer), timer = null; };
    track.addEventListener('mouseenter', stop);
    track.addEventListener('mouseleave', start);

    const relayout = () => layout(false);
    window.addEventListener('resize', relayout);
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    // Initial paint + retries so the active card is centered once fonts/layout settle
    requestAnimationFrame(() => { layout(false); start(); });
    setTimeout(relayout, 200);
    setTimeout(relayout, 600);
  }

  /* ---------- Product filter (products page) ---------- */
  function initFilter() {
    const bar = $('[data-filter-bar]');
    if (!bar) return;
    const cards = $$('.product-grid .product-card');
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      $$('[data-filter]', bar).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      cards.forEach(c => {
        c.hidden = !(f === 'all' || c.dataset.series === f);
      });
    });
  }

  /* ---------- Tabs (spec tables) ---------- */
  function initTabs() {
    $$('[data-tabs]').forEach(group => {
      const btns = $$('[data-tab]', group);
      // Panels live alongside the tab group (often siblings of the header),
      // so search the enclosing section, falling back to the document.
      const scope = group.closest('section') || document;
      btns.forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        btns.forEach(b => b.classList.toggle('active', b === btn));
        $$('[data-tab-panel]', scope).forEach(p => {
          p.hidden = p.dataset.tabPanel !== id;
        });
      }));
    });
  }

  /* ---------- Cart (localStorage; Shopify-ready) ---------- */
  const CART_KEY = 'cscables_cart_v1';
  const WA = '917230989720';

  const Cart = {
    items: [],
    load() { try { this.items = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { this.items = []; } },
    save() { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); },
    add(item) {
      const found = this.items.find(i => i.id === item.id);
      if (found) found.qty += 1;
      else this.items.push({ id: item.id, name: item.name, price: item.price, img: item.img, qty: 1 });
      this.save(); this.render();
    },
    setQty(id, delta) {
      const it = this.items.find(i => i.id === id);
      if (!it) return;
      it.qty += delta;
      if (it.qty <= 0) this.items = this.items.filter(i => i.id !== id);
      this.save(); this.render();
    },
    remove(id) { this.items = this.items.filter(i => i.id !== id); this.save(); this.render(); },
    count() { return this.items.reduce((n, i) => n + i.qty, 0); },
    total() { return this.items.reduce((s, i) => s + i.price * i.qty, 0); },
    render() {
      const badge = $('.cart-count');
      const n = this.count();
      if (badge) { badge.textContent = n; badge.dataset.empty = n === 0 ? 'true' : 'false'; }
      const body = $('.cart-body');
      const foot = $('.cart-foot');
      if (!body) return;
      if (!this.items.length) {
        body.innerHTML =
          '<div class="cart-empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>' +
          '<p>Your cart is empty.</p></div>';
        if (foot) foot.hidden = true;
        return;
      }
      if (foot) foot.hidden = false;
      body.innerHTML = this.items.map(i =>
        '<div class="cart-line">' +
          '<img class="thumb" src="' + i.img + '" alt="" loading="lazy">' +
          '<div><h4>' + i.name + '</h4>' +
            '<div class="sub">' + RUPEE + fmt(i.price) + ' each</div>' +
            '<div class="qty"><button data-dec="' + i.id + '">−</button><span>' + i.qty + '</span><button data-inc="' + i.id + '">+</button></div>' +
          '</div>' +
          '<div style="text-align:right"><div class="price">' + RUPEE + fmt(i.price * i.qty) + '</div>' +
            '<div class="rm" data-rm="' + i.id + '">Remove</div></div>' +
        '</div>'
      ).join('');
      const tot = $('.cart-total b');
      if (tot) tot.textContent = RUPEE + fmt(this.total());
    }
  };

  function toast(msg) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(t);
    }
    $('span', t).textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function openCart(open) {
    const drawer = $('.cart-drawer');
    const overlay = $('.cart-overlay');
    if (!drawer || !overlay) return;
    drawer.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function checkout() {
    if (!Cart.items.length) { toast('Your cart is empty'); return; }
    // --- Shopify swap point ---
    // Replace the block below with a Shopify cart permalink, e.g.:
    //   const variants = Cart.items.map(i => i.shopifyVariant + ':' + i.qty).join(',');
    //   window.location = 'https://<shop>.myshopify.com/cart/' + variants;
    let msg = 'Hello CS Cables, I would like to order:%0A%0A';
    Cart.items.forEach(i => {
      msg += '• ' + i.name + ' x' + i.qty + ' — ' + RUPEE + fmt(i.price * i.qty) + '%0A';
    });
    msg += '%0ATotal: ' + RUPEE + fmt(Cart.total());
    window.open('https://wa.me/' + WA + '?text=' + msg, '_blank');
  }

  function initCart() {
    Cart.load();
    Cart.render();

    // Add to cart (event delegation so cloned carousel cards work)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      Cart.add({
        id: btn.dataset.add,
        name: btn.dataset.name,
        price: parseInt(btn.dataset.price, 10) || 0,
        img: btn.dataset.img
      });
      btn.classList.add('added');
      const label = $('span', btn);
      const original = label ? label.textContent : null;
      if (label) label.textContent = 'Added';
      setTimeout(() => { btn.classList.remove('added'); if (label && original) label.textContent = original; }, 1400);
      toast(btn.dataset.name + ' added to cart');
    });

    // Drawer controls
    const cartBtn = $('.cart-btn');
    if (cartBtn) cartBtn.addEventListener('click', () => openCart(true));
    const closeBtn = $('.cart-close');
    if (closeBtn) closeBtn.addEventListener('click', () => openCart(false));
    const overlay = $('.cart-overlay');
    if (overlay) overlay.addEventListener('click', () => openCart(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openCart(false); });

    // Qty / remove (delegation)
    const body = $('.cart-body');
    if (body) body.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      const rm = e.target.closest('[data-rm]');
      if (inc) Cart.setQty(inc.dataset.inc, 1);
      else if (dec) Cart.setQty(dec.dataset.dec, -1);
      else if (rm) Cart.remove(rm.dataset.rm);
    });

    const checkoutBtn = $('.cart-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
  }

  /* ---------- Catalogue lightbox ---------- */
  function initLightbox() {
    const pages = $$('.cat-page');
    const box = $('.lightbox');
    if (!pages.length || !box) return;
    const bImg = $('.lightbox img', box);
    const count = $('.lightbox-count', box);
    const srcs = pages.map(p => {
      const img = p.querySelector('img');
      return img ? (img.dataset.full || img.src) : '';
    });
    let idx = 0;

    function show(i) {
      idx = (i + srcs.length) % srcs.length;
      bImg.src = srcs[idx];
      if (count) count.textContent = 'Page ' + (idx + 1) + ' / ' + srcs.length;
    }
    function open(i) { show(i); box.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { box.classList.remove('open'); document.body.style.overflow = ''; }

    pages.forEach((p, i) => p.addEventListener('click', (e) => { e.preventDefault(); open(i); }));
    const closeBtn = $('.lightbox-close', box);
    const prevBtn = $('.lightbox-prev', box);
    const nextBtn = $('.lightbox-next', box);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', (e) => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- Footer year ---------- */
  function initYear() {
    $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  }

  /* ---------- Boot ---------- */
  function boot() {
    decoratePrices();   // must run before the carousel clones cards
    initHeader();
    initNav();
    initReveal();
    initCarousel();
    initFilter();
    initTabs();
    initCart();
    initLightbox();
    initYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
