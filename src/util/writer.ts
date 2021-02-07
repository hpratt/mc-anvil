import { BinaryParser } from "./binary";

export class ResizableBinaryWriter extends BinaryParser {

    private resize() {
        const newBuffer = new ArrayBuffer(this.view.byteLength * 2);
        new Uint8Array(newBuffer).set(new Uint8Array(this.view.buffer));
        this.view = new DataView(newBuffer);
        this.bindReaders();
    }

    private setValue(value: any, size: number, setValueF: (value: any) => void) {
        while (size > this.remainingLength()) this.resize();
        setValueF(value);
    }

    setArrayBuffer(value: ArrayBuffer) {
        while (value.byteLength > this.remainingLength()) this.resize();
        new Uint8Array(this.view.buffer).set(new Uint8Array(value), this.currentPosition());
        this.position += value.byteLength;
    }

    setNByteInteger(value: number, size: number) {
        while (size > this.remainingLength()) this.resize();
        super.setNByteInteger(value, size);
    }

    setByte = (value: number) => this.setValue(value, 1, super.setByte.bind(this));
    setShort = (value: number) => this.setValue(value, 2, super.setShort.bind(this));
    setUShort = (value: number) => this.setValue(value, 2, super.setUShort.bind(this));
    setInt = (value: number) => this.setValue(value, 4, super.setInt.bind(this));
    setUInt = (value: number) => this.setValue(value, 4, super.setUInt.bind(this));
    setFloat = (value: number) => this.setValue(value, 4, super.setFloat.bind(this));
    setDouble = (value: number) => this.setValue(value, 8, super.setDouble.bind(this));
    setInt64 = (value: bigint) => this.setValue(value, 8, super.setInt64.bind(this));
    setUInt64 = (value: bigint) => this.setValue(value, 8, super.setUInt64.bind(this));
    setInt64LE = (value: bigint) => this.setValue(value, 8, super.setInt64LE.bind(this));
    setUInt64LE = (value: bigint) => this.setValue(value, 8, super.setUInt64LE.bind(this));
    setString = (value: string) => this.setValue(value, value.length + 1, super.setString.bind(this));
    setFixedLengthString = (value: string) => this.setValue(value, value.length, super.setFixedLengthString.bind(this));

}
