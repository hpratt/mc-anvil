import axios from "axios";

import { MockDirectoryEntry, MockFile, MockFileEntry } from './mock/FileSystemAPI';
import { AnvilParser, isValidRegionFileName, parseRegionName, SaveParser } from '../src';

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

    it("should set a block in the region", async () => {
        const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
        const ROOT = new MockDirectoryEntry("");
        const REGIONS = new MockDirectoryEntry("region", ROOT);
        new MockFileEntry("r.1.1.mca", REGIONS, new MockFile(new Uint8Array(data.data).buffer, ""));
        new MockFileEntry("level.dat", ROOT);
        const parser = new SaveParser(ROOT);
        await parser.setBlock([ 600, 50, 600 ], "minecraft:diamond_ore", {});
        const region = await parser.getAnvilParserByCoordinate([ 600, 50, 600 ]);
        expect(region).not.toBeUndefined();
        expect(region!.getBlock([ 600, 50, 600 ]).name).toEqual("minecraft:diamond_ore");
    });

    it("should write an updated region to a ZIP file", async () => {

        /* fetch region at region coordinates (-1, -1) */
        const data = await axios.get("http://localhost:8001/r.1.1.mca", { responseType: 'arraybuffer' });
        const ROOT = new MockDirectoryEntry("");
        const REGIONS = new MockDirectoryEntry("region", ROOT);
        new MockFileEntry("r.1.1.mca", REGIONS, new MockFile(new Uint8Array(data.data).buffer, ""));
        new MockFileEntry("level.dat", ROOT, new MockFile(new Uint8Array(data.data).buffer, ""));

        /* export to ZIP and check the block at (600, 50, 600) */
        const parser = new SaveParser(ROOT);
        let zip = await parser.asZip();
        let f = await new Promise<ArrayBuffer>((resolve, reject) => {
            zip.file("/region/r.1.1.mca")!.async("arraybuffer").then(resolve).catch(reject);
        });
        expect(new AnvilParser(f).getBlock([ 600, 50, 600 ]).name).toEqual("minecraft:iron_ore");

        /* set (600, 50, 600) to diamond and check that diamond is present in re-export to ZIP */
        await parser.setBlock([ 600, 50, 600 ], "minecraft:diamond_ore", {});
        zip = await parser.asZip();
        f = await new Promise<ArrayBuffer>((resolve, reject) => {
            zip.file("/region/r.1.1.mca")!.async("arraybuffer").then(resolve).catch(reject);
        });
        expect(new AnvilParser(f).getBlock([ 600, 50, 600 ]).name).toEqual("minecraft:diamond_ore");

    });
    
});
