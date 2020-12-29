import { inflate } from 'pako';

import { BinaryParser } from '../util';
import { ChunkDataDescriptor, CompressionType, LocationEntry } from './types';

const LOCATION_ENTRIES_PER_FILE = 1024;
const LOCATION_ENTRY_SIZE = 4;
const SECTOR_SIZE = 4096;

export class AnvilParser extends BinaryParser {

    getLocationEntry(): LocationEntry {
        return {
            offset: this.getNByteInteger(3),
            sectorCount: this.getByte()
        };
    }

    getLocationEntries(): LocationEntry[] {
        this.position = 0;
        const r: LocationEntry[] = [];
        for (let i = 0; i < LOCATION_ENTRIES_PER_FILE; ++i)
            r.push(this.getLocationEntry());
        return r;
    }

    getTimestamps(): number[] {
        this.position = LOCATION_ENTRIES_PER_FILE * LOCATION_ENTRY_SIZE;
        const r: number[] = [];
        for (let i = 0; i < LOCATION_ENTRIES_PER_FILE; ++i)
            r.push(this.getUInt());
        return r;
    }

    getChunkDataDescriptor(offset?: number): ChunkDataDescriptor {
        if (offset !== undefined) this.position = offset;
        return {
            length: this.getUInt(),
            compressionType: this.getByte()
        };
    }

    getChunkData(offset?: number): ArrayBuffer {
        if (offset !== undefined) this.position = offset * SECTOR_SIZE;
        const descriptor = this.getChunkDataDescriptor();
        const data = this.view.buffer.slice(this.position, this.position + descriptor.length - 1);
        this.position += descriptor.length;
        switch (descriptor.compressionType) {
            case CompressionType.NONE:
                return data;
            case CompressionType.ZLIB:
            case CompressionType.GZIP:
                return inflate(new Uint8Array(data)).buffer;
        }
    }

}
