import { BitParser } from "../src";

function testArrayBuffer() {
	const a = new Uint8Array(8);
	[ 132, 66, 33, 0, 0 ].forEach( (i, j) => { a[j] = i; } );
	return a.buffer;
}

describe("BitParser", () => {

	it("should read 5 bits at a time", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(5), b.getBits(5), b.getBits(5), b.getBits(5) ];
		expect(r).toEqual([ 16, 17, 1, 2 ]);
	});

	it("should read 3 bits at a time", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(3), b.getBits(3), b.getBits(3) ];
		expect(r).toEqual([ 4, 1, 0 ]);
	});
	
	it("should read variable numbers of bits", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(10), b.getBits(5), b.getBits(3), b.getBits(1) ];
		expect(r).toEqual([ 529, 1, 0, 1 ]);
	});

	it("should read variable numbers of bits", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(16), b.getBits(4), b.getBits(5) ];
		expect(r).toEqual([ 33858, 2, 2 ]);
		expect(b.currentPosition()).toBe(4);
	});

	it("should read variable numbers of bits", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(18), b.getBits(2), b.getBits(4) ];
		expect(r).toEqual([ 135432, 2, 1 ]);
		expect(b.currentPosition()).toBe(3);
	});

	it("should read variable numbers of bits", async () => {
		const b = new BitParser(testArrayBuffer());
		const r = [ b.getBits(18), b.getBits(10) ];
		expect(r).toEqual([ 135432, 528 ]);
		expect(b.currentPosition()).toBe(4);
	});

	it("should write bits and read them back", async () => {
		const b = new BitParser(testArrayBuffer());
		b.setBits(3, 3);
		b.setBits(3, 2);
		b.setBits(12, 1385);
		b.setBits(7, 88);
		b.setBits(7, 112);
		b.setBits(18, 229376);
		b.seek(0);
		expect(b.getBits(3)).toBe(3);
		expect(b.getBits(3)).toBe(2);
		expect(b.getBits(12)).toBe(1385);
		expect(b.getBits(7)).toBe(88);
		expect(b.getBits(7)).toBe(112);
		expect(b.getBits(18)).toBe(229376);
	});

});
