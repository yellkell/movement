// The probe: boots the built app headless and rides the whole circuit
// itself — out on the runner, up the lift through its sweep, across the
// skywalk through all six stolen moves, down the drop, home — asserting the
// mechanism at every joint and holding the frame to the research/02 budgets.
// The one thing it must prove above all: THE SLIDE IS GONE. Ground departing
// under a body that isn't tracked on it never takes the frame and never
// moves the rig — it is a slip, a miss, and the world stands still.

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4174;
const EXECUTABLE = process.env.PROBE_BROWSER || '/opt/pw-browsers/chromium';

const failures = [];
let checks = 0;
function assert(name, cond, detail = '') {
  checks++;
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures.push(name);
    console.error(`FAIL  ${name}  ${detail}`);
  }
}

async function waitPort(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`preview server never answered on :${port}`);
}

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'ignore', detached: false },
);
process.on('exit', () => server.kill());

try {
  await waitPort(PORT);
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });

  // ---------------------------------------------------------------- probe A
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`http://127.0.0.1:${PORT}/?probe`);
    await page.waitForFunction(() => window.__VOIDSTEP !== undefined, null, {
      timeout: 30000,
    });

    // A small riding library, installed once in the page. All movement is
    // the body: the probe never teleports the rig, only the head.
    await page.evaluate(() => {
      const d = window.__VOIDSTEP;
      const G = d.G;
      const P = {
        idx: (id) => d.ids.indexOf(id),
        st: (id) => G.platforms[P.idx(id)],
        stepUntil(pred, cap = 30000) {
          let n = 0;
          while (!pred() && n++ < cap) d.step(5);
          return pred();
        },
        tile(id, k = 0) {
          const i = P.idx(id);
          const s = G.platforms[i];
          const c = d.claims[i][k];
          return {
            x: s.anchor.x - G.rig.x + c[0] * 0.66,
            z: s.anchor.z - G.rig.z + c[1] * 0.66,
          };
        },
        stand(id, k = 0, y = 1.7) {
          const t = P.tile(id, k);
          d.setBody(t.x, t.z, y);
        },
        board(id, k = 0) {
          const ok = P.stepUntil(
            () => P.st(id).aligned && !P.st(id).moving,
            60000,
          );
          if (!ok) return false;
          P.stand(id, k);
          d.step(10);
          return G.tracked === P.idx(id);
        },
        // Ride the tracked platform like an attentive player: obey every
        // charging attack's safe answer (or, when obey is false, stand tall
        // in the default spot and take what comes), until pred.
        ride(id, k, pred, obey = true, cap = 30000) {
          const i = P.idx(id);
          const home = P.tile(id, k);
          const cur = { x: home.x, z: home.z, y: 1.7 };
          let n = 0;
          while (!pred() && n++ < cap) {
            cur.y = 1.7;
            if (obey) {
              for (let a = 0; a < d.attacks.length; a++) {
                const spec = d.attacks[a];
                const s = G.attacks[a];
                if (P.idx(spec.platform) !== i) continue;
                if (s.phase !== 'charge') continue;
                switch (spec.kind) {
                  case 'beam':
                    cur.x = spec.at === 0 ? -0.66 : 0;
                    break;
                  case 'rail':
                    cur.z = spec.at === 0 ? -0.66 : 0;
                    break;
                  case 'seesaw':
                    cur.x = spec.side === -1 ? 0 : -0.66;
                    break;
                  case 'surge':
                    cur.z = spec.side === -1 ? 0 : -0.66;
                    break;
                  case 'gate':
                    cur.x = spec.at;
                    break;
                  case 'sweep':
                    cur.y = 1.0;
                    break;
                }
              }
            }
            d.setBody(cur.x, cur.z, cur.y);
            d.step(5);
          }
          return pred();
        },
      };
      window.__P = P;
    });

    const S = (fn, ...args) =>
      page.evaluate(
        ({ code, a }) => {
          const d = window.__VOIDSTEP;
          const P = window.__P;
          return new Function('d', 'P', 'a', `return (${code})(d, P, ...a)`)(d, P, a);
        },
        { code: fn.toString(), a: args },
      );

    // --- Boot state and budgets.
    const boot = await S((d) => ({
      n: d.G.platforms.length,
      tracked: d.G.tracked,
      rig: { ...d.G.rig },
      noCorrection: !('correction' in d.G),
    }));
    assert('boots with the full circuit of platforms', boot.n === 10, `n=${boot.n}`);
    assert('home tracked at origin', boot.tracked === 0 && Math.hypot(boot.rig.x, boot.rig.y, boot.rig.z) < 1e-6);
    assert('the correction term does not exist', boot.noCorrection === true);

    const info = await S((d) => {
      d.step(30);
      d.render();
      return d.render();
    });
    console.log(`  draw calls=${info.calls} triangles=${info.triangles}`);
    assert('draw calls within budget', info.calls <= 60, `calls=${info.calls}`);
    assert('triangles within budget', info.triangles <= 100000, `tris=${info.triangles}`);

    const wayBoot = await S((d) => {
      d.step(10);
      return { target: d.G.wayfind.targetIndex, runner: d.ids.indexOf('runner-out') };
    });
    assert('wayfinding points at the out runner', wayBoot.target === wayBoot.runner);

    // --- The paired step onto the runner: clean handover, rig unmoved.
    await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 1);
      P.stand('runner-out', 0);
      d.step(10);
    });
    let st = await S((d) => ({ tracked: d.G.tracked, rig: { ...d.G.rig } }));
    assert('clean handover onto the runner', st.tracked === 1);
    assert('clean handover moved nothing', Math.hypot(st.rig.x, st.rig.y, st.rig.z) < 1e-3);

    await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 10.3);
    });
    st = await S((d) => ({ rig: { ...d.G.rig }, tracked: d.G.tracked }));
    assert(
      'the ride delivered the rig east',
      Math.abs(st.rig.x - 2.6) < 0.02 && Math.abs(st.rig.z + 1.2) < 0.02 && st.tracked === 1,
      JSON.stringify(st.rig),
    );

    await S((d) => {
      d.setBody(0, 0);
      d.step(10);
    });
    st = await S((d) => ({ tracked: d.G.tracked, body: d.world.camera.position.x }));
    assert('paired step lands on east-step, body centred', st.tracked === 2 && Math.abs(st.body) < 1e-6, JSON.stringify(st));

    // --- THE SLIP — the simplification, proven. Stand on the runner as it
    // departs un-tracked: the frame must hold, the rig must not move, and
    // the miss must be charged as a slip. (In stepwell this exact stance
    // forced a switch and slid the world back under your feet.)
    const slip = await S((d, P) => {
      // Wait until the departing runner is clearly unaligned but its deck
      // is still underfoot, then plant the head on its actual tile.
      P.stepUntil(() => d.G.transport.bars > 14.18);
      const rig0 = { ...d.G.rig };
      const slips0 = d.G.slips;
      P.stand('runner-out', 0);
      d.step(14);
      const during = {
        tracked: d.G.tracked,
        slips: d.G.slips,
        rig: { ...d.G.rig },
        aligned: P.st('runner-out').aligned,
      };
      d.setBody(0, 0); // step back to safe ground
      d.step(10);
      return { rig0, during, slips0, back: d.G.tracked };
    });
    assert(
      'departing ground never takes the frame',
      slip.during.tracked === 2 && slip.during.aligned === false,
      JSON.stringify(slip.during),
    );
    assert(
      'the world stood still through it',
      Math.abs(slip.during.rig.x - slip.rig0.x) < 1e-6 &&
        Math.abs(slip.during.rig.z - slip.rig0.z) < 1e-6,
    );
    assert('the miss is charged as a slip', slip.during.slips === slip.slips0 + 1);

    // --- The gate: the lift returning to its berth may not take tracking
    // until it is aligned (research/03 §2.3, unchanged).
    const gate = await S((d, P) => {
      // The lift descends home at the end of its cycle; catch it low.
      P.stepUntil(
        () =>
          P.st('lift').moving &&
          P.st('lift').anchor.y - d.G.rig.y < 1.1 &&
          P.st('lift').anchor.y - d.G.rig.y > 0.3,
        60000,
      );
      P.stand('lift', 0);
      d.step(24);
      const held = { tracked: d.G.tracked, aligned: P.st('lift').aligned };
      d.setBody(0, 0);
      d.step(10);
      return held;
    });
    assert('gated: incoming lift refused tracking', gate.tracked === 2 && !gate.aligned, JSON.stringify(gate));

    // --- The lift, ridden clean: duck its sweep on the way up.
    const climb = await S((d, P) => {
      P.stand('east-step', 1); // walk to the north tile first
      d.step(10);
      if (!P.board('lift')) return { fail: 'board' };
      const clears0 = d.G.clears;
      const hits0 = d.G.hits;
      if (!P.ride('lift', 0, () => !P.st('lift').moving && P.st('lift').anchor.y > 3.7))
        return { fail: 'ride' };
      return { clears: d.G.clears - clears0, hits: d.G.hits - hits0, flow: d.G.flow };
    });
    assert('the lift climbs with its sweep ducked', !climb.fail && climb.clears === 1 && climb.hits === 0, JSON.stringify(climb));
    assert('flow rewards the dodge', climb.flow > 0);

    // --- Transfer to the skywalk across the high landing.
    const highStep = await S((d, P) => {
      P.stand('sky-east', 0);
      d.step(10);
      const at = d.G.tracked === P.idx('sky-east');
      if (!P.board('skywalk', 1)) return { at, fail: 'board-skywalk' };
      return { at, on: d.G.tracked === P.idx('skywalk') };
    });
    assert('the high landing hands over to the skywalk', highStep.at && highStep.on, JSON.stringify(highStep));

    // --- THE VOLLEY: all six stolen moves across one crossing, all dodged.
    const volley = await S((d, P) => {
      const clears0 = d.G.clears;
      const hits0 = d.G.hits;
      let ducked = false;
      let energyMin = 1;
      const done = P.ride(
        'skywalk',
        1,
        () => {
          if (d.G.hazardLive) {
            ducked = true;
            energyMin = Math.min(energyMin, d.G.energy);
          }
          return !P.st('skywalk').moving && Math.abs(P.st('skywalk').anchor.x + 3.0) < 0.05;
        },
        true,
        60000,
      );
      return {
        done,
        clears: d.G.clears - clears0,
        hits: d.G.hits - hits0,
        flow: d.G.flow,
        ducked,
        energyMin,
      };
    });
    assert('the volley rides clean: six dodges, no clips', volley.done && volley.clears === 6 && volley.hits === 0, JSON.stringify(volley));
    assert('flow carries the whole volley', volley.flow >= 6, `flow=${volley.flow}`);
    assert('danger ducked the scenery while it owned the deck', volley.ducked && volley.energyMin < 0.6, `min=${volley.energyMin.toFixed(2)}`);

    // Budgets hold mid-show too, telegraphs and all.
    const midInfo = await S((d) => {
      d.render();
      return d.render();
    });
    assert('draw calls within budget at altitude', midInfo.calls <= 60, `calls=${midInfo.calls}`);

    // --- Down: alight west, take the drop STANDING — the clip must charge.
    const descent = await S((d, P) => {
      P.stand('sky-west', 0);
      d.step(10);
      const at = d.G.tracked === P.idx('sky-west');
      if (!P.board('drop')) return { at, fail: 'board-drop' };
      const hits0 = d.G.hits;
      if (!P.ride('drop', 0, () => !P.st('drop').moving && P.st('drop').anchor.y < 0.1, false))
        return { at, fail: 'ride-drop' };
      return { at, hits: d.G.hits - hits0, flow: d.G.flow };
    });
    assert('standing through the drop sweep is a clip', !descent.fail && descent.at && descent.hits === 1, JSON.stringify(descent));
    assert('the clip kills the flow', descent.flow === 0);

    // --- Home: west landing, the home runner, the circuit closes.
    const home = await S((d, P) => {
      P.stand('west-step', 0);
      d.step(10);
      const at = d.G.tracked === P.idx('west-step');
      P.stand('west-step', 1);
      d.step(10);
      if (!P.board('runner-home')) return { at, fail: 'board-runner' };
      if (!P.ride('runner-home', 0, () => !P.st('runner-home').moving && Math.abs(P.st('runner-home').anchor.x) < 0.05))
        return { at, fail: 'ride-runner' };
      P.stand('home', 0);
      d.step(10);
      return {
        at,
        tracked: d.G.tracked,
        laps: d.G.laps,
        rig: { ...d.G.rig },
        body: { x: d.world.camera.position.x, z: d.world.camera.position.z },
      };
    });
    assert(
      'the circuit closes at centre',
      !home.fail &&
        home.tracked === 0 &&
        home.laps === 1 &&
        Math.hypot(home.rig.x, home.rig.y, home.rig.z) < 1e-3,
      JSON.stringify(home),
    );
    assert('the ledger closes: body centred after the whole lap', Math.hypot(home.body.x, home.body.z) < 1e-6, JSON.stringify(home.body));

    const eventLog = await S((d) => d.events());
    assert('event log records the slip', eventLog.some((e) => e.startsWith('slip:runner-out')));
    assert('event log records the circuit', eventLog.includes('circuit'));
    for (const wanted of ['dodge:beam', 'dodge:seesaw', 'dodge:sweep', 'dodge:rail', 'dodge:gate', 'dodge:surge', 'clip:sweep']) {
      assert(`event log records ${wanted}`, eventLog.includes(wanted), eventLog.slice(-40).join(','));
    }
    assert(
      'no forced switch ever fired',
      !eventLog.some((e) => e.endsWith(':slide')),
      eventLog.filter((e) => e.startsWith('switch:')).join(','),
    );

    assert('no console errors (probe A)', errors.length === 0, errors.slice(0, 5).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- probe B
  // Emulated-headset smoke: real XR session via IWER, one real handover.
  {
    const page = await browser.newPage();
    const errors = [];
    const offsiteFailures = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => {
      if (!r.url().includes('127.0.0.1')) offsiteFailures.push(r.url());
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL_CONNECTION_FAILED'))
        errors.push(m.text());
    });
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?emu`);
      await page.waitForFunction(() => !!window.__XRDEVICE, null, { timeout: 30000 });
      await page.waitForFunction(() => !!window.__VOIDSTEP_XR, null, { timeout: 30000 });
      await page.waitForSelector('#enter-vr:not([hidden])', { timeout: 15000 });
      await page.click('#enter-vr');
      await page.waitForFunction(() => window.__VOIDSTEP_XR.presenting(), null, {
        timeout: 20000,
      });
      const handover = await page.evaluate(async () => {
        const dev = window.__XRDEVICE;
        const until = Date.now() + 45000;
        let tracked = null;
        while (Date.now() < until) {
          dev.position.x = 0.66;
          dev.position.z = 0;
          await new Promise((r) => setTimeout(r, 150));
          if (window.__VOIDSTEP_XR.tracked() === 1) {
            tracked = 1;
            break;
          }
        }
        return tracked;
      });
      assert('XR (IWER): handover follows the walking head', handover === 1);
      if (offsiteFailures.length) {
        console.log(
          `  note: ${offsiteFailures.length} offsite fetch(es) blocked by egress policy (controller models)`,
        );
      }
      assert('no console errors (probe B)', errors.length === 0, errors.slice(0, 4).join(' | '));
    } catch (e) {
      assert(
        'XR (IWER) probe completes',
        false,
        `${String(e).split('\n')[0]}  page errors: ${errors.slice(0, 4).join(' | ') || '(none)'}`,
      );
    }
    await page.close();
  }

  await browser.close();
} finally {
  server.kill();
}

console.log(`\n${checks - failures.length}/${checks} checks passed`);
if (failures.length) {
  console.error('FAILURES:', failures.join(', '));
  process.exit(1);
}
