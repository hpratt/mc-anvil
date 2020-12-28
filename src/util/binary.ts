export class BinaryParser {
    
    protected view: DataView;
    protected position: number;
    protected length: number;

    private _getByte: (byteOffset: number) => number;
    private _getShort: (byteOffset: number) => number;
    private _getUShort: (byteOffset: number) => number;
    private _getInt: (byteOffset: number) => number;
    private _getUInt: (byteOffset: number) => number;
    private _getFloat: (byteOffset: number) => number;
    private _getDouble: (byteOffset: number) => number;
    private _getInt64: (byteOffset: number) => bigint;
    private _getUInt64: (byteOffset: number) => bigint;
    private _getInt64LE: (byteOffset: number) => bigint;
    private _getUInt64LE: (byteOffset: number) => bigint;

    constructor(data: ArrayBuffer) {
        this.view = new DataView(data);
        this.position = 0;
        this.length = this.view.byteLength;
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
        return this.length - this.position;
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

    getShort() {
        return this.getValue(this._getShort, 2);
    }

    getUShort() {
        return this.getValue(this._getUShort, 2);
    }

    getInt() {
        return this.getValue(this._getInt, 4);
    }

    getUInt() {
        return this.getValue(this._getUInt, 4);
    }

    getFloat() {
        return this.getValue(this._getFloat, 4);
    }

    getDouble() {
        return this.getValue(this._getDouble, 8);
    }

    getNByteInteger(n: number) {
        const b: Array<number> = [];
        for (let i = 0; i < n; i++) b[i] = this.view.getUint8(this.position + i);
        let value = 0;
        for (let i = 0; i < b.length; i++) value = (value * 256) + b[i];
        this.position += n;
        return value;
    }

    getUInt64(): bigint {
        return this.getBigValue(this._getUInt64, 8);
    }

    getInt64(): bigint {
        return this.getBigValue(this._getInt64, 8);
    }

    getUInt64LE(): bigint {
        return this.getBigValue(this._getUInt64LE, 8);
    }

    getInt64LE(): bigint {
        return this.getBigValue(this._getInt64LE, 8);
    }

    getString(len?: number) {
        let s = "", c: number;
        while ((c = this.view.getUint8(this.position++)) != 0) {
            s += String.fromCharCode(c);
            if (len && s.length == len) break;
        }
        return s;
    }

    getFixedLengthString(len: number) {
        let s = "";
        for (let i = 0; i < len; i++) {
            const c = this.view.getUint8(this.position++);
            if (c > 0) s += String.fromCharCode(c);
        }
        return s;
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
