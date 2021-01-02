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

export class SaveParser {

    private root: DirectoryEntry;
    
    constructor(root: DirectoryEntry) {
        this.root = root;
    }

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

    async getLevel(): Promise<FileEntry> {
        return new Promise( (resolve, reject) => {
            this.root.getFile("level.dat", undefined, resolve, reject);
        });
    }

}
