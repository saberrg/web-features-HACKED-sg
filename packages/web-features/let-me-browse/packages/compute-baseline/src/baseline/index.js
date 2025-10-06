"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASELINE_LOW_TO_HIGH_DURATION = exports.logger = exports.parseRangedDateString = exports.coreBrowserSet = void 0;
exports.setLogger = setLogger;
exports.getStatus = getStatus;
exports.computeBaseline = computeBaseline;
exports.keystoneDateToStatus = keystoneDateToStatus;
const polyfill_1 = require("@js-temporal/polyfill");
const compat_js_1 = require("../browser-compat-data/compat.js");
const feature_js_1 = require("../browser-compat-data/feature.js");
const core_browser_set_js_1 = require("./core-browser-set.js");
const date_utils_js_1 = require("./date-utils.js");
const support_js_1 = require("./support.js");
// Include this in the public API
var core_browser_set_js_2 = require("./core-browser-set.js");
Object.defineProperty(exports, "coreBrowserSet", { enumerable: true, get: function () { return core_browser_set_js_2.identifiers; } });
var date_utils_js_2 = require("./date-utils.js");
Object.defineProperty(exports, "parseRangedDateString", { enumerable: true, get: function () { return date_utils_js_2.parseRangedDateString; } });
exports.logger = process.env["DEBUG_COMPUTE_BASELINE"]
    ? console
    : undefined;
function setLogger(logFacility) {
    exports.logger = logFacility;
}
// Number of months after Baseline low that Baseline high happens. Keep in sync with definition:
// https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md#wider-support-high-status
exports.BASELINE_LOW_TO_HIGH_DURATION = polyfill_1.Temporal.Duration.from({
    months: 30,
});
/**
 * Calculate a Baseline status for specific browser compat data keys within a
 * web-features feature, in the style of a web-feature's `status` key. Use this
 * method to calculate fine-grained support statuses. This is the only method
 * approved to compute Baseline statuses not otherwise published in the
 * `web-features` package.
 *
 * For example, suppose you want to show a Baseline status for a specific method
 * in a feature, which might've been supported earlier or later than the broader
 * feature overall. Then you'd call `getStatus('example-feature',
 * 'api.ExampleManager.doExample')`.
 */
function getStatus(featureId, compatKey, compat = compat_js_1.defaultCompat) {
    // TODO: actually check that featureId is a valid feature
    // TODO: actually check that compatKey is tagged as featureId in BCD _or_ listed in web-features
    return JSON.parse(computeBaseline({ compatKeys: [compatKey], checkAncestors: true }, compat).toJSON());
}
/**
 * Given a set of compat keys, compute the aggregate Baseline support ("high",
 * "low" or false, dates, and releases) for those keys.
 */
function computeBaseline(featureSelector, compat = compat_js_1.defaultCompat) {
    // A cutoff date approximating "now" is needed to determine when a feature has
    // entered Baseline high. We use BCD's __meta.timestamp for this, but any
    // "clock" based on the state of the tree that ticks frequently would work.
    const timestamp = compat.data.__meta.timestamp;
    const cutoffDate = polyfill_1.Temporal.Instant.from(timestamp)
        .toZonedDateTimeISO("UTC")
        .toPlainDate();
    const { compatKeys } = featureSelector;
    const keys = featureSelector.checkAncestors
        ? compatKeys.flatMap((key) => withAncestors(key, compat))
        : compatKeys;
    const statuses = keys.map((key) => calculate(key, compat));
    const support = collateSupport(statuses.map((status) => status.support));
    const keystoneDate = findKeystoneDate(statuses.flatMap((s) => [...s.support.values()]));
    const discouraged = statuses.some((s) => s.discouraged);
    const { baseline, baseline_low_date, baseline_high_date } = keystoneDateToStatus(keystoneDate, cutoffDate, discouraged);
    return {
        baseline,
        baseline_low_date,
        baseline_high_date,
        discouraged,
        support,
        toJSON: function () {
            return jsonify(this);
        },
    };
}
/**
 * Compute the Baseline support ("high", "low" or false, dates, and releases)
 * for a single compat key.
 */
