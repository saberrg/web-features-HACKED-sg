"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
const typeUtils_js_1 = require("./typeUtils.js");
// TODO: Name this better. There's nothing so sophisticated as a "query" here.
// It's a boring lookup!
function query(path, data) {
    const pathElements = path.split(".");
    let lookup = data;
    while (pathElements.length) {
        const next = pathElements.shift();
        if (!(0, typeUtils_js_1.isIndexable)(lookup) || !(next in lookup)) {
            throw new Error(`${path} is unindexable at '${next}'`);
        }
        lookup = lookup[next];
    }
    return lookup;
}
