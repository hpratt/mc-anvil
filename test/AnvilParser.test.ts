import axios from "axios";

import { AnvilParser, chunkCoordinateFromIndex, indexFromChunkCoordinate, indexFromBiomeCoordinate, biomeCoordinateFromIndex, NBTParser, Chunk, findChildTagAtPath, BlockDataParser } from "../src";
import { CompressionType } from "../src/anvil/types";

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
		expect(b.getLocationEntries().filter(x => x.offset !== 0).length).toBe(976);
		expect(b.getTimestamps().filter(x => x > 0).length).toBe(976);
	});

	it("should read chunk data", async () => {
		const data = await axios.get("http://localhost:8001/r.0.0.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const chunk = b.getChunkContainingCoordinate([ 0, 0, 0 ])!;
		const sections = chunk.sortedSections();
		const wh = chunk.worldHeights();
		
		expect(sections).not.toBeUndefined();
		expect(sections?.map(x => x.filter(xx => xx.name.toLowerCase() === "y")[0]).map(x => x?.data)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 252, 253, 254, 255
		]);
		expect(chunk.getBlock([ 0, 0, 0 ])).toEqual({ name: "minecraft:polished_deepslate", properties: {} });
		expect(chunk.findBlocksByName("minecraft:polished_deepslate")).toEqual([[ 0, 0, 0 ], [ 3, 0, 0 ]]);
		expect(wh).not.toBeUndefined();
		expect(wh![wh!.length - 1]).toEqual([ 148, 148, 148, 149, 149, 148, 149, 149, 148, 148, 148, 149, 147, 147, 148, 148 ]);
	});

	it("should read chunk data for a chunk with negative coordinates", async () => {
		const data = await axios.get("http://localhost:8001/r.-1.-1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const chunk = b.getChunkContainingCoordinate([ -1, 0, -1 ])!;
		const sections = chunk.sortedSections();
		expect(sections).not.toBeUndefined();
		expect(sections?.map(x => x.filter(xx => xx.name.toLowerCase() === "y")[0]).map(x => x?.data)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 252, 253, 254, 255
		]);
		expect(chunk.getBlock([ -1, 0, -1 ])).toEqual({ name: "minecraft:diamond_block", properties: {} });
		expect(chunk.getBlock([ -2, 0, -1 ])).toEqual({ name: "minecraft:iron_block", properties: {} });
		expect(chunk.getBlock([ -3, 0, -1 ])).toEqual({ name: "minecraft:copper_block", properties: {} });
		expect(chunk.getBlock([ -4, 0, -1 ])).toEqual({ name: "minecraft:gold_block", properties: {} });
	});

	it("should set blocks in a chunk", async () => {
		const data = await axios.get("http://localhost:8001/r.0.0.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const tt = b.getChunkContainingCoordinate([ 0, 0, 0 ])!;
		expect(tt.findBlocksByName("minecraft:netherrack")).toEqual([]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toEqual([]);
		tt.setBlock([ 0, 5, 0 ], "minecraft:netherrack", {});
		tt.setBlock([ 15, 15, 15 ], "minecraft:gold_block", {});
		tt.setBlock([ 5, -64, 7 ], "minecraft:gold_block", {});
		tt.setBlock([ 3, 55, 2 ], "minecraft:torch", { facing: "north" });
		tt.chunkData();
		expect(tt.findBlocksByName("minecraft:netherrack")).toEqual([[ 0, 5, 0 ]]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toContainEqual([ 5, -64, 7 ]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toContainEqual([ 15, 15, 15 ]);
		expect(tt.getBlock([ 3, 55, 2 ])).toEqual({ name: "minecraft:torch", properties: { facing: "north" } });
		expect(tt.findBlocksByName("minecraft:iron_block")).toEqual([]);
	});

	it("should set blocks in a chunk with negative coordinates", async () => {
		const data = await axios.get("http://localhost:8001/r.-1.-1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		expect(b.getBlock([ -100, 97, -100 ]).name).toEqual("minecraft:grass_block");
		b.setBlock([ -100, 97, -100 ], "minecraft:diamond_ore", {});
		expect(b.getBlock([ -100, 97, -100 ]).name).toEqual("minecraft:diamond_ore");
	});

	it("should set blocks in a region", async () => {
		const data = await axios.get("http://localhost:8001/r.0.0.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		expect(b.getChunkContainingCoordinate([ 100, 57, 100 ])?.findBlocksByName("minecraft:deepslate_diamond_ore")).toContainEqual([ 102, -57, 96 ]);
		expect(b.getChunkContainingCoordinate([ 100, 57, 100 ])?.findBlocksByName("minecraft:deepslate_diamond_ore")).not.toContainEqual([ 102, 100, 96 ]);
		b.setBlock([ 102, 100, 96 ], "minecraft:deepslate_diamond_ore", {});
		b.setBlock([ 100, 56, 100 ], "minecraft:torch", { facing: "north" });
		expect(b.getChunkContainingCoordinate([ 100, 57, 100 ])?.findBlocksByName("minecraft:deepslate_diamond_ore")).toContainEqual([ 102, 100, 96 ]);
		expect(b.getChunkContainingCoordinate([ 100, 57, 100 ])?.getBlock([ 100, 56, 100 ])).toEqual({ name: "minecraft:torch", properties: { facing: "north" } });
	});

	it("should write an updated chunk back to the Anvil object", async () => {
		const data = await axios.get("http://localhost:8001/r.0.0.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const tt = b.getChunkContainingCoordinate([ 100, 0, 100 ])!;
		tt.setBlock([ 100, 0, 100 ], "minecraft:netherrack", {});
		tt.setBlock([ 100, -60, 100 ], "minecraft:gold_block", {});
		b.setChunks([ tt ]);
		const updatedChunk = b.getChunkContainingCoordinate([ 100, 0, 100 ])!;
		expect(updatedChunk.findBlocksByName("minecraft:netherrack")).toEqual([[ 100, 0, 100 ]]);
		expect(tt.findBlocksByName("minecraft:gold_block")).toEqual([[ 100, -60, 100 ]]);
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
