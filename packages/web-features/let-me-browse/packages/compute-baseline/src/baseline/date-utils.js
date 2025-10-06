"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHighDate = toHighDate;
exports.toRangedDateString = toRangedDateString;
exports.parseRangedDateString = parseRangedDateString;
const polyfill_1 = require("@js-temporal/polyfill");
const index_js_1 = require("./index.js");
function toHighDate(lowDate) {
    const startDate = polyfill_1.Temporal.PlainDate.from(lowDate);
    return startDate.add(index_js_1.BASELINE_LOW_TO_HIGH_DURATION);
}
/**
 * Format a `Temporal.PlainDate` as a string, with a ≤ range specifier as
 * needed.
 */
function toRangedDateString(date, ranged) {
    return `${ranged ? "≤" : ""}${date.toString().slice(0, 10)}`;
}
/**
 * Parse a potentially ranged date string (e.g., "≤2024-01-01") to a
 * `Temporal.PlainDate` and a boolean value for ranged or unranged.
 */
function parseRangedDateString(dateSpec) {
    const ranged = dateSpec.startsWith("≤");
    return [
        polyfill_1.Temporal.PlainDate.from(ranged ? dateSpec.slice(1) : dateSpec),
        ranged,
    ];
}
