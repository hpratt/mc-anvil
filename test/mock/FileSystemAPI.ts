function mockFileSystem(root: DirectoryEntry | any): FileSystem {
    return {
        name: "",
        root
    };
}

class MockDirectoryReader implements DirectoryReader {

    private children: Entry[] = [];
    private entryPointer: number;

    constructor(children: Entry[]) {
        this.children = children;
        this.entryPointer = 0;
    }

    readEntries(success: (entries: Entry[]) => void, _: (e: any) => void) {
        const results = this.children.slice(this.entryPointer, this.entryPointer + 100);
        this.entryPointer += 100;
        success(results);
    }

}

export class MockDirectoryEntry implements DirectoryEntry {
    
    public name: string;
    public isFile: boolean = false;
    public isDirectory: boolean = true;
    public fullPath: string;
    public filesystem: FileSystem;
    private children: Entry[] = [];
    private parent: DirectoryEntry;

    constructor(name: string, parent?: MockDirectoryEntry) {
        this.name = name;
        this.fullPath = (parent?.fullPath || "") + name + "/";
        this.parent = parent || this;
        this.filesystem = parent?.filesystem || mockFileSystem(this);
        if (parent) parent.addChild(this);
    }

    addChild(child: Entry) {
        this.children.push(child);
    }

    getDirectory(name: string, _: Flags | undefined, success: (d: DirectoryEntry) => void, error: (e: any) => void) {
        const d = this.children.find(x => x.isDirectory && x.name === name);
        if (d) success(d as DirectoryEntry); else error(`No directory named ${name} found within ${this.fullPath}`);
    }

    getFile(name: string, _: Flags | undefined, success: (f: FileEntry) => void, error: (e: any) => void) {
        const f = this.children.find(x => x.isFile && x.name === name) as FileEntry;
        if (f) success(f as FileEntry); else error(`No file named ${name} found within ${this.fullPath}`);
    }

    getParent() { return this.parent; }

    createReader() {
        return new MockDirectoryReader(this.children);
    }

    copyTo() {}
    moveTo() {}
    removeRecursively() {}
    getMetadata() {}
    toURL() { return this.fullPath; }
    remove() {}

}

export class MockFileEntry implements FileEntry {

    public name: string;
    public parent: DirectoryEntry;
    public isFile: boolean = true;
    public isDirectory: boolean = false;
    public fullPath: string;
    public filesystem: FileSystem;
    private data?: File;

    constructor(name: string, parent: MockDirectoryEntry, data?: File) {
        this.name = name;
        this.parent = parent;
        this.fullPath = parent.fullPath + name;
        this.filesystem = parent.filesystem;
        this.data = data;
        parent.addChild(this);
    }

    getMetadata() {}
    moveTo() {}
    copyTo() {}
    toURL() { return this.fullPath; }
    remove() {}
    createWriter() {}

    getParent() {
        return this.parent;
    }

    file(successCallback: FileCallback, errorCallback?: ErrorCallback): void {
        successCallback(this.data!);
    }

}

export class MockFile implements File {

    lastModified: number = 0;
    webkitRelativePath: string = "";
    name: string;
    size: number;
    type: string = "";
    private buffer: ArrayBuffer;

    constructor(data: ArrayBuffer, name: string) {
        this.buffer = data;
        this.name = name;
        this.size = data.byteLength;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.buffer;
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
        return new Blob([ this.buffer.slice(start || 0, end) ]);
    }

    async text(): Promise<string> {
        return "";
    }
    
    stream() {
        return new ReadableStream();
    }

}
