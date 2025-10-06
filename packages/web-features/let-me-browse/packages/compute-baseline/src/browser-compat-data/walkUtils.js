"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.descendantKeys = descendantKeys;
const typeUtils_js_1 = require("./typeUtils.js");
function descendantKeys(data, path) {
    if ((0, typeUtils_js_1.isCompatData)(data)) {
        return [
            "api",
            "css",
            "html",
            "http",
            "javascript",
            "mathml",
            "svg",
            "webassembly",
            "webdriver",
            "webextensions",
        ];
    }
    if ((0, typeUtils_js_1.isMetaBlock)(data)) {
        return [];
    }
    if ((0, typeUtils_js_1.isCompatStatement)(data)) {
        return [];
    }
    if ((0, typeUtils_js_1.isBrowserStatement)(data)) {
        return [];
    }
    if ((0, typeUtils_js_1.isFeatureData)(data)) {
        return Object.keys(data).filter((key) => key !== "__compat");
    }
    throw new Error(`Unhandled traverse into descendants of object at ${path ?? "[root]"}`);
}
