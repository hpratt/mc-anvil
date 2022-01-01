import { deflate, inflate } from 'pako';
import { Chunk } from '.';
import { NBTParser } from '..';

import { ResizableBinaryWriter } from '../util';
import { mod } from './chunk/chunk';
import { ChunkDataDescriptor, CompressionType, Coordinate3D, LocationEntry } from './types';

const LOCATION_ENTRIES_PER_FILE = 1024;
const LOCATION_ENTRY_SIZE = 4;
const SECTOR_SIZE = 4096;

/**
 * Class for parsing and writing Anvil-format blobs representing regions of 32x32 chunks.
 * Convenience methods are provided for simple mutations including placing a block at a
 * given position within the region.
 */
export class AnvilParser extends ResizableBinaryWriter {

    private dirtyChunks: Map<number, Chunk> = new Map();

    /**
     * Determines the offset in bytes of the chunk offset descriptor for the given chunk.
     * @param x the chunk's x-coordinate (in chunk coordinates).
     * @param z the chunk's y-coordinate (in chunk coordinates).
     * @returns the offset of the chunk descriptor in bytes from the Anvil blob's start.
     */
    static chunkOffset(x: number, z: number): number {
        return 4 * (mod(x, 32) + mod(z, 32) * 32);
    }

    /**
     * Extracts chunk data for a given chunk if it matches provided filtering criteria.
     * @param offset the offset of the chunk's descriptor in bytes from the Anvil blob's start.
     * @param valid a function for determining if the chunk matches desired criteria.
     * @returns the chunk's data wrapped in a Chunk class.
     */
    private getValidMatchingChunkAtOffset(offset: number, valid: (x: Chunk) => boolean): Chunk | undefined {

        /* return the chunk from the cache if it is present */
        if (this.dirtyChunks.get(offset) && valid(this.dirtyChunks.get(offset)!)) return this.dirtyChunks.get(offset);

        /* seek to the chunk's location entry and determine if it has been rendered; return undefined if not */
        this.seek(offset);
        const entry = this.getLocationEntry();
        if (entry.sectorCount === 0) return;

        /* parse the chunk and determine if it matches the desired criteria. */
        const chunk = new Chunk(new NBTParser(this.getChunkData(entry.offset)).getTag());
        if (valid(chunk)) {
            this.dirtyChunks.set(offset, chunk);
            return chunk;
        }

    }

    /**
     * Flushes modified chunks to the parser's array buffer then returns the buffer.
     * @returns the underlying array buffer containing the region's data.
     */
    buffer() {
        this.setChunks();
        return super.buffer();
    }

    /**
     * Identifies the block present at the provided 3D coordinates.
     * @param c the coordinates from which to extract the block.
     * @returns the block's name and associated properties.
     * @throws an Error if the provided coordinate is not within this region.
     */
    getBlock(c: Coordinate3D): { name: string, properties: { [key: string]: string } } {
        const chunk = this.getChunkContainingCoordinate(c);
        if (!chunk) throw new Error(`This region does not contain (${c[0]},${c[1]},${c[2]})`);
        return chunk.getBlock(c);
    }

    /**
     * Sets a block at the provided 3D coordinates.
     * @param c the coordinates at which to set the block.
     * @param name the name of the block to set.
     * @param properties map of block property names to property values.
     * @throws an Error if the provided coordinate is not within this region.
     */
    setBlock(c: Coordinate3D, name: string, properties: { [key: string]: string }) {
        const chunk = this.getChunkContainingCoordinate(c);
        if (!chunk) throw new Error(`This region does not contain (${c[0]},${c[1]},${c[2]})`);
        chunk.setBlock(c, name, properties);
    }

