export enum TagType {
    END = 0,
    BYTE = 1,
    SHORT = 2,
    INT = 3,
    LONG = 4,
    FLOAT = 5,
    DOUBLE = 6,
    BYTE_ARRAY = 7,
    STRING = 8,
    LIST = 9,
    COMPOUND = 10,
    INT_ARRAY = 11,
    LONG_ARRAY = 12
};

export type ListPayload = {
    subType: number;
    data: TagPayload[];
};

export type TagPayload = number | bigint | string | number[] | TagData[] | string[] | ListPayload | ArrayBuffer | null;

export type TagData = {
    type: TagType;
    name: string;
    data: TagPayload | TagPayload[];
};
