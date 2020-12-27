import axios from "axios";

import { BlockDataParser, TagType } from "../src";

const TEST_ARRAY = [ 73335308288n ];
const TEST_ARRAY_2 = [ 622904999936n ];

describe("BlockDataParser", () => {

	it("should read blocks from a palette of size 12", async () => {
		const p = await axios.get("http://localhost:8001/palette12.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY
		}, p.data);
		expect(b.getBlocks()).toEqual([ 0, 0, 0, 0, 2, 0, 1, 3, 1, 1, 0, 0, 0, 0, 0, 0 ].map( x => p.data.data.data[x] ));
	});

	it("should read blocks from a palette of size 4", async () => {
		const p = await axios.get("http://localhost:8001/palette4.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY
		}, p.data);
		expect(b.getBlocks().slice(0, 20)).toEqual([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 3, 0, 1, 0, 1 ].map( x => p.data.data.data[x] ));
	});

	it("should read blocks from a palette of size 5", async () => {
		const p = await axios.get("http://localhost:8001/palette5.json", { responseType: 'json' });
		const b = new BlockDataParser({
			type: TagType.LONG_ARRAY,
			name: "BlockStates",
			data: TEST_ARRAY_2
		}, p.data);
		expect(b.getBlocks().slice(0, 13)).toEqual([ 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1, 1, 0 ].map( x => p.data.data.data[x] ));
	});

});
