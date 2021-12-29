import JSZip = require("jszip");
import { associateBy } from "queryz";
import { AnvilParser } from "..";
import { Coordinate3D } from "../anvil/types";
import { RegionFile } from "./types";

const REGION_FORMAT_FILE_NAME = /^r[\.]([\-]?[0-9,]+)[\.]([\-]?[0-9,]+)[\.]mca$/g;

export function isValidRegionFileName(name: string): boolean {
    return name.match(REGION_FORMAT_FILE_NAME) !== null;
}

export function parseRegionName(name: string): { x: number, z: number } {
    if (!isValidRegionFileName(name)) throw new Error(`${name} is not a valid region file name; expected r.<x>.<z>.mca`);
    const m = name.matchAll(REGION_FORMAT_FILE_NAME).next();
    return {
        x: +m.value[1],
        z: +m.value[2]
    };
}

/**
 * Writes the contents of a user-provided directory entry to an in-memory ZIP file for download.
 * @param d the directory entry whose contents should be written.
 * @param z the ZIP file to write to.
 * @param path the root path within the ZIP file where this directory should be written.
 * @param overrideMap optional list of paths to manually override with custom array buffer data.
 * @returns a promise which resolves when the ZIP file write is complete.
 */
async function writeDirectoryToZip(d: DirectoryEntry, z: JSZip, path: string, overrideMap?: Map<string, ArrayBuffer>): Promise<void> {
    return new Promise((resolve, reject) => {
        d.createReader().readEntries(entries => Promise.all<void>(
            entries.map(e => {
                const thispath = `${path}/${e.name}`;
                if (overrideMap?.has(thispath)) // if this path has been manually overridden with data, write that
                    return new Promise<void>(resolve => {
                        z.file(thispath, overrideMap.get(thispath)!);
                        resolve();
                    });
                return e.isDirectory // if here, write the original contents of the directory at this path
                    ? writeDirectoryToZip(e as DirectoryEntry, z, thispath, overrideMap)
                    : new Promise((resolve, reject) => (e as FileEntry).file(f => {
                        f.arrayBuffer().then(a => { z.file(thispath, a); resolve(); }).catch(reject)
                    }));
            })
        ).then(() => resolve()).catch(reject), reject);
    });
}

/**
 * Provides methods for navigating a Minecraft world save directory. Corresponding region files and the level NBT tag
 * can be read, mutated, and saved.
 */
export class SaveParser {

    private root: DirectoryEntry;
    private cachedRegions: Map<string, RegionFile> = new Map([]);
    private dirtyRegions: Map<string, AnvilParser> = new Map([]);

    /**
     * Constructs a save parser from a directory entry uploaded to the browser.
     * @param root directory entry containing the world.
     */
    constructor(root: DirectoryEntry) {
        this.root = root;
    }

    /**
     * Asynchronously retrieves region files from the world save directory.
     * @returns a list of region files, each with coordinates and a corresponding file object.
     */
     async getRegions(): Promise<RegionFile[]> {
        return new Promise( (resolve, reject) => {
            this.root.getDirectory("region", undefined, regionDirectory => {
                regionDirectory.createReader().readEntries( entries => {
                    resolve(
                        entries
                            .filter(x => x.isFile && isValidRegionFileName(x.name))
                            .map(x => ({ ...parseRegionName(x.name), file: x as FileEntry }))
                    );
                }, reject);
            }, reject);
        });
    }

    /**
     * Asynchronously retrieves a file entry corresponding to the world's level NBT tag.
     * @returns a file entry containing the level NBT tag.
     */
    async getLevel(): Promise<FileEntry> {
        return new Promise( (resolve, reject) => {
            this.root.getFile("level.dat", undefined, resolve, reject);
        });
    }

    /**
     * Returns an region file reference for the region within this world containing the given coordinate.
     * If the region does not exist (i.e. it has not yet been rendered), the function returns undefined.
     * @param coordinate the coordinates for which to retrive the parser.
     * @returns a region file reference with the region data if the region exists; undefined otherwise.
     */
    async getRegionFileContainingCoordinate(coordinate: Coordinate3D): Promise<RegionFile | undefined> {
        if (this.cachedRegions.size === 0) this.cachedRegions = associateBy(await this.getRegions(), x => `${x.x},${x.z}`, x => x);
        const x = Math.floor(coordinate[0] / 512);
        const z = Math.floor(coordinate[2] / 512);
        return this.cachedRegions.get(`${x},${z}`);
    }

    /**
     * Returns an Anvil parser for reading and mutating the region within this world containing the given coordinate.
     * If the region does not exist (i.e. it has not yet been rendered), the function returns undefined.
     * @param coordinate the coordinates for which to retrive the parser.
     * @returns a parser with the region data if the region exists; undefined otherwise.
     */
    async getAnvilParserByCoordinate(coordinate: Coordinate3D): Promise<AnvilParser | undefined> {

        /* get the region file for the given coordinates if it exists */
        const region = await this.getRegionFileContainingCoordinate(coordinate);
        if (!region) return;
        const x = region.x;
        const z = region.z;

        /* get and cache the anvil parser for the region */
        const parser = await new Promise<AnvilParser>((resolve, reject) => {
            if (this.dirtyRegions.get(`${x},${z}`)) resolve(this.dirtyRegions.get(`${x},${z}`)!);
            region.file.file(f => f.arrayBuffer().then(x => resolve(new AnvilParser(x))).catch(reject));
        });
        this.dirtyRegions.set(`${x},${z}`, parser);
        return parser;

    }

    /**
     * Places a new block at the specified coordinates within this world. If the region containing the coordinate does
     * not exist within this world (i.e. it has not yet been rendered), no action will be taken.
     * @param coordinates the coordinates at which to place the block.
     * @param name the name of the block to place.
     * @param properties key-value map of properties for the block.
     */
    async setBlock(coordinates: Coordinate3D, name: string, properties: { [key: string]: string }) {
        (await this.getAnvilParserByCoordinate(coordinates))?.setBlock(coordinates, name, properties);
    }

    /**
     * Fetches a block from the specified coordinates within this world. If the region containing the coordinate does
     * not exist within this world (i.e. it has not yet been rendered), undefined will be returned.
     * @param coordinates the coordinates from which to fetch the block.
     * @returns object containing the name and key-value properties of the block if the region is present; undefined otherwise.
     */
    async getBlock(coordinates: Coordinate3D) {
        return (await this.getAnvilParserByCoordinate(coordinates))?.getBlock(coordinates);
    }

    /**
     * Writes this file, with any updates to regions and chunks reflected, to an in-memory ZIP file for download.
     */
    async asZip(): Promise<JSZip> {
        const dirtyRegions = [ ...this.dirtyRegions.keys() ];
        const zip = new JSZip();
        const overrideMap = new Map(dirtyRegions.map(key => [
            `/region/r.${key.replace(/,/g, '.')}.mca`,
            this.dirtyRegions.get(key)!.buffer()
        ]));
        await writeDirectoryToZip(this.root, zip, "", overrideMap);
        return zip;
    }

}
