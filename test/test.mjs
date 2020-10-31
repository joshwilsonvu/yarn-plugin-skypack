import fs from "fs/promises";
import fss from "fs";
import { fileURLToPath } from "url";
import assert from "assert";
import execa from "execa";
import { homedir } from "os";
import path from "path";
import stripAnsi from "strip-ansi";
import { inspect } from "util";

const testCases = {
  preact: {
    install: "preact@skypack:~10.4.7",
    main: `export * from "https://cdn.skypack.dev/pin/preact@v10.4.8-BY8aUIKfZliyT1UPQXam/preact.js";\nexport {default} from "https://cdn.skypack.dev/pin/preact@v10.4.8-BY8aUIKfZliyT1UPQXam/preact.js";`,
    pkgJson: {
      name: "preact",
      version: "10.4.8", // Latest compatible version with ~10.4.7 (tilde means forward patches only)
      type: "module",
      description: "Fast 3kb React-compatible Virtual DOM library.",
      license: "MIT",
      main: "index.mjs",
      module: "index.mjs",
      browser: "index.mjs",
      files: ["index.mjs"],
      keywords: [
        "preact",
        "react",
        "ui",
        "user interface",
        "virtual dom",
        "vdom",
        "components",
        "dom diff",
      ],
    },
  },
  "simple-audio-worklet": {
    install: "simple-audio-worklet@skypack:latest", // dist-tag of a package not likely to change soon
    main: `export * from "https://cdn.skypack.dev/pin/simple-audio-worklet@v1.0.1-otETz1jKFDXNqZZh1REx/simple-audio-worklet.js";\nexport {default} from "https://cdn.skypack.dev/pin/simple-audio-worklet@v1.0.1-otETz1jKFDXNqZZh1REx/simple-audio-worklet.js";`,
    pkgJson: {
      name: "simple-audio-worklet",
      version: "1.0.1",
      type: "module",
      description:
        "Write an audio worklet with frame-based processing and a variety of input formats.",
      license: "ISC",
      keywords: [],
      main: "index.mjs",
      module: "index.mjs",
      browser: "index.mjs",
      files: ["index.mjs"],
    },
  },
};

async function run() {
  const thisPkgJson = resolveAndReadFile("./package.json");
  const testDeps = Object.keys(testCases);
  const installedTestDeps = Object.keys(
    thisPkgJson.dependencies || {}
  ).filter((dep) => testDeps.includes(dep));
  if (installedTestDeps.length) {
    console.log("Removing", ...installedTestDeps);
  }
  await execa("yarn", ["remove", ...installedTestDeps]);

  await cleanCache();
  //await Promise.all(skypackCachedFiles.map(f => fs.unlink(path.join(globalCacheDir, f)));

  for (const dep of testDeps) {
    const { install, main, pkgJson } = testCases[dep];
    const { stdout } = await execa("yarn", ["add", install]);
    assert.match(
      stripAnsi(stdout),
      /can't be found in the cache and will be generated with Skypack/,
      `yarn add ${install} didn't generate a fresh Skypack skeleton file`
    );

    const text = await resolveAndReadFile(dep);
    assert.strictEqual(text.trim(), main, "The skeleton file doesn't match");

    const parsedPkgJson = JSON.parse(
      await resolveAndReadFile(`${dep}/package.json`)
    );
    assert.deepStrictEqual(parsedPkgJson, pkgJson);
    // for (const field of Object.keys(pkgJson)) {
    //   assert.deepStrictEqual(
    //     parsedPkgJson[field],
    //     pkgJson[field],
    //     `${dep} package.json field ${field} doesn't match`
    //   );
    // }
  }

  await execa("yarn", ["remove", ...testDeps]);
}

run().catch((err) => {
  console.log(inspect(err, { depth: null }));
  process.exitCode = 1;
});

async function resolveAndReadFile(id) {
  return await fs.readFile(
    fileURLToPath(await import.meta.resolve(id)),
    "utf-8"
  );
}

async function cleanCache() {
  const testDeps = Object.keys(testCases);
  const isCachedSkypack = (f) =>
    f.includes("-skypack-") && testDeps.some((dep) => f.includes(dep));
  return Promise.all(
    [
      path.resolve(homedir(), ".yarn", "berry", "cache"),
      path.resolve("..", ".yarn", "cache"),
    ]
      .filter(fss.existsSync)
      .flatMap((cacheDir) =>
        fss
          .readdirSync(cacheDir)
          .filter(isCachedSkypack)
          .map((f) => {
            f = path.join(cacheDir, f);
            console.log("- deleting", f);
            return fs.unlink(f);
          })
      )
  );
}
