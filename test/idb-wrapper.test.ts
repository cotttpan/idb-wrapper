import * as assert from 'power-assert';
import { IDBWrapper, SchemaBuilder } from '../src/index';
import { options } from './test-helper';

const schema = new SchemaBuilder()
    .define(1)
    .addStore('demo', { keyPath: 'id', autoIncrement: true });

describe('idb-wrapper', () => {
    let db: IDBWrapper;

    beforeEach(() => {
        db = new IDBWrapper('SampleDB', options).open(schema);
    });

    afterEach(() => db.isOpen && db.delete());

    describe('open', () => {
        it('opne the databse', async () => {
            await db.ready();
            assert(db.isOpen);
        });

        it('create database from schema', async () => {
            await db.ready();
            const originDB = db.originDB!;
            assert(originDB.version === 1);
            assert.deepEqual(Array.from(originDB.objectStoreNames), ['demo']);
        });
    });

    describe('close', () => {
        it('close database', async () => {
            await db.ready();
            const originDB = db.originDB!;

            assert(db.isOpen === true);
            assert('transaction' in originDB!);

            await db.close();

            assert(db.isOpen === false);
            assert.throws(() => {
                originDB.transaction('demo');
            });
        });
    });

    describe('delete', () => {
        it('delete the database', async () => {
            await db.ready();
            assert(db.isOpen === true);

            await db.delete();
            assert(db.isOpen === false);
            assert(db.originDB === undefined);
        });
    });
});

