import type { Plugin } from "@yarnpkg/core";

import { SkypackSemverResolver } from "./SkypackSemverResolver";
import { SkypackSkeletonFetcher } from "./SkypackSkeletonFetcher";

const plugin: Plugin = {
  fetchers: [SkypackSkeletonFetcher],
  resolvers: [SkypackSemverResolver],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
