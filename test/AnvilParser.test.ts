import axios from "axios";

import { AnvilParser, NBTParser } from "../src";
import { CompressionType } from "../src/anvil/types";
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
		const data = await axios.get("http://localhost:8001/r.-1.-1.mca", { responseType: 'arraybuffer' });
		const b = new AnvilParser(new Uint8Array(data.data).buffer);
		const offset = b.getLocationEntries().filter(x => x.offset !== 0)[0].offset;
		const chunk = new NBTParser(b.getChunkData(offset));
		expect(chunk.getTag().type).toBe(TagType.COMPOUND);
		expect(chunk.remainingLength()).toBe(0);
	});

});
