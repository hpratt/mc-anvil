import { BinaryParser } from "../util";
import { TagData, TagPayload, TagType } from "./types";

export class NBTParser extends BinaryParser {

    private tagReaders: Map<TagType, () => TagPayload> = new Map([
        [ TagType.END, () => null ],
        [ TagType.BYTE, this.getByte.bind(this) ],
        [ TagType.BYTE_ARRAY, this._getByteArrayTag.bind(this) ],
        [ TagType.SHORT, this.getShort.bind(this) ],
        [ TagType.INT, this.getInt.bind(this) ],
        [ TagType.INT_ARRAY, this._getIntArrayTag.bind(this) ],
        [ TagType.LONG, this.getLong.bind(this) ],
        [ TagType.LONG_ARRAY, this._getLongArrayTag.bind(this) ],
        [ TagType.FLOAT, this.getFloat.bind(this) ],
        [ TagType.DOUBLE, this.getDouble.bind(this) ],
        [ TagType.STRING, this._getStringTag.bind(this) ],
        [ TagType.COMPOUND, this._getCompoundTag.bind(this) ],
        [ TagType.LIST, this._getListTag.bind(this) ]
    ]);

    _getNumberArrayTag(reader: () => number): TagPayload {
        const data: number[] = [];
        const length = this.getInt();
        for (let i = 0; i < length; ++i) data.push(reader());
        return data;
    }

    _getByteArrayTag(): TagPayload {
        return this._getNumberArrayTag(this.getByte.bind(this));
    }

    _getIntArrayTag(): TagPayload {
        return this._getNumberArrayTag(this.getInt.bind(this));
    }

    _getLongArrayTag(): TagPayload {
        return this._getNumberArrayTag(this.getLong.bind(this));
    }

    _getStringTag(): TagPayload {
        const length = this.getUShort();
        return this.getFixedLengthString(length);
    }

    _getListTag(): TagPayload {
        const subType = this.getByte();
        const length = this.getInt();
        const reader = this.tagReaders.get(subType);
        const data: TagPayload[] = [];
        if (reader === undefined) throw new Error(`Invalid NBT tag ID ${subType} for list tag`);
        for (let i = 0; i < length; ++i) data.push(reader());
        return { subType, data };
    }

    _getCompoundTag(): TagPayload {
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
