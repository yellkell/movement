// The probe: boots the built app headless and walks the mechanic itself —
// the paired step, the gated handover, the slide correction, the sweep judge,
// the throat — then holds the frame to the research/02 budgets. The same
// instinct as dance's Playwright probes: invariants checked against the live
// app, not asserted in prose.

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const EXecutable =
  process.env.PROBE_BROWSER || '/opt/pw-browsers/chromium';

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
    executablePath: EXecutable,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });

  // ---------------------------------------------------------------- probe A
  // Deterministic mechanics: ?probe stops the animation loop and steps the
  // world by hand at 72 fps.
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

    const S = (fn, ...args) =>
      page.evaluate(
        ({ code, a }) => {
          const d = window.__STEPWELL;
          return new Function('d', 'a', `return (${code})(d, ...a)`)(d, a);
        },
        { code: fn.toString(), a: args },
      );

    // Boot state
    const boot = await S((d) => ({
      tracked: d.G.tracked,
      rig: { ...d.G.rig },
      platforms: d.G.platforms.length,
    }));
    assert('boots with threshold tracked', boot.tracked === 0);
    assert(
      'rig starts at origin',
      Math.hypot(boot.rig.x, boot.rig.y, boot.rig.z) < 1e-6,
    );
    assert('all platforms present', boot.platforms === 10);

    // Budgets (research/02 §8) — after a settle and a render.
    const info = await S((d) => {
      d.step(30);
      d.render();
      return d.render();
    });
    console.log(`  draw calls=${info.calls} triangles=${info.triangles}`);
    assert('draw calls within budget', info.calls <= 60, `calls=${info.calls}`);
    assert(
      'triangles within budget',
      info.triangles <= 100000,
      `tris=${info.triangles}`,
    );

    // --- The paired step, leg 1: sidestep east onto the dwelling ferry.
    await S((d) => {
      d.step(60); // ~0.33 bar in — ferry dwells at the threshold until bar 4
      d.setBody(0.66, 0);
      d.step(10);
    });
    let st = await S((d) => ({ tracked: d.G.tracked, rig: { ...d.G.rig } }));
    assert('clean handover onto ferry', st.tracked === 1);
    assert(
      'clean handover moved nothing',
      Math.hypot(st.rig.x, st.rig.y, st.rig.z) < 1e-3,
      JSON.stringify(st.rig),
    );

    // --- Ride: the world sails past a still body.
    await S((d) => {
      d.warp(4.2); // into the travel bars
      d.step(40);
    });
    st = await S((d) => ({ rig: { ...d.G.rig }, moving: d.G.platforms[1].moving }));
    assert('ferry travel moves the rig', st.moving && st.rig.z < -0.3, JSON.stringify(st));
    await S((d) => {
      while (d.G.transport.bars < 6.3) d.step(20);
    });
    st = await S((d) => ({ rig: { ...d.G.rig }, tracked: d.G.tracked }));
    assert(
      'ride delivered the rig to the far anchor',
      Math.abs(st.rig.z + 3.2) < 0.02 && st.tracked === 1,
      JSON.stringify(st),
    );

    // --- Leg 2: sidestep west off — the pair nets to zero.
    await S((d) => {
      d.setBody(0, 0);
      d.step(10);
    });
    st = await S((d) => ({ tracked: d.G.tracked, rig: { ...d.G.rig } }));
    assert('paired step lands on gallery-a', st.tracked === 2);
    assert(
      'net body displacement is zero',
      (await S((d) => Math.hypot(d.world.camera.position.x, d.world.camera.position.z))) <
        1e-6,
    );

    // --- The gate (research/03 §2.3): an incoming, unaligned ferry may not
    // take tracking, even with the head over its deck.
    await S((d) => {
      while (d.G.transport.bars < 16.6) d.step(40); // ferry mid-approach
    });
    const gate = await S((d) => {
      const rig = d.G.rig;
      const a = d.G.platforms[1].anchor;
      // stand exactly on the incoming ferry's live tile
      d.setBody(a.x - rig.x + 0.66, a.z - rig.z);
      d.step(24);
      return { tracked: d.G.tracked, aligned: d.G.platforms[1].aligned };
    });
    assert(
      'gated: incoming platform refused tracking',
      gate.tracked === 2 && gate.aligned === false,
      JSON.stringify(gate),
    );

    // --- Forced switch: stay aboard past departure, then step off onto
    // ground the frame has left behind — it must slide back under the feet.
    await S((d) => {
      while (d.G.transport.bars < 18.6) d.step(40);
      d.setBody(0.66, 0); // aboard the ferry, aligned dwell
      d.step(10);
    });
    st = await S((d) => ({ tracked: d.G.tracked }));
    assert('re-boarded the ferry', st.tracked === 1);
    const slide = await S((d) => {
      while (d.G.transport.bars < 22.55) d.step(20); // riding the return leg
      const rig0 = { ...d.G.rig };
      const a = d.G.platforms[2].anchor; // gallery-a, now misaligned
      d.setBody(a.x - rig0.x, a.z - rig0.z); // step onto it anyway
      d.step(12);
      const afterSwitch = {
        tracked: d.G.tracked,
        corr: d.G.correction.active,
        rig: { ...d.G.rig },
      };
      // A real player steps toward the tile's centre as it slides home.
      d.setBody(0, 0);
      d.step(600); // let the correction drain
      return {
        afterSwitch,
        rig0,
        settled: { ...d.G.rig },
        corrActive: d.G.correction.active,
      };
    });
    assert(
      'leaving ground forces the switch',
      slide.afterSwitch.tracked === 2 && slide.afterSwitch.corr === true,
      JSON.stringify(slide.afterSwitch),
    );
    assert(
      'switch instant is continuous',
      Math.abs(slide.afterSwitch.rig.z - slide.rig0.z) < 0.25,
      `jumped ${slide.rig0.z} -> ${slide.afterSwitch.rig.z}`,
    );
    assert(
      'correction drains to alignment',
      !slide.corrActive && Math.abs(slide.settled.z + 3.2) < 0.02,
      JSON.stringify(slide.settled),
    );

    // --- The sweep judge: ride the long ferry standing → hit; ducked → clear.
    const sweep = await S((d) => {
      // walk the route: elevator down, gallery-b, board ferry-long
      const bars = d.G.transport.bars;
      const nextTop = bars + ((6 - (bars % 12)) + 12) % 12; // elevator dwells top at 6+12k
      while (d.G.transport.bars < nextTop + 0.3) d.step(40);
      d.setBody(0, -0.66);
      d.step(10);
      const onElevator = d.G.tracked === 3;
      while (d.G.platforms[3].moving || d.G.platforms[3].anchor.y > -2.5) d.step(40);
      d.setBody(0, 0);
      d.step(10);
      const onGalleryB = d.G.tracked === 4;
      // ferry-long dwells with gallery-b at bars [12,18) mod 16
      let b = d.G.transport.bars;
      const at = ((b - 12) % 16 + 16) % 16;
      if (at > 5) {
        const wait = 16 - at + 0.2;
        while (d.G.transport.bars < b + wait) d.step(40);
      }
      d.setBody(-0.66, 0, 1.7); // standing tall
      d.step(10);
      const onFerryLong = d.G.tracked === 5;
      const hits0 = d.G.hits;
      while (d.G.platforms[5].anchor.z > -6.9) d.step(20); // ride through the gate
      return { onElevator, onGalleryB, onFerryLong, hit: d.G.hits > hits0 };
    });
    assert(
      'route walk reaches the long ferry',
      sweep.onElevator && sweep.onGalleryB && sweep.onFerryLong,
      JSON.stringify(sweep),
    );
    assert('standing through the sweep is a hit', sweep.hit === true);

    const sweep2 = await S((d) => {
      // Stay aboard; on the next pass through the gate, duck like a player
      // would — low through the pane, tall otherwise. The gate sits at
      // z ≈ −5.5 on this leg.
      const clears0 = d.G.clears;
      let guard = 0;
      while (d.G.clears === clears0 && guard++ < 4000) {
        const z = d.G.platforms[5].anchor.z;
        const nearGate = z < -4.5 && z > -6.5;
        d.setBody(-0.66, 0, nearGate ? 1.0 : 1.7);
        d.step(10);
      }
      return { cleared: d.G.clears > clears0, flow: d.G.flow };
    });
    assert('ducking the sweep clears it', sweep2.cleared === true, JSON.stringify(sweep2));
    assert('flow rewards the clear', sweep2.flow > 0);

    // --- The throat: raft + water + hold = rebirth at bar zero.
    const throat = await S((d) => {
      d.G.tracked = 9;
      d.setBody(0, -0.66, 1.7);
      const bars = d.G.transport.bars;
      const at = ((bars - 34) % 28 + 28) % 28; // raft waits at water during [16,24) of its cycle
      const target = at < 17 ? 17 - at : 28 - at + 17;
      d.warp(target);
      d.step(30);
      const atWater = Math.abs(d.G.platforms[9].anchor.y + 13) < 0.05;
      let guard = 0;
      while (d.G.laps === 0 && guard++ < 900) d.step(20);
      return { atWater, laps: d.G.laps, bars: d.G.transport.bars, tracked: d.G.tracked, rig: { ...d.G.rig } };
    });
    assert('raft reaches the water', throat.atWater === true);
    assert(
      'the throat is a rebirth',
      throat.laps === 1 &&
        throat.tracked === 0 &&
        throat.bars < 8 &&
        Math.hypot(throat.rig.x, throat.rig.y, throat.rig.z) < 1e-3,
      JSON.stringify(throat),
    );

    const eventLog = await S((d) => d.G.events);
    assert(
      'event log tells the story',
      eventLog.some((e) => e.includes(':clean')) &&
        eventLog.some((e) => e.includes(':slide')) &&
        eventLog.includes('hit:sweep') &&
        eventLog.includes('clear:sweep') &&
        eventLog.includes('rebirth'),
      eventLog.join(','),
    );

    assert('no console errors (probe A)', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- probe B
  // Emulated-headset smoke: real XR session via IWER, real time, one clean
  // handover driven by walking the emulated head across the play area.
  {
    const page = await browser.newPage();
    const errors = [];
    const offsiteFailures = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => {
      if (!r.url().includes('127.0.0.1')) offsiteFailures.push(r.url());
    });
    page.on('console', (m) => {
      // Loads blocked by the sandbox's egress policy (e.g. the WebXR
      // input-profiles CDN for controller models) are environment, not app.
      if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL_CONNECTION_FAILED'))
        errors.push(m.text());
    });
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?emu`);
      await page.waitForFunction(() => !!window.__XRDEVICE, null, { timeout: 30000 });
      await page.waitForFunction(() => !!window.__STEPWELL_XR, null, { timeout: 30000 });
      await page.waitForSelector('#enter-vr:not([hidden])', { timeout: 15000 });
      await page.click('#enter-vr');
      await page.waitForFunction(
        () => window.__STEPWELL_XR.presenting(),
        null,
        { timeout: 20000 },
      );
      // Walk east onto the ferry during a dwell; wait for tracking to follow.
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
      assert(
        'no console errors (probe B)',
        errors.length === 0,
        errors.slice(0, 4).join(' | '),
      );
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