    /**
     * Extracts data for the chunk at the given chunk coordinates.
     * @param x the chunk's x-coordinate (in chunk coordinates).
     * @param z the chunk's y-coordinate (in chunk coordinates).
     * @returns the chunk's data if it is present; undefined if not.
     */
    getChunkAtChunkCoordinates(x: number, z: number): Chunk | undefined {
        return this.getValidMatchingChunkAtOffset(AnvilParser.chunkOffset(x, z), chunk => {
            const coordinates = chunk.getChunkCoordinates();
            return !coordinates || coordinates[0] !== x || coordinates[1] !== z;
        });
    }

    /**
     * Extracts data for the chunk containing the given block coordinate.
     * @param c the coordinate (in block coordinates).
     * @returns the chunk's data if it is present; undefined if not.
     */
    getChunkContainingCoordinate(c: Coordinate3D): Chunk | undefined {
        return this.getValidMatchingChunkAtOffset(AnvilParser.chunkOffset(Math.floor(c[0] / 16), Math.floor(c[2] / 16)), chunk => (
            chunk.containsCoordinate(c)
        ));
    }

    /**
     * Retrieves a chunk location entry from the current pointer in the Anvil blob; advances the pointer.
     * @returns the read location entry.
     */
    getLocationEntry(): LocationEntry {
        return {
            offset: this.getNByteInteger(3),
            sectorCount: this.getByte()
        };
    }

    /**
     * Writes a chunk location entry to the current pointer in the Anvil blob; advances the pointer.
     * @param entry the location entry to write.
     */
    setLocationEntry(entry: LocationEntry) {
        this.setNByteInteger(entry.offset, 3);
        this.setByte(entry.sectorCount);
    }

    /**
     * Retrieves the full list of chunk location entries from this Anvil blob. The pointer will be moved to the beginning
     * of the first header sector at the start of this method and advanced to the end during reading.
     * @returns list of chunk location entries.
     */
    getLocationEntries(): LocationEntry[] {
        this.position = 0;
        const r: LocationEntry[] = [];
        for (let i = 0; i < LOCATION_ENTRIES_PER_FILE; ++i)
            r.push(this.getLocationEntry());
        return r;
    }

    /**
     * Writes a list of chunk location entries to the current pointer in the Anvil blob; advances the pointer.
     * @param entries the list of entries to write.
     */
    setLocationEntries(entries: LocationEntry[]) {
        entries.forEach(this.setLocationEntry.bind(this));
    }

    /**
     * Retrieves the full list of last chunk update timestamps from this Anvil blob. The pointer will be moved to the
     * beginning of the timestamp sector at the start of this method and advanced to the end during reading.
     * @returns the list of timestamps (each a 4-byte integer representing seconds from the Unix epoch).
     */
    getTimestamps(): number[] {
        this.position = LOCATION_ENTRIES_PER_FILE * LOCATION_ENTRY_SIZE;
        const r: number[] = [];
        for (let i = 0; i < LOCATION_ENTRIES_PER_FILE; ++i)
            r.push(this.getUInt());
        return r;
    }

    /**
     * Writes a list of chunk timestamps to the timestamp sector in the Anvil blob; The pointer will be moved to the
     * beginning of the timestamp sector at the start of this method and advanced to the end during writing.
     * @param value the timestamps to write.
     */
    setTimestamps(value: number[]) {
        this.position = LOCATION_ENTRIES_PER_FILE * LOCATION_ENTRY_SIZE;
        value.forEach(this.setUInt.bind(this));
    }

    /**
     * Reads a chunk data descriptor from the given pointer in the Anvil blob; advances the pointer.
     * @param offset the offset of the chunk's data in bytes from the Anvil blob's start.
     * @returns the read data descriptor.
     */
    getChunkDataDescriptor(offset?: number): ChunkDataDescriptor {
        if (offset !== undefined) this.position = offset;
        return {
            length: this.getUInt(),
            compressionType: this.getByte()
        };
    }

