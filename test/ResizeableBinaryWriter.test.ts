import { ResizableBinaryWriter } from "../src";

function testArrayBuffer() {
	const a = new Uint8Array(8);
	[ 0, 1, 2, 3, 4, 5, 6, 7 ].forEach( i => { a[i] = i; } );
	return a.buffer;
}

describe("ResizeableBinaryWriter", () => {

	it("should resize the buffer to write a byte", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setByte(0);
		b.setByte(1);
		b.seek(6);
		const r = [ b.getByte(), b.getByte(), b.getByte() ];
		expect(r).toEqual([ 6, 0, 1 ]);
		expect(b.remainingLength()).toBe(7);
	});

	it("should resize the buffer to write two shorts", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setShort(-150);
		b.setUShort(150);
		b.seek(7);
		const r = [ b.getShort(), b.getUShort() ];
		expect(r).toEqual([ -150, 150 ]);
		expect(b.remainingLength()).toBe(5);
	});

	it("should resize the buffer to write two ints", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setInt(-150);
		b.setUInt(150);
		b.seek(7);
		const r = [ b.getInt(), b.getUInt() ];
		expect(r).toEqual([ -150, 150 ]);
		expect(b.remainingLength()).toBe(1);
	});

	it("should resize the buffer to write two floats", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setFloat(9.25571648671185e-41);
		b.setFloat(1.5636842486455404e-36);
		b.seek(7);
		const r = [ b.getFloat(), b.getFloat() ];
		expect(r).toEqual([ 9.25571648671185e-41, 1.5636842486455404e-36 ]);
		expect(b.remainingLength()).toBe(1);
	});

	it("should resize the buffer twice to write two doubles", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setDouble(1.40159977307889e-309);
		b.setDouble(1.48159977307889e-306);
		b.seek(7);
		const r = [ b.getDouble(), b.getDouble() ];
		expect(r).toEqual([ 1.40159977307889e-309, 1.48159977307889e-306 ]);
		expect(b.remainingLength()).toBe(9);
	});

	it("should resize the buffer to write null-terminated strings", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setString("AAA");
		b.setString("BBB");
		b.seek(7);
		const r = [ b.getString(), b.getString() ];
		expect(r).toEqual([ "AAA", "BBB" ]);
		expect(b.remainingLength()).toBe(1);
	});

	it("should resize the buffer to write fixed-length strings", async () => {
		const b = new ResizableBinaryWriter(testArrayBuffer());
		b.seek(7);
		b.setFixedLengthString("AAA");
		b.setFixedLengthString("BBB");
		b.seek(7);
		const r = [ b.getFixedLengthString(3), b.getFixedLengthString(3) ];
		expect(r).toEqual([ "AAA", "BBB" ]);
		expect(b.remainingLength()).toBe(3);
	});

});
