import { BrowserStatement, Browsers, CompatData, CompatStatement, Identifier, MetaBlock } from "@mdn/browser-compat-data";
type BCD = CompatData | Browsers | BrowserStatement | CompatStatement | Identifier | MetaBlock;
export declare function walk(entryPoints: string | string[], data: BCD): Generator<any, void, unknown>;
export {};