    /**
     * Writes a chunk data descriptor to the given pointer in the Anvil blob; advances the pointer.
     * @param value the data descriptor to write.
     * @param offset the offset at which to write in bytes from the Anvil blob's start.
     */
    setChunkDataDescriptor(value: ChunkDataDescriptor, offset?: number) {
        if (offset !== undefined) this.position = offset;
        this.setUInt(value.length);
        this.setByte(value.compressionType);
    }

    /**
     * Extracts data for a chunk present at the given offset in the Anvil blob. The offset is provided in
     * sectors of 4096 bytes (as in the chunk location entries from the blob's first header sector).
     * @param offset the chunk's offset in sectors of 4096 bytes from the Anvil blob's start.
     * @returns the chunk's data.
     */
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

    /**
     * Reads all rendered chunks stored in this Anvil blob. Chunks are read in the order they are stored in the
     * location entry header sector.
     * @returns a list of parsed chunk data.
     */
    getAllChunks(): Chunk[] {
        const offsets = this.getLocationEntries().filter(x => x.sectorCount > 0);
        return offsets.map(x => new Chunk(new NBTParser(this.getChunkData(x.offset)).getTag()));
    }

    /**
     * Writes the provided chunks to this Anvil blob. This method will also flush any unsaved changes from the
     * setBlock method to the blob. Provided chunks will overwrite existing chunks at the same location; other
     * existing rendered chunks which do not overlap a passed chunk will also remain in the blob unless exact is set.
     * @param chunks optional list of chunks to write; altered but unsaved chunks modified with setBlock will also be written.
     * @param exact if set, existing rendered chunks will NOT be written to the blob.
     */
    setChunks(chunks: Chunk[] = [], exact?: boolean) {

        /* map coordinates to location, length, and timestamp offsets */
        const locations: Map<string, number> = new Map();
        const lengths: Map<string, number> = new Map();
        const timestamps: Map<string, number> = new Map();

        /* determine which chunks from the existing file need to be overwritten */
        const toOverwrite = new Set(chunks.map(chunk => chunk.coordinateKey()).filter(x => x));
        const existingChunks = (exact ? [] : this.getAllChunks()).filter(x => x.coordinateKey() && !toOverwrite.has(x.coordinateKey()));
        const dirtyChunks = [ ...this.dirtyChunks.keys() ].map(k => this.dirtyChunks.get(k)!);
        let currentLocation: number = 2;

        this.getTimestamps(); // seek to end of timestamp section

        /* loop through the chunks to be written */
        [ ...chunks.filter(x => x.coordinateKey()), ...existingChunks, ...dirtyChunks ].forEach(chunk => {

            /* compress the chunk data */
            const fullBuffer = new NBTParser(new ArrayBuffer(SECTOR_SIZE));
            fullBuffer.setTag(chunk.chunkData());
            const data = deflate(new Uint8Array(fullBuffer.buffer()));
            const length = Math.ceil((data.byteLength + 5) / SECTOR_SIZE);

            /* get the associated metadata */
            const key = chunk.coordinateKey()!;
            lengths.set(key, length);
            locations.set(key, currentLocation);
            timestamps.set(key, Math.floor(new Date().getTime() / 1000));
            currentLocation += length;

            /* write to the Anvil buffer */
            this.setInt(data.byteLength + 1);
            this.setByte(CompressionType.ZLIB);
            this.setArrayBuffer(data);
            if (length * SECTOR_SIZE - data.byteLength - 5 > 0) this.setArrayBuffer(new ArrayBuffer(length * SECTOR_SIZE - data.byteLength - 5));

        });

        /* write the chunk metadata to the header sectors */
        [ ...locations.keys() ].forEach( k => {
            const p = k.split(",");
            const x = +p[0];
            const z = +p[1];
            this.seek(AnvilParser.chunkOffset(x, z));
            this.setNByteInteger(locations.get(k)!, 3);
            this.setByte(lengths.get(k)!);
            this.seek(AnvilParser.chunkOffset(x, z) + SECTOR_SIZE);
            this.setInt(timestamps.get(k)!);
        });

    }

}
