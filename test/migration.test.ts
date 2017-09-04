import * as assert from 'power-assert';
import { IDBWrapper, TrxContext } from '../src/index';
import { options, Task, Schema } from './test-helper';
import { contains } from '@cotto/utils.ts';

let db: IDBWrapper;

describe('v1 schema', () => {
    before(async () => {
        db = new IDBWrapper('SampleDB', options).open(Schema.v1);
        return await db.ready();
    });

    after(() => db.delete());

    it('create database of version 1', () => {
        assert(db.originDB!.version === 1);
    });

    it('create a store', () => {
        assert(db.storeNames.length === 1);
        assert(contains(db.storeNames, 'storeA'));
    });

    it('create indexes', () => {
        return db.transaction('storeA', 'r', (__: any, ctx: TrxContext<null>) => {
            const store = ctx.trx.objectStore('storeA');
            assert(store.keyPath === 'id');
            assert(store.indexNames.length === 2);
            assert(store.indexNames.contains('indexA1'));
            assert(store.indexNames.contains('indexA2'));
            ctx.next(null);
        }).execute(null);
    });

    it('saved 2 records on storeA', async () => {
        const proc = db.transaction('storeA', 'r', Task.getCount('storeA'));
        const count = await proc.execute(null);
        assert(count === 2);
    });
});

describe('v2 schema', () => {
    before(async () => {
        db = new IDBWrapper('SampleDB', options).open(Schema.v2);
        return await db.ready();
    });

    after(() => db.delete());

    it('delete index from storeA', () => {
        const proc = db.transaction('storeA', 'r', (__, ctx: TrxContext<null>) => {
            const store = ctx.trx.objectStore('storeA');
            assert(store.indexNames.length === 1);
            assert(!store.indexNames.contains('indexA2'));
            ctx.next(null);
        });

        return proc.execute(null);
    });

    it('add storeB', () => {
        const proc = db.transaction('storeB', 'r', (__, ctx: TrxContext<any>) => {
            const store = ctx.trx.objectStore('storeB');
            assert(store.keyPath === null);
            assert(store.indexNames.length === 1);
            assert(store.indexNames.contains('indexB1'));
            ctx.next(null);
        });

        return proc.execute(null);
    });
});

describe('v3 schema', () => {
    before(async () => {
        const verifyLostData = (lostdata: any, ctx: TrxContext<null>) => {
            const dropStores = Object.keys(lostdata);
            assert(contains(dropStores, 'storeA'));
            assert(lostdata['storeA'].length === 2);
            ctx.next(null);
        };

        const schema = Schema.v3.clone()
            .addMigrateTask(verifyLostData);

        db = new IDBWrapper('SampleDB', options).open(schema);
        return await db.ready();
    });

    after(() => db.delete());

    it('delete storeA and migrate with lostdata', () => {
        assert(db.storeNames.length === 1);
        assert(!contains(db.storeNames, 'storeA'));
    });
});
