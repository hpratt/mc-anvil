import { BlockDataParser, BlockStates, ChunkRootTag, ChunkSectionTag, Palette } from "..";
import { BinaryParser, BitParser, findChildTagAtPath, findCompoundListChildren, NBTActions, nbtTagReducer, TagData, TagType } from "../..";
import { paletteNameList, paletteBlockList, paletteAsList } from "../block";
import { Coordinate3D } from "../types";

export function mod(n: number, m: number) {
    if (n < 0) return ((n % m) + m) % m;
    return n % m;
}

export function chunkCoordinateFromIndex(index: number): Coordinate3D {
    return [
        index % 16,
        Math.floor(index / 256),
        Math.floor(index / 16) % 16
    ];
}

export function indexFromChunkCoordinate(coordinate: Coordinate3D): number {
    const [ x, y, z ] = coordinate;
    return (y * 16 + z) * 16 + x;
}

export function biomeCoordinateFromIndex(index: number): Coordinate3D {
    return [
        index % 4,
        Math.floor(index / 16),
        Math.floor(index / 4) % 4
    ];
}

export function indexFromBiomeCoordinate(coordinate: Coordinate3D): number {
    const [ x, y, z ] = coordinate;
    return (y * 4 + z) * 4 + x;
}

/**
 * Class for parsing, mutating, and writing chunk-format data to and from NBT-format blobs. This class handles
 * NBT-related parsing and writing only; chunk compression logic is handled by the AnvilParser class.
 * @member AIR hash of the string "minecraft:air()"
 * @member BLOCKS_PER_CHUNK total number of blocks in a 16x16x16 chunk section
 * @member root the compound NBT tag containing this chunk's data.
 */
export class Chunk {

    static readonly AIR = -968583441; // hash of "minecraft:air()"
    static readonly BLOCKS_PER_CHUNK = 4096; // 16 * 16 * 16
    
    private blockStates: Map<number, number[][][]> = new Map();
    private palettes: Map<number, Palette | undefined> = new Map();
    private blockStatesDirty: Map<number, boolean> = new Map();
    root: TagData;

    /**
     * Checks if the given NBT tag is a valid chunk section tag (containing a list of chunk sections).
     * @param tag the tag to check.
     * @returns true if the tag is a valid section tag; false otherwise.
     */
    static isValidChunkSectionTag(tag?: TagData): tag is ChunkSectionTag {
        const t = tag as ChunkSectionTag;
        return t && t.type === TagType.LIST && t.name.toLowerCase() === "sections" && t.data && t.data.subType === TagType.COMPOUND
            && t.data.data && t.data.data.length !== undefined;
    }

    /**
     * Checks if the given NBT tag is a valid chunk root tag.
     * @param tag the tag to check.
     * @returns true if the tag is a valid chunk root tag; false otherwise.
     */
    static isValidChunkRootTag(tag?: TagData): tag is ChunkRootTag {
        const t = tag as ChunkRootTag;
        return t && t.type === TagType.COMPOUND && t.name === "" && t.data && t.data.length !== undefined;
    }

    /**
     * Creates a zero-filled 2D array of integers for storing blocks in an x-coordinate column of a chunk or section.
     * @param y the total number of y-coordinates to represent.
     * @param z the total number of z-coordinates to represnt.
     * @returns a zero-filled 2D array.
     */
    static emptyX(y: number = 256, z: number = 16): number[][] {
        const r: number[][] = [];
        for (let i = 0; i < y; ++i) {
            const c = [];
            for (let j = 0; j < z; ++j) c.push(0);
            r.push(c);
        }
        return r;
    }

    /**
     * Constructs a new chunk object from a given NBT tag.
     * @param root the NBT tag containing the chunk's data; must pass Chunk.isValidChunkRootTag.
     */
    constructor(root: TagData) {
        this.root = root;
    }

    /**
     * Checks if the given block coordinate is contained within this chunk.
     * @param c the coordinate to check.
     * @returns true if this coordinate is contained within the chunk; false otherwise.
     */
    containsCoordinate(c: Coordinate3D): boolean {
        if (c[1] < -64 || c[1] > 256) return false;
        const cc = this.getCoordinates();
        if (!cc) return false;
        return c[0] >= cc[0] && c[0] < cc[0] + 16 && c[2] >= cc[1] && c[2] < cc[1] + 16;
    }

