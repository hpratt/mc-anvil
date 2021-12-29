import axios from "axios";

import { AnvilParser, chunkCoordinateFromIndex, indexFromChunkCoordinate, indexFromBiomeCoordinate, biomeCoordinateFromIndex, NBTParser, Chunk, findChildTagAtPath } from "../src";
import { CompressionType, LocationEntry } from "../src/anvil/types";
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
		expect(b.getLocationEntries().filter(x => x.offset !== 0).length).toBe(322);
		expect(b.getTimestamps().filter(x => x > 0).length).toBe(322);
	});

	it("should read chunk data", async () => {
		const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const offset = b.getLocationEntries().filter(x => x.offset !== 0)[0].offset;
		const chunk = new NBTParser(b.getChunkData(offset));
		const tag = chunk.getTag();
		const sections = new Chunk(tag).sortedSections();
		const wh = new Chunk(tag).worldHeights();
		expect(tag.type).toBe(TagType.COMPOUND);
		expect(chunk.remainingLength()).toBe(0);
		expect(sections).not.toBeUndefined();
		expect(sections?.map(x => x.filter(xx => xx.name.toLowerCase() === "y")[0]).map(x => x?.data)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 252, 253, 254, 255
		]);
		expect(new Chunk(tag).getBlock([ 516, 3, 515 ])).toEqual({ name: "minecraft:diamond_ore", properties: {} });
		expect(new Chunk(tag).findBlocksByName("minecraft:diamond_ore")).toEqual([[ 516, 3, 515 ], [ 517, 3, 515 ]]);
		expect(wh).not.toBeUndefined();
		expect(wh![wh!.length - 1]).toEqual([ 141, 141, 141, 141, 141, 141, 141, 141, 141, 141, 141, 141, 140, 140, 140, 140 ]);
	});

	it("should set blocks in a chunk", async () => {
		const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const offset = b.getLocationEntries().filter(x => x.offset !== 0)[0].offset;
		const chunk = new NBTParser(b.getChunkData(offset));
		const tag = chunk.getTag();
		const tt = new Chunk(tag);
		expect(tt.findBlocksByName("minecraft:netherrack")).toEqual([]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toEqual([]);
		tt.setBlock([ 517, 0, 512 ], "minecraft:netherrack", {});
		tt.setBlock([ 518, -64, 512 ], "minecraft:gold_block", {});
		tt.setBlock([ 516, 200, 518 ], "minecraft:torch", { facing: "north" });
		tt.chunkData();
		expect(tt.findBlocksByName("minecraft:diamond_ore")).toEqual([[ 516, 3, 515 ], [ 517, 3, 515 ]]);
		expect(tt.findBlocksByName("minecraft:netherrack")).toEqual([[ 517, 0, 512 ]]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toEqual([[ 518, -64, 512 ]]);
		expect(tt.getBlock([ 516, 200, 518 ])).toEqual({ name: "minecraft:torch", properties: { facing: "north" } });
		expect(tt.findBlocksByName("minecraft:iron_block")).toEqual([]);
	});

	it("should set blocks in a chunk with negative coordinates", async () => {
		const data = await axios.get("http://localhost:8001/r.-1.-1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		expect(b.getBlock([ -10, 100, -10 ]).name).toEqual("minecraft:air");
		b.setBlock([ -10, 100, -10 ], "minecraft:diamond_ore", {});
		expect(b.getBlock([ -10, 100, -10 ]).name).toEqual("minecraft:diamond_ore");
	});

	it("should set blocks in a region", async () => {
		const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		expect(b.getChunkContainingCoordinate([ 600, 57, 600 ])?.findBlocksByName("minecraft:diamond_ore")).toEqual([
			[ 592, 7, 592 ], [ 592, 7, 593 ], [ 592, 8, 592 ], [ 592, 8, 593 ]
		]);
		b.setBlock([ 600, 57, 600 ], "minecraft:diamond_ore", {});
		b.setBlock([ 600, 56, 600 ], "minecraft:torch", { facing: "north" });
		expect(b.getChunkContainingCoordinate([ 600, 57, 600 ])?.findBlocksByName("minecraft:diamond_ore")).toEqual([
			[ 592, 7, 592 ], [ 592, 7, 593 ], [ 592, 8, 592 ], [ 592, 8, 593 ], [ 600, 57, 600 ]
		]);
		expect(b.getBlock([ 600, 56, 600 ])).toEqual({ name: "minecraft:torch", properties: { facing: "north" } });
		b.setChunks();
		const chunk = b.getAllChunks().filter(x => {
			const c = x.getChunkCoordinates();
			return c !== undefined && c[0] === 37 && c[1] === 37
		})[0];
		expect(chunk?.findBlocksByName("minecraft:diamond_ore")).toEqual([
			[ 592, 7, 592 ], [ 592, 7, 593 ], [ 592, 8, 592 ], [ 592, 8, 593 ], [ 600, 57, 600 ]
		]);
		expect(chunk?.getBlock([ 600, 56, 600 ])).toEqual({ name: "minecraft:torch", properties: { facing: "north" } });
	});

	it("should write an updated chunk back to the Anvil object", async () => {
		const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const offset = b.getLocationEntries().map((x, i) => [ x, i ] as [ LocationEntry, number ]).filter(x => x[0].offset !== 0)[0];
		const chunk = new NBTParser(b.getChunkData(offset[0].offset));
		const tag = chunk.getTag();
		const tt = new Chunk(tag);
		tt.setBlock([ 517, 0, 512 ], "minecraft:netherrack", {});
		tt.setBlock([ 518, -60, 512 ], "minecraft:gold_block", {});
		b.setChunks([ tt ]);
		const newOffset = b.getLocationEntries()[offset[1]].offset;
		const updatedChunk = new Chunk(new NBTParser(b.getChunkData(newOffset)).getTag());
		expect(updatedChunk.findBlocksByName("minecraft:netherrack")).toEqual([[ 517, 0, 512 ]]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toEqual([[ 518, -60, 512 ]]);
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
