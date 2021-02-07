export class BinaryParser {
    
    protected view: DataView;
    protected position: number;

    private _getByte: (byteOffset: number) => number = () => 0;
    private _getShort: (byteOffset: number) => number = () => 0;
    private _getUShort: (byteOffset: number) => number = () => 0;
    private _getInt: (byteOffset: number) => number = () => 0;
    private _getUInt: (byteOffset: number) => number = () => 0;
    private _getFloat: (byteOffset: number) => number = () => 0;
    private _getDouble: (byteOffset: number) => number = () => 0;
    private _getInt64: (byteOffset: number) => bigint = () => BigInt(0);
    private _getUInt64: (byteOffset: number) => bigint = () => BigInt(0);
    private _getInt64LE: (byteOffset: number) => bigint = () => BigInt(0);
    private _getUInt64LE: (byteOffset: number) => bigint = () => BigInt(0);

    constructor(data: ArrayBuffer) {
        this.view = new DataView(data);
        this.position = 0;
        this.bindReaders();
    }

    protected bindReaders() {
        this._getByte = this.view.getUint8.bind(this.view);
        this._getShort = this.view.getInt16.bind(this.view);
        this._getUShort = this.view.getUint16.bind(this.view);
        this._getInt = this.view.getInt32.bind(this.view);
        this._getUInt = this.view.getUint32.bind(this.view);
        this._getFloat = this.view.getFloat32.bind(this.view);
        this._getDouble = this.view.getFloat64.bind(this.view);
        this._getInt64 = (byteOffset: number) => this.view.getBigInt64(byteOffset, true);
        this._getUInt64 = (byteOffset: number) => this.view.getBigUint64(byteOffset, true);
        this._getInt64LE = (byteOffset: number) => this.view.getBigInt64(byteOffset);
        this._getUInt64LE = (byteOffset: number) => this.view.getBigUint64(byteOffset);
    }

    seek(position: number) {
        this.position = position;
    }

    currentPosition() {
        return this.position;
    }

    remainingLength() {
        return this.view.byteLength - this.position;
    }

    private getValue(readFunc: (position: number, littleEndian?: boolean) => number, positionIncrement: number) {
        const retValue = readFunc(this.position);
        this.position += positionIncrement;
        return retValue;
    }

    private getBigValue(readFunc: (position: number, littleEndian?: boolean) => bigint, positionIncrement: number) {
        const retValue = readFunc(this.position);
        this.position += positionIncrement;
        return retValue;
    }

    getByte() {
        return this.getValue(this._getByte, 1);
    }

    setByte(value: number) {
        this.view.setUint8(this.position++, value);
    }

    getShort() {
        return this.getValue(this._getShort, 2);
    }

    setShort(value: number) {
        this.view.setInt16(this.position, value);
        this.position += 2;
    }

    getUShort() {
        return this.getValue(this._getUShort, 2);
    }

    setUShort(value: number) {
        this.view.setUint16(this.position, value);
        this.position += 2;
    }

    getInt() {
        return this.getValue(this._getInt, 4);
    }

    setInt(value: number) {
        this.view.setInt32(this.position, value);
        this.position += 4;
    }

    getUInt() {
        return this.getValue(this._getUInt, 4);
    }

    setUInt(value: number) {
        this.view.setUint32(this.position, value);
        this.position += 4;
    }

    getFloat() {
        return this.getValue(this._getFloat, 4);
    }

    setFloat(value: number) {
        this.view.setFloat32(this.position, value);
        this.position += 4;
    }

    getDouble() {
        return this.getValue(this._getDouble, 8);
    }

    setDouble(value: number) {
        this.view.setFloat64(this.position, value);
        this.position += 8;
    }

    getNByteInteger(n: number) {
        const b: Array<number> = [];
        for (let i = 0; i < n; ++i) b[i] = this.view.getUint8(this.position + i);
        let value = 0;
        for (let i = 0; i < b.length; ++i) value = (value * 256) + b[i];
        this.position += n;
        return value;
    }

    setNByteInteger(value: number, n: number) {
        for (let i = n - 1; i >= 0; --i) this.setByte(Math.floor(value / Math.pow(256, i)) % 256);
    }

    getUInt64(): bigint {
        return this.getBigValue(this._getUInt64, 8);
    }

    setUInt64(value: bigint) {
        this.view.setBigUint64(this.position, value);
        this.position += 8;
    }

    getInt64(): bigint {
        return this.getBigValue(this._getInt64, 8);
    }

    setInt64(value: bigint) {
        this.view.setBigInt64(this.position, value);
        this.position += 8;
    }

    getUInt64LE(): bigint {
        return this.getBigValue(this._getUInt64LE, 8);
    }

    setUInt64LE(value: bigint) {
        this.view.setBigUint64(this.position, value, true);
        this.position += 8;
    }

    getInt64LE(): bigint {
        return this.getBigValue(this._getInt64LE, 8);
    }

    setInt64LE(value: bigint) {
        this.view.setBigUint64(this.position, value, true);
        this.position += 8;
    }

    getString(len?: number) {
        let s = "", c: number;
        while ((c = this.view.getUint8(this.position++)) != 0) {
            s += String.fromCharCode(c);
            if (len && s.length == len) break;
        }
        return s;
    }

    setString(value: string) {
        for (let i = 0; i < value.length; ++i) this.setByte(value.charCodeAt(i));
        this.setByte(0);
    }

    getFixedLengthString(len: number) {
        let s = "";
        for (let i = 0; i < len; i++) {
            const c = this.view.getUint8(this.position++);
            if (c > 0) s += String.fromCharCode(c);
        }
        return s;
    }

    setFixedLengthString(value: string) {
        for (let i = 0; i < value.length; ++i) this.setByte(value.charCodeAt(i));
    }

    getFixedLengthTrimmedString(len: number) {
        let s = "";
        for (let i = 0; i < len; i++) {
            const c = this.view.getUint8(this.position++);
            if (c > 32) s += String.fromCharCode(c);
        }
        return s;
    }

}
