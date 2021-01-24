import { TagData, TagType } from "../src";
import { nbtTagReducer } from "../src/nbt";
import { NBTActions } from "../src/nbt/reducer";
import { TEST_TAG_WITH_LIST } from "./NBTParser.test";

const TEST_TAG: TagData = {
    type: TagType.COMPOUND,
    name: "",
    data: [{
        type: TagType.COMPOUND,
        name: 'data',
        data: [
            { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
            { type: TagType.INT, name: 'NextAvailableID', data: 1 },
            { type: TagType.INT, name: 'Tick', data: 1187 },
            { type: TagType.END, name: '', data: null }
        ]
    }, {
        type: TagType.INT,
        name: "DataVersion",
        data: 2230
    }, {
        type: TagType.END,
        data: null,
        name: ""
    }]
};

const TEST_NESTED_LIST_TAG: TagData = {
    type: TagType.COMPOUND,
    name: "",
    data: [{
        type: TagType.COMPOUND,
        name: 'data',
        data: [
            { type: TagType.LIST, name: 'Raids', data: {
                subType: 10, data: [
                    [ { type: TagType.COMPOUND, name: 'test', data: [
                        { type: TagType.INT, name: 'test', data: 1 },
                        { type: TagType.END, name: '', data: null }
                    ] }, { type: TagType.END, name: '', data: null } ]
                ] }
            },
            { type: TagType.INT, name: 'Tick', data: 1187 },
            { type: TagType.END, name: '', data: null }
        ]
    }, {
        type: TagType.INT,
        name: "DataVersion",
        data: 2230
    }, {
        type: TagType.END,
        data: null,
        name: ""
    }]
};

describe("nbtTagReducer", () => {

    it("should add a tag to an existing compound tag", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_TAG, path: "data", tag: { type: TagType.INT, name: 'Sierra', data: 117 } })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.INT, name: 'Tick', data: 1187 },
                    { type: TagType.INT, name: 'Sierra', data: 117 },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
    });

    it("should delete a compound list tag member", () => {
        expect(nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_DELETE_TAG, path: "data/Inventory/[0]", recursive: true })).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [{
                    type: TagType.LIST,
                    name: 'Inventory',
                    data: {
                        subType: 10,
                        data: [
                            [{ type: TagType.INT, name: "test", data: 111 }, { type: TagType.END, name: '', data: null }]
                        ]
                    }
                }, {
                    type: TagType.END, name: '', data: null
                }]
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
    });

    it("should add a tag to an existing compound list tag", () => {
        const newTags = [{ type: TagType.INT, name: 'Sierra', data: 117 }, { type: TagType.END, name: '', data: 0 }];
        expect(
            nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/Inventory", tags: newTags, index: 2 })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [{
                    type: TagType.LIST,
                    name: 'Inventory',
                    data: {
                        subType: 10,
                        data: [
                            [{ type: TagType.END, name: '', data: null }],
                            [{ type: TagType.INT, name: "test", data: 111 }, { type: TagType.END, name: '', data: null }],
                            [{ type: TagType.INT, name: 'Sierra', data: 117 }, { type: TagType.END, name: '', data: 0 }]
                        ]
                    }
                }, {
                    type: TagType.END, name: '', data: null
                }]
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/Inventory", tags: newTags, index: 3 })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [{
                    type: TagType.LIST,
                    name: 'Inventory',
                    data: {
                        subType: 10,
                        data: [
                            [{ type: TagType.END, name: '', data: null }],
                            [{ type: TagType.INT, name: "test", data: 111 }, { type: TagType.END, name: '', data: null }],
                            [{ type: TagType.END, name: '', data: null }],
                            [{ type: TagType.INT, name: 'Sierra', data: 117 }, { type: TagType.END, name: '', data: 0 }]
                        ]
                    }
                }, {
                    type: TagType.END, name: '', data: null
                }]
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/Inventories", tags: newTags, index: 2 })
        ).toThrowError(/recursive/g);
    });

    it("should overwrite an item in an existing compound list tag if overwrite is set", () => {
        const newTags = [{ type: TagType.INT, name: 'Sierra', data: 117 }, { type: TagType.END, name: '', data: 0 }];
        expect(
            nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/Inventory", tags: newTags, index: 1, overwrite: true })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [{
                    type: TagType.LIST,
                    name: 'Inventory',
                    data: {
                        subType: 10,
                        data: [
                            [{ type: TagType.END, name: '', data: null }],
                            [{ type: TagType.INT, name: 'Sierra', data: 117 }, { type: TagType.END, name: '', data: 0 }]
                        ]
                    }
                }, {
                    type: TagType.END, name: '', data: null
                }]
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            nbtTagReducer(TEST_NESTED_LIST_TAG, { type: NBTActions.NBT_EDIT_TAG, path: "data/Raids/[0]/test/test", tag: { type: TagType.INT, name: 'Sierra', data: 117 } })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: {
                        subType: 10, data: [
                            [ { type: TagType.COMPOUND, name: 'test', data: [
                                { type: TagType.INT, name: 'Sierra', data: 117 },
                                { type: TagType.END, name: '', data: null }
                            ] }, { type: TagType.END, name: '', data: null } ]
                        ] }
                    },
                    { type: TagType.INT, name: 'Tick', data: 1187 },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG_WITH_LIST, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/Inventory", tags: newTags, index: 1 })
        ).toThrowError(/overwrite/g);
    });

    it("should overwrite an existing tag in an existing compound tag when overwrite is set", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_TAG, path: "data", tag: { type: TagType.INT, name: 'Tick', data: 117 }, overwrite: true })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.INT, name: 'Tick', data: 117 },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_TAG, path: "data", tag: { type: TagType.INT, name: 'Tick', data: 117 } })
        ).toThrowError(/already exists/g);
    });

    it("should add a non-existent compound list when recursive is set", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/test", index: 0, tags: [{ type: TagType.INT, name: 'Tick', data: 117 }], recursive: true })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.INT, name: 'Tick', data: 1187 },
                    { type: TagType.LIST, name: 'test', data: {
                        subType: TagType.COMPOUND,
                        data: [[
                            { type: TagType.INT, name: 'Tick', data: 117 },
                            { type: TagType.END, name: "", data: null }
                        ]]
                    } },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM, path: "data/test", index: 0, tags: [{ type: TagType.INT, name: 'Tick', data: 117 }] })
        ).toThrowError(/recursive/g);
    });

    it("should add a non-existent container with a new child when recursive is set", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_TAG, path: "data/data", tag: { type: TagType.INT, name: 'Sierra', data: 117 }, recursive: true })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.INT, name: 'Tick', data: 1187 },
                    { type: TagType.COMPOUND, name: 'data', data: [
                        { type: TagType.INT, name: 'Sierra', data: 117 },
                        { type: TagType.END, name: '', data: null }
                    ] },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_ADD_TAG, path: "data/data", tag: { type: TagType.INT, name: 'Sierra', data: 117 } })
        ).toThrowError(/recursive/g);
    });

    it("should delete a non-container tag", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_DELETE_TAG, path: "data/Tick" })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
    });

    it("should delete a container tag when recursive is set", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_DELETE_TAG, path: "data", recursive: true })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_DELETE_TAG, path: "data" })
        ).toThrowError(/recursive/g);
    });

    it("should raise an error on attempting to delete a non-existent tag", () => {
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_DELETE_TAG, path: "data/Sierra" })
        ).toThrowError(/not found/g);
    });

    it("should edit an existing tag but not a non-existent tag", () => {
        expect(
            nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_EDIT_TAG, path: "data/Tick", tag: { type: TagType.INT, name: 'Sierra', data: 117 } })
        ).toEqual({
            type: TagType.COMPOUND,
            name: "",
            data: [{
                type: TagType.COMPOUND,
                name: 'data',
                data: [
                    { type: TagType.LIST, name: 'Raids', data: { subType: 0, data: [] } },
                    { type: TagType.INT, name: 'NextAvailableID', data: 1 },
                    { type: TagType.INT, name: 'Sierra', data: 117 },
                    { type: TagType.END, name: '', data: null }
                ]
            }, {
                type: TagType.INT,
                name: "DataVersion",
                data: 2230
            }, {
                type: TagType.END,
                data: null,
                name: ""
            }]
        });
        expect(
            () => nbtTagReducer(TEST_TAG, { type: NBTActions.NBT_EDIT_TAG, path: "data/Sierra", tag: { type: TagType.INT, name: 'Sierra', data: 117 } })
        ).toThrowError(/exist/g);
    });

});
