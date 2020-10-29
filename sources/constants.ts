import type { Ident } from "@yarnpkg/core";

export const PROTOCOL = `skypack:`;
export const CDN = `https://cdn.skypack.dev`;
export const API = `https://api.skypack.dev`;
export function getIdentUrl(ident: Ident) {
  const scopePart = ident.scope ? `@${ident.scope}/` : ``;
  return `/${scopePart}${ident.name}`;
}
