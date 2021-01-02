import { MockDirectoryEntry, MockFileEntry } from './mock/FileSystemAPI';
import { isValidRegionFileName, parseRegionName, SaveParser } from '../src';

describe("SaveParser", () => {

	it("should parse region file names", async () => {
        expect(isValidRegionFileName("r.1.1.mca")).toBe(true);
        expect(isValidRegionFileName("r.-1.-1.mca")).toBe(true);
        expect(isValidRegionFileName("r.999.100.mca")).toBe(true);
        expect(isValidRegionFileName("r.1.1.mcb")).toBe(false);
        expect(isValidRegionFileName("r.1.1.mcb")).toBe(false);
        expect(isValidRegionFileName("s.1.1.mca")).toBe(false);
        expect(isValidRegionFileName("r.-.1.mca")).toBe(false);
    });

    it("should parse region file names", async () => {
        expect(parseRegionName("r.1.1.mca")).toEqual({ x: 1, z: 1 });
        expect(parseRegionName("r.-1.-1.mca")).toEqual({ x: -1, z: -1 });
        expect(parseRegionName("r.999.100.mca")).toEqual({ x: 999, z: 100 });
    });

    it("should read no region files from an empty directory entry", async () => {
        const ROOT = new MockDirectoryEntry("");
        const REGIONS = new MockDirectoryEntry("region", ROOT);
        expect(await new SaveParser(ROOT).getRegions()).toEqual([]);
        new MockFileEntry("r.1.2.mca", REGIONS);
        new MockFileEntry("r.1.100.mca", ROOT);
        new MockFileEntry("x.1.100.mca", REGIONS);
        new MockFileEntry("level.dat", ROOT);
        const parser = new SaveParser(ROOT);
        const f = await parser.getRegions();
        expect(f.length).toBe(1);
        expect(f[0].x).toBe(1);
        expect(f[0].z).toBe(2);
        expect(await parser.getLevel()).not.toBeUndefined();
    });
    
});
