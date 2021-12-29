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

    static inverseMask(start: number, n: number): number {
        return 0xFF - ((MASK.get(n)! << (8 - start - n)) % 0xFF);
    }

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

    setBits(n: number, value: number) {
        let needed = n;
        if (n > 8 - this.partialCount) {
            const x = 8 - this.partialCount;
            const l = this.view.getUint8(this.position) & (MASK.get(this.partialCount)! << x);
            this.view.setUint8(this.position++, l + (value >> (n - x)));
            this.partialCount = 0;
            needed -= x;
        }
        const sm = needed % 8;
        for (let i = Math.floor(needed / 8) - 1; i >= 0; --i)
            this.view.setUint8(this.position++, (value >> (sm + (8 * i))) % 256);
        const existing = this.view.getUint8(this.position) & BitParser.inverseMask(this.partialCount, sm);
        this.view.setUint8(this.position, existing + ((value & MASK.get(sm)!) << (8 - sm - this.partialCount)));
        this.partialCount += sm;
    }

    seek(position: number, partialCount?: number) {
        this.position = position;
        this.partialCount = partialCount || 0;
    }

}
