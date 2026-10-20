Module.register("MMM-JudoCollage", {
  defaults: {
    imageFolder: "photos",
    imageCount: 3,
    grayscale: true,
    shuffleOnResume: true,
    avoidRecentImages: 6,
    transitionSpeed: 800,
    logoFile: "",
    showBrandPanel: true,
    titleTop: "STAFFANSTORPS",
    titleBottom: "JUDO"
  },
  photos: [],
  selected: [],
  recent: [],
  decodedImages: [],
  badPhotos: [],
  prepared: null,
  preparing: false,
  initialized: false,
  suspended: false,

  start() {
    this.sendSocketNotification("JUDO_GET_PHOTOS", { imageFolder: this.config.imageFolder });
  },

  getStyles() { return [this.file("MMM-JudoCollage.css")]; },

  socketNotificationReceived(name, payload) {
    if (name !== "JUDO_PHOTOS") return;
    this.initialized = true;
    this.photos = Array.isArray(payload.photos) ? payload.photos : [];
    if (payload.error) Log.warn("MMM-JudoCollage: " + payload.error);
    if (!this.selected.length) {
      // Never block the initial collage behind Promise.all(Image.decode()).
      // One slow or corrupt photo must not leave the whole page black.
      this.selected = this.choosePhotos();
      this.updateDom({ speed: 0 });
    } else if (this.suspended) {
      this.prepareNextPhotos();
    }
  },

  // MMM-pages calls suspend() only once the outgoing page is hidden.
  // Prepare and render the next collage here, not when the page appears.
  suspend() {
    this.suspended = true;
    if (!this.config.shuffleOnResume || !this.initialized) return;
    if (this.prepared) this.applyPrepared();
    else this.prepareNextPhotos();
  },

  resume() {
    // Never change the images on the visible page. If decoding was slow,
    // the previous collage remains on screen until the next hide.
    this.suspended = false;
  },

  choosePhotos() {
    const all = this.photos.filter(photo => !this.badPhotos.includes(photo));
    const requested = Number(this.config.imageCount);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(12, Math.trunc(requested))) : 3;
    const count = Math.min(limit, all.length);
    const current = new Set(this.selected);
    const fresh = all.filter(x => !current.has(x) && !this.recent.includes(x));
    const older = all.filter(x => !current.has(x) && this.recent.includes(x));
    const repeats = all.filter(x => current.has(x));
    const shuffle = arr => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    return [...shuffle(fresh), ...shuffle(older), ...shuffle(repeats)].slice(0, count);
  },

  preloadPhoto(relativePath) {
    const image = new Image();
    const url = this.file(relativePath);
    if (typeof image.decode === "function") {
      image.src = url;
      return image.decode().then(() => image);
    }
    return new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load " + relativePath));
      image.src = url;
    });
  },

  prepareNextPhotos() {
    if (!this.initialized || this.preparing || this.prepared || !this.photos.length) return;
    const next = this.choosePhotos();
    if (!next.length) return;
    this.preparing = true;

    // Decode at most two images at once on a Raspberry Pi. Preloading
    // twelve large photos simultaneously can exhaust renderer memory.
    const loaded = new Array(next.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < next.length) {
        const index = cursor++;
        try {
          loaded[index] = await this.preloadPhoto(next[index]);
        } catch (error) {
          loaded[index] = null;
          if (!this.badPhotos.includes(next[index])) this.badPhotos.push(next[index]);
          Log.warn("MMM-JudoCollage: unable to preload " + next[index] + ": " + error.message);
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(2, next.length) }, () => worker()))
      .then(() => {
        this.preparing = false;
        const photos = [];
        const images = [];
        for (let i = 0; i < next.length; ++i) {
          if (loaded[i]) {
            photos.push(next[i]);
            images.push(loaded[i]);
          }
        }
        // A failed photo reduces this one collage instead of blacking out
        // the entire page. Future selections avoid failed files.
        if (!photos.length) return;
        this.prepared = { photos, images };
        if (this.suspended) this.applyPrepared();
      })
      .catch(error => {
        this.preparing = false;
        Log.warn("MMM-JudoCollage: unexpected preload error: " + error.message);
      });
  },

  applyPrepared() {
    if (!this.prepared) return;
    const limit = Math.max(0, Math.trunc(Number(this.config.avoidRecentImages) || 0));
    this.recent = limit ? [...this.recent, ...this.selected].slice(-limit) : [];
    this.selected = this.prepared.photos;
    // Hold references to decoded HTMLImageElements through display.
    this.decodedImages = this.prepared.images;
    this.prepared = null;
    // No 800 ms DOM transition after the page has become visible.
    this.updateDom({ speed: 0 });
  },

  // Balanced row layouts use a 12-track grid, so every row fills the full
  // screen width without empty cells. The classic three-photo layout is kept.
  getLayoutRows(count) {
    const layouts = {
      1: [1],
      2: [2],
      3: [1, 2], // Special 60/40 split, handled separately below
      4: [2, 2],
      5: [3, 2],
      6: [3, 3],
      7: [4, 3],
      8: [4, 4],
      9: [3, 3, 3],
      10: [4, 3, 3],
      11: [4, 4, 3],
      12: [4, 4, 4]
    };
    return layouts[count] || [];
  },

  getDom() {
    const root = document.createElement("div");
    const count = this.selected.length;
    const classic = count === 3;
    root.className = "judo-collage" +
      (this.config.grayscale ? " judo-collage--bw" : "") +
      (classic ? " judo-collage--classic" : " judo-collage--grid");

    const rows = this.getLayoutRows(count);
    if (!classic) {
      // Explicit tracks avoid Chromium/CSS variable parsing differences.
      root.style.gridTemplateColumns = "repeat(12, minmax(0, 1fr))";
      root.style.gridTemplateRows = "repeat(" + Math.max(1, rows.length) + ", minmax(0, 1fr))";
    }

    let index = 0;
    const slots = classic ? [1, 2, 3] : rows;
    for (const columns of slots) {
      for (let col = 0; col < (classic ? 1 : columns); col++) {
        const tile = document.createElement("div");
        const slotClass = classic ? ["large", "top", "bottom"][index] : null;
        tile.className = "judo-collage__tile" +
          (slotClass ? " judo-collage__tile--" + slotClass : "");
        if (!classic) tile.style.gridColumn = "span " + (12 / columns);
        if (this.selected[index]) {
          // Reuse the already-decoded image instead of creating a second
          // full-resolution image element for each photo.
          const url = this.file(this.selected[index]);
          const ready = this.decodedImages[index];
          const img = ready && ready.src === url ? ready : document.createElement("img");
          if (img.src !== url) img.src = url;
          img.alt = "Judofoto";
          tile.appendChild(img);
        }
        root.appendChild(tile);
        index++;
      }
    }
    if (this.config.showBrandPanel) {
      const panel = document.createElement("div");
      panel.className = "judo-collage__brand";
      if (this.config.logoFile) {
        const img = document.createElement("img");
        img.src = this.file(this.config.logoFile);
        img.alt = "Staffanstorps Judo";
        panel.appendChild(img);
      } else {
        const mark = document.createElement("div");
        mark.className = "judo-collage__wordmark";
        const upper = document.createElement("span");
        upper.textContent = this.config.titleTop;
        const lower = document.createElement("strong");
        lower.textContent = this.config.titleBottom;
        mark.append(upper, lower);
        panel.appendChild(mark);
      }
      root.appendChild(panel);
    }
    if (this.initialized && !this.photos.length) {
      const msg = document.createElement("div");
      msg.className = "judo-collage__empty";
      msg.textContent = "Inga bilder hittades i photos-katalogen.";
      root.appendChild(msg);
    }
    return root;
  }
});
