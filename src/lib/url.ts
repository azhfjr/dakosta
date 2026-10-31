import { createHash } from "node:crypto";

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|igshid$|mc_cid$|mc_eid$)/i;

export type NormalizedUrl = {
  normalizedUrl: string;
  normalizedUrlHash: string;
};

export function normalizePublishedUrl(input: string): NormalizedUrl {
  const url = new URL(input);

  if (url.protocol !== "https:") {
    throw new Error("Tautan harus memakai https://");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  const normalizedUrl = `${url.hostname}${pathname}${url.search}`;

  return {
    normalizedUrl,
    normalizedUrlHash: createHash("sha256").update(normalizedUrl).digest("hex"),
  };
}
