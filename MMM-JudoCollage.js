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
    this.prepareNextPhotos();
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
    const all = this.photos;
    const count = Math.min(3, all.length, Math.max(1, Math.trunc(Number(this.config.imageCount) || 3)));
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

    Promise.all(next.map(photo => this.preloadPhoto(photo)))
      .then(images => {
        this.preparing = false;
        this.prepared = { photos: next, images };
        // Updating hidden DOM is safe. On first load we must also populate
        // an initially empty collage even if it is already visible.
        if (this.suspended || this.selected.length === 0) this.applyPrepared();
      })
      .catch(error => {
        this.preparing = false;
        Log.warn("MMM-JudoCollage: image preload failed: " + error.message);
        // Keep the existing collage, never replace it with broken images.
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

  getDom() {
    const root = document.createElement("div");
    root.className = "judo-collage" + (this.config.grayscale ? " judo-collage--bw" : "");
    ["large", "top", "bottom"].forEach((slot, i) => {
      const tile = document.createElement("div");
      tile.className = "judo-collage__tile judo-collage__tile--" + slot;
      if (this.selected[i]) {
        const img = document.createElement("img");
        img.src = this.file(this.selected[i]);
        img.alt = "Judofoto";
        tile.appendChild(img);
      }
      root.appendChild(tile);
    });
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
