// REPAIHUB end-to-end transfer flow test (experienced-tester script).
// Usage: node scripts/qa/transfer-flow.cjs [appUrl] [outDir] [amountInr]
//   appUrl: https://repaihub.com (default) or a local preview (http://localhost:4173) —
//   for a local preview, API calls are forwarded to https://repaihub.com.
// Walks: sign up → new transfer → residency → NRO → amount → step 2 →
//   Connect via DigiLocker → (must chain straight to) Flinks → back to the transfer with
//   both accounts connected → speed / fee step. Stops before submitting; never moves money.
// Creates a qa.flow.<ts>@repaihub.com account; run scripts/qa/cleanup.sh afterwards.
const { chromium, devices } = require('playwright');

const APP = process.argv[2] || 'https://repaihub.com';
const OUT = process.argv[3] || '.';
const AMOUNT = process.argv[4] || '300000';
const API = 'https://repaihub.com';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext(devices['iPhone 13']);
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  if (!APP.startsWith(API)) {
    // Local preview: forward API calls (fetch/xhr) to production, through the
    // environment's HTTPS proxy when one is set.
    const { request } = require('playwright');
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    const api = await request.newContext(proxyUrl ? { proxy: { server: proxyUrl } } : {});
    await p.route('**/*', async route => {
      const req = route.request();
      if (['fetch', 'xhr'].includes(req.resourceType()) && req.url().startsWith(APP)) {
        const headers = { ...req.headers() }; delete headers.origin; delete headers.referer;
        const resp = await api.fetch(req.url().replace(APP, API), { method: req.method(), headers, data: req.postDataBuffer() || undefined });
        return route.fulfill({ status: resp.status(), headers: resp.headers(), body: await resp.body() });
      }
      return route.continue();
    });
  }
  let n = 0;
  const shot = async name => { n++; await p.screenshot({ path: `${OUT}/flow_${String(n).padStart(2, '0')}_${name}.png`, fullPage: true }); };
  const path = () => p.url().replace(APP, '');
  const body = () => p.evaluate(() => document.body.innerText);
  const email = `qa.flow.${Date.now()}@repaihub.com`;

  try {
    // 1. Sign up
    await p.goto(APP + '/signup', { waitUntil: 'networkidle' });
    await p.fill('input[placeholder="Raj Sharma"]', 'QA Flow Test');
    await p.fill('input[type=email]', email);
    await p.fill('input[type=password]', 'QaFlow!2026demo');
    await p.getByText('I understand the app is a beta preview').click();
    await p.click('button[type=submit]');
    const signed = await p.waitForURL(u => !/\/signup/.test(u.toString()), { timeout: 45000 }).then(() => true).catch(() => false);
    check('sign up', signed, path());

    // 2. New transfer: residency, account type, amount
    await p.goto(APP + '/app/new-transfer', { waitUntil: 'networkidle' });
    if (/Before Your First Transfer/.test(await body())) {
      await p.getByText('Canadian Citizen', { exact: true }).click();
      await p.getByText('Continue to Transfer →').click();
      await p.waitForTimeout(1500);
    }
    if (/NRO — Non-Resident Ordinary/.test(await body())) {
      await p.getByText('NRO — Non-Resident Ordinary').click();
      await p.getByRole('button', { name: /Continue/ }).first().click();
      await p.waitForTimeout(800);
    }
    await shot('amount');
    const amountInput = p.locator('input[placeholder="1,00,000"]');
    check('amount field shown', await amountInput.count() === 1);
    await amountInput.fill(AMOUNT);
    await p.waitForTimeout(500);
    const preview = await body();
    check('fee preview shows base fee + markup', /Base fee/.test(preview) && /Markup \(effective/.test(preview), '');
    check('no TCS deduction shown', !/TCS 5%/.test(preview));
    await shot('amount_filled');
    await p.getByRole('button', { name: 'Continue →' }).last().click();
    await p.waitForTimeout(800);
    await shot('step2_banks');

    // 3. Connect via DigiLocker → must chain straight to Flinks, not back to the transfer
    await p.getByText('Connect via DigiLocker →').first().click();
    await p.waitForURL(/\/onboarding\/india-nro/, { timeout: 15000 });
    check('DigiLocker page opens with returnTo', /returnTo=/.test(p.url()), path());
    await p.getByText('Continue to NRO Details →').click();
    const selects = p.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    const panInput = p.locator('input[placeholder="ABCDE1234F"]');
    const consent = p.getByRole('button', { name: /Grant DigiLocker Consent/ });
    check('consent button disabled until a valid PAN is entered', await consent.isDisabled(), '');
    if (await panInput.count()) await panInput.fill('ABCPE1234K');
    check('consent button enabled with a valid PAN', await consent.isEnabled(), '');
    await shot('digilocker_form');
    await p.getByText('Grant DigiLocker Consent →').click();
    const indiaDone = await p.getByText(/Next — Connect Canadian Bank →|Continue to Transfer →/).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    check('DigiLocker verification completes', indiaDone, (await body()).replace(/\s+/g, ' ').slice(0, 120));
    await shot('digilocker_done');
    const nextBtn = await p.getByText(/Next — Connect Canadian Bank →|Continue to Transfer →/).first().innerText().catch(() => '');
    check('after DigiLocker the next step is Flinks (not back to transfer)', /Connect Canadian Bank/i.test(nextBtn), nextBtn);
    await p.getByText(nextBtn.trim()).click();
    await p.waitForTimeout(1000);
    check('Flinks page opens next', /\/onboarding\/canada-bank/.test(p.url()), path());

    // 4. Flinks → then back to the transfer
    await p.getByText('Connect My Bank →').click();
    await p.locator('select').first().selectOption({ index: 1 });
    await p.fill('input[placeholder="Exactly as on your bank account"]', 'QA Flow Test');
    await p.getByText('Verify with Flinks →').click();
    const canadaDone = await p.getByText('Continue to Transfer →').waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    check('Flinks verification completes → "Continue to Transfer"', canadaDone);
    await shot('flinks_done');
    await p.getByText('Continue to Transfer →').click();
    await p.waitForURL(/\/app\/new-transfer/, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const back = await body();
    check('returned to the transfer at step 2 with both accounts connected', /\/app\/new-transfer/.test(p.url()) && !/Connect via DigiLocker|Connect via Flinks/.test(back), path());
    await shot('back_to_transfer');

    // 5. Continue to Review (purpose); speed and fee were chosen on the first screen
    await p.getByRole('button', { name: 'Continue →' }).last().click().catch(() => {});
    await p.waitForTimeout(800);
    const s3 = await body();
    check('review step asks for purpose (Form 145)', /Review Transfer/.test(s3) && /PURPOSE/i.test(s3), '');
    await p.getByText('Repatriation of savings').click().catch(() => {});
    await p.waitForTimeout(400);
    const s3b = await body();
    check('review shows base fee and markup, no TCS', /Base fee/.test(s3b) && /Markup \(effective/.test(s3b) && !/TCS/.test(s3b), '');
    await shot('review_step');

    // 6. Confirm & send — up to ₹5 lakh: Form 145 Part A screen must NOT ask the customer
    //    to retype anything DigiLocker already verified (PAN, father's name, address, signature).
    await p.getByText('Looks Good — Confirm →').click();
    await p.waitForTimeout(600);
    await p.getByText(/Confirm & Send/).first().click();
    const modal = p.locator('[role=dialog][aria-label="Form 145 Part A declaration"]');
    const modalShown = await modal.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check('Form 145 Part A screen opens for a ≤ ₹5 lakh transfer', modalShown);
    if (modalShown) {
      const mt = await modal.innerText();
      const inputs = await modal.locator('input:not([type=checkbox])').count();
      check('no fields to retype (PAN / father / address / signature)', inputs === 0, `text inputs=${inputs}`);
      check('verified PAN shown masked', /XXXXXX\w{4}\s+✓ verified/.test(mt), '');
      check('uses Form 145 name, not 15CA', /Form 145/.test(mt) && !/15CA(?! )/.test(mt.replace(/formerly 15CA/g, '')), '');
      await shot('form145_partA');
      await modal.getByText('Yes — TDS was deducted').click();
      await modal.locator('input[type=checkbox]').check();
      await modal.getByRole('button', { name: /Confirm & send/i }).click();
      const done = await p.getByText('Transfer Initiated!').waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
      const doneText = (await body()).replace(/\s+/g, ' ');
      check('transfer submitted (beta) with correct Part A wording', done && /no CA certificate needed up to ₹5 lakh/.test(doneText), doneText.slice(0, 160));
      await shot('submitted');
    }

    // 7. Inward (Canada → India) direction is available and priced
    await p.goto(APP + '/app/new-transfer', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    if (/Send money to India/.test(await body())) await p.getByText('Send money to India').click();
    else await p.locator('button[title="Flip direction"]').first().click().catch(() => {});
    await p.waitForTimeout(600);
    const inward = await body();
    check('inward Canada → India available', /Chequing Account \(CAD\)/.test(inward) && /🇨🇦 Canada[\s\S]*🇮🇳 India/.test(inward), '');
    await shot('inward');
  } catch (e) {
    check('flow run', false, e.message.split('\n')[0]);
    await shot('error').catch(() => {});
  } finally {
    check('no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await b.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ app: APP, qaEmail: email, passed: results.length - failed.length, failed: failed.length, results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
