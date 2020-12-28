import { TagData } from "../nbt";
import { findCompoundListChildren } from "../nbt/nbt";
import { BitParser } from "../util";
import { BlockStates, Palette } from "./types";

export class BlockDataParser extends BitParser {

    private palette: Palette;

    constructor(blockStates: BlockStates, palette: Palette) {
        const b = new BigUint64Array(blockStates.data.length);
        blockStates.data.forEach( (i, j) => { b[j] = i; });
        super(b.buffer);
        this.palette = palette;
    }

    private getBlocksGeneric<T>(f: (n: number) => T) {
        const paletteSize = this.palette.data.data.length;
        const toRead = paletteSize ? Math.ceil(Math.log2(paletteSize)) : 0;
        const total = toRead ? Math.floor(this.length * 8 / toRead) : 0;
        const r: T[] = [];
        for (let i = 0; i < total; ++i) r.push(f(this.getBits(toRead)));
        return r;
    }

    getBlocks() {
        return this.getBlocksGeneric(x => this.palette.data.data[x]);
    }

    getBlockIDs() {
        return this.getBlocksGeneric(x => x);
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
