declare module 'idb-schema' {
    export = Schema

    class Schema {
        readonly _current: { version: number, store: Schema.StoreDescription }
        readonly _stores: { [key: string]: Schema.StoreDescription }
        readonly _versions: Schema.VersionMap

        stores(): Schema.StoreDescription[]
        version(): number // current version
        version(v: number): this
        addStore(name: string, opts?: Schema.AddStoreOptions): this
        delStore(name: string): this
        getStore(name: string): this
        addIndex(name: string, field: string | string[], opts?: Schema.AddIndexOptions): this
        delIndex(name: string): this
        // addCallback(cb: (this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any): this
        // callback(): (this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any
        clone(): this
    }

    namespace Schema {
        interface VersionInfo {
            stores: Schema.StoreDescription[],
            dropStores: Schema.StoreDescription[]
            indexes: Schema.IndexDescription[]
            dropIndexes: Schema.IndexDescription[]
            // callbacks: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any)[],
            version: number
        }

        interface VersionMap {
            [version: number]: VersionInfo
        }


        interface StoreDescription {
            name: string;
            keyPath: string | null
            autoIncrement: boolean
            indexes: IndexDescription[]
        }

        interface IndexDescription {
            name: string;
            field: string | string[];
            multiEntry: boolean;
            unique: boolean;
            storeName: string
        }

        interface AddStoreOptions {
            // key?: string
            keyPath?: string
            // increment?: boolean
            autoIncrement?: boolean
        }

        interface AddIndexOptions {
            unique?: boolean
            // multi?: boolean
            multiEntry?: boolean
        }
    }
}