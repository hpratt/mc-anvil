import axios from "axios";

import { BinaryParser, BlockDataParser, Palette, TagType } from "../src";

function TEST_ARRAY() {
	const c = new Uint32Array(2);
	c[0] = 3325036576;
	c[1] = 25977624;
	const b = new BinaryParser(c.buffer);
	const v = b.getUInt64LE();
	b.seek(0);
	b.setUInt64(v);
	return c.buffer;
}

describe("BlockDataParser", () => {

	it("should read blocks from a palette of size 12", async () => {
		const p = await axios.get("http://localhost:8001/palette16.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlocks(false, 12)).toEqual([ 0, 1, 2, 0, 3, 3, 3, 3, 3, 3, 3, 3 ].map( x => p.data.data.data[x] ));
	});

	it("should read blocks from a palette of size 5", async () => {
		const p = await axios.get("http://localhost:8001/palette5.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlocks(false, 16)).toEqual([ 0, 1, 8, 12, 6, 3, 1, 8, 12, 6, 3, 0, 0, 8, 2, 0 ].reverse().map( x => p.data.data.data[x] ));
	});

	it("should write blocks to a buffer", async () => {
		const data = BlockDataParser.writeBlockStates([ 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0 ])[0];
		const p = await axios.get("http://localhost:8001/palette5.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data
		}, p.data);
		expect(b.getBlocks(false, 32)).toEqual([ 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0 ].map( x => p.data.data.data[x] ));
	});

	it("should write blocks to a buffer", async () => {
		const data = BlockDataParser.writeBlockStates([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0 ])[0];
		const p = await axios.get("http://localhost:8001/palette16.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data
		}, p.data);
		expect(b.getBlocks(false, 17)).toEqual([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0 ].map( x => p.data.data.data[x] ));
	});

	it("should write blocks to a buffer, leaving out extra palette entries", async () => {
		const p = await axios.get("http://localhost:8001/palette16.json", { responseType: 'json' });
		const data = BlockDataParser.writeBlockStates([ 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3 ], p.data as Palette);
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: data[0]
		}, data[1]!);
		expect(b.getBlocks(false, 16)).toEqual([ 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3 ].map( x => data[1]!.data.data[x] ));
		expect(data[1]!.data.data.length).toBe(4);
	});

});
