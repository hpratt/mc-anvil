import * as MD5 from 'crypto-js/md5';
import { associateBy } from 'queryz';

import { TagData, TagType } from "../nbt";
import { findCompoundListChildren } from "../nbt/nbt";
import { BinaryParser, BitParser } from "../util";
import { Chunk } from './chunk';
import { BlockStates, Palette } from "./types";

export function blockTypeString(t: TagData[]): string {
    const name = t.find(x => x.name.toLowerCase() === "name")?.data || "";
    const properties = ((t.find(x => x.name.toLowerCase() === "properties")?.data || []) as TagData[])
        .filter(x => x.type === TagType.STRING)
        .sort( (a, b) => a.name.localeCompare(b.name) )
        .map(x => `${x.name}:${x.data}`);
    return `${name}(${properties.join(",")})`;
}

export function block(t: TagData[]): { name: string, properties: { [key: string]: string } } {
    const name = t.find(x => x.name.toLowerCase() === "name")?.data as string || "";
    const properties: { [key: string]: string } = {};
    ((t.find(x => x.name.toLowerCase() === "properties")?.data || []) as TagData[])
        .filter(x => x.type === TagType.STRING)
        .forEach(x => { properties[x.name] = x.data as string; });
    return { name, properties };
}

export function blockTypeID(t: TagData[]): number {
    const w = MD5(blockTypeString(t)).words;
    return w[0];
}

export function paletteNameList(palette: Palette): string[] {
    return palette.data.data.map(x => (x.find(x => x.name.toLowerCase() === "name")?.data || "") as string);
}

export function paletteAsList(palette: Palette): { name: string, properties: { [key: string]: string } }[] {
    return palette.data.data.map(block);
}

export function paletteBlockList(palette: Palette): string[] {
    return palette.data.data.map(blockTypeString);
}

/**
 * Provides bitwise parsing and writing for the UInt64 array encoding block states within chunk sections.
 */
export class BlockDataParser extends BitParser {

    private palette: Palette;
    private blockTypeStringMap: Map<string, string> | null;
    private blockTypeIDMap: Map<string, number> | null;
    private blockTypeIDToStringMap: Map<number, string> | null;
    private paletteNames: string[];

    /**
     * Encodes a list of block states for a section and writes them to a blob.
     * @param states the list of block states to write, corresponding to indexes in the corresponding palette.
     * @returns an ArrayBuffer containing the data which can be inserted into a long array NBT tag.
     */
    static writeBlockStates(states: number[], paletteLength?: number): ArrayBuffer {
        const l = Math.floor(Math.log2((paletteLength === undefined ? Math.max(...states) : paletteLength) || 1)) + 1;
        const length = l < 4 ? 4 : l;
        const c = Math.floor(64 / length);
        const toSkip = 64 % c;
        const r = new ArrayBuffer(8 * Math.ceil(states.length / c));
        const d = new BitParser(r);
        let workingList: number[] = [];
        for (let i = 0; i < states.length; ++i) {
            if (c > 0 && c < Infinity && i % c === 0) {
                if (workingList.length > 0) d.setBits(toSkip, 0);
                for (let i = workingList.length - 1; i >= 0; --i) d.setBits(length, workingList[i]);
                workingList = [];
            }
            workingList.push(states[i]);
        }
        if (workingList.length > 0) d.setBits(toSkip, 0);
        for (let i = 0; i < c - workingList.length; ++i) d.setBits(length, 0);
        for (let i = workingList.length - 1; i >= 0; --i) d.setBits(length, workingList[i]);
        return r;
    }

    /**
     * Constructs a parser for a section given its block state data and palette.
     * @param blockStates an NBT tag containing the block state data; typically found at block_states/data for a section.
     * @param palette an NBT tag containing the palette; typically found at block_states/palette for a section.
     */
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

    /**
     * Fetches block indexes stored in original format (prior to snapshot 20w17a) in which individual blocks may be
     * spread across multiple unsigned longs. Each index corresponds to an index in the section's palette.
     * @param f transform function to apply to each fetched index.
     * @param limit maximum number of blocks to retrieve; if not passed, all will be retrieved.
     * @returns list of transformed block indexes.
     */
    private getBlocksGenericOriginal<T>(f: (n: number) => T, limit?: number) {
        const paletteSize = this.palette.data.data.length;
        const toRead = paletteSize ? Math.ceil(Math.log2(paletteSize)) : 0;
        const total = limit || Chunk.BLOCKS_PER_CHUNK;
        const r: T[] = [];
        for (let i = 0; i < total; ++i) r.push(f(this.getBits(toRead)));
        return r;
    }

