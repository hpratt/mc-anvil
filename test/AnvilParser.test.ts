import axios from "axios";

import { AnvilParser, chunkCoordinateFromIndex, indexFromChunkCoordinate, indexFromBiomeCoordinate, biomeCoordinateFromIndex, NBTParser, sortedSections } from "../src";
import { findBlocksByName } from "../src/anvil";
import { CompressionType } from "../src/anvil/types";
import { findChildTag } from "../src/nbt/nbt";
import { TagType } from "../src/nbt/types";

function testArrayBuffer() {
	const a = new Uint8Array(5);
	[ 0, 1, 2, 3, 3 ].forEach( (i, j) => { a[j] = i; } );
	return a.buffer;
}

describe("AnvilParser", () => {

	it("should read a chunk location entry", async () => {
		const b = new AnvilParser(testArrayBuffer());
		expect(b.getLocationEntry()).toEqual({
			offset: 258,
			sectorCount: 3
		});
		expect(b.currentPosition()).toBe(4);
		expect(b.remainingLength()).toBe(1);
	});

	it("should read a chunk data descriptor", async () => {
		const b = new AnvilParser(testArrayBuffer());
		expect(b.getChunkDataDescriptor()).toEqual({
			length: 66051,
			compressionType: CompressionType.NONE
		});
	});

	it("should read chunk location entries and timestamps", async () => {
		const data = await axios.get("http://localhost:8001/r.-1.-1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		expect(b.getLocationEntries().filter(x => x.offset !== 0).length).toBe(20);
		expect(b.getTimestamps().filter(x => x > 0).length).toBe(20);
	});

	it("should read chunk data", async () => {
		const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const offset = b.getLocationEntries().filter(x => x.offset !== 0)[0].offset;
		const chunk = new NBTParser(b.getChunkData(offset));
		const tag = chunk.getTag();
		const sections = sortedSections(tag);
		expect(tag.type).toBe(TagType.COMPOUND);
		expect(chunk.remainingLength()).toBe(0);
		expect(sections).not.toBeUndefined();
		expect(sections?.map(x => x.filter(xx => xx.name === "Y")[0]).map(x => x?.data)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 255
		]);
		expect(findBlocksByName(tag, "minecraft:diamond_ore")).toEqual([[ 516, 3, 515 ], [ 517, 3, 515 ]]);
	});

	it("should compute chunk coordinates", async () => {
		expect(chunkCoordinateFromIndex(0)).toEqual([ 0, 0, 0 ]);
		expect(chunkCoordinateFromIndex(256 + 16 + 1)).toEqual([ 1, 1, 1 ]);
		expect(indexFromChunkCoordinate([ 0, 0, 0 ])).toBe(0);
		expect(indexFromChunkCoordinate([ 2, 1, 1 ])).toBe(256 + 16 + 2);
		expect(indexFromChunkCoordinate([ 1, 2, 3 ])).toBe(256 * 2 + 16 * 3 + 1);
	});

	it("should compute biome coordinates", async () => {
		expect(biomeCoordinateFromIndex(0)).toEqual([ 0, 0, 0 ]);
		expect(biomeCoordinateFromIndex(16 + 2)).toEqual([ 2, 1, 0 ]);
		expect(biomeCoordinateFromIndex(16 * 2 + 3 * 4 + 1)).toEqual([ 1, 2, 3 ]);
		expect(indexFromBiomeCoordinate([ 0, 0, 0 ])).toBe(0);
		expect(indexFromBiomeCoordinate([ 2, 1, 0])).toBe(16 + 2);
		expect(indexFromBiomeCoordinate([ 1, 3, 2 ])).toBe(16 * 3 + 2 * 4 + 1);
	});

});
