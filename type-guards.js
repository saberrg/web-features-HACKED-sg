export function isOrdinaryFeatureData(x) {
    return typeof x === "object" && "kind" in x && x.kind === "feature";
}
export function isSplit(x) {
    return typeof x === "object" && "kind" in x && x.kind === "split";
}
export function isMoved(x) {
    return typeof x === "object" && "kind" in x && x.kind === "moved";
}
