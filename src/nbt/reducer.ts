import { baseName, findChildTagAtPath, LIST_INDEX, parent, parseCompoundListIndex } from "./nbt";
import { ListPayload, TagData, TagPayload, TagType } from "./types";

export enum NBTActions {
    NBT_DELETE_TAG = "NBT_DELETE_TAG",
    NBT_ADD_TAG = "NBT_ADD_TAG",
    NBT_EDIT_TAG = "NBT_EDIT_TAG",
    NBT_ADD_COMPOUND_LIST_ITEM = "NBT_ADD_COMPOUND_LIST_ITEM"
};

export type NBTDeleteTagAction = {
    type: NBTActions.NBT_DELETE_TAG;
    path: string;
    recursive?: boolean;
};

export type NBTAddTagAction = {
    type: NBTActions.NBT_ADD_TAG;
    path: string;
    tag: TagData;
    overwrite?: boolean;
    recursive?: boolean;
};

export type NBTEditTagAction = {
    type: NBTActions.NBT_EDIT_TAG;
    path: string;
    tag: TagData;
};

export type NBTAddCompoundListItemAction = {
    type: NBTActions.NBT_ADD_COMPOUND_LIST_ITEM;
    path: string;
    index: number;
    tags: TagData[];
    recursive?: boolean;
    overwrite?: boolean;
};

export type NBTAction = NBTDeleteTagAction | NBTAddTagAction | NBTEditTagAction | NBTAddCompoundListItemAction;

export function transformTag(tag: TagData, path: string, transform: (tag: TagData) => TagData): TagData {

    /**
     * Find the next child. If this is the final tag, the remaining path will be the empty string, in which case
     * the given transform function is called to return the final result.
     */
    if (path[0] === '/') path = path.slice(1);
    const p = path.split("/");
    if (p.length === 1 && p[0] === "") return transform(tag);

    /**
     * If the current tag is a compound tag, either:
     *   1) replace an existing tag with the same name as the next child if it exists, or
     *   2) add a new tag with the name of the next child right before the final end tag.
     */
    if (tag.type === TagType.COMPOUND) {

        let children = [ ...(tag.data as TagData[]) ];
        if (children[children.length - 1].type === TagType.END) children = children.slice(0, children.length - 1); // all except the final end tag
        if (children.find(x => x.name === p[0]) !== undefined) // if there is already a child with this name, overwrite it
            children.forEach( (child, i) => { if (child.name === p[0]) children[i] = transformTag(child, p.slice(1).join("/"), transform); });
        else { // if there is not a child with this name, add it
            const nTag = p[1]?.match(LIST_INDEX) // determine if the new tag should be a compound or a list
                ? { type: TagType.LIST, name: p[0], data: { subType: TagType.COMPOUND, data: [] }}
                : { type: TagType.COMPOUND, name: p[0], data: [{ type: TagType.END, name: "", data: null }] };
            children.push(transformTag(nTag, p.slice(1).join("/"), transform));
        }
        return {
            ...tag,
            data: [ ...children, { type: TagType.END, name: "", data: null } ] // make sure it ends with an end tag
        };
    
    /**
     * If the current tag is a list of compound tags, either:
     *   1) replace an existing tag at the index of the next child if it exists, or
     *   2) add a new tag at the given index past the end of the list, filling in empty tags as necessary.
     */
    } else if (tag.type === TagType.LIST && (tag.data as ListPayload).subType === TagType.COMPOUND) {

        const index = parseCompoundListIndex(p[0]); // parse the child's index
        const data = [ ...(tag.data as ListPayload).data ];
        if (index >= data.length) // if the requested index is past the end...
            for (let i = data.length; i < index; ++i) data.push([{ type: TagType.END, name: "", data: null }]); // pad with empty lists as necessary
        return {
            ...tag,
            data: {
                ...(tag.data as ListPayload),
                data: [
                    ...data.slice(0, index),
                    transformTag(
                        { type: TagType.COMPOUND, name: "", data: data[index] || [{ type: TagType.END, name: "", data: null }] },
                        p.slice(1).join("/"), transform
                    ).data as TagData[],
                    ...data.slice(index + 1)
                ] as TagPayload[]
            }
        };

    }

    /** If here, the tag at the current cannot have children, so we cannot continue. */
    throw new Error(`${tag.name} is not a compound or list tag, and cannot have children at ${path}.`);

}

