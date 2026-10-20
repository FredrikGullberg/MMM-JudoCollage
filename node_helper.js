const NodeHelper = require("node_helper");
const fs = require("node:fs/promises");
const path = require("node:path");
const extensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

async function listPhotos(root, folder) {
  const relative = typeof folder === "string" ? folder : "photos";
  const dir = path.resolve(root, relative);
  const rel = path.relative(root, dir);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw Error("imageFolder must be a subdirectory inside MMM-JudoCollage");
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => rel.split(path.sep).concat(entry.name).map(encodeURIComponent).join("/"))
    .sort();
}
module.exports = NodeHelper.create({
  socketNotificationReceived(notification, payload) {
    if (notification !== "JUDO_GET_PHOTOS") return;
    listPhotos(__dirname, payload?.imageFolder ?? "photos")
      .then(photos => this.sendSocketNotification("JUDO_PHOTOS", { photos }))
      .catch(error => this.sendSocketNotification("JUDO_PHOTOS", { photos: [], error: error.message }));
  }
});