    /**
     * Fetches block indexes stored in current format (after snapshot 20w17a) in which individual blocks are not
     * spread across multiple unsigned longs. Each index corresponds to an index in the section's palette.
     * @param f transform function to apply to each fetched index.
     * @param limit maximum number of blocks to retrieve; if not passed, all will be retrieved.
     * @returns list of transformed block indexes.
     */
    private getBlocksGeneric<T>(f: (n: number) => T, limit?: number) {
        const paletteSize = this.palette.data.data.length;
        const l = Math.floor(Math.log2((paletteSize - 1) || 1)) + 1;
        const toRead = paletteSize ? (l < 4 ? 4 : l) : 0;
        const r: T[] = [];
        const skipIndex = Math.floor(64 / toRead);
        const toSkip = 64 % toRead;
        const total = limit || (this.view.byteLength / 8 * skipIndex);
        let workingList: number[] = [];
        for (let i = 0; i < total; ++i) {
            if (skipIndex > 0 && skipIndex < Infinity && i % skipIndex === 0) {
                this.getBits(toSkip);
                for (let i = workingList.length - 1; i >= 0; --i) r.push(f(workingList[i]));
                workingList = [];
            }
            workingList.push(this.getBits(toRead));
        }
        for (let i = workingList.length - 1; i >= 0; --i) r.push(f(workingList[i]));
        if (total > Chunk.BLOCKS_PER_CHUNK) return r.slice(0, Chunk.BLOCKS_PER_CHUNK);
        return r;
    }

    private getBlockTypeIDMap() {
        this.blockTypeIDMap = associateBy(this.palette.data.data, x => (x.find(x => x.name.toLowerCase() === "name")?.data || "") as string, blockTypeID);
    }

    private getBlockTypeStringMap() {
        this.blockTypeStringMap = associateBy(this.palette.data.data, x => (x.find(x => x.name.toLowerCase() === "name")?.data || "") as string, blockTypeString);
    }

    private getBlockTypeIDToStringMap() {
        this.blockTypeIDToStringMap = associateBy(
            this.palette.data.data,
            blockTypeID,
            blockTypeString
        );
    }

    /**
     * Fetches block indexes from the section, with each index corresponding to an index in the section's palette.
     * The original parameter may be used to specify whether the section was generated prior to snapshot 20w17a, in
     * which case the bitwise format encoding the blocks differs.
     * @param original if set, specifies that the section was generated prior to snapshot 20w17a.
     * @param limit maximum number of blocks to retrieve; if not passed, all will be retrieved.
     * @returns list of block indexes.
     */
    getRawBlocks(original?: boolean, limit?: number) {
        return original
            ? this.getBlocksGenericOriginal(x => x, limit)
            : this.getBlocksGeneric(x => x, limit);
    }

    /**
     * Fetches block NBT tags from the palette corresponding to the blocks in this section. The original parameter may
     * be used to specify whether the section was generated prior to snapshot 20w17a, in which case the bitwise format
     * encoding the blocks differs.
     * @param original if set, specifies that the section was generated prior to snapshot 20w17a.
     * @param limit maximum number of blocks to retrieve; if not passed, all will be retrieved.
     * @returns list of block NBT tags.
     */
    getBlocks(original?: boolean, limit?: number) {
        return original
            ? this.getBlocksGenericOriginal(x => this.palette.data.data[x], limit)
            : this.getBlocksGeneric(x => this.palette.data.data[x], limit);
    }

    /**
     * Fetches block names from the palette corresponding to the blocks in this section. The original parameter may
     * be used to specify whether the section was generated prior to snapshot 20w17a, in which case the bitwise format
     * encoding the blocks differs.
     * @param original if set, specifies that the section was generated prior to snapshot 20w17a.
     * @param limit maximum number of blocks to retrieve; if not passed, all will be retrieved.
     * @returns list of block names.
     */
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

    /**
     * Searches the chunk for the block with the given name; returns its locations.
     * @param name the name of the block to locate.
     * @returns a list of block coordinate locations where this block occurs in the chunk.
     */
    findBlocksByName(name: string): number[] {
        const blocks = this.getRawBlocks();
        const nameIndex = findCompoundListChildren(this.palette, x => x.name.toLowerCase() === "name")
            ?.map((x, i) => ({ x, i }))
            .find(x => x.x?.data === name)
            ?.i;
        return blocks.map((x, i) => ({ x, i })).filter(x => x.x === nameIndex).map(x => x.i);
    }

}
