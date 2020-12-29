import axios from "axios";

import { BlockDataParser, TagType } from "../src";

function TEST_ARRAY() {
	const c = new Uint32Array(2);
	c[0] = 285212672;
	c[1] = 8211;
	return c.buffer;
}

describe("BlockDataParser", () => {

	it("should read blocks from a palette of size 12", async () => {
		const p = await axios.get("http://localhost:8001/palette12.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlocks(true, 16)).toEqual([ 0, 0, 0, 0, 2, 0, 1, 3, 1, 1, 0, 0, 0, 0, 0, 0 ].map( x => p.data.data.data[x] ));
	});

	it("should read blocks from a palette of size 4", async () => {
		const p = await axios.get("http://localhost:8001/palette4.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlocks(true, 16).slice(0, 20)).toEqual([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 3 ].map( x => p.data.data.data[x] ));
	});

	it("should read block type names from a palette of size 4", async () => {
		const p = await axios.get("http://localhost:8001/palette4.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlockTypeNames(true, 16).reverse().slice(12, 16)).toEqual([ "minecraft:air()", "minecraft:air()", "minecraft:air()", "minecraft:air()" ]);
	});

	it("should read block type IDs from a palette of size 4", async () => {
		const p = await axios.get("http://localhost:8001/palette4.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlockTypeIDs(true, 16).reverse().slice(12, 16)).toEqual([ -968583441, -968583441, -968583441, -968583441 ]);
		expect(b.blockStateFromHash(-968583441)).toEqual("minecraft:air()");
		expect(b.blockStateFromHash(-1460882837)).toEqual("minecraft:bedrock()");
	});

	it("should read blocks from a palette of size 5", async () => {
		const p = await axios.get("http://localhost:8001/palette5.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY()
		}, p.data);
		expect(b.getBlocks(true, 16).slice(0, 12)).toEqual([ 0, 0, 0, 0, 0, 0, 4, 0, 0, 4, 6, 1 ].map( x => p.data.data.data[x] ));
	});

});
