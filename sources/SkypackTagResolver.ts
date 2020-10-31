import {
  Descriptor,
  Locator,
  MessageName,
  MinimalResolveOptions,
  Package,
  ReportError,
  ResolveOptions,
  Resolver,
  structUtils,
  TAG_REGEXP,
  httpUtils,
} from "@yarnpkg/core";
import { PROTOCOL, API, getIdentUrl } from "./constants";

export class SkypackTagResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL)) return false;

    if (!TAG_REGEXP.test(descriptor.range.slice(PROTOCOL.length))) return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    // Once transformed into locators, the tags are resolved by the SkypackSemverResolver
    return false;
  }

  shouldPersistResolution(
    locator: Locator,
    opts: MinimalResolveOptions
  ): never {
    // Once transformed into locators, the tags are resolved by the SkypackSemverResolver
    throw new Error(`Unreachable`);
  }

  bindDescriptor(
    descriptor: Descriptor,
    fromLocator: Locator,
    opts: MinimalResolveOptions
  ) {
    return descriptor;
  }

  getResolutionDependencies(
    descriptor: Descriptor,
    opts: MinimalResolveOptions
  ) {
    return [];
  }

  async getCandidates(
    descriptor: Descriptor,
    dependencies: unknown,
    opts: ResolveOptions
  ) {
    const tag = descriptor.range.slice(PROTOCOL.length);

    const registryData: any = await httpUtils.get(
      `${API}/v1/package${getIdentUrl(descriptor)}`,
      {
        jsonResponse: true,
        configuration: opts.project.configuration,
      }
    );

    const distTags = registryData.distTags;
    if (typeof distTags !== "object" && !distTags) {
      throw new ReportError(
        MessageName.REMOTE_INVALID,
        `Skypack API returned invalid data: missing "distTags" field`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(distTags, tag))
      throw new ReportError(
        MessageName.REMOTE_NOT_FOUND,
        `Skypack failed to resolve tag "${tag}"`
      );

    const version = distTags[tag];
    const versionLocator = structUtils.makeLocator(
      descriptor,
      `${PROTOCOL}${version}`
    );

    return [versionLocator];
  }

  async getSatisfying(
    descriptor: Descriptor,
    references: Array<string>,
    opts: ResolveOptions
  ) {
    // We can't statically know if a tag resolves to a specific version without using the network
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    // Once transformed into locators (through getCandidates), the tags are resolved by the SkypackSemverResolver
    throw new Error(`Unreachable`);
  }
}
