# yarn-plugin-skypack

This plugin adds support for a new `skypack:` protocol, which imports
dependencies from the [Skypack CDN](https://skypack.dev) on the fly.

## Installation

You must be using [Yarn 2](https://yarnpkg.com/). In your Yarn 2
repository, run the following:

```bash
yarn plugin import https://raw.githubusercontent.com/joshwilsonvu/yarn-plugin-skypack/main/bundles/@yarnpkg/plugin-skypack.js
```

## How it works

Instead of downloading packages from the npm registry to disk, packages
installed with the `skypack:` protocol will only save a skeleton file
that imports the package from the Skypack CDN.

For example, running `yarn install react@skypack:latest` will write something
like the following to disk:

```javascript
export * from "https://cdn.skypack.dev/react@17.0.1";
```

No need to change your imports; `import React from "react"` will continue
to work as usual.

## Features

- **It's a CDN**: skip downloading code that only runs in the browser,
  and skip serving up to 90% of your JS during production.

- **Deterministic versioning**: Unlike handwritten Skypack imports, Yarn
  manages which versions of your dependencies get loaded. Code served
  from Skypack is guaranteed to work the same as if you had installed
  it normally.

- **Modern optimizations**: `yarn-plugin-skypack` uses
[pinned URLs](https://docs.skypack.dev/lookup-urls/pinned-urls-optimized)
for maximum performance and cacheablility. Pinned URLs come with a few
other benefits too, like optimizing responses for each browser and
preventing request waterfalls.
<!--
- **Export maps**: Some packages use [export maps](https://nodejs.org/api/packages.html#packages_exports)
  to specify what subpaths in a package you are allowed to import from.
  `yarn-plugin-skypack` makes sure to support these, so you can only
  import the code you need. -->

## Caveats

- **Anything importing a `skypack:` package must understand `https:` imports.**
  Currently, modern browsers do, but Node.js and some bundlers do not. If you
  see this error message:

  ```
  Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only file and data URLs are supported by the default ESM loader. Received protocol 'https:'
  ```

  this means you tried to import a `skypack:` package from Node.js, and you should
  probably use a different protocol.

  Bundlers could solve this problem by passing `https:` imports through unchanged,
  as long as they are targeting modern browsers.

  <details>
    <summary>Using an experimental HTTPS loader</summary>
    Though Node.js doesn't natively support `https:` imports, this functionality can be
    added. See the <a href="https://nodejs.org/api/esm.html#esm_https_loader">HTTPS loader example</a>
    in the docs, and use the `--experimental-loader` flag. This API may change.
  </details>

- **Package type definitions will not be installed.** Though Skypack can serve type
  definitions, this feature is blocked because TypeScript does not yet support
  fetching type definitions over HTTPS. If you want to help move this along, give
  [this issue](https://github.com/microsoft/TypeScript/issues/28985) a thumbs
  up on GitHub.
