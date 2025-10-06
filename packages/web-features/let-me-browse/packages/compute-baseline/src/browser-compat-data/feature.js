"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feature = void 0;
exports.feature = feature;
const compat_js_1 = require("./compat.js");
const supportStatements_js_1 = require("./supportStatements.js");
const typeUtils_js_1 = require("./typeUtils.js");
function feature(id, compat = compat_js_1.defaultCompat) {
    let f = compat.features.get(id);
    if (f) {
        return f;
    }
    f = new Feature(id, compat.query(id));
    compat.features.set(id, f);
    return f;
}
class Feature {
    constructor(id, featureData) {
        if (!(0, typeUtils_js_1.isFeatureData)(featureData)) {
            throw new Error(`${id} is not valid feature`);
        }
        this.id = id;
        this.data = featureData;
    }
    toString() {
        return `[Feature ${this.id}]`;
    }
    /**
     * The deprecation status of this feature, if known.
     */
    get deprecated() {
        return this.data.__compat?.status?.deprecated;
    }
    /**
     * The feature's tags as an array (whether there are any tags or not).
     */
    get tags() {
        return this.data.__compat?.tags ?? [];
    }
    get mdn_url() {
        return this.data.__compat?.mdn_url;
    }
    /**
     * The feature's specification URLs as an array (whether there are any URLs or
     * not).
     */
    get spec_url() {
        const underlying = this.data.__compat?.spec_url;
        if (underlying) {
            return Array.isArray(underlying) ? underlying : [underlying];
        }
        return [];
    }
    get standard_track() {
        return this.data.__compat?.status?.standard_track ?? false;
    }
    /**
     * Get this feature's support statement data, for a given browser.
     */
    rawSupportStatements(browser) {
        const support = this.data?.__compat?.support;
        if (support === undefined) {
            throw new Error("This feature contains no __compat object.");
        }
        const statementOrStatements = support[browser.id];
        if (statementOrStatements === undefined) {
            throw new Error(`${this} contains no support data for ${browser.name}`);
        }
        return Array.isArray(statementOrStatements)
            ? statementOrStatements
            : [statementOrStatements];
    }
    /**
     * Get this feature's `SupportStatement` objects, for a given browser.
     */
    supportStatements(browser) {
        return this.rawSupportStatements(browser).map((raw) => new supportStatements_js_1.SupportStatement(raw, browser, this));
    }
    /**
     * Find out whether this feature's support data says that a given browser
     * release is supported (with or without qualifications), unsupported, or
     * unknown.
     */
    supportedInDetails(release) {
        const result = [];
        for (const s of this.supportStatements(release.browser)) {
            result.push(s.supportedInDetails(release));
        }
        return result;
    }
    /**
     * Find out whether this feature's support data says that a given browser
     * release is supported (`true`), unsupported (`false`), or unknown (`null`).
     * Note that this treats qualifications such as partial implementations,
     * prefixes, alternative names, and flags as wholly unsupported.
     */
    supportedIn(release) {
        let unknown = false;
        for (const s of this.supportStatements(release.browser)) {
            const supported = s.supportedInDetails(release);
            if (supported.supported && !supported.qualifications) {
                return true;
            }
            if (supported.supported === null) {
                unknown = true;
            }
        }
        if (unknown) {
            return null;
        }
        return false;
    }
    _supportedBy(browser) {
        const result = [];
        for (const s of this.supportStatements(browser)) {
            result.push(...s.supportedBy());
        }
        return result;
    }
    supportedBy(options) {
        const compat = options?.compat === undefined ? compat_js_1.defaultCompat : options.compat;
        const browsers = options?.only
            ? options.only
            : Object.keys(this.data?.__compat?.support || {}).map((id) => compat.browser(id));
        const result = [];
        for (const b of browsers) {
            result.push(...this._supportedBy(b));
        }
        return result;
    }
}
exports.Feature = Feature;
