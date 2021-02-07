import { ResizableBinaryWriter } from "../util";
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

export class NBTParser extends ResizableBinaryWriter {

    private verbose?: boolean;

    constructor(data: ArrayBuffer, verbose?: boolean) {
        super(tryInflate(data));
        this.verbose = verbose;
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

    private tagWriters: Map<TagType, (value?: any) => void> = new Map([
        [ TagType.END, () => {} ],
        [ TagType.BYTE, this.setByte.bind(this) as (value?: any) => void ],
        [ TagType.BYTE_ARRAY, this.setByteArrayTag.bind(this) as (value?: any) => void ],
        [ TagType.SHORT, this.setShort.bind(this) as (value?: any) => void ],
        [ TagType.INT, this.setInt.bind(this) as (value?: any) => void ],
        [ TagType.INT_ARRAY, this.setIntArrayTag.bind(this) as (value?: any) => void ],
        [ TagType.LONG, this.setInt64LE.bind(this) as (value?: any) => void ],
        [ TagType.LONG_ARRAY, this.setLongArrayTag.bind(this) as (value?: any) => void ],
        [ TagType.FLOAT, this.setFloat.bind(this) as (value?: any) => void ],
        [ TagType.DOUBLE, this.setDouble.bind(this) as (value?: any) => void ],
        [ TagType.STRING, this.setStringTag.bind(this) as (value?: any) => void ],
        [ TagType.COMPOUND, this.setCompoundTag.bind(this) as (value?: any) => void ],
        [ TagType.LIST, this.setListTag.bind(this) as (value?: any) => void ]
    ]);

    private getNumberArrayTag(reader: () => number): TagPayload {
        const data: number[] = [];
        const length = this.getInt();
        for (let i = 0; i < length; ++i) data.push(reader());
        return data;
    }

    private setNumberArrayTag(value: number[], writer: (value: number) => void) {
        this.setInt(value.length);
        value.forEach(writer);
    }

    private getByteArrayTag(): TagPayload {
        return this.getNumberArrayTag(this.getByte.bind(this));
    }

    private setByteArrayTag(value: number[]) {
        this.setNumberArrayTag(value, this.setByte.bind(this));
    }

    private getIntArrayTag(): TagPayload {
        return this.getNumberArrayTag(this.getInt.bind(this));
    }

    private setIntArrayTag(value: number[]) {
        this.setNumberArrayTag(value, this.setInt.bind(this));
    }

    private getLongArrayTag(): TagPayload {        
        const length = this.getInt();
        const r = this.view.buffer.slice(this.position, this.position + length * 8);
        this.position += length * 8;
        return r;
    }

    private setLongArrayTag(value: ArrayBuffer) {
        this.setInt(value.byteLength);
        this.setArrayBuffer(value);
    }

    private getStringTag(): TagPayload {
        const length = this.getUShort();
        return this.getFixedLengthString(length);
    }

    private setStringTag(value: string) {
        this.setUShort(value.length);
        this.setFixedLengthString(value);
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

    private setListTag(value: { subType: number, data: TagPayload[] }) {
        const writer = this.tagWriters.get(value.subType);
        if (writer === undefined) throw new Error(`Invalid NBT tag ID ${value.subType} for list tag`);
        this.setByte(value.subType);
        this.setInt(value.data.length);
        value.data.forEach(writer);
    }

    private getCompoundTag(): TagPayload {
        const tags: TagData[] = [];
        do {
            tags.push(this.getTag());
        } while (tags[tags.length - 1].type !== TagType.END);
        return tags;
    }

    private setCompoundTag(value: TagData[]) {
        value.forEach(this.setTag.bind(this));
    }

    getTag() {
        const p = this.currentPosition();
        const type = this.getByte();
        const nameLength = type !== TagType.END ? this.getUShort() : 0;
        const name = this.getFixedLengthString(nameLength);
        const reader = this.tagReaders.get(type);
        if (reader === undefined) throw new Error(`Invalid NBT tag ID ${type}`);
        return { type, name, data: reader() };
    }

    setTag(value: TagData) {
        const writer = this.tagWriters.get(value.type);
        if (writer === undefined) throw new Error(`Invalid NBT tag ID ${value.type}`);
        this.setByte(value.type);
        if (value.type !== TagType.END) this.setUShort(value.name.length);
        this.setFixedLengthString(value.name);
        writer(value.data);
    }

}
