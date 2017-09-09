import { bundle, existy, isEmpty, clone } from '@cotto/utils.ts';
import { TrxTask, ExtraTrxContext, TrxContext } from './transaction';
import { compose, parallel } from '@cotto/sq';
import { IDBWrapper } from './idb-wrapper';

// ============================================================================
// types
// ============================================================================
export interface VersionInfo {
    version: number;
    stores: StoreDescription[];
    dropStores: StoreDescription[];
    indexes: IndexDescription[];
    dropIndexes: IndexDescription[];
    tasks: TrxTask<any, any>[];
}

export interface VersionMap {
    [version: number]: VersionInfo;
}

export interface StoreDescription {
    name: string;
    keyPath: string | null;
    autoIncrement: boolean;
    indexes: { [k: string]: IndexDescription };
}

export interface IndexDescription {
    name: string;
    field: string | string[];
    multiEntry: boolean;
    unique: boolean;
    storeName: string;
}

// ============================================================================
// consts
// ============================================================================
const MAX_VERSION = Math.pow(2, 32) - 1;

// ============================================================================
// main
// ============================================================================
export class SchemaBuilder {
    // ─── PROPS ──────────────────────────────────────────────────────────────────────
    _current: { version: number, store: StoreDescription | null } = { version: 1, store: null };
    _stores: { [k: string]: StoreDescription } = {};
    _versions: VersionMap = {};

    constructor() {
        this.define(1);
    }

    // ─── GETTER ─────────────────────────────────────────────────────────────────────
    get version() {
        return this._current.version;
    }


    define(version: number): SchemaBuilder {
        if (typeof version !== 'number' || version < 1 || version < this.version || version > MAX_VERSION) {
            throw new TypeError('invalid version');
        }

        this._current = { version, store: null };
        this._versions[version] = {
            version,
            stores: [],
            dropStores: [],
            indexes: [],
            dropIndexes: [],
            tasks: []
        };

        return this;
    }

    addStore(name: string, opts: {
        keyPath?: string;
        autoIncrement?: boolean;
    } = {}) {
        const store: StoreDescription = {
            name,
            keyPath: opts.keyPath || null,
            autoIncrement: opts.autoIncrement || false,
            indexes: {}
        };

        if (store.autoIncrement && !store.keyPath) {
            throw new TypeError('set keyPath in order to use autoIncrement');
        }

        this._stores[name] = store;
        this._versions[this.version].stores.push(store);
        this._current = { version: this.version, store };
        return this;
    }

    delStore(name: string) {
        const store = this._stores[name];
        if (!store) throw new TypeError(`${name} store is not defined`);

        delete this._stores[name];
        this._versions[this.version].dropStores.push(store);
        this._current = { version: this.version, store: null };

        return this;
    }

    getStore(name: string) {
        const store = this._stores[name];

        if (!store) throw new TypeError(`${name} store is not defined`);

        this._current = { version: this.version, store };
        return this;
    }

    addIndex(name: string, field: string, opts: {
        unique?: boolean;
        multiEntry?: boolean;
    } = {}) {
        const store = this._current.store;

        if (!store) throw new TypeError('set current store using "getStore" or "addStore"');
        if (store.indexes[name]) throw new TypeError(`"${name}" index is already defined`);

        const index: IndexDescription = {
            storeName: store.name,
            name,
            field,
            unique: opts.unique || false,
            multiEntry: opts.multiEntry || false
        };

        store.indexes[name] = index;
        this._versions[this.version].indexes.push(index);
        return this;
    }

    delIndex(name: string) {
        const store = this._current.store;

        if (!store) throw new TypeError('set current store using "getStore" or "addStore"');

        const index = store.indexes[name];

        if (!index) throw new TypeError(`${name} index is not defined on ${store.name}`);

        delete store.indexes[name];

        this._versions[this.version].dropIndexes.push(index);
        return this;
    }

    addMigrateTask<I = any>(task: TrxTask<I, any>, ...rest: TrxTask<I, any>[]) {
        this._versions[this.version].tasks.push(task, ...rest);
        return this;
    }

    clone(): SchemaBuilder {
        const schema: any = new SchemaBuilder();
        Object.keys(this).forEach((k: keyof this) => {
            schema[k] = clone(this[k]);
        });

        return schema;
    }

    build(db: IDBWrapper) {
        const self = this;
        return function onUpgrade(this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) {
            const newVersion = ev.newVersion || self.version;
            const trx = this.transaction;
            const ctx: ExtraTrxContext = { trx, range: db.IDBKeyrange };

            (function migrate(version: number): any {
                const currentSchema = self._versions[version];

                if (version > newVersion) return;
                if (!existy(currentSchema)) return;

                const end = () => migrate(version + 1);
                const { stores, dropStores, indexes, dropIndexes, tasks } = currentSchema;

                /* tasks */
                const createStores = parallel(...stores.map(factory.createStore));
                const delStores = parallel(...dropStores.map(factory.deleteStore({ buckup: tasks.length > 0 })));
                const createIndexs = parallel(...indexes.map(factory.createIndex));
                const delIndexes = parallel(...dropIndexes.map(factory.deleteIndex));
                const migraters = parallel(...tasks);

                /* execute */
                return compose(createStores)
                    .pipe(createIndexs)
                    .pipe(delIndexes)
                    .pipe(delStores)
                    .pipe(bundleLostData)
                    .pipe(migraters)
                    .run(null, end, ctx);

            }(ev.oldVersion ? ev.oldVersion + 1 : 1));
        };
    }
}

// ============================================================================
// internal
// ============================================================================
namespace factory {
    export function createStore(desc: StoreDescription): TrxTask<any, IDBObjectStore> {
        return (_, ctx) => {
            const store = ctx.trx.db.createObjectStore(desc.name, {
                keyPath: desc.keyPath || undefined,
                autoIncrement: desc.autoIncrement || false
            });

            return ctx.next(store);
        };
    }

    export function deleteStore(opts: { buckup: boolean }) {
        return (desc: StoreDescription): TrxTask<any, any> => (_, ctx) => {
            const storeName = desc.name;
            const records: any[] = [];

            const delStore = () => ctx.trx.db.deleteObjectStore(storeName);
            const next = () => ctx.next({ [storeName]: records });
            const end = bundle(delStore, next);

            if (!opts.buckup) return end();

            const store = ctx.trx.objectStore(storeName);
            const req = store.openCursor();

            req.addEventListener('success', function (this: IDBRequest) {
                const cursor: IDBCursorWithValue = this.result;
                if (cursor) {
                    records.push(cursor.value);
                    cursor.continue();
                } else {
                    end();
                }
            });
        };
    }

    export function createIndex(desc: IndexDescription): TrxTask<any, IDBIndex> {
        return (_, ctx) => {
            const store = ctx.trx.objectStore(desc.storeName);
            const idx = store.createIndex(desc.name, desc.field, {
                unique: desc.unique,
                multiEntry: desc.multiEntry
            });

            return ctx.next(idx);
        };
    }

    export function deleteIndex(desc: IndexDescription): TrxTask<any, void> {
        return (_, ctx) => {
            const store = ctx.trx.objectStore(desc.storeName);
            const idx = store.deleteIndex(desc.name);
            return ctx.next(idx);
        };
    }
}


function bundleLostData(lostdata: any[], ctx: TrxContext<any>) {
    const data = isEmpty(lostdata) ? null : Object.assign({}, ...lostdata);
    return ctx.next(data);
}
