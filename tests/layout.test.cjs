/* Grid layout regression tests. Run: node --test tests/*.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let definition;
const document = {
  createElement(tag) {
    return {
      tag,
      children: [],
      style: { setProperty(name, value) { this[name] = value; } },
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); }
    };
  }
};
vm.runInNewContext(readFileSync(path.join(__dirname, "..", "MMM-JudoCollage.js"), "utf8"), {
  Module: { register(name, module) {
    assert.equal(name, "MMM-JudoCollage");
    definition = module;
  } },
  document,
  Image: class {},
  Log: { warn() {} }
});

function createInstance(count, available = 20) {
  return Object.assign({}, definition, {
    config: { ...definition.defaults, imageCount: count },
    photos: Array.from({ length: available }, (_, i) => "photo" + i + ".jpg"),
    selected: [],
    recent: [],
    file(name) { return name; }
  });
}

test("all image counts from 1 to 12 select unique photos and fill the grid", () => {
  for (let count = 1; count <= 12; count++) {
    const module = createInstance(count);
    module.selected = module.choosePhotos();
    assert.equal(module.selected.length, count);
    assert.equal(new Set(module.selected).size, count);

    const rows = module.getLayoutRows(count);
    assert.equal(rows.reduce((sum, row) => sum + row, 0), count);
    const dom = module.getDom();
    const tiles = dom.children.filter(child => child.className?.includes("judo-collage__tile"));
    assert.equal(tiles.length, count);

    if (count === 3) {
      assert.match(dom.className, /judo-collage--classic/);
      assert.deepEqual(tiles.map(tile => tile.className.split("--").at(-1)), [
        "large", "top", "bottom"
      ]);
    } else {
      assert.match(dom.className, /judo-collage--grid/);
      assert.equal(dom.style["--judo-rows"], rows.length);
      let index = 0;
      for (const columns of rows) {
        for (let j = 0; j < columns; j++) {
          assert.equal(tiles[index++].style.gridColumn, "span " + 12 / columns);
        }
      }
    }
  }
});

test("six, nine, ten, and twelve photos use balanced layouts", () => {
  const expected = {
    6: [3, 3],
    9: [3, 3, 3],
    10: [4, 3, 3],
    12: [4, 4, 4]
  };
  for (const [count, rows] of Object.entries(expected)) {
    const instance = createInstance(Number(count));
    assert.deepEqual(Array.from(instance.getLayoutRows(Number(count))), rows);
  }
});

test("count is clamped between 1 and 12 and by available photo files", () => {
  assert.equal(createInstance(99).choosePhotos().length, 12);
  assert.equal(createInstance(0).choosePhotos().length, 1);
  assert.equal(createInstance(12, 2).choosePhotos().length, 2);
  assert.equal(createInstance(12, 0).choosePhotos().length, 0);
});

test("responsive grid CSS provides 12 columns and adjustable rows", () => {
  const css = readFileSync(path.join(__dirname, "..", "MMM-JudoCollage.css"), "utf8");
  assert.match(css, /grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /grid-template-rows:\s*repeat\(var\(--judo-rows/);
  assert.match(css, /\.judo-collage__tile--large/);
});