    /**
     * Encodes this chunk's location (in chunk coordinates) for use as a key.
     * @returns a string representation of this chunk's coordinates which may be used as a key.
     */
    coordinateKey(): string | undefined {
        const coordinates = this.getChunkCoordinates();
        if (!coordinates) return;
        return `${coordinates[0]},${coordinates[1]}`;
    }

    /**
     * Fetches this chunk's location in chunk coordinates.
     * @returns the chunk's coordinates.
     */
    getChunkCoordinates(): [ number, number ] | undefined {
        if (!Chunk.isValidChunkRootTag(this.root)) return;
        const x = (findChildTagAtPath("Level/xPos", this.root) || findChildTagAtPath("xPos", this.root))?.data;
        const z = (findChildTagAtPath("Level/zPos", this.root) || findChildTagAtPath("zPos", this.root))?.data;
        if (x !== undefined && z !== undefined) return [ x as number, z as number ];
    }

    /**
     * Fetches the starting location of this chunk in block coordinates.
     * @returns the chunk's coordinates.
     */
    getCoordinates(): [ number, number ] | undefined {
        const c = this.getChunkCoordinates();
        if (!c) return;
        return [ c[0] * 16, c[1] * 16 ];
    }

    /**
     * Fetches the NBT tag containing the list of chunk sections within this chunk.
     * @returns the section NBT tag.
     */
    sections(): ChunkSectionTag | undefined {
        if (!Chunk.isValidChunkRootTag(this.root)) return;
        const sectionTag = findChildTagAtPath("Level/Sections", this.root) || findChildTagAtPath("sections", this.root);
        if (!Chunk.isValidChunkSectionTag(sectionTag)) return;
        return sectionTag;
    }

    /**
     * Fetches a list of section NBT tags within this chunk, sorted by ascending Y coordinate.
     * @returns a list of section NBT tags.
     */
    sortedSections(): TagData[][] | undefined {
        const s = this.sections();
        if (s === undefined) return;
        const yTags = findCompoundListChildren(s!, x => x.name === "Y")?.map( (v, i) => ({ v, i }) ).filter(x => x.v);
        return yTags?.sort( (a, b) => (a.v!.data as number) - (b.v!.data as number) ).map( x => s!.data.data[x.i] );
    }

