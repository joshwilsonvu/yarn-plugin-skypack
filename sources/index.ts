import type { Plugin } from "@yarnpkg/core";

import { SkypackTagResolver } from "./SkypackTagResolver";
import { SkypackSemverResolver } from "./SkypackSemverResolver";
import { SkypackSkeletonFetcher } from "./SkypackSkeletonFetcher";

const plugin: Plugin = {
  resolvers: [SkypackTagResolver, SkypackSemverResolver],
  fetchers: [SkypackSkeletonFetcher],
};

export default plugin;