export function deleteChild(tag: TagData, name: string): TagData {
    if (tag.type === TagType.COMPOUND)
        return {
            ...tag,
            data: (tag.data as TagData[]).filter(x => x.name !== name)
        };
    else if (tag.type === TagType.LIST) {
        const index = parseCompoundListIndex(name);
        return {
            ...tag,
            data: {
                ...(tag.data as ListPayload),
                data: (tag.data as ListPayload).data.filter( (_, i) => i !== index)
            }
        };
    }
    throw new Error(`Cannot delete child ${name} from non-container tag of type ${tag.type}.`);
}

function ensureEndTag(tags: TagData[]): TagData[] {
    if (tags[tags.length - 1].type === TagType.END) return tags;
    return [ ...tags, { type: TagType.END, name: "", data: null }];
}

export function nbtTagReducer(tag: TagData, action: NBTAction): TagData {
    
    switch (action.type) {

        /**
         * Deletes a child tag. An error will be thrown if:
         *   1) The specified child tag does not exist, or
         *   2) The tag to delete is a container and recursive is not specified.
         */
        case NBTActions.NBT_DELETE_TAG:
            if (findChildTagAtPath(action.path, tag) === undefined)
                throw new Error(`Unable to delete ${action.path}: tag not found.`);
            else if (!action.recursive && findChildTagAtPath(action.path, tag)?.type === TagType.COMPOUND)
                throw new Error(`Deletion of compound tag with name ${tag.name} requires the recursive flag.`)
            return transformTag(tag, parent(action.path), tag => deleteChild(tag, baseName(action.path)));

        /**
         * Adds a child tag at the given path. An error will be thrown if:
         *   1) One of the child's ancestors does not exist and recursive is not set, or
         *   2) One of the child's ancestors is not a container tag, or
         *   3) The child already exists and overwite is not specified.
         */
        case NBTActions.NBT_ADD_TAG:
            if (!action.recursive && findChildTagAtPath(action.path, tag) === undefined)
                throw new Error(`Unable to add a child to non-existent tag ${action.path} without the recursive flag set.`);
            else if (!action.overwrite && findChildTagAtPath(action.path + "/" + action.tag.name, tag) !== undefined)
                throw new Error(`A child tag already exists at ${action.path}/${action.tag.name}; use the overwrite flag to replace.`);
            return transformTag(tag, `${action.path}/${action.tag.name}`, () => action.tag);

        /**
         * Adds a child tag to a compound list tag at the given path. An error will be thrown if:
         *   1) The target or one of its ancestors does not exist and recursive is not set, or
         *   2) The target or one of its ancestors is not a container tag, or
         *   3) The child already exists and overwite is not specified.
         */
        case NBTActions.NBT_ADD_COMPOUND_LIST_ITEM:
            if (!action.recursive && findChildTagAtPath(action.path, tag) === undefined)
                throw new Error(`Unable to add a child to non-existent tag ${action.path} without the recursive flag set.`);
            else if (!action.overwrite && findChildTagAtPath(`${action.path}/[${action.index}]`, tag) !== undefined)
                throw new Error(`A child tag already exists at ${action.path}/[${action.index}]; use the overwrite flag to replace.`);
            return transformTag(tag, `${action.path}/[${action.index}]`, () => ({ type: TagType.COMPOUND, name: "", data: ensureEndTag(action.tags) }));

        /**
         * Edits a tag at the given path by replacing it with the specified new value. An error will be thrown if:
         *   1) The tag at the given path does not exist.
         */
        case NBTActions.NBT_EDIT_TAG:
            if (findChildTagAtPath(action.path, tag) === undefined)
                throw new Error(`Unable to edit non-existent tag ${action.path}.`);
            return transformTag(
                transformTag(tag, parent(action.path), tag => deleteChild(tag, baseName(action.path))),
                action.path, () => action.tag
            );

    }

}
