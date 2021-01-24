import { BinaryParser } from "../util";
import { inflate } from 'pako';
import { ListPayload, TagData, TagPayload, TagType } from "./types";

export const LIST_INDEX = /^[\[][0-9]+[\]]$/;

export function parseCompoundListIndex(value: string): number {
    if (value.match(LIST_INDEX) !== null) return +value.slice(1, value.length - 1);
    return +value;
}

export function findChildTag(tag: TagData, f: (x: TagData) => boolean): TagData | undefined {
    if (tag.type === TagType.COMPOUND) return (tag.data as TagData[]).find(f);
}

export function findChildTagIndex(tag: TagData, f: (x: TagData) => boolean): number | undefined {
    if (tag.type === TagType.COMPOUND) return (tag.data as TagData[]).findIndex(f);
}

export function findCompoundListChildren(tag: TagData, f: (x: TagData) => boolean): (TagData | undefined)[] | undefined {
    if (tag.type === TagType.LIST && (tag.data as ListPayload).subType === TagType.COMPOUND)
        return (tag.data as ListPayload).data.map( x => (x as TagData[]).find(f));
}

export function findChildTagAtPath(path: string, tag?: TagData): TagData | undefined {
    const p = path.split('/');
    for (let i = 0; i < p.length; ++i) {
        if (!tag || !tag.type) return;
        if (tag.type === TagType.COMPOUND)
            tag = findChildTag(tag, x => x.name === p[i]);
        else if (tag.type === TagType.LIST && (tag.data as ListPayload).subType === TagType.COMPOUND) {
            const data = ((tag.data as ListPayload).data as TagData[][])[parseCompoundListIndex(p[i])];
            tag = data ? { type: TagType.COMPOUND, name: "", data } : undefined;
        }
    }
    return tag;
}

export function parent(path: string): string {
    const p = path.split("/");
    return p.slice(0, p.length - 1).join("/");
}

export function baseName(path: string): string {
    const p = path.split("/");
    return p[p.length - 1];
}

function tryInflate(buffer: ArrayBuffer): ArrayBuffer {
    try {
        const b = inflate(new Uint8Array(buffer));
        if (!b) throw new Error("not compressed");
        return b.buffer;
    } catch (e) {
        return buffer;
    }
}

export class NBTParser extends BinaryParser {

    constructor(data: ArrayBuffer) {
        super(tryInflate(data));
    }

    private tagReaders: Map<TagType, () => TagPayload> = new Map([
        [ TagType.END, () => null ],
        [ TagType.BYTE, this.getByte.bind(this) ],
        [ TagType.BYTE_ARRAY, this.getByteArrayTag.bind(this) ],
        [ TagType.SHORT, this.getShort.bind(this) ],
        [ TagType.INT, this.getInt.bind(this) ],
        [ TagType.INT_ARRAY, this.getIntArrayTag.bind(this) ],
        [ TagType.LONG, this.getInt64.bind(this) ],
        [ TagType.LONG_ARRAY, this.getLongArrayTag.bind(this) ],
        [ TagType.FLOAT, this.getFloat.bind(this) ],
        [ TagType.DOUBLE, this.getDouble.bind(this) ],
        [ TagType.STRING, this.getStringTag.bind(this) ],
        [ TagType.COMPOUND, this.getCompoundTag.bind(this) ],
        [ TagType.LIST, this.getListTag.bind(this) ]
    ]);

    private getNumberArrayTag(reader: () => number): TagPayload {
        const data: number[] = [];
        const length = this.getInt();
        for (let i = 0; i < length; ++i) data.push(reader());
        return data;
    }

    private getByteArrayTag(): TagPayload {
        return this.getNumberArrayTag(this.getByte.bind(this));
    }

    private getIntArrayTag(): TagPayload {
        return this.getNumberArrayTag(this.getInt.bind(this));
    }

    private getLongArrayTag(): TagPayload {        
        const length = this.getInt();
        const r = this.view.buffer.slice(this.position, this.position + length * 8);
        this.position += length * 8;
        return r;
    }

    private getStringTag(): TagPayload {
        const length = this.getUShort();
        return this.getFixedLengthString(length);
    }

    private getListTag(): TagPayload {
        const subType = this.getByte();
        const length = this.getInt();
        const reader = this.tagReaders.get(subType);
        const data: TagPayload[] = [];
        if (reader === undefined) throw new Error(`Invalid NBT tag ID ${subType} for list tag`);
        for (let i = 0; i < length; ++i) data.push(reader());
        return { subType, data };
    }

    private getCompoundTag(): TagPayload {
        const tags: TagData[] = [];
        do {
            tags.push(this.getTag());
        } while (tags[tags.length - 1].type !== TagType.END);
        return tags;
    }

    getTag() {
        const type = this.getByte();
        const nameLength = type !== TagType.END ? this.getUShort() : 0;
        const name = this.getFixedLengthString(nameLength);
        const reader = this.tagReaders.get(type);
        if (reader === undefined) throw new Error(`Invalid NBT tag ID ${type}`);
        return { type, name, data: reader() };
    }

}
