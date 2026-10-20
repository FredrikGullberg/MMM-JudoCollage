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
    this.pickPhotos();
  },
  suspend() { this.suspended = true; },
  resume() {
    this.suspended = false;
    if (this.initialized && this.config.shuffleOnResume) this.pickPhotos();
  },
  pickPhotos() {
    const all = this.photos;
    const count = Math.min(3, all.length, Math.max(1, Math.trunc(Number(this.config.imageCount) || 3)));
    const recentLimit = Math.max(0, Math.trunc(Number(this.config.avoidRecentImages) || 0));
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
    const next = [...shuffle(fresh), ...shuffle(older), ...shuffle(repeats)].slice(0, count);
    this.recent = recentLimit ? [...this.recent, ...this.selected].slice(-recentLimit) : [];
    this.selected = next;
    this.updateDom({ speed: Math.max(0, Number(this.config.transitionSpeed) || 0) });
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
