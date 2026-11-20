// REPAIHUB live smoke test — used by Claude's scheduled QA monitor.
// Usage: node scripts/qa/smoke.cjs [baseUrl] [outDir]
// Exits non-zero if any check fails. Creates a QA account (qa.smoke.<ts>@repaihub.com)
// which the caller should delete afterwards.
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] || 'https://repaihub.com';
const OUT = process.argv[3] || '.';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };

(async () => {
  const b = await chromium.launch();
  const email = `qa.smoke.${Date.now()}@repaihub.com`;
  const password = 'QaSmoke!2026demo';
  try {
    // 1. Public pages (desktop + mobile)
    for (const [dev, opts] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
      const c = await b.newContext(opts);
      const p = await c.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      for (const rt of ['/', '/guide', '/property', '/privacy', '/terms', '/login', '/signup', '/forgot-password', '/ca-login']) {
        let status = 0;
        for (let attempt = 0; attempt < 4; attempt++) {           // ride out Render cold starts
          const r = await p.goto(BASE + rt, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
          status = r ? r.status() : 0;
          if (status === 200) break;
          await p.waitForTimeout(15000);
        }
        const h1 = await p.$eval('h1', e => e.innerText).catch(() => '');
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        check(`${dev} ${rt}`, status === 200 && !!h1 && !overflow, `status=${status} h1=${!!h1} overflowX=${overflow}`);
      }
      check(`${dev} no JS errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await c.close();
    }

    // 2. Calculator
    {
      const p = await b.newPage();
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      const inputs = await p.$$('input');
      let amount = null;
      for (const f of inputs) { if ((await f.getAttribute('type')) !== 'email') { amount = f; break; } }
      for (const [inr, fee] of [['300000', '79'], ['1000000', '199'], ['4000000', '499']]) {
        await amount.fill(''); await amount.type(inr); await p.waitForTimeout(300);
        const t = await p.evaluate(() => document.body.innerText);
        check(`calculator ₹${inr} → $${fee}`, new RegExp(`CAD \\$${fee}\\b`).test(t));
      }
      await p.close();
    }

    // 2b. Help assistant answers from approved facts
    {
      const p = await b.newPage();
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      let ok = false, detail = '';
      try {
        await p.click('button[aria-label="Ask REPAIHUB a question"]');
        for (const [q, expect] of [['Who is the founder?', /NIT Durgapur/], ['What are the fees?', /CAD \$79/], ['Is REPAIHUB regulated?', /N300002485/]]) {
          await p.fill('input[aria-label="Your question"]', q);
          await p.press('input[aria-label="Your question"]', 'Enter');
          const last = await p.$$eval('[data-from=bot]', els => els[els.length - 1].innerText);
          if (!expect.test(last)) { detail = `"${q}" → ${last.slice(0, 60)}`; throw new Error(detail); }
        }
        ok = true;
      } catch (e) { detail = detail || e.message.split('\n')[0]; }
      check('help assistant answers', ok, detail);
      await p.close();
    }

    // 3. Sign up → dashboard → log out → log in → wrong password
    {
      const c = await b.newContext(devices['iPhone 13']);
      const p = await c.newPage();
      await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
      await p.fill('input[placeholder="Raj Sharma"]', 'QA Smoke Test');
      await p.fill('input[type=email]', email);
      await p.fill('input[type=password]', password);
      await p.getByText('I understand the app is a beta preview').click();
      const t0 = Date.now();
      await p.click('button[type=submit]');
      const signedUp = await p.waitForURL(u => !/\/signup/.test(u.toString()), { timeout: 45000 }).then(() => true).catch(() => false);
      const signupErr = signedUp ? '' : (await p.evaluate(() => document.body.innerText)).match(/[^\n]*(unavailable|failed|error|already)[^\n]*/i)?.[0] || '';
      check('sign up', signedUp, `${Date.now() - t0}ms → ${p.url().replace(BASE, '')} ${signupErr}`);
      await p.screenshot({ path: `${OUT}/smoke_after_signup.png` });

      // log out by clearing the session, then log in again with the same password
      await p.evaluate(() => localStorage.clear());
      await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
      await p.fill('input[type=email]', email);
      await p.fill('input[type=password]', password);
      const t1 = Date.now();
      await p.click('button[type=submit]');
      const loggedIn = await p.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 30000 }).then(() => true).catch(() => false);
      check('log in after sign up (password saved)', loggedIn, `${Date.now() - t1}ms → ${p.url().replace(BASE, '')}`);
      await p.screenshot({ path: `${OUT}/smoke_after_login.png` });

      // walk the app
      for (const rt of ['/app/dashboard', '/app/transfer', '/app/new-transfer', '/app/fees', '/app/compliance', '/app/settings']) {
        await p.goto(BASE + rt, { waitUntil: 'networkidle', timeout: 45000 });
        await p.waitForTimeout(1000);
        const onLogin = /\/login/.test(p.url());
        const text = await p.evaluate(() => document.body.innerText);
        check(`app page ${rt}`, !onLogin && !/fetch failed|something went wrong|cannot read prop/i.test(text), onLogin ? 'redirected to login' : '');
        await p.screenshot({ path: `${OUT}/smoke${rt.replace(/\//g, '_')}.png` });
      }

      // wrong password
      await p.evaluate(() => localStorage.clear());
      await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
      await p.fill('input[type=email]', email);
      await p.fill('input[type=password]', 'WrongPassword!123');
      const t2 = Date.now();
      await p.click('button[type=submit]');
      const errShown = await p.waitForFunction(() => /invalid|incorrect/i.test(document.body.innerText), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check('wrong password rejected with message', errShown && /\/login/.test(p.url()), `${Date.now() - t2}ms`);
      await c.close();
    }
  } catch (e) {
    check('smoke run', false, e.message.split('\n')[0]);
  } finally {
    await b.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ base: BASE, qaEmail: email, passed: results.length - failed.length, failed: failed.length, results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
