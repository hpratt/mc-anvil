import { BlockStates, ChunkRootTag, ChunkSectionTag, Coordinate3D, Palette } from './types';
import { TagData, TagType } from "../nbt";
import { findChildTag, findCompoundListChildren } from "../nbt/nbt";
import { BlockDataParser } from './block';

export function isValidChunkSectionTag(tag?: TagData): tag is ChunkSectionTag {
    const t = tag as ChunkSectionTag;
    return t && t.type === TagType.LIST && t.name === "Sections" && t.data && t.data.subType === TagType.COMPOUND
        && t.data.data && t.data.data.length !== undefined;
}

export function isValidChunkRootTag(tag?: TagData): tag is ChunkRootTag {
    const t = tag as ChunkRootTag;
    return t && t.type === TagType.COMPOUND && t.name === "" && t.data && t.data.length !== undefined;
}

export function sortedSections(tag: TagData): TagData[][] | undefined {
    if (!isValidChunkRootTag(tag)) return;
    const levelTag = findChildTag(tag as ChunkRootTag, x => x.name === "Level");
    const sectionTag = levelTag && findChildTag(levelTag, x => x.name === "Sections");
    if (!isValidChunkSectionTag(sectionTag)) return [];
    const yTags = findCompoundListChildren(sectionTag!, x => x.name === "Y")?.map( (v, i) => ({ v, i }) ).filter(x => x.v);
    return yTags?.sort( (a, b) => (a.v!.data as number) - (b.v!.data as number) ).map( x => sectionTag.data.data[x.i] );
}

export function getCoordinates(tag: TagData): [ number, number ] | undefined {
    if (!isValidChunkRootTag(tag)) return;
    const levelTag = findChildTag(tag as ChunkRootTag, x => x.name === "Level");
    const x = levelTag && findChildTag(levelTag, x => x.name === "xPos")?.data;
    const z = levelTag && findChildTag(levelTag, x => x.name === "zPos")?.data;
    if (x !== undefined && z !== undefined) return [ x as number * 16, z as number * 16 ];
}

export function findBlocksByName(chunkRootTag: TagData, name: string): Coordinate3D[] {
    const sections = sortedSections(chunkRootTag);
    if (sections === undefined) return [];
    return sections.flatMap( (section, y) => {
        const yy = y * 16;
        const [ xx, zz ] = getCoordinates(chunkRootTag) || [ 0, 0 ];
        const blockData = section.find(x => x.name === "BlockStates");
        const palette = section.find(x => x.name === "Palette");
        if (blockData === undefined || palette === undefined) return [];
        return (new BlockDataParser(blockData as BlockStates, palette as Palette))
            .findBlocksByName(name)
            .map(chunkCoordinateFromIndex)
            .map(x => [ x[0] + xx, x[1] + 16 * yy, x[2] + zz ] as Coordinate3D);
    });
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