function calculate(compatKey, compat) {
    const f = (0, feature_js_1.feature)(compatKey);
    return {
        discouraged: f.deprecated ?? false,
        support: (0, support_js_1.support)(f, (0, core_browser_set_js_1.browsers)(compat)),
    };
}
/**
 * Given a compat key, get the key and any of its ancestor features.
 *
 * For example, given the key `"html.elements.a.href"`, return
 * `["html.elements.a", "html.elements.a.href"]`.
 */
function withAncestors(compatKey, compat) {
    const items = compatKey.split(".");
    const ancestors = [];
    let current = items.shift();
    while (items.length) {
        current = `${current}.${items.shift()}`;
        const data = compat.query(current);
        if (typeof data === "object" && data !== null && "__compat" in data) {
            ancestors.push(current);
        }
    }
    return ancestors;
}
/**
 * Collate several support summaries, taking the most-recent release for each
 * browser across all of the summaries.
 */
function collateSupport(supports) {
    const collated = new Map();
    for (const support of supports) {
        for (const [browser, initialSupport] of support) {
            collated.set(browser, [...(collated.get(browser) ?? []), initialSupport]);
        }
    }
    const support = new Map();
    for (const [browser, initialSupports] of collated) {
        if (initialSupports.includes(undefined)) {
            support.set(browser, undefined);
        }
        else {
            support.set(browser, initialSupports
                .sort(support_js_1.compareInitialSupport)
                .at(-1));
        }
    }
    return support;
}
/**
 * Given several dates, find the most-recent date and determine the
 * corresponding Baseline status and high and low dates.
 */
function keystoneDateToStatus(dateSpec, cutoffDate, discouraged) {
    if (dateSpec == null || discouraged) {
        return {
            baseline: false,
            baseline_low_date: null,
            baseline_high_date: null,
        };
    }
    const [date, ranged] = (0, date_utils_js_1.parseRangedDateString)(dateSpec);
    let baseline = "low";
    let baseline_low_date = (0, date_utils_js_1.toRangedDateString)(date, ranged);
    let baseline_high_date = null;
    const possibleHighDate = (0, date_utils_js_1.toHighDate)(date);
    if (polyfill_1.Temporal.PlainDate.compare(possibleHighDate, cutoffDate) <= 0) {
        baseline = "high";
        baseline_high_date = (0, date_utils_js_1.toRangedDateString)(possibleHighDate, ranged);
    }
    return { baseline, baseline_low_date, baseline_high_date };
}
/**
 * Given one or more releases, return the most-recent release date. If a release
 * is `undefined` or the release date is `null`, then return `null`, since the
 * feature is not Baseline and there is no keystone date.
 */
function findKeystoneDate(support) {
    if (support.includes(undefined) || support.length === 0) {
        return null;
    }
    const initialSupports = support;
    if (initialSupports.some((i) => i.release.date === null)) {
        return null;
    }
    const keystone = initialSupports
        .sort((i1, i2) => {
        if (polyfill_1.Temporal.PlainDate.compare(i1.release.date, i2.release.date) === 0) {
            if (i1.ranged && !i2.ranged) {
                return -1;
            }
            if (!i1.ranged && i2.ranged) {
                return 1;
            }
            return 0;
        }
        return polyfill_1.Temporal.PlainDate.compare(i1.release.date, i2.release.date);
    })
        .at(-1);
    if (!keystone.release.date) {
        return null;
    }
    if (keystone.ranged) {
        return `≤${keystone.release.date}`;
    }
    return keystone.release.date.toString();
}
function jsonify(status) {
    const { baseline_low_date, baseline_high_date } = status;
    const support = {};
    for (const [browser, initialSupport] of status.support.entries()) {
        if (initialSupport !== undefined) {
            support[browser.id] = initialSupport.text;
        }
    }
    if (status.baseline === "high") {
        return JSON.stringify({
            baseline: status.baseline,
            baseline_low_date,
            baseline_high_date,
            support,
        }, undefined, 2);
    }
    if (status.baseline === "low") {
        return JSON.stringify({
            baseline: status.baseline,
            baseline_low_date,
            support,
        }, undefined, 2);
    }
    return JSON.stringify({
        baseline: status.baseline,
        support,
    }, undefined, 2);
}
