/**
 * Prueft die wiederholte Untertitel-Suche: ein Player, der seine Liste erst
 * nach ein paar Anlaeufen bereitstellt, darf nicht als "kein Untertitel" gelten.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTranslatedTrack } from "../src/track-pipeline.js";

const json3 = (lines) => JSON.stringify({
  events: lines.map((text, i) => ({
    tStartMs: i * 3000, dDurationMs: 2800, segs: [{ utf8: text }]
  }))
});

const SOURCE = ["first line here.", "second line here.", "third line here.", "fourth line.", "fifth line."];

/**
 * Baut ein chrome-Double, dessen MAIN-world-Aufruf erst beim n-ten Versuch
 * eine Spur liefert — genau das Verhalten eines noch nicht fertigen Players.
 */
function fakeChrome({ readyAfter, withTrack = true }) {
  const calls = { main: 0, message: 0 };
  globalThis.chrome = {
    scripting: {
      executeScript: async () => {
        calls.main += 1;
        if (withTrack && calls.main >= readyAfter) {
          return [{ result: { ok: true, text: json3(SOURCE), format: "json3", lang: "en", videoId: "vid1" } }];
        }
        return [{ result: { ok: false, reason: calls.main < readyAfter ? "not-ready" : "no-track" } }];
      }
    },
    tabs: {
      sendMessage: async () => {
        calls.message += 1;
        return { ok: false, reason: "no-track" };
      }
    }
  };
  return calls;
}

const settings = {
  apiKey: "",                 // keine Uebersetzung: wir pruefen nur die Entdeckung
  targetLang: "fa",
  translationMemory: false,
  textModel: "m"
};

test("a player that is late with its caption list is still found", async () => {
  const calls = fakeChrome({ readyAfter: 4 });
  try {
    // Ohne Schluessel schlaegt die Uebersetzung fehl, aber die Entdeckung muss
    // vorher erfolgreich gewesen sein — genau das trennt die beiden Fehler.
    await assert.rejects(
      () => buildTranslatedTrack({ tabId: 1, settings, sourceUrl: "https://www.youtube.com/watch?v=vid1" }),
      (error) => error.code === "err.noKey",
      "discovery must have succeeded, so the failure can only come from the missing key"
    );
    assert.ok(calls.main >= 4, `expected at least 4 attempts, got ${calls.main}`);
  } finally {
    delete globalThis.chrome;
  }
});

test("a video that truly has no captions gives up and reports nothing found", async () => {
  const calls = fakeChrome({ readyAfter: 1, withTrack: false });
  try {
    const result = await buildTranslatedTrack({
      tabId: 1, settings, sourceUrl: "https://www.youtube.com/watch?v=none"
    });
    assert.equal(result, null, "no track must be reported as null, so the live path can take over");
    assert.ok(calls.main >= 5, `all attempts should be spent before giving up, got ${calls.main}`);
    assert.ok(calls.message >= 1, "the TextTrack layer must be tried as well");
  } finally {
    delete globalThis.chrome;
  }
});

test("the search progress is reported for every attempt", async () => {
  fakeChrome({ readyAfter: 99, withTrack: false });
  const seen = [];
  try {
    await buildTranslatedTrack({
      tabId: 1, settings, sourceUrl: "https://x/y",
      onSearching: (attempt, total) => seen.push(`${attempt}/${total}`)
    });
    assert.ok(seen.length >= 5, `progress was reported ${seen.length} times`);
    assert.equal(seen[0], `1/${seen.length}`);
    assert.equal(seen.at(-1), `${seen.length}/${seen.length}`);
  } finally {
    delete globalThis.chrome;
  }
});

test("the first attempt is immediate, so a ready player costs no delay", async () => {
  fakeChrome({ readyAfter: 1 });
  const started = Date.now();
  try {
    await assert.rejects(() => buildTranslatedTrack({
      tabId: 1, settings, sourceUrl: "https://www.youtube.com/watch?v=vid1"
    }));
    assert.ok(Date.now() - started < 400, "a ready player must not be made to wait");
  } finally {
    delete globalThis.chrome;
  }
});

/**
 * Der eigentliche Grund, warum YouTube "kein Untertitel" meldete: die Liste
 * entsteht erst, wenn CC am Player an ist. Also muss sie vor der Suche an und
 * danach wieder aus — aber nur, wenn wir sie selbst umgelegt haben.
 */
function fakeChromeWithCc({ readyAfter = 1, wasOn = false }) {
  const order = [];
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, args }) => {
        const name = func?.name ?? "";
        if (name === "setCaptionsEnabled") {
          const on = Boolean(args?.[0]);
          order.push(on ? "cc-on" : "cc-off");
          // wasOn=true bedeutet: der Nutzer hatte CC schon an, wir aendern nichts
          return [{ result: { ok: true, was: wasOn, now: on, changed: !wasOn, how: "button" } }];
        }
        order.push("discover");
        const attempts = order.filter((step) => step === "discover").length;
        if (attempts >= readyAfter) {
          return [{ result: { ok: true, text: json3(SOURCE), format: "json3", lang: "en", videoId: "v" } }];
        }
        return [{ result: { ok: false, reason: "not-ready" } }];
      }
    },
    tabs: { sendMessage: async () => ({ ok: false, reason: "no-track" }) }
  };
  return order;
}

test("the player's CC is switched on before the search and off again after", async () => {
  const order = fakeChromeWithCc({ readyAfter: 2 });
  try {
    await assert.rejects(() => buildTranslatedTrack({
      tabId: 1, settings, sourceUrl: "https://www.youtube.com/watch?v=v"
    }), (error) => error.code === "err.noKey");
    assert.equal(order[0], "cc-on", "CC must be on before the first look");
    assert.equal(order.at(-1), "cc-off", "and off again once the file is in hand");
    assert.ok(order.filter((s) => s === "discover").length >= 2);
    // Ausgeschaltet wird vor dem Uebersetzen, nicht danach
    assert.equal(order.filter((s) => s === "cc-off").length, 1);
  } finally {
    delete globalThis.chrome;
  }
});

test("a CC the user had already enabled is left alone", async () => {
  const order = fakeChromeWithCc({ readyAfter: 1, wasOn: true });
  try {
    await assert.rejects(() => buildTranslatedTrack({
      tabId: 1, settings, sourceUrl: "https://www.youtube.com/watch?v=v"
    }));
    assert.equal(order.includes("cc-off"), false, "nothing we did not change may be switched off");
  } finally {
    delete globalThis.chrome;
  }
});

test("the CC toggle can be switched off entirely", async () => {
  const order = fakeChromeWithCc({ readyAfter: 1 });
  try {
    await assert.rejects(() => buildTranslatedTrack({
      tabId: 1, settings: { ...settings, toggleCaptions: false }, sourceUrl: "https://x/y"
    }));
    assert.equal(order.includes("cc-on"), false, "the player must stay untouched");
  } finally {
    delete globalThis.chrome;
  }
});
