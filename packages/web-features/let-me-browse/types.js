"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
// Quicktype produces definitions that are correct, but not as narrow or
// well-named as hand-written type definition might produce. This module takes
// the Quicktype-generated types as renames or modifies the types to be somewhat
// nicer to work with in TypeScript.
Object.defineProperty(exports, "__esModule", { value: true });
// These are "tests" for our type definitions.
const badQuicktypeStatusHeadline = {
    baseline: true, // This is an improper value in our actual published data
    support: {},
};
const badQuicktypeStatus = badQuicktypeStatusHeadline;
const badSupportStatus = {
    // This validates that we're actually overriding Quicktype (and correctly). If
    // `baseline: true` ever becomes possible in the `SupportStatus`, then
    // TypeScript will complain about the next line.
    // @ts-expect-error
    baseline: true,
    support: {},
};
const badStatus = {
    // @ts-expect-error
    baseline: true,
    support: {},
};
const goodSupportStatus = {
    baseline: false,
    support: {},
};
const goodFeatureData = {
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
const goodFeatureMovedData = {
    kind: "moved",
    redirect_target: "",
};
const badFeatureMovedData = {
    kind: "moved",
    // @ts-expect-error
    redirect_targets: ["", ""],
};
const goodFeatureSplitData = {
    kind: "split",
    redirect_targets: ["", ""],
};
const badFeatureSplitData = {
    kind: "split",
    // @ts-expect-error
    redirect_target: "",
};
