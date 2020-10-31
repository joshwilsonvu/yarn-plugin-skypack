import {
  structUtils,
  tgzUtils,
  Locator,
  httpUtils,
  ReportError,
  MessageName,
  Fetcher,
  FetchOptions,
  MinimalFetchOptions,
} from "@yarnpkg/core";
import { xfs, ppath, Filename } from "@yarnpkg/fslib";
import semver from "semver";

import { PROTOCOL, CDN, API, getIdentUrl } from "./constants";

export class SkypackSkeletonFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    return locator.reference.startsWith(PROTOCOL);
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [
      packageFs,
      releaseFs,
      checksum,
    ] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, {
      onHit: () => opts.report.reportCacheHit(locator),
      onMiss: () =>
        opts.report.reportCacheMiss(
          locator,
          `${structUtils.prettyLocator(
            opts.project.configuration,
            locator
          )} can't be found in the cache and will be generated with Skypack`
        ),
      loader: () => this.generate(locator, opts),
      skipIntegrityCheck: opts.skipIntegrityCheck,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  private async generate(locator: Locator, opts: FetchOptions) {
    const { selector } = structUtils.parseRange(locator.reference);
    const version = semver.clean(selector);
    if (version === null) {
      throw new ReportError(
        MessageName.RESOLVER_NOT_FOUND,
        `The Skypack semver resolver got selected, but the version isn't semver`
      );
    }
    let data: any;
    const dataUrl = `${API}/v1/package${getIdentUrl(locator)}`;
    try {
      data = await httpUtils.get(dataUrl, {
        jsonResponse: true,
        configuration: opts.project.configuration,
      });
    } catch (e) {
      throw new ReportError(
        MessageName.FETCH_FAILED,
        `Couldn't lookup package data from ${dataUrl}`
      );
    }

    // const rawExportMap: RawExportMap = data.exportMap || { ".": `./index.mjs` };
    // const exportMap: ExportMap =
    //   typeof rawExportMap === `string` ? { ".": rawExportMap } : rawExportMap;

    const importUrl = `${CDN}${getIdentUrl(locator)}@${version}`;

    const response = await httpUtils.request(importUrl, null, {
      configuration: opts.project.configuration,
    });
    if (response.statusCode !== 200) {
      throw new ReportError(
        MessageName.FETCH_FAILED,
        `${importUrl} responded with code ${response.statusCode}`
      );
    }
    const pinnedUrl = response.headers[`x-pinned-url`] as string | undefined;
    if (!pinnedUrl) {
      opts.report.reportWarning(
        MessageName.REMOTE_NOT_FOUND,
        `${structUtils.prettyLocator(
          opts.project.configuration,
          locator
        )} has no pinned URL available; falling back to lookup URL`
      );
    }
    const fullUrl = pinnedUrl ? `${CDN}${pinnedUrl}` : importUrl;

    return xfs.mktempPromise(async (cwd) => {
      const mainFile = "index.mjs";
      await Promise.all([
        xfs.writeFilePromise(
          ppath.join(cwd, mainFile as Filename),
          skeleton(fullUrl)
        ),
        xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
          name: locator.name,
          version,
          type: "module",
          description: data.description || "",
          license: data.license || "",
          keywords: data.keywords || [],
          main: mainFile,
          module: mainFile,
          browser: mainFile,
          files: [mainFile],
        }),
      ]);

      return tgzUtils.makeArchiveFromDirectory(cwd, {
        prefixPath: structUtils.getIdentVendorPath(locator),
        compressionLevel: opts.project.configuration.get(`compressionLevel`),
      });
    });
  }
}

// {
//   ".": "./index.js",
//   "./hooks": "./dist/hooks.js",
//   "./asdf": {
//     require: "./dist/cjs/index.js",
//     default: "./dist/esm/index.js"
//   }
//   "./foo": {
//     "node": {
//       "default": "./dist/foo.js"
//     }
//     "default": "./dist/bar.js"
//   }
// }
// Get top level pinned url
// For each path value, create a file at that path importing `${pinnedUrl}/${pathKey}` from Skypack
// For each conditional key supporting ESM, recurse
function recurseExports(
  exportMap: RawExportMap,
  urlPath: string
): Array<{ filePath: string; urlPath: string }> {
  if (typeof exportMap === `string`) {
    return [{ filePath: exportMap, urlPath }];
  }
  const keys = Object.keys(exportMap).filter((key) => !key.includes(`*`));
  if (!keys.every((key) => key.startsWith(`.`))) {
    // conditions, not paths
    const next = [
      exportMap.browser,
      exportMap.import,
      exportMap.node,
      exportMap.default,
    ].filter(Boolean);
    if (!next.length) {
      throw new Error(
        `No matching condition found from ${Object.keys(exportMap).join(",")}`
      );
    }
    return next.flatMap((n) => recurseExports(n, urlPath));
  } else {
    // paths, not conditions
    return keys.flatMap((key) =>
      recurseExports(exportMap[key], urlPath + key.slice(1))
    );
  }
}

function skeleton(url: string) {
  return `export * from "${url}";\nexport {default} from "${url}";\n`;
}

interface Recursive<T> {
  [k: string]: Recursive<T> | T;
}
type ExportMap = Recursive<string>;
type RawExportMap = ExportMap | string;
