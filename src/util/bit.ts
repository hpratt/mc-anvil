const MASK: Map<number, number> = new Map([
    [ 0, 0 ],
    [ 1, 1 ],
    [ 2, 3 ],
    [ 3, 7 ],
    [ 4, 15 ],
    [ 5, 31 ],
    [ 6, 63 ],
    [ 7, 127 ],
    [ 8, 255 ]
]);

export class BitParser {

    protected partial: number;
    protected partialCount: number;
    protected view: DataView;
    protected position: number;
    protected length: number;

    constructor(data: ArrayBuffer) {
        this.view = new DataView(data);
        this.position = 0;
        this.length = this.view.byteLength;
        this.partial = 0;
        this.partialCount = 0;
    }

    currentPosition() {
        return this.position;
    }

    remainingLength() {
        return this.length - this.position;
    }

    getBits(n: number): number {

        if (n <= this.partialCount) {
            const r = this.partial >> (this.partialCount - n);
            this.partial &= MASK.get(this.partialCount - n)!;
            this.partialCount -= n;
            return r;
        }

        let needed = n - this.partialCount;
        let r = this.partial << (n - this.partialCount);
        this.partialCount = 8 - (needed % 8);
        if (this.partialCount === 8) this.partialCount = 0;
        while (needed > 8) {
            r |= this.view.getUint8(this.position++) << (needed - 8);
            needed -= 8;
        }
        const b = this.view.getUint8(this.position++);
        r |= (b >> this.partialCount) & MASK.get(needed)!;
        this.partial = b & MASK.get(this.partialCount)!;

        return r;

    }

}
