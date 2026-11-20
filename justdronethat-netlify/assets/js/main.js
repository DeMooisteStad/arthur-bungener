/* Just Drone That — interactie & scroll-animaties (vanilla JS, geen libraries) */
(() => {
    'use strict';
    const doc = document.documentElement;
    const body = document.body;
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    if (reduce) doc.classList.add('reduce');

    /* ---------- Loader ---------- */
    const store = {
        get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* privé-modus */ } },
    };
    const loaded = () => { body.classList.add('is-loaded'); store.set('jdt-visited', '1'); };
    if (store.get('jdt-visited') || reduce) {
        body.classList.add('no-loader');
        requestAnimationFrame(() => requestAnimationFrame(loaded));
    } else {
        const bar = $('.loader-bar span'), pct = $('.loader-pct');
        let p = 0, done = false;
        const tick = () => {
            p = Math.min(done ? 100 : 92, p + (done ? 9 : Math.random() * 7));
            if (bar) bar.style.width = p + '%';
            if (pct) pct.textContent = String(Math.round(p)).padStart(3, '0');
            if (p < 100) setTimeout(tick, 40); else setTimeout(loaded, 180);
        };
        tick();
        const finish = () => { done = true; };
        if (document.readyState === 'complete') setTimeout(finish, 500);
        else window.addEventListener('load', () => setTimeout(finish, 200));
        setTimeout(finish, 2600); // nooit langer wachten dan nodig
    }

    /* ---------- Koppen splitsen in woorden ---------- */
    const splitHeading = (el) => {
        let w = 0;
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const parts = child.textContent.split(/(\s+)/);
                    const frag = document.createDocumentFragment();
                    parts.forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const ln = document.createElement('span');
                        ln.className = 'ln';
                        const inner = document.createElement('span');
                        inner.style.setProperty('--w', w++);
                        inner.textContent = part;
                        ln.appendChild(inner);
                        frag.appendChild(ln);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
    };
    $$('.split, [data-split-lines]').forEach((el) => { el.classList.add('split'); splitHeading(el); });

    /* ---------- Reveal bij scrollen ---------- */
    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    $$('.reveal, .reveal-card, .split:not(.hero-title), .clip-reveal').forEach((el) => io.observe(el));

    /* ---------- Statement: woorden lichten op tijdens scrollen ---------- */
    const scrub = $$('[data-scrub-words]').map((el) => {
        const words = el.textContent.trim().split(/\s+/);
        el.innerHTML = words.map((w) => `<span class="w">${w.replace(/</g, '&lt;')}</span>`).join(' ');
        return { el, words: $$('.w', el) };
    });

    /* ---------- Tellers ---------- */
    const counter = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (!en.isIntersecting) return;
            counter.unobserve(en.target);
            const raw = en.target.dataset.count;
            const m = raw.match(/^(\D*)(\d+)(.*)$/);
            if (!m || reduce) return;
            const target = parseInt(m[2], 10), t0 = performance.now(), dur = 1600;
            const step = (t) => {
                const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
                en.target.textContent = m[1] + Math.round(target * e) + m[3];
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach((el) => counter.observe(el));

    /* ---------- Scroll-loop: header, voortgang, hoogtemeter, parallax ---------- */
    const header = $('.site-header');
    const progress = $('.progress span');
    const alt = $('.altimeter'), altVal = $('.alt-val b'), altDot = $('.alt-dot');
    const hero = $('.hero'), heroMedia = $('[data-parallax-hero]'), heroContent = $('.hero-content');
    const parallax = $$('[data-parallax]');
    const dock = $('.dock');
    let lastY = window.scrollY, ticking = false;

    const onScroll = () => {
        const y = window.scrollY;
        const vh = window.innerHeight;
        const max = Math.max(1, doc.scrollHeight - vh);
        const p = clamp(y / max, 0, 1);

        if (header) {
            header.classList.toggle('is-scrolled', y > 40);
            const menuOpen = body.classList.contains('menu-open');
            header.classList.toggle('is-hidden', !menuOpen && y > lastY && y > vh * 0.8);
        }
        if (progress) progress.style.transform = `scaleX(${p})`;
        if (alt) {
            alt.classList.toggle('on', y > vh * 0.5);
            altVal.textContent = String(Math.round(p * 120)).padStart(3, '0'); // max. 120 m wettelijk
            altDot.style.bottom = `calc(${p * 100}% - 3px)`;
        }
        if (dock) dock.classList.toggle('on', y > (hero ? vh * 0.6 : 200));

        if (!reduce) {
            if (heroMedia && y < vh * 1.2) {
                const k = y / vh;
                heroMedia.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(${1 + k * 0.08})`;
                if (heroContent) {
                    heroContent.style.transform = `translate3d(0, ${y * -0.15}px, 0)`;
                    heroContent.style.opacity = String(1 - clamp(k * 1.3, 0, 1));
                }
            }
            parallax.forEach((el) => {
                const r = el.parentElement.getBoundingClientRect();
                if (r.bottom < 0 || r.top > vh) return;
                el.style.transform = `translate3d(0, ${-r.top * parseFloat(el.dataset.parallax || 0.2)}px, 0)`;
            });
        }
        scrub.forEach(({ el, words }) => {
            const r = el.getBoundingClientRect();
            const k = reduce ? 1 : clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
            const n = Math.round(k * words.length);
            words.forEach((w, i) => w.classList.toggle('on', i < n));
        });
        lastY = y;
        ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();

    /* ---------- HUD-tijdcode ---------- */
    const tc = $('.hud-tc');
    if (tc) {
        const t0 = performance.now();
        const pad = (n) => String(n).padStart(2, '0');
        setInterval(() => {
            const ms = performance.now() - t0, s = Math.floor(ms / 1000);
            tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(Math.floor((ms % 1000) / 1000 * 25))}`;
        }, 40);
    }

    /* ---------- Video's: lazy laden & pauzeren buiten beeld ---------- */
    const vidIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            const v = en.target;
            if (en.isIntersecting) {
                $$('source[data-src]', v).forEach((s) => { s.src = s.dataset.src; s.removeAttribute('data-src'); v.load(); });
                if (v.autoplay || v.hasAttribute('data-lazy-video') || v.classList.contains('hero-video')) v.play().catch(() => {});
            } else if (!v.paused) {
                v.pause();
            }
        });
    }, { rootMargin: '200px 0px' });
    $$('video[data-lazy-video], .hero-video').forEach((v) => vidIO.observe(v));

    /* Projectkaarten: video afspelen bij hover (desktop) */
    if (finePointer) {
        $$('.card').forEach((card) => {
            const v = $('.card-video', card);
            if (!v) return;
            card.addEventListener('mouseenter', () => {
                if (!v.src && v.dataset.src) v.src = v.dataset.src;
                v.play().then(() => card.classList.add('is-playing')).catch(() => {});
            });
            card.addEventListener('mouseleave', () => { card.classList.remove('is-playing'); v.pause(); });
        });
    }

    /* ---------- Werkwijze: actieve stap ---------- */
    const steps = $$('.step');
    const stepLabel = $('.process-step-label');
    if (steps.length) {
        const stepIO = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (en.isIntersecting) {
                    steps.forEach((s) => s.classList.toggle('is-active', s === en.target));
                    if (stepLabel) stepLabel.textContent = 'STAP ' + en.target.dataset.step;
                }
            });
        }, { rootMargin: '-45% 0px -45% 0px' });
        steps.forEach((s) => stepIO.observe(s));
        steps[0].classList.add('is-active');
    }


    /* ---------- Showreel: frame groeit mee tijdens scrollen ---------- */
    const reel = $('.reel'), reelFrame = $('.reel-frame');
    if (reel && reelFrame) {
        const upd = () => {
            const r = reel.getBoundingClientRect();
            const p = reduce ? 1 : clamp(-r.top / Math.max(1, r.height - window.innerHeight) * 1.25, 0, 1);
            reelFrame.style.setProperty('--p', (1 - Math.pow(1 - p, 3)).toFixed(4));
        };
        window.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
        window.addEventListener('resize', upd);
        upd();
    }

    /* ---------- Story-speler (alle films, zoals Instagram) ---------- */
    const st = $('.stories'), dataEl = $('#reel-data');
    if (st && dataEl) {
        let list = [];
        try { list = JSON.parse(dataEl.textContent); } catch (e) { list = []; }
        const v = $('video', st), bars = $('.stories-bars', st), bg = $('.stories-bg', st);
        const title = $('.stories-meta b', st), loc = $('.stories-meta small', st), cta = $('.stories-cta', st);
        let i = 0, raf = null, lastFocus = null;
        bars.innerHTML = list.map(() => '<span><i></i></span>').join('');
        const barEls = $$('span', bars);
        const tick = () => {
            if (v.duration) $('i', barEls[i]).style.width = (v.currentTime / v.duration * 100) + '%';
            raf = requestAnimationFrame(tick);
        };
        const show = (n) => {
            if (n < 0) n = 0;
            if (n >= list.length) { close(); return; }
            i = n;
            const it = list[i];
            barEls.forEach((b, k) => { b.classList.toggle('done', k < i); $('i', b).style.width = k < i ? '100%' : '0'; });
            v.poster = it.poster; v.src = it.video; v.play().catch(() => {});
            bg.style.backgroundImage = `url("${it.poster}")`;
            title.textContent = it.title; loc.textContent = it.location; cta.href = it.url;
        };
        const open = (n = 0) => {
            if (!list.length) return;
            lastFocus = document.activeElement;
            st.hidden = false; body.style.overflow = 'hidden';
            requestAnimationFrame(() => st.classList.add('on'));
            show(n); cancelAnimationFrame(raf); tick();
            $('.stories-close', st).focus();
        };
        const close = () => {
            st.classList.remove('on'); v.pause(); cancelAnimationFrame(raf); body.style.overflow = '';
            setTimeout(() => { st.hidden = true; v.removeAttribute('src'); v.load(); }, 450);
            if (lastFocus) lastFocus.focus();
        };
        v.addEventListener('ended', () => show(i + 1));
        $('.stories-nav.next', st).addEventListener('click', () => show(i + 1));
        $('.stories-nav.prev', st).addEventListener('click', () => show(i - 1));
        $('.stories-close', st).addEventListener('click', close);
        st.addEventListener('click', (e) => { if (e.target === st || e.target === bg) close(); });
        document.addEventListener('keydown', (e) => {
            if (st.hidden) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') show(i + 1);
            if (e.key === 'ArrowLeft') show(i - 1);
        });
        $$('[data-reel-open]').forEach((b) => b.addEventListener('click', () => open(0)));
    }

    /* ---------- Zachte paginaovergang ---------- */
    const curtain = $('.curtain');
    if (curtain && !reduce) {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href]');
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-lightbox')) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin || /^(mailto|tel):/.test(a.href)) return;
            if (url.pathname === location.pathname && url.hash) return;
            e.preventDefault();
            curtain.classList.add('on');
            setTimeout(() => { location.href = a.href; }, 320);
        });
        window.addEventListener('pageshow', (e) => { if (e.persisted) curtain.classList.remove('on'); });
    }

    /* ---------- Custom cursor ---------- */
    const cursor = $('.cursor');
    if (cursor && finePointer && !reduce) {
        body.classList.add('has-cursor');
        const dot = $('.cursor-dot', cursor), ring = $('.cursor-ring', cursor), label = $('b', ring);
        let mx = -100, my = -100, rx = -100, ry = -100;
        window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px)`; }, { passive: true });
        const loop = () => { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx}px, ${ry}px)`; requestAnimationFrame(loop); };
        loop();
        document.addEventListener('mouseover', (e) => {
            const lab = e.target.closest('[data-cursor]');
            const link = e.target.closest('a, button, summary, label.choice');
            cursor.classList.toggle('is-label', !!lab);
            cursor.classList.toggle('is-hover', !lab && !!link);
            if (lab) label.textContent = lab.dataset.cursor;
        });
        document.addEventListener('mouseleave', () => { mx = my = -100; });
    }

    /* ---------- Mobiel menu ---------- */
    const toggle = $('.menu-toggle'), menu = $('#mobile-menu');
    if (toggle && menu) {
        const set = (open) => {
            body.classList.toggle('menu-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
            if (open) menu.hidden = false;
            else setTimeout(() => { if (!body.classList.contains('menu-open')) menu.hidden = true; }, 800);
        };
        toggle.addEventListener('click', () => set(!body.classList.contains('menu-open')));
        $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    }

    /* ---------- Projectfilter ---------- */
    $$('.filters .chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const f = chip.dataset.filter;
            $$('.filters .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
            $$('.filter-item').forEach((it) => {
                const show = f === '*' || it.dataset.cat === f;
                it.classList.toggle('is-out', !show);
                if (show) { const c = $('.reveal-card', it); if (c) c.classList.add('in'); }
            });
        });
    });

    /* ---------- Btw-schakelaar (tarieven) ---------- */
    $$('.vat-toggle .chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const inc = chip.dataset.vat === 'inc';
            $$('.vat-toggle .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
            $$('[data-ex]').forEach((b) => {
                const v = parseFloat(b.dataset.ex) * (inc ? 1.21 : 1);
                b.textContent = '€ ' + v.toLocaleString('nl-NL', { minimumFractionDigits: inc ? 2 : 0, maximumFractionDigits: 2 });
            });
        });
    });

    /* ---------- Lightbox ---------- */
    const lb = $('.lightbox');
    if (lb) {
        const lbImg = $('img', lb);
        const close = () => { lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; }, 400); };
        $$('[data-lightbox]').forEach((a) => a.addEventListener('click', (e) => {
            e.preventDefault();
            lbImg.src = a.href; lbImg.alt = ($('img', a) || {}).alt || '';
            lb.hidden = false; requestAnimationFrame(() => lb.classList.add('on'));
        }));
        lb.addEventListener('click', (e) => { if (e.target !== lbImg) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });
    }

    /* ---------- Formulier (AJAX met fallback) ---------- */
    $$('form[data-ajax]').forEach((form) => {
        const alertBox = $('.form-alert[role="status"]', form);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            $$('.field-err', form).forEach((x) => x.remove());
            $$('.has-err', form).forEach((x) => x.classList.remove('has-err'));
            form.classList.add('is-sending');
            try {
                const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' } });
                const data = await res.json();
                alertBox.hidden = false;
                alertBox.textContent = data.message;
                alertBox.className = 'form-alert ' + (data.ok ? 'is-ok' : 'is-error');
                if (data.ok) {
                    form.classList.add('is-done');
                    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
                    if (window.gtag) window.gtag('event', 'generate_lead');
                } else {
                    Object.entries(data.errors || {}).forEach(([k, msg]) => {
                        const input = form.elements[k];
                        const wrap = input && (input.closest('.field') || input.closest('.consent'));
                        if (wrap) {
                            wrap.classList.add('has-err');
                            const s = document.createElement('span'); s.className = 'field-err'; s.textContent = msg; wrap.appendChild(s);
                        }
                    });
                    const first = $('.has-err', form);
                    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } catch (err) {
                form.removeAttribute('data-ajax');
                form.submit(); // terugvallen op normale verzending
            } finally {
                form.classList.remove('is-sending');
            }
        });
    });
})();
