const fs = require("node:fs/promises");
const path = require("node:path");
const { MVP_ROOT, PUBLIC_ROOT } = require("./config");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".aiff": "audio/aiff",
};

function isInside(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readFromRoots(requested) {
  const roots = [PUBLIC_ROOT, MVP_ROOT];
  for (const root of roots) {
    const filePath = path.normalize(path.join(root, requested));
    if (!isInside(root, filePath)) continue;
    try {
      return {
        filePath,
        content: await fs.readFile(filePath),
      };
    } catch {
      // Try the next root.
    }
  }
  return null;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const result = await readFromRoots(requested);

  if (!result) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(result.filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(result.content);
}

module.exports = {
  serveStatic,
};
