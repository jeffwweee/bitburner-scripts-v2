const DEFAULT_MANIFEST_URL = "https://raw.githubusercontent.com/jeffwweee/bitburner-scripts-v2/master/manifest.json";
const TEMP_MANIFEST = "_repo-update-manifest.json";

export async function main(ns) {
  const options = ns.flags([
    ["manifest-url", DEFAULT_MANIFEST_URL],
    ["base-url", ""],
    ["host", "home"],
    ["dry-run", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const manifestUrl = String(options["manifest-url"]);
  const host = String(options.host);
  const dryRun = Boolean(options["dry-run"]);

  ns.disableLog("wget");
  ns.tprint(`repo-update: downloading manifest from ${manifestUrl}`);
  ns.tprint("repo-update: adding a cache-busting query so GitHub raw updates are available immediately.");

  const gotManifest = await ns.wget(cacheBust(manifestUrl), TEMP_MANIFEST, host);
  if (!gotManifest) {
    ns.tprint("repo-update: failed to download manifest.");
    return;
  }

  const manifest = parseManifest(ns, ns.read(TEMP_MANIFEST));
  const baseUrl = String(options["base-url"] || manifest.baseUrl || "");
  const files = normalizeFiles(manifest.files);

  if (files.length === 0) {
    ns.tprint("repo-update: manifest has no files to download.");
    removeTempManifest(ns, host);
    printAliasRecommendation(ns, manifestUrl);
    return;
  }

  ns.tprint(`repo-update: ${dryRun ? "would download" : "downloading"} ${files.length} file(s).`);

  let successCount = 0;
  for (const file of files) {
    const target = file.path;
    const source = file.url || joinUrl(baseUrl, file.source || target);

    if (!source) {
      ns.tprint(`WARN skipped ${target}: missing url and manifest baseUrl.`);
      continue;
    }

    if (dryRun) {
      ns.tprint(`DRY ${source} -> ${target}`);
      successCount++;
      continue;
    }

    if (file.preserve && ns.fileExists(target, host)) {
      successCount++;
      ns.tprint(`KEEP ${target}`);
      continue;
    }

    const ok = await ns.wget(cacheBust(source), target, host);
    if (ok) {
      successCount++;
      ns.tprint(`OK   ${target}`);
    } else {
      ns.tprint(`FAIL ${target} from ${source}`);
    }
  }

  removeTempManifest(ns, host);

  ns.tprint(`repo-update: finished ${successCount}/${files.length} download(s).`);
  printAliasRecommendation(ns, manifestUrl);
}

function parseManifest(ns, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    ns.tprint(`repo-update: manifest is not valid JSON: ${String(error)}`);
    return { files: [] };
  }
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .map((entry) => typeof entry === "string" ? { path: entry } : entry)
    .filter((entry) => entry && typeof entry.path === "string" && isSafePath(entry.path));
}

function isSafePath(path) {
  return path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").includes("..");
}

function joinUrl(baseUrl, path) {
  if (!baseUrl || !path) return "";
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function cacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function removeTempManifest(ns, host) {
  if (ns.fileExists(TEMP_MANIFEST, host)) {
    ns.rm(TEMP_MANIFEST, host);
  }
}

function printAliasRecommendation(ns, manifestUrl) {
  ns.tprint("Recommended terminal alias:");
  ns.tprint(`alias pull="run lib/repo-update.js --manifest-url ${manifestUrl}"`);
  ns.tprint("Next step:");
  ns.tprint("cat README.md");
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/repo-update.js [--manifest-url URL] [--base-url URL] [--host HOST] [--dry-run]");
  ns.tprint("Downloads manifest.json, then downloads every file listed in the manifest.");
}
