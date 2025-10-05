"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
// Quicktype produces definitions that are correct, but not as narrow or
// well-named as hand-written type definition might produce. This module takes
// the Quicktype-generated types as renames or modifies the types to be somewhat
// nicer to work with in TypeScript.
Object.defineProperty(exports, "__esModule", { value: true });
// These are "tests" for our type definitions.
var badQuicktypeStatusHeadline = {
    baseline: true, // This is an improper value in our actual published data
    support: {},
};
var badQuicktypeStatus = badQuicktypeStatusHeadline;
var badSupportStatus = {
    // This validates that we're actually overriding Quicktype (and correctly). If
    // `baseline: true` ever becomes possible in the `SupportStatus`, then
    // TypeScript will complain about the next line.
    // @ts-expect-error
    baseline: true,
    support: {},
};
var badStatus = {
    // @ts-expect-error
    baseline: true,
    support: {},
};
var goodSupportStatus = {
    baseline: false,
    support: {},
};
var goodFeatureData = {
    kind: "feature",
    name: "Test",
    description: "Hi",
    description_html: "Hi",
    spec: [""],
    snapshot: [""],
    group: [""],
    caniuse: [""],
    discouraged: {
        according_to: [""],
        alternatives: [""],
    },
    status: {
        baseline: false,
        support: {},
    },
};
var goodFeatureMovedData = {
    kind: "moved",
    redirect_target: "",
};
var badFeatureMovedData = {
    kind: "moved",
    // @ts-expect-error
    redirect_targets: ["", ""],
};
var goodFeatureSplitData = {
    kind: "split",
    redirect_targets: ["", ""],
};
var badFeatureSplitData = {
    kind: "split",
    // @ts-expect-error
    redirect_target: "",
};
