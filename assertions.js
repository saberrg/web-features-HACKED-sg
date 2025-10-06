import { isOrdinaryFeatureData } from "./type-guards";
/**
 * Assert that a reference from one feature to another is an ordinary feature
 * reference (i.e., it's defined and not some kind of redirect).
 *
 * @export
 * @param {string} sourceId The feature that is referencing another feature
 * @param {string} targetId The feature being referenced
 * @param {WebFeaturesData["features"]} features Feature data
 */
export function assertValidFeatureReference(sourceId, targetId, features) {
    const target = features[targetId];
    if (target === undefined) {
        throw new Error(`${sourceId} references a non-existent feature`);
    }
    if (!isOrdinaryFeatureData(target)) {
        throw new Error(`${sourceId} references a redirect "${targetId} instead of an ordinary feature ID`);
    }
}
// TODO: assertValidSnapshotReference
