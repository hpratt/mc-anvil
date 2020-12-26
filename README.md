# mc-anvil
A Typescript library for reading Minecraft Anvil format files and Minecraft NBT format files in the browser.

## Installation

For npm use: `npm install mc-anvil --save`

For yarn use: `yarn add mc-anvil`

## Usage

### Importing
```typescript
import { NBTParser, AnvilParser } from "mc-anvil";
```

## Reading NBT data
The following example reads the root tag from an NBT file uploaded into the browser:
```typescript
const reader = new FileReader();
reader.onload = e => {
    const parser = new NBTParser(e);
    const tag = parser.getTag(); // receives contents of the root tag
};
reader.readAsArrayBuffer(file); // file is a File object or Blob containing NBT data
```

## Reading Anvil data
The following example extracts a chunk from an Anvil file uploaded into the browser:
```typescript
const reader = new FileReader();
reader.onload = e => {
    const parser = new AnvilParser(e);
    const chunks = parser.getLocationEntries();
    const firstNonEmptyChunk = chunks.filter(x => x.offset > 0)[0].offset;
    const data = parser.getChunkData(firstNonEmptyChunk); // receives NBT data of the first chunk
    const nbtParser = new NBTParser(data);
    const tag = nbtParser.getTag(); // receives contents of the chunk's root NBT tag
};
reader.readAsArrayBuffer(file); // file is a File object or Blob containing Anvil data
```

## For contributers

### Building
* Run `yarn install` to install dependencies.
* Run `yarn build` to build.

### Testing
You must have [Node.js](https://www.npmjs.com/get-npm) and [docker-compose](https://www.docker.com/products/docker-desktop) installed. 
* `scripts/test.sh` to run automated tests.
* `scripts/run-dependencies.sh` to stand up a web server to host static sample NBT and Anvil files. `scripts/test.sh` runs this for you.
* `scripts/stop-dependencies.sh` to stop bring down the server.