    /**
     * Fetches a list of 3D coordinates where blocks of the given type occur within this chunk.
     * @param name the name of the block to fetch.
     * @returns a list of 3D coordinate block locations.
     */
    findBlocksByName(name: string): Coordinate3D[] {
        this.chunkData();
        const sections = this.sortedSections();
        if (sections === undefined) return [];
        return sections.flatMap( (section, y) => {
            let yy = (section.find(x => x.name === "Y")?.data || 0) as number * 16;
            if (yy >= 4032) yy -= 4096;
            const [ xx, zz ] = this.getCoordinates() || [ 0, 0 ];
            const blockData = section.find(x => x.name === "BlockStates") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "data");
            const palette = section.find(x => x.name === "Palette" || x.name === "palette") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "palette");
            if (blockData === undefined || palette === undefined) return [];
            return (new BlockDataParser(blockData as BlockStates, palette as Palette))
                .findBlocksByName(name)
                .map(chunkCoordinateFromIndex)
                .map(x => [ x[0] + xx, x[1] + yy, x[2] + zz ] as Coordinate3D);
        });
    }

    /**
     * Fetches the block at the provided coordinates.
     * @param coordinates the 3D coordinates at which to fetch the block.
     * @returns the name and property key-value pairs for the block.
     */
    getBlock(coordinates: Coordinate3D): { name: string, properties: { [key: string]: string } } {
        const yIndex = coordinates[1] >= 0 ? Math.floor(coordinates[1] / 16) : Math.floor((coordinates[1] + 4096) / 16);
        const [ s, palette ] = this.sectionBlockStateTensor(yIndex);
        const i = s[mod(coordinates[0], 16)][(coordinates[1] + 64) % 16][mod(coordinates[2], 16)];
        return (palette ? paletteAsList(palette) : [])[i];
    }

    /**
     * Places a block at the provided coordinates.
     * @param coordinates the 3D coordinates at which to set the block.
     * @param name the name of the block to set.
     * @param properties property key-value pairs for the block.
     */
    setBlock(coordinates: Coordinate3D, name: string, properties: { [key: string]: string }) {
        const yIndex = coordinates[1] >= 0 ? Math.floor(coordinates[1] / 16) : Math.floor((coordinates[1] + 4096) / 16);
        const fullName = `${name}(${Object.keys(properties).map(k => `${k}:${properties[k]}`).sort((a, b) => a.localeCompare(b)).join(",")})`;
        const [ s, palette ] = this.sectionBlockStateTensor(yIndex);
        const nameOrder = palette ? paletteBlockList(palette) : [];
        const i = nameOrder.findIndex(x => x === fullName);
        const index = i !== -1 ? nameOrder.findIndex(x => x === fullName)! : nameOrder.length;
        s[mod(coordinates[0], 16)][(coordinates[1] + 64) % 16][mod(coordinates[2], 16)] = index;
        if (i === -1) this.palettes.set(yIndex, nbtTagReducer(palette || { type: TagType.LIST, name: "palette", data: { subType: TagType.COMPOUND, data: [] } }, {
            type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM,
            path: "",
            index,
            tags: [{
                type: TagType.STRING,
                name: "Name",
                data: name
            }, ...(Object.keys(properties).length === 0 ? [] : [{
                type: TagType.COMPOUND,
                name: "Properties",
                data: Object.keys(properties).map(k => ({
                    type: TagType.STRING,
                    name: k,
                    data: properties[k]
                }))
            }])] as TagData[]
        }) as Palette);
    }

    /**
     * Obtains a set of unique block names contained within the chunk.
     * @returns a set of block name strings.
     */
    uniqueBlockNames(): Set<string> {
        return new Set(
            this.sortedSections()?.flatMap(x => paletteNameList(x.find(xx => xx.name === "Palette" || xx.name === "palette") as Palette)) || []
        );
    }

    /**
     * Fetches a 2D matrix of world heights for this chunk.
     * @param name the world height metric to use; defaults to WORLD_SURFACE.
     * @returns a matrix of world heights; x-coordinate is the outer coordinate and z-coordinate is the inner coordinate.
     */
    worldHeights(name: string = "WORLD_SURFACE") : number[][] | undefined {

        /* check if the tag is valid */
        if (!Chunk.isValidChunkRootTag(this.root)) return;
        
        /* extract the height map tag */
        const r: number[][] = Chunk.emptyX(16);
        const map = findChildTagAtPath(`Level/Heightmaps/${name}`, this.root) || findChildTagAtPath(`Heightmaps/${name}`, this.root);
        if (map === undefined || map.type !== TagType.LONG_ARRAY || !map.data) return;
    
        /* initialize bitwise parser for the height map tag */
        const d = new BinaryParser(map.data as ArrayBuffer);
        const b = new BigUint64Array(d.remainingLength() / 8);
        for (let i = 0; i < b.length; ++i) b[i] = d.getUInt64();
        const p = new BitParser(b.buffer);
    
        /* loop the tag extracting height values */
        for (let i = 0; i < 259; ++i) {
            const ii = i + 6 - 2 * (i % 7);
            const x = ii % 16;
            const z = Math.floor(ii / 16);
            if (i % 7 === 0) p.getBits(1);
            const cc = p.getBits(9);
            if (x < 16 && z < 16) r[x][z] = cc;
        }
        return r;
    
    }

    /**
     * Extracts a 3D tensor containing block states for the chunk section at the given y coordinates and the palette NBT tag.
     * @param yIndex the y index of the coordinate (in chunk coordinates).
     * @returns a 3D tensor of block state indexes (corresponding to indexes in the block state palette for the section) and the palette NBT tag.
     */
    sectionBlockStateTensor(yIndex: number): [ number[][][], Palette | undefined ] {
        this.blockStatesDirty.set(yIndex, true);
        if (this.blockStates.get(yIndex) && this.palettes.get(yIndex)) return [ this.blockStates.get(yIndex)!, this.palettes.get(yIndex)! ];
        const r: number[][][] = [];
        for (let x = 0; x < 16; ++x) r.push(Chunk.emptyX());
        const sections = this.sortedSections();
        if (!sections) return [ r, undefined ];
        const section = sections.find(x => x.find(xx => xx.name === "Y")?.data === yIndex) as TagData[];
        const blockData = section?.find(x => x.name === "BlockStates") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "data");
        const palette = section?.find(x => x.name === "Palette" || x.name === "palette") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "palette");
        this.blockStates.set(yIndex, r);
        this.palettes.set(yIndex, palette as Palette);
        if (blockData === undefined) return [ r, palette as Palette ];
        const b = new BlockDataParser(blockData as BlockStates, palette as Palette);
        b.getRawBlocks().forEach( (v, i) => {
            const [ x, y, z ] = chunkCoordinateFromIndex(i);
            r[x][y][z] = v || 0;
        });
        return [ r, palette as Palette ];
    }

    /**
     * Extracts a 3D tensor of block states for the chunk.
     * @returns a 3D tensor of block states for the chunk, each corresponding to an index in the corresponding chunk section palette.
     */
    blockStateTensor(): number[][][] {
        const r: number[][][] = [];
        for (let x = 0; x < 16; ++x) r.push(Chunk.emptyX());
        const sections = this.sortedSections() || [];
        sections.forEach( (section, y) => {
            const yy = y * 16;
            const blockData = section.find(x => x.name === "BlockStates") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "data");
            const palette = section.find(x => x.name === "Palette" || x.name === "palette") || (section.find(x => x.name === "block_states")?.data as TagData[]).find(x => x.name === "palette");
            if (blockData === undefined || palette === undefined) return [];
            const b = new BlockDataParser(blockData as BlockStates, palette as Palette);
            b.getBlockTypeIDs().forEach( (v, i) => {
                const [ x, y, z ] = chunkCoordinateFromIndex(i);
                r[x][y + yy + 64][z] = v || 0;
            });
        });
        return r;
    }

    /**
     * Flushes unsaved changes to this chunk's NBT tag and then returns the tag. This method should be used instead of
     * directly accessing the object's root tag property to ensure any unsaved block changes are reflected.
     * @returns NBT tag containing this chunk's data.
     */
    chunkData(): TagData {

        /* get a list of sections in this chunk */
        const sections = this.sections()?.data.data;
        if (!sections) return this.root;

        /* loop through chunks needing updates */
        [ ...this.blockStatesDirty.keys() ].filter(k => this.blockStatesDirty.get(k)).forEach( yy => {

            /* create a flat list of blocks in this section */
            const blocks: number[] = [];
            for (let y = 0; y < 16; ++y)
                for (let z = 0; z < 16; ++z)
                    for (let x = 0; x < 16; ++x)
                        blocks.push(this.blockStates.get(yy)![x][y][z]);

            /* write out updated blocks and palette for this section */
            const r = BlockDataParser.writeBlockStates(blocks);
            const index = sections.findIndex(x => x.find(xx => xx.name === "Y")?.data === yy);
            this.root = nbtTagReducer(this.root, {
                type: NBTActions.NBT_ADD_TAG,
                overwrite: true,
                path: `sections/${index}/block_states`,
                tag: {
                    type: TagType.LONG_ARRAY,
                    name: 'data',
                    data: r
                }
            }); // updates block state data
            this.root = nbtTagReducer(this.root, {
                type: NBTActions.NBT_ADD_TAG,
                overwrite: true,
                path: `sections/${index}/block_states`,
                tag: (this.palettes.get(yy) || findChildTagAtPath(`sections/${index}/block_states/palette`, this.root))!
            }); // updates palette
            this.blockStatesDirty.set(yy, false);

        });
        return this.root;

    }

};
