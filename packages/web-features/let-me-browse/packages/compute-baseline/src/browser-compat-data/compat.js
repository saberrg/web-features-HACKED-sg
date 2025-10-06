"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCompat = exports.Compat = void 0;
const browser_compat_data_1 = require("@mdn/browser-compat-data");
const index_js_1 = require("./index.js");
const typeUtils_js_1 = require("./typeUtils.js");
class Compat {
    constructor(data = browser_compat_data_1.default) {
        this.data = data;
        this.browsers = new Map();
        this.features = new Map();
    }
    /**
     * Get the version string from @mdn/browser-compat-data's `__meta` object (or
     * `"unknown"` if unset).
     */
    get version() {
        if ((0, typeUtils_js_1.isIndexable)(this.data) && (0, typeUtils_js_1.isMetaBlock)(this.data.__meta)) {
            return this.data.__meta.version;
        }
        return "unknown";
    }
    query(path) {
        return (0, index_js_1.query)(path, this.data);
    }
    browser(id) {
        return (0, index_js_1.browser)(id, this);
    }
    feature(id) {
        return (0, index_js_1.feature)(id, this);
    }
    /**
     * Generate `Feature` objects by walking tree of features.
     *
     * Similar to the `traverse` command in mdn/browser-compat-data.
     *
     * @param {string[]} [entryPoints] An array of dotted paths to compat features (e.g., `css.properties.background-color`)
     */
    *walk(entryPoints) {
        if (!entryPoints) {
            entryPoints = Object.keys(this.data).filter((key) => !["__meta", "browsers"].includes(key));
        }
        for (const { path } of (0, index_js_1.walk)(entryPoints, this.data)) {
            yield this.feature(path);
        }
    }
}
exports.Compat = Compat;
exports.defaultCompat = new Compat(browser_compat_data_1.default);
