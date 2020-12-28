import axios from "axios";

import { NBTParser, findChildTag, TagType, findChildTagAtPath } from "../src";

describe("NBTParser", () => {

	it("should read the root compound tag of raids.dat", async () => {
		const data = await axios.get("http://localhost:8001/raids.dat", { responseType: 'arraybuffer' });
		const b = new NBTParser(new Uint8Array(data.data).buffer);
		const tag = b.getTag();
		expect(tag).toEqual({
			type: TagType.COMPOUND,
			name: "",
			data: [{
				type: TagType.COMPOUND,
				name: 'data',
				data: [
					{ type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
					{ type: TagType.INT, name: 'NextAvailableID', data: 1 },
					{ type: TagType.INT, name: 'Tick', data: 1187 },
					{ type: TagType.END, name: '', data: null }
				]
			}, {
				type: TagType.INT,
				name: "DataVersion",
				data: 2230
			}, {
				type: TagType.END,
				data: null,
				name: ""
			}]
		});
		expect(findChildTag(tag, x => x.name === "data")).not.toBeUndefined();
		expect(findChildTag(findChildTag(tag, x => x.name === "data")!, x => x.name === "Raids")).not.toBeUndefined();
		expect(findChildTag(tag, x => x.name === "sections")).toBeUndefined();
		expect(findChildTagAtPath("data/Raids", tag)).not.toBeUndefined();
		expect(findChildTagAtPath("data/sections", tag)).toBeUndefined();
	});

	it("should read level.dat", async () => {
		const data = await axios.get("http://localhost:8001/level.dat", { responseType: 'arraybuffer' });
		const b = new NBTParser(new Uint8Array(data.data).buffer);
		expect(b.getTag().type).toBe(TagType.COMPOUND);
		expect(b.remainingLength()).toBe(0);
	});

});
