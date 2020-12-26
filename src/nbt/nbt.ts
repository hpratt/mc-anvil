import { BinaryParser } from "../util";
import { TagData, TagPayload, TagType } from "./types";

export class NBTParser extends BinaryParser {

    private tagReaders: Map<TagType, () => TagPayload> = new Map([
        [ TagType.END, () => null ],
        [ TagType.BYTE, this.getByte.bind(this) ],
        [ TagType.BYTE_ARRAY, this.getByteArrayTag.bind(this) ],
        [ TagType.SHORT, this.getShort.bind(this) ],
        [ TagType.INT, this.getInt.bind(this) ],
        [ TagType.INT_ARRAY, this.getIntArrayTag.bind(this) ],
        [ TagType.LONG, this.getLong.bind(this) ],
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
        return this.getNumberArrayTag(this.getLong.bind(this));
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
