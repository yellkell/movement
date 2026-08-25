// The probe: boots the built app headless and walks the whole winding
// itself — down the east side, through the relay, the paternoster, the mill
// and the raft; takes the ember; back up the west side through the gauntlet
// to the dock and the rebirth — asserting the mechanism at every joint and
// holding the frame to the research/02 budgets. The same instinct as dance's
// Playwright probes: invariants checked against the live app.

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
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
    await page.waitForFunction(() => window.__STEPWELL !== undefined, null, {
      timeout: 30000,
    });

    // A small walking library, installed once in the page. All movement is
    // the body: the probe never teleports the rig, only the head.
    await page.evaluate(() => {
      const d = window.__STEPWELL;
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
            x: s.anchor.x - G.rig.x + s.claimShift.x + c[0] * 0.66,
            z: s.anchor.z - G.rig.z + s.claimShift.z + c[1] * 0.66,
          };
        },
        stand(id, k = 0, y = 1.7) {
          const t = P.tile(id, k);
          d.setBody(t.x, t.z, y);
        },
        boardAny(ids, k = 0) {
          const ok = P.stepUntil(
            () => ids.some((id) => P.st(id).aligned && !P.st(id).moving),
            60000,
          );
          if (!ok) return null;
          const id = ids.find((id) => P.st(id).aligned && !P.st(id).moving);
          P.stand(id, k);
          d.step(10);
          return G.tracked === P.idx(id) ? id : null;
        },
        board(id, k = 0) {
          return P.boardAny([id], k) === id;
        },
        // Ride the tracked platform like an attentive player: stay on lane
        // `k`, duck sweeps, and vacate a beam's doomed lane, until pred.
        ride(id, k, pred, cap = 30000) {
          const i = P.idx(id);
          let n = 0;
          while (!pred() && n++ < cap) {
            let lane = k;
            let y = 1.7;
            // Obey the most imminent live gate, like an attentive player.
            let bestD = Infinity;
            let bestBeam = -1;
            const host = G.platforms[i];
            for (let g = 0; g < G.gates.length; g++) {
              const gate = G.gates[g];
              const s = G.gateState[g];
              if (gate.platform !== i) continue;
              if (s.phase !== 'telegraph' && s.phase !== 'window') continue;
              const laneOff = { x: gate.lane[0] * 0.66, z: gate.lane[1] * 0.66 };
              const along =
                gate.axis === 'z'
                  ? Math.abs(host.anchor.z + laneOff.z - gate.pos.z)
                  : Math.abs(host.anchor.x + laneOff.x - gate.pos.x);
              if (gate.kind === 'sweep') {
                if (along < 1.2) y = 1.0;
              } else if (along < bestD) {
                bestD = along;
                bestBeam = g;
              }
            }
            if (bestBeam >= 0) {
              const gate = G.gates[bestBeam];
              const claims = d.claims[i];
              for (let c = 0; c < claims.length; c++) {
                if (claims[c][0] !== gate.lane[0] || claims[c][1] !== gate.lane[1]) {
                  lane = c;
                }
              }
            }
            P.stand(id, lane, y);
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
          const d = window.__STEPWELL;
          const P = window.__P;
          return new Function('d', 'P', 'a', `return (${code})(d, P, ...a)`)(d, P, a);
        },
        { code: fn.toString(), a: args },
      );

    // --- Boot state and budgets.
    const boot = await S((d) => ({
      n: d.G.platforms.length,
      ids: d.ids.length,
      tracked: d.G.tracked,
      rig: { ...d.G.rig },
    }));
    assert('boots with the full company of platforms', boot.n === 23, `n=${boot.n}`);
    assert('threshold tracked at origin', boot.tracked === 0 && Math.hypot(boot.rig.x, boot.rig.y, boot.rig.z) < 1e-6);

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
      return { target: d.G.wayfind.targetIndex, ferry: d.ids.indexOf('ferry-east') };
    });
    assert('wayfinding points at the first ferry', wayBoot.target === wayBoot.ferry);

    // --- The paired step (unchanged mechanism from v1).
    await S((d) => {
      d.step(60);
      d.setBody(0.66, 0);
      d.step(10);
    });
    let st = await S((d) => ({ tracked: d.G.tracked, rig: { ...d.G.rig } }));
    assert('clean handover onto ferry', st.tracked === 1);
    assert('clean handover moved nothing', Math.hypot(st.rig.x, st.rig.y, st.rig.z) < 1e-3);

    await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 6.3);
    });
    st = await S((d) => ({ rig: { ...d.G.rig }, tracked: d.G.tracked }));
    assert(
      'ride delivered the rig to the far berth',
      Math.abs(st.rig.z + 2.6) < 0.02 && Math.abs(st.rig.x - 0.9) < 0.02 && st.tracked === 1,
      JSON.stringify(st.rig),
    );

    await S((d) => {
      d.setBody(0, 0);
      d.step(10);
    });
    st = await S((d) => ({ tracked: d.G.tracked, body: d.world.camera.position.x }));
    assert('paired step lands on gallery-a, body centred', st.tracked === 2 && Math.abs(st.body) < 1e-6);

    // --- The gate: an incoming, unaligned ferry may not take tracking.
    await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 16.6);
    });
    const gate = await S((d) => {
      const rig = d.G.rig;
      const a = d.G.platforms[1].anchor;
      d.setBody(a.x - rig.x + 0.66, a.z - rig.z);
      d.step(24);
      return { tracked: d.G.tracked, aligned: d.G.platforms[1].aligned };
    });
    assert('gated: incoming platform refused tracking', gate.tracked === 2 && !gate.aligned, JSON.stringify(gate));

    // --- Forced switch and slide correction.
    await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 18.6);
      d.setBody(0.66, 0);
      d.step(10);
    });
    st = await S((d) => ({ tracked: d.G.tracked }));
    assert('re-boarded the ferry', st.tracked === 1);
    const slide = await S((d, P) => {
      P.stepUntil(() => d.G.transport.bars > 22.55);
      const rig0 = { ...d.G.rig };
      const a = d.G.platforms[2].anchor;
      d.setBody(a.x - rig0.x, a.z - rig0.z);
      d.step(12);
      const afterSwitch = { tracked: d.G.tracked, corr: d.G.correction.active, rig: { ...d.G.rig } };
      d.setBody(0, 0);
      d.step(600);
      return { afterSwitch, rig0, settled: { ...d.G.rig }, corrActive: d.G.correction.active };
    });
    assert(
      'leaving ground forces the switch',
      slide.afterSwitch.tracked === 2 && slide.afterSwitch.corr === true,
      JSON.stringify(slide.afterSwitch),
    );
    assert('switch instant is continuous', Math.abs(slide.afterSwitch.rig.z - slide.rig0.z) < 0.25);
    assert(
      'correction drains to alignment',
      !slide.corrActive && Math.abs(slide.settled.z + 2.6) < 0.02,
      JSON.stringify(slide.settled),
    );

    // --- Elevator down, long ferry: standing = hit, then ducked = clear.
    const sweep = await S((d, P) => {
      if (!P.board('elevator')) return { fail: 'elevator' };
      if (!P.stepUntil(() => !P.st('elevator').moving && P.st('elevator').anchor.y < -2.5))
        return { fail: 'elevator-ride' };
      if (!P.board('gallery-b')) return { fail: 'gallery-b' };
      if (!P.board('ferry-long')) return { fail: 'ferry-long' };
      const hits0 = d.G.hits;
      // Stand tall through the sweep on purpose.
      P.stepUntil(() => P.st('ferry-long').anchor.z < -5.6);
      d.step(40);
      return { hit: d.G.hits > hits0 };
    });
    assert('route walk reaches the long ferry', !sweep.fail, sweep.fail ?? '');
    assert('standing through the sweep is a hit', sweep.hit === true);

    const sweep2 = await S((d, P) => {
      const clears0 = d.G.clears;
      let guard = 0;
      while (d.G.clears === clears0 && guard++ < 6000) {
        const z = P.st('ferry-long').anchor.z;
        const nearGate = z < -3.4 && z > -5.4;
        P.stand('ferry-long', 0, nearGate ? 1.0 : 1.7);
        d.step(10);
      }
      return { cleared: d.G.clears > clears0, flow: d.G.flow };
    });
    assert('ducking the sweep clears it', sweep2.cleared === true, JSON.stringify(sweep2));
    assert('flow rewards the clear', sweep2.flow > 0);

    // --- The relay: transfer between two machines on their shared dwell.
    const relay = await S((d, P) => {
      if (!P.stepUntil(() => P.st('ferry-long').aligned && !P.st('ferry-long').moving && Math.abs(P.st('ferry-long').anchor.z + 6.2) < 0.05))
        return { fail: 'ferry-long-far' };
      if (!P.board('gallery-c')) return { fail: 'gallery-c' };
      if (!P.board('relay-a')) return { fail: 'relay-a' };
      if (!P.ride('relay-a', 0, () => P.st('relay-b').aligned && !P.st('relay-b').moving && !P.st('relay-a').moving && Math.abs(P.st('relay-a').anchor.z + 8.2) < 0.05))
        return { fail: 'relay-meet' };
      if (!P.board('relay-b')) return { fail: 'relay-b' };
      const tracked = d.G.tracked === P.idx('relay-b');
      // Ride it down (its sweep gets ducked by ride()).
      if (!P.ride('relay-b', 0, () => !P.st('relay-b').moving && P.st('relay-b').anchor.y < -5.1))
        return { fail: 'relay-b-ride' };
      if (!P.board('top-landing', 0)) return { fail: 'top-landing' };
      P.stand('top-landing', 1);
      d.step(10);
      return { tracked, at: d.G.tracked === P.idx('top-landing') };
    });
    assert('the relay transfers mid-well', !relay.fail && relay.tracked && relay.at, JSON.stringify(relay));

    // --- The paternoster: board whichever car opens its one-bar door.
    const pater = await S((d, P) => {
      const car = P.boardAny(['car-1', 'car-2', 'car-3']);
      if (!car) return { fail: 'no-car' };
      if (!P.ride(car, 0, () => !P.st(car).moving && Math.abs(P.st(car).anchor.y + 10.4) < 0.05 && Math.abs(P.st(car).anchor.x - 0.7) < 0.05))
        return { fail: 'car-ride' };
      if (!P.board('deep-landing')) return { fail: 'deep-landing' };
      return { car, ok: true };
    });
    assert('the paternoster carries you down its east column', pater.ok === true, JSON.stringify(pater));

    // --- The mill: it grinds only while you walk it.
    const mill = await S((d, P) => {
      if (!P.board('mill')) return { fail: 'board' };
      const walkTo = (target) => {
        let guard = 0;
        while (d.G.mill.progress < target && guard++ < 8000) {
          P.stand('mill', 0);
          d.step(5);
        }
      };
      walkTo(0.3);
      const pBefore = d.G.mill.progress;
      d.setBody(1.6, 1.6); // step clean off the drum
      d.step(300);
      const pStalled = d.G.mill.progress;
      walkTo(1);
      const done = d.G.mill.progress >= 1 && d.G.mill.maxProgress >= 1;
      P.stand('mill', 0);
      d.step(10);
      const bay = P.board('raft-bay');
      return { pBefore, pStalled, done, bay, tracked: d.G.tracked };
    });
    assert(
      'the mill grinds only while walked',
      mill.done === true && Math.abs(mill.pStalled - mill.pBefore) < 0.02,
      JSON.stringify(mill),
    );
    assert('the mill delivers to the raft bay', mill.bay === true);

    // --- The call plate summons the raft.
    const plate = await S((d, P) => {
      // Make sure the raft is genuinely away, then stand the glyph.
      P.stepUntil(() => !P.st('raft').aligned, 8000);
      const away = !P.st('raft').aligned;
      d.setBody(0, 0.66); // the bay's south square carries the glyph
      const called = P.stepUntil(() => P.st('raft').phaseShift > 0, 2000);
      const boarded = P.stepUntil(() => P.st('raft').aligned && !P.st('raft').moving, 4000);
      return { away, called, boarded };
    });
    assert('the call plate rephases the raft to the door', plate.away && plate.called && plate.boarded, JSON.stringify(plate));

    // --- Down to the water; the ember answers a two-bar stand.
    const ember = await S((d, P) => {
      if (!P.board('raft', 1)) return { fail: 'board-raft' };
      if (!P.ride('raft', 1, () => !P.st('raft').moving && Math.abs(P.st('raft').anchor.y + 13) < 0.05))
        return { fail: 'sink' };
      P.stand('raft', 1);
      const held = P.stepUntil(() => d.G.ember.held, 3000);
      return { held, target: d.G.wayfind.targetIndex, bay: d.ids.indexOf('raft-bay') };
    });
    assert('the ember rises for a held stand', ember.held === true, JSON.stringify(ember));
    assert('wayfinding turns for home', ember.target === ember.bay);

    // --- Ascend: raft up, west ferry, the paternoster's west column.
    const ascent = await S((d, P) => {
      if (!P.ride('raft', 1, () => !P.st('raft').moving && Math.abs(P.st('raft').anchor.y + 10.4) < 0.05))
        return { fail: 'raft-up' };
      if (!P.board('raft-bay')) return { fail: 'bay' };
      if (!P.board('ferry-west')) return { fail: 'ferry-west' };
      if (!P.ride('ferry-west', 0, () => !P.st('ferry-west').moving && Math.abs(P.st('ferry-west').anchor.x + 1.3) < 0.05))
        return { fail: 'west-ride' };
      if (!P.board('west-landing')) return { fail: 'west-landing' };
      const car = P.boardAny(['car-1', 'car-2', 'car-3']);
      if (!car) return { fail: 'no-car-up' };
      if (!P.ride(car, 0, () => !P.st(car).moving && Math.abs(P.st(car).anchor.y + 5.2) < 0.05 && Math.abs(P.st(car).anchor.x + 1.3) < 0.05))
        return { fail: 'car-up' };
      if (!P.board('high-landing')) return { fail: 'high-landing' };
      return { lit: d.G.storeysLit.filter(Boolean).length };
    });
    assert('the west column carries the ember up', !ascent.fail, JSON.stringify(ascent));
    assert('storeys relight as the ember climbs', (ascent.lit ?? 0) >= 3, `lit=${ascent.lit}`);

    // --- The gauntlet: summoned, then ridden clean through four gates.
    const gauntlet = await S((d, P) => {
      P.stepUntil(() => !P.st('gauntlet').aligned, 8000);
      d.setBody(0.66, 0); // the high landing's east square carries the glyph
      P.stepUntil(() => P.st('gauntlet').phaseShift > 0, 2000);
      if (!P.board('gauntlet', 0)) return { fail: 'board' };
      const hits0 = d.G.hits;
      const clears0 = d.G.clears;
      if (!P.ride('gauntlet', 0, () => !P.st('gauntlet').moving && P.st('gauntlet').anchor.y > -2.7))
        return { fail: 'ride' };
      if (!P.board('arrival')) return { fail: 'arrival' };
      return { clears: d.G.clears - clears0, hits: d.G.hits - hits0 };
    });
    assert('the gauntlet rides clean', !gauntlet.fail && gauntlet.hits === 0 && gauntlet.clears >= 4, JSON.stringify(gauntlet));

    // --- Home: the last ferry, the dock, the rebirth.
    const home = await S((d, P) => {
      if (!P.board('ferry-home')) return { fail: 'board' };
      if (!P.ride('ferry-home', 0, () => !P.st('ferry-home').moving && Math.abs(P.st('ferry-home').anchor.y) < 0.05))
        return { fail: 'ride' };
      if (!P.board('threshold')) return { fail: 'threshold' };
      const reborn = P.stepUntil(() => d.G.laps === 1, 4000);
      d.step(120);
      return {
        reborn,
        bars: d.G.transport.bars,
        tracked: d.G.tracked,
        rig: { ...d.G.rig },
        ember: d.G.ember.phase,
        lit: d.G.storeysLit.filter(Boolean).length,
      };
    });
    assert(
      'docking the ember reruns the well',
      !home.fail &&
        home.reborn &&
        home.tracked === 0 &&
        home.bars < 8 &&
        Math.hypot(home.rig.x, home.rig.y, home.rig.z) < 1e-3 &&
        home.ember === 'water' &&
        home.lit === 0,
      JSON.stringify(home),
    );

    const eventLog = await S((d) => d.events());
    for (const wanted of [
      'mill-complete',
      'ember-held',
      'ember-docking',
      'rebirth',
    ]) {
      assert(`event log records ${wanted}`, eventLog.includes(wanted), eventLog.slice(-30).join(','));
    }
    assert(
      'event log records a storey relight and a plate call',
      eventLog.some((e) => e.startsWith('storey-lit:')) && eventLog.some((e) => e.startsWith('plate:')),
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
      await page.waitForFunction(() => !!window.__STEPWELL_XR, null, { timeout: 30000 });
      await page.waitForSelector('#enter-vr:not([hidden])', { timeout: 15000 });
      await page.click('#enter-vr');
      await page.waitForFunction(() => window.__STEPWELL_XR.presenting(), null, {
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
          if (window.__STEPWELL_XR.tracked() === 1) {
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
