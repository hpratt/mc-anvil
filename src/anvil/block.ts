import * as MD5 from 'crypto-js/md5';
import { associateBy } from 'queryz';

import { TagData, TagType } from "../nbt";
import { findCompoundListChildren } from "../nbt/nbt";
import { BinaryParser, BitParser } from "../util";
import { BLOCKS_PER_CHUNK } from './chunk';
import { BlockStates, Palette } from "./types";

export function blockTypeString(t: TagData[]): string {
    const name = t.find(x => x.name === "Name")?.data || "";
    const properties = ((t.find(x => x.name === "Properties")?.data || []) as TagData[])
        .filter(x => x.type === TagType.STRING)
        .map(x => `${x.name}:${x.data}`);
    return `${name}(${properties.join(",")})`;
}

export function blockTypeID(t: TagData[]): number {
    const w = MD5(blockTypeString(t)).words;
    return w[0];
}

export function paletteNameList(palette: Palette): string[] {
    return palette.data.data.map(x => (x.find(x => x.name === "Name")?.data || "") as string);
}

export class BlockDataParser extends BitParser {

    private palette: Palette;
    private blockTypeStringMap: Map<string, string> | null;
    private blockTypeIDMap: Map<string, number> | null;
    private blockTypeIDToStringMap: Map<number, string> | null;
    private paletteNames: string[];

    constructor(blockStates: BlockStates, palette: Palette) {
        const d = new BinaryParser(blockStates.data as ArrayBuffer);
        const b = new BigUint64Array(d.remainingLength() / 8);
        for (let i = 0; i < b.length; ++i) b[i] = d.getUInt64LE();
        super(b.buffer);
        this.palette = palette;
        this.paletteNames = paletteNameList(this.palette);
        this.blockTypeStringMap = null;
        this.blockTypeIDMap = null;
        this.blockTypeIDToStringMap = null;
    }

    private getBlocksGenericOriginal<T>(f: (n: number) => T, limit?: number) {
        const paletteSize = this.palette.data.data.length;
        const toRead = paletteSize ? Math.ceil(Math.log2(paletteSize)) : 0;
        const total = limit || BLOCKS_PER_CHUNK;
        const r: T[] = [];
        for (let i = 0; i < total; ++i) r.push(f(this.getBits(toRead)));
        return r;
    }

    private getBlocksGeneric<T>(f: (n: number) => T, limit?: number) {
        const paletteSize = this.palette.data.data.length;
        const toRead = paletteSize ? Math.ceil(Math.log2(paletteSize)) : 0;
        const r: T[] = [];
        const skipIndex = Math.floor(64 / toRead);
        const toSkip = 64 % toRead;
        const total = limit || BLOCKS_PER_CHUNK;
        for (let i = 0; i < total; ++i) {
            if (skipIndex > 0 && skipIndex < Infinity && i % skipIndex === 0) this.getBits(toSkip);
            r.push(f(this.getBits(toRead)));
        }
        return r;
    }

    private getBlockTypeIDMap() {
        this.blockTypeIDMap = associateBy(this.palette.data.data, x => (x.find(x => x.name === "Name")?.data || "") as string, blockTypeID);
    }

    private getBlockTypeStringMap() {
        this.blockTypeStringMap = associateBy(this.palette.data.data, x => (x.find(x => x.name === "Name")?.data || "") as string, blockTypeString);
    }

    private getBlockTypeIDToStringMap() {
        this.blockTypeIDToStringMap = associateBy(
            this.palette.data.data,
            blockTypeID,
            blockTypeString
        );
    }

    getBlocks(original?: boolean, limit?: number) {
        return original
            ? this.getBlocksGenericOriginal(x => this.palette.data.data[x], limit)
            : this.getBlocksGeneric(x => this.palette.data.data[x], limit);
    }

    getBlockIDs(original?: boolean, limit?: number) {
        return original
            ? this.getBlocksGenericOriginal(x => x, limit)
            : this.getBlocksGeneric(x => x, limit);
    }

    getBlockTypeNames(original?: boolean, limit?: number) {
        if (this.blockTypeStringMap === null) this.getBlockTypeStringMap();
        return original
            ? this.getBlocksGenericOriginal(x => this.blockTypeStringMap?.get(this.paletteNames[x]), limit)
            : this.getBlocksGeneric(x => this.blockTypeStringMap?.get(this.paletteNames[x]), limit);
    }

    getBlockTypeIDs(original?: boolean, limit?: number) {
        if (this.blockTypeIDMap === null) this.getBlockTypeIDMap();
        return original
            ? this.getBlocksGenericOriginal(x => this.blockTypeIDMap?.get(this.paletteNames[x]), limit)
            : this.getBlocksGeneric(x => this.blockTypeIDMap?.get(this.paletteNames[x]), limit);
    }

    blockStateFromHash(hash: number): string {
        if (this.blockTypeIDToStringMap === null) this.getBlockTypeIDToStringMap();
        return this.blockTypeIDToStringMap?.get(hash) || "";
    }

    findBlocksByName(name: string): number[] {
        const blocks = this.getBlockIDs();
        const nameIndex = findCompoundListChildren(this.palette, x => x.name === "Name")
            ?.map((x, i) => ({ x, i }))
            .find(x => x.x?.data === name)
            ?.i;
        return blocks.map((x, i) => ({ x, i })).filter(x => x.x === nameIndex).map(x => x.i);
    }

}
