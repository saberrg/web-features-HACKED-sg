import { Identifier, SimpleSupportStatement } from "@mdn/browser-compat-data";
import { Browser } from "./browser.js";
import { Compat } from "./compat.js";
import { Release } from "./release.js";
import { Qualifications, Supported, SupportStatement, UnknownSupport, Unsupported } from "./supportStatements.js";
export declare function feature(id: string, compat?: Compat): Feature;
export declare class Feature {
    id: string;
    data: Identifier;
    constructor(id: string, featureData: unknown);
    toString(): string;
    /**
     * The deprecation status of this feature, if known.
     */
    get deprecated(): boolean | undefined;
    /**
     * The feature's tags as an array (whether there are any tags or not).
     */
    get tags(): string[];
    get mdn_url(): string | undefined;
    /**
     * The feature's specification URLs as an array (whether there are any URLs or
     * not).
     */
    get spec_url(): string[];
    get standard_track(): boolean;
    /**
     * Get this feature's support statement data, for a given browser.
     */
    rawSupportStatements(browser: Browser): SimpleSupportStatement[];
    /**
     * Get this feature's `SupportStatement` objects, for a given browser.
     */
    supportStatements(browser: Browser): SupportStatement[];
    /**
     * Find out whether this feature's support data says that a given browser
     * release is supported (with or without qualifications), unsupported, or
     * unknown.
     */
    supportedInDetails(release: Release): (Supported | Unsupported | UnknownSupport)[];
    /**
     * Find out whether this feature's support data says that a given browser
     * release is supported (`true`), unsupported (`false`), or unknown (`null`).
     * Note that this treats qualifications such as partial implementations,
     * prefixes, alternative names, and flags as wholly unsupported.
     */
    supportedIn(release: Release): boolean | null;
    _supportedBy(browser: Browser): {
        release: Release;
        qualifications?: Qualifications;
    }[];
    supportedBy(options?: {
        only?: Browser[];
        compat?: Compat;
    }): any[];
}
