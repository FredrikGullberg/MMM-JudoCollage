const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function harness({ deferred = false, canDecode = true } = {}) {
  let definition;
  const pending = [];
  const logs = [];
  class MockImage {
    set src(value) { this._src = value; }
    get src() { return this._src; }
    decode() {
      return deferred
        ? new Promise((resolve, reject) => pending.push({ src: this.src, resolve, reject }))
        : Promise.resolve();
    }
  }
  if (!canDecode) delete MockImage.prototype.decode;
  const context = {
    Module: { register(name, module) { assert.equal(name, "MMM-JudoCollage"); definition = module; } },
    Image: MockImage,
    Log: { warn(message) { logs.push(message); } },
    Math, Number, Promise, Set, Error
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "MMM-JudoCollage.js"), "utf8"), context);
  const changes = [];
  const instance = Object.assign({}, definition, {
    config: Object.assign({}, definition.defaults),
    file: filename => "/modules/MMM-JudoCollage/" + filename,
    updateDom(options) { changes.push({ photos: Array.from(this.selected), speed: options.speed, suspended: this.suspended }); }
  });
  const library = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
  const flushed = async () => { for(let i=0;i<5;i++) await Promise.resolve(); };
  const init = async () => {
    instance.socketNotificationReceived("JUDO_PHOTOS", { photos: library });
    if (!deferred) await flushed();
  };
  return { instance, changes, pending, logs, init, flushed, library };
}

test("initial photos are decoded before DOM update", async () => {
  const h = harness({ deferred: true });
  await h.init();
  assert.equal(h.changes.length, 0);
  assert.equal(h.pending.length, 3);
  for (const image of h.pending) image.resolve();
  await h.flushed();
  assert.equal(h.changes.length, 1);
  assert.equal(h.changes[0].photos.length, 3);
  assert.equal(h.changes[0].speed, 0);
  assert.equal(new Set(h.changes[0].photos).size, 3);
});

test("new collage is rendered while page is hidden, never on resume", async () => {
  const h = harness();
  await h.init();
  assert.equal(h.changes.length, 1);
  const first = h.changes[0].photos;
  h.instance.suspend();
  await h.flushed();
  assert.equal(h.changes.length, 2);
  assert.equal(h.changes[1].suspended, true);
  assert.equal(h.changes[1].speed, 0);
  assert.ok(h.changes[1].photos.every(x => !first.includes(x)));
  h.instance.resume();
  assert.equal(h.changes.length, 2);
});

test("if decoding finishes after resume, previous collage stays on screen", async () => {
  const h = harness({ deferred: true });
  await h.init();
  h.pending.splice(0).forEach(image => image.resolve());
  await h.flushed();
  const initial = h.changes[0].photos;
  h.instance.suspend();
  assert.equal(h.pending.length, 3);
  h.instance.resume();
  h.pending.splice(0).forEach(image => image.resolve());
  await h.flushed();
  assert.equal(h.changes.length, 1);
  assert.deepEqual(Array.from(h.instance.selected), initial);
  h.instance.suspend();
  assert.equal(h.changes.length, 2);
  assert.equal(h.changes[1].suspended, true);
});

test("repeated hiding does not trigger duplicate pending requests", async () => {
  const h = harness({ deferred: true });
  await h.init();
  h.pending.splice(0).forEach(image => image.resolve());
  await h.flushed();
  h.instance.suspend();
  h.instance.suspend();
  assert.equal(h.pending.length, 3);
});

test("shuffleOnResume=false keeps the first collage", async () => {
  const h = harness();
  h.instance.config.shuffleOnResume = false;
  await h.init();
  h.instance.suspend();
  await h.flushed();
  h.instance.resume();
  assert.equal(h.changes.length, 1);
});

test("decoding failure keeps old collage and logs warning", async () => {
  const h = harness({ deferred: true });
  await h.init();
  h.pending.splice(0).forEach(image => image.resolve());
  await h.flushed();
  h.instance.suspend();
  const attempts = h.pending.splice(0);
  attempts[0].reject(new Error("broken image"));
  attempts.slice(1).forEach(image => image.resolve());
  await h.flushed();
  assert.equal(h.changes.length, 1);
  assert.ok(h.logs.some(x => x.includes("image preload failed")));
});
