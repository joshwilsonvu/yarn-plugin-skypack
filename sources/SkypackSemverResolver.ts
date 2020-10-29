import { structUtils } from "@yarnpkg/core";
import { LinkType } from "@yarnpkg/core";
import {
  Descriptor,
  Locator,
  Ident,
  semverUtils,
  httpUtils,
} from "@yarnpkg/core";
import {
  ReportError,
  MessageName,
  Resolver,
  ResolveOptions,
  MinimalResolveOptions,
  DescriptorHash,
  Package,
} from "@yarnpkg/core";
import semver from "semver";

import { PROTOCOL, API, getIdentUrl } from "./constants";

export class SkypackSemverResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL)) {
      return false;
    }
    return !!semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(PROTOCOL)) {
      return false;
    }
    const { selector } = structUtils.parseRange(locator.reference);
    return !!semver.valid(selector);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
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
    dependencies: Map<DescriptorHash, Package>,
    opts: ResolveOptions
  ) {
    const range = semverUtils.validRange(
      descriptor.range.slice(PROTOCOL.length)
    );
    if (range === null) {
      throw new Error(
        `Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`
      );
    }
    const registryData: any = await httpUtils.get(
      `${API}/v1/package${getIdentUrl(descriptor)}`,
      {
        jsonResponse: true,
        configuration: opts.project.configuration,
      }
    );

    if (registryData.isDeprecated) {
      opts.report.reportWarning(
        MessageName.DEPRECATED_PACKAGE,
        `${structUtils.prettyDescriptor(
          opts.project.configuration,
          descriptor
        )} is deprecated`
      );
    }

    return Object.keys(registryData.versions)
      .map((version) => new semver.SemVer(version))
      .filter((version) => range.test(version))
      .sort((a, b) => -a.compare(b))
      .map((version) =>
        structUtils.makeLocator(descriptor, `${PROTOCOL}${version.raw}`)
      );
  }

  async getSatisfying(
    descriptor: Descriptor,
    references: Array<string>,
    opts: ResolveOptions
  ) {
    const range = semverUtils.validRange(
      descriptor.range.slice(PROTOCOL.length)
    );
    if (range === null) {
      throw new Error(
        `Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`
      );
    }
    return references
      .map((reference) => {
        try {
          return new semver.SemVer(reference.slice(PROTOCOL.length));
        } catch {
          return null;
        }
      })
      .filter((version): version is semver.SemVer => version !== null)
      .filter((version) => range.test(version))
      .sort((a, b) => -a.compare(b))
      .map((version) =>
        structUtils.makeLocator(descriptor, `${PROTOCOL}${version.raw}`)
      );
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const { selector } = structUtils.parseRange(locator.reference);

    const version = semver.clean(selector);
    if (version === null) {
      throw new ReportError(
        MessageName.RESOLVER_NOT_FOUND,
        `The Skypack semver resolver got selected, but the version isn't semver`
      );
    }
    return {
      ...locator,
      version,
      languageName: `node`,
      linkType: LinkType.HARD,
      // Since only a skeleton file is getting installed, dependencies are irrelevant here
      // (they'll be loaded from Skypack).
      dependencies: new Map(),
      peerDependencies: new Map(),
      dependenciesMeta: new Map(),
      peerDependenciesMeta: new Map(),
      bin: new Map(),
    };
  }
}
