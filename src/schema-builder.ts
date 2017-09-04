import { bundle, existy, isEmpty } from '@cotto/utils.ts';
import * as Schema from 'idb-schema';
import { TrxTask, ExtraTrxContext, TrxContext } from './transaction';
import { compose, parallel } from '@cotto/sq';
import { IDBWrapper } from './idb-wrapper';

export interface VersionInfo extends Schema.VersionInfo {
    tasks: TrxTask<any, any>[];
}

export interface VersionMap {
    [version: number]: VersionInfo;
}

export class SchemaBuilder extends Schema {
    _versions: VersionMap;

    define(version: number): SchemaBuilder {
        super.version(version);
        this._versions[version].tasks = [];
        return this;
    }

    addMigrateTask<I = any>(task: TrxTask<I, any>, ...rest: TrxTask<I, any>[]) {
        this._versions[this.version()].tasks.push(task, ...rest);
        return this;
    }

    clone() {
        const schema = super.clone();
        return Object.assign(new SchemaBuilder(), schema);
    }

    build(db: IDBWrapper) {
        const self = this;
        return function onUpgrade(this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) {
            const newVersion = ev.newVersion || self._current.version;
            const trx = this.transaction;
            const ctx: ExtraTrxContext = { trx, range: db.IDBKeyrange };

            (function migrate(version: number): any {
                const currentSchema = self._versions[version];

                if (version > newVersion) return;
                if (!existy(currentSchema)) return;

                const end = () => migrate(version + 1);
                const { stores, dropStores, indexes, dropIndexes, tasks } = currentSchema;

                /* tasks */
                const createStores = parallel(...stores.map(createStoreTaskFactory));
                const delStores = parallel(...dropStores.map(deleteStoreTaskFactory({ buckup: tasks.length > 0 })));
                const createIndexs = parallel(...indexes.map(createIndexTaskFactory));
                const delIndexes = parallel(...dropIndexes.map(deleteIndexTaskFactory));
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

function createStoreTaskFactory(desc: Schema.StoreDescription): TrxTask<any, IDBObjectStore> {
    return (_, ctx) => {
        const store = ctx.trx.db.createObjectStore(desc.name, {
            keyPath: desc.keyPath || undefined,
            autoIncrement: desc.autoIncrement || false
        });

        return ctx.next(store);
    };
}

function deleteStoreTaskFactory(opts: { buckup: boolean }) {
    return (desc: Schema.StoreDescription): TrxTask<any, any> => (_, ctx) => {
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

function createIndexTaskFactory(desc: Schema.IndexDescription): TrxTask<any, IDBIndex> {
    return (_, ctx) => {
        const store = ctx.trx.objectStore(desc.storeName);
        const idx = store.createIndex(desc.name, desc.field, {
            unique: desc.unique,
            multiEntry: desc.multiEntry
        });

        return ctx.next(idx);
    };
}

function deleteIndexTaskFactory(desc: Schema.IndexDescription): TrxTask<any, void> {
    return (_, ctx) => {
        const store = ctx.trx.objectStore(desc.storeName);
        const idx = store.deleteIndex(desc.name);
        return ctx.next(idx);
    };
}

function bundleLostData(lostdata: any[], ctx: TrxContext<any>) {
    const data = isEmpty(lostdata) ? null : Object.assign({}, ...lostdata);
    return ctx.next(data);
}
