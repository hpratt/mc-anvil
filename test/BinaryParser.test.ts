import { BinaryParser } from "../src";

function testArrayBuffer() {
	const a = new Uint8Array(8);
	[ 0, 1, 2, 3, 4, 5, 6, 7 ].forEach( i => { a[i] = i; } );
	return a.buffer;
}

function testStringArrayBuffer() {
	const a = new Uint8Array(8);
	[ 65, 66, 67, 68, 0, 65, 66, 0 ].forEach( (i, j) => { a[j] = i; } );
	return a.buffer;
}

describe("BinaryParser", () => {

	it("should seek to the second byte", async () => {
		const b = new BinaryParser(testArrayBuffer());
		b.seek(1);
		expect(b.currentPosition()).toBe(1);
		expect(b.remainingLength()).toBe(7);
		expect(b.getByte()).toBe(1);
	});

	it("should overwrite the first byte", async () => {
		const b = new BinaryParser(testArrayBuffer());
		expect(b.getByte()).toBe(0);
		b.seek(0);
		b.setByte(1);
		b.seek(0);
		expect(b.getByte()).toBe(1);
	});

	it("should read two bytes", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getByte(), b.getByte() ];
		expect(r).toEqual([ 0, 1 ]);
		expect(b.currentPosition()).toBe(2);
		expect(b.remainingLength()).toBe(6);
	});

	it("should write two shorts", async () => {
		const b = new BinaryParser(testArrayBuffer());
		b.setShort(-150);
		b.setUShort(150);
		b.seek(0);
		expect(b.getShort()).toBe(-150);
		expect(b.getUShort()).toBe(150);
	});

	it("should read a short", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getShort() ];
		expect(r).toEqual([ 1 ]);
		expect(b.currentPosition()).toBe(2);
		expect(b.remainingLength()).toBe(6);
	});

	it("should read an unsigned short", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getUShort() ];
		expect(r).toEqual([ 1 ]);
		expect(b.currentPosition()).toBe(2);
		expect(b.remainingLength()).toBe(6);
	});

	it("should write two ints", async () => {
		const b = new BinaryParser(testArrayBuffer());
		b.setInt(-150);
		b.setUInt(150);
		b.seek(0);
		expect(b.getInt()).toBe(-150);
		expect(b.getUInt()).toBe(150);
	});

	it("should read an int", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getInt() ];
		expect(r).toEqual([ 66051 ]);
		expect(b.currentPosition()).toBe(4);
		expect(b.remainingLength()).toBe(4);
	});

	it("should read an unsigned int", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getUInt() ];
		expect(r).toEqual([ 66051 ]);
		expect(b.currentPosition()).toBe(4);
		expect(b.remainingLength()).toBe(4);
	});

	it("should overwrite one float", async () => {
		const b = new BinaryParser(testArrayBuffer());
		b.setFloat(1.5636842486455404e-36);
		b.seek(0);
		expect(b.getFloat()).toBe(1.5636842486455404e-36);
		expect(b.getFloat()).toBe(1.5636842486455404e-36);
	});

	it("should read two floats", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getFloat(), b.getFloat() ];
		expect(r).toEqual([ 9.25571648671185e-41, 1.5636842486455404e-36 ]);
		expect(b.currentPosition()).toBe(8);
		expect(b.remainingLength()).toBe(0);
	});

	it("should write a double", async () => {
		const b = new BinaryParser(testArrayBuffer());
		b.setDouble(1.20159977307889e-305);
		b.seek(0);
		expect(b.getDouble()).toEqual(1.20159977307889e-305);
	});

	it("should read a double", async () => {
		const b = new BinaryParser(testArrayBuffer());
		const r = [ b.getDouble() ];
		expect(r).toEqual([ 1.40159977307889e-309 ]);
		expect(b.currentPosition()).toBe(8);
		expect(b.remainingLength()).toBe(0);
	});

	it("should write two null-terminated strings", async () => {
		const b = new BinaryParser(testStringArrayBuffer());
		b.setString("ACDC");
		b.setString("BA");
		b.seek(0);
		const r = [ b.getString(), b.getString() ];
		expect(r).toEqual([ "ACDC", "BA" ]);
	});

	it("should read two null-terminated strings", async () => {
		const b = new BinaryParser(testStringArrayBuffer());
		const r = [ b.getString(), b.getString() ];
		expect(r).toEqual([ "ABCD", "AB" ]);
		expect(b.currentPosition()).toBe(8);
		expect(b.remainingLength()).toBe(0);
	});

	it("should write two fixed-length strings", async () => {
		const b = new BinaryParser(testStringArrayBuffer());
		b.setFixedLengthString("ACDC");
		b.setFixedLengthString("BA");
		b.seek(0);
		const r = [ b.getFixedLengthString(4), b.getFixedLengthString(2) ];
		expect(r).toEqual([ "ACDC", "BA" ]);
	});

	it("should read two fixed-length strings", async () => {
		const b = new BinaryParser(testStringArrayBuffer());
		const r = [ b.getFixedLengthString(2), b.getFixedLengthString(3) ];
		expect(r).toEqual([ "AB", "CD" ]);
		expect(b.currentPosition()).toBe(5);
		expect(b.remainingLength()).toBe(3);
	});

});
