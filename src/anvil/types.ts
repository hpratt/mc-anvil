import { TagData, TagType } from "../nbt";

export type LocationEntry = {
    offset: number;
    sectorCount: number;
};

export enum CompressionType {
    GZIP = 1,
    ZLIB = 2,
    NONE = 3
}

export type ChunkDataDescriptor = {
    length: number;
    compressionType: CompressionType;
};

export type BlockStates = {
    type: TagType.LONG_ARRAY;
    name: "BlockStates";
    data: bigint[];
};

export type Palette = {
    type: TagType.LIST;
    name: "Palette";
    data: {
        subType: TagType.COMPOUND;
        data: TagData[][];
    };
};

export type ChunkRootTag = {
    type: TagType.COMPOUND;
    name: "";
    data: TagData[];
};

export type ChunkSectionTag = {
    type: TagType.LIST;
    name: "Sections";
    data: {
        subType: TagType.COMPOUND;
        data: TagData[][];
    };
};
