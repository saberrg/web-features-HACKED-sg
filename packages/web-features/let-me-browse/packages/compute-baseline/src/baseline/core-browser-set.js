"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifiers = void 0;
exports.browsers = browsers;
exports.identifiers = [
    "chrome",
    "chrome_android",
    "edge",
    "firefox",
    "firefox_android",
    "safari",
    "safari_ios",
];
function browsers(compat) {
    return exports.identifiers.map((b) => compat.browser(b));
}
