import { IDBWrapperOptions, SchemaBuilder, TrxContext } from '../src/index';

//
// ─── OPTIONS ────────────────────────────────────────────────────────────────────
//
export const options: IDBWrapperOptions = {};

if (process.env.TEST_ENV === 'node') {
    options.IDBFactory = require('fake-indexeddb');
    options.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
}

//
// ─── TASKS ──────────────────────────────────────────────────────────────────────
//
export namespace Task {
    export function addRecord(storeName: string, record: any) {
        return (__, ctx: TrxContext<number>) => {
            const store = ctx.trx.objectStore(storeName);
            const req = store.put(record);
            req.onsuccess = function () {
                ctx.next(this.result);
            };

            req.onerror = function () {
                ctx.next(this.error);
            };
        };
    }

    export function getCount(storeName: string) {
        return function (__, ctx: TrxContext<number>) {
            const store = ctx.trx.objectStore(storeName);
            const req = store.count();
            req.onsuccess = function () {
                ctx.next(this.result);
            };
            req.onerror = function () {
                ctx.next(this.error);
            };
        };
    }
}

//
// ─── MODEL ──────────────────────────────────────────────────────────────────────
//
export namespace Model {
    export function record(id: number) {
        return { id, indexA1: `xxx-${id}` };
    }
}

//
// ─── SCHEMA ─────────────────────────────────────────────────────────────────────
//
export namespace Schema {
    export const v1 = new SchemaBuilder()
        .define(1)
        .addStore('storeA', { keyPath: 'id', autoIncrement: true })
        .addIndex('indexA1', 'indexA1')
        .addIndex('indexA2', 'indexA2')
        .addMigrateTask(
        /*  */Task.addRecord('storeA', Model.record(1)),
        /*  */Task.addRecord('storeA', Model.record(2))
        );

    export const v2 = v1.clone()
        .define(2)
        .getStore('storeA')
        .delIndex('indexA2')
        .addStore('storeB')
        .addIndex('indexB1', 'indexB1');

    export const v3 = v2.clone()
        .define(3)
        .delStore('storeA');
}
