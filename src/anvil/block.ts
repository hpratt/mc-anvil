import { TagData } from "../nbt";
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

    getBlocks() {
        const paletteSize = this.palette.data.data.length;
        const toRead = Math.ceil(Math.log2(paletteSize));
        const total = Math.floor(this.length * 8 / toRead);
        const r: TagData[][] = [];
        for (let i = 0; i < total; ++i) r.push(this.palette.data.data[this.getBits(toRead)]);
        return r;
    }

}
