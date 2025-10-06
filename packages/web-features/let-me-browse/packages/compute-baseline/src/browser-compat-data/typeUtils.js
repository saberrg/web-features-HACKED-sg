"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIndexable = isIndexable;
exports.isCompatData = isCompatData;
exports.isFeatureData = isFeatureData;
exports.isBrowsers = isBrowsers;
exports.isBrowserStatement = isBrowserStatement;
exports.isCompatStatement = isCompatStatement;
exports.isMetaBlock = isMetaBlock;
function isIndexable(o) {
    if (typeof o === "object" && o !== null) {
        return true;
    }
    return false;
}
function hasKeys(o, expectedKeys) {
    return (isIndexable(o) && Object.keys(o).every((key) => expectedKeys.includes(key)));
}
// The root BCD object
function isCompatData(o) {
    return (isIndexable(o) &&
        hasKeys(o, [
            "__meta",
            "browsers",
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
        ]));
}
function isFeatureData(o) {
    return isIndexable(o) && !isBrowsers(o);
}
function isBrowsers(o) {
    return (isIndexable(o) &&
        Object.keys(o).includes("chrome") &&
        Object.keys(o).includes("edge") &&
        Object.keys(o).includes("firefox") &&
        Object.keys(o).includes("safari"));
}
function isBrowserStatement(o) {
    return hasKeys(o, ["name", "type", "releases"]);
}
function isCompatStatement(o) {
    return hasKeys(o, ["support"]);
}
function isMetaBlock(o) {
    return hasKeys(o, ["version", "timestamp"]);
}
