"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walk = walk;
const query_js_1 = require("./query.js");
const typeUtils_js_1 = require("./typeUtils.js");
const walkUtils_js_1 = require("./walkUtils.js");
function* lowLevelWalk(data, path, depth = Infinity) {
    if (path !== undefined) {
        const next = {
            path,
            data,
        };
        if ((0, typeUtils_js_1.isBrowserStatement)(data)) {
            next.browser = data;
        }
        else if ((0, typeUtils_js_1.isFeatureData)(data)) {
            next.compat = data.__compat;
        }
        yield next;
    }
    if (depth > 0) {
        for (const key of (0, walkUtils_js_1.descendantKeys)(data, path)) {
            // TODO: can anything be done about this "as"?
            yield* lowLevelWalk(data[key], joinPath(path, key), depth - 1);
        }
    }
}
function joinPath(...pathItems) {
    return pathItems.filter((item) => item !== undefined).join(".");
}
function* walk(entryPoints, data) {
    const walkers = [];
    if (entryPoints === undefined) {
        walkers.push(lowLevelWalk(data));
    }
    else {
        entryPoints = Array.isArray(entryPoints) ? entryPoints : [entryPoints];
        walkers.push(...entryPoints.map((entryPoint) => {
            const queryResult = (0, query_js_1.query)(entryPoint, data);
            if ((0, typeUtils_js_1.isFeatureData)(queryResult)) {
                return lowLevelWalk(queryResult, entryPoint);
            }
            throw new Error("Unhandled traverse target");
        }));
    }
    for (const walker of walkers) {
        for (const step of walker) {
            if (step.compat) {
                yield step;
            }
        }
    }
}
