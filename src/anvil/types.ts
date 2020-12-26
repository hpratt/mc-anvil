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
