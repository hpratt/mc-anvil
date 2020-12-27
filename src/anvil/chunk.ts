import { ChunkRootTag, ChunkSectionTag } from './types';
import { TagData, TagType } from "../nbt";
import { findChildTag, findCompoundListChildren } from "../nbt/nbt";

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
    const levelTag = findChildTag(tag as ChunkRootTag, "Level");
    const sectionTag = levelTag && findChildTag(levelTag, "Sections");
    if (!isValidChunkSectionTag(sectionTag)) return [];
    const yTags = findCompoundListChildren(sectionTag!, "Y")?.map( (v, i) => ({ v, i }) ).filter(x => x.v);
    return yTags?.sort( (a, b) => (a.v!.data as number) - (b.v!.data as number) ).map( x => sectionTag.data.data[x.i] );
}

export function chunkCoordinateFromIndex(index: number): [ number, number, number ] {
    return [
        index % 16,
        Math.floor(index / 256),
        Math.floor(index / 16) % 16
    ];
}

export function indexFromChunkCoordinate(coordinate: [ number, number, number ]): number {
    const [ x, y, z ] = coordinate;
    return (y * 16 + z) * 16 + x;
}

export function biomeCoordinateFromIndex(index: number): [ number, number ] {
    return [
        index % 16,
        Math.floor(index / 16) % 16
    ];
}

export function indexFromBiomeCoordinate(coordinate: [ number, number ]): number {
    const [ x, z ] = coordinate;
    return z * 16 + x;
}
