import * as assert from 'assert';
import { SchemaBuilder } from '../src/schema-builder';
import { isEmpty, noop } from '@cotto/utils.ts';

describe('#constructor', () => {
    specify('initialize', () => {
        const schema = new SchemaBuilder();
        assert.deepEqual(schema._current, { version: 1, store: null });
        assert.deepEqual(schema._stores, {});
        assert.deepEqual(schema._versions, {
            '1': {
                version: 1,
                stores: [],
                dropStores: [],
                indexes: [],
                dropIndexes: [],
                tasks: []
            }
        });
    });
});

describe('#get version', () => {
    it('return current version', () => {
        const schema = new SchemaBuilder();
        assert(schema.version === 1);
    });
});

describe('#define', () => {
    let schema: SchemaBuilder;
    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA')
            .define(2)
            .addStore('storeB');
    });

    it('initialize version map', () => {
        assert(!isEmpty(schema._versions[1]));
        assert(!isEmpty(schema._versions[2]));
        assert(isEmpty(schema._versions[3]));
    });

    it('increment current version', () => {
        assert(schema.version === 2);
    });

    it('throw TypeError when version is under than current', () => {
        assert.throws(() => {
            schema = schema.clone().define(1);
        }, TypeError);
    });
});


describe('#addStore', () => {
    let schema: SchemaBuilder;
    const storeA = {
        name: 'storeA',
        keyPath: 'id',
        autoIncrement: true,
        indexes: {}
    };
    const storeB = {
        name: 'storeB',
        keyPath: null,
        autoIncrement: false,
        indexes: {}
    };

    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA', { keyPath: 'id', autoIncrement: true })
            .addStore('storeB');
    });

    it('update current store', () => {
        assert.deepEqual(schema._current.store, storeB);
    });

    it('update store map', () => {
        assert.deepEqual(schema._stores['storeA'], storeA);
        assert.deepEqual(schema._stores['storeB'], storeB);
    });

    it('update version map', () => {
        assert.deepEqual(schema._versions[1].stores, [storeA, storeB]);
    });

    it('thwow TypeError when invalid options', () => {
        assert.throws(() => {
            schema.clone().addStore('storeC', { autoIncrement: true });
        }, TypeError);
    });
});

describe('#delStore', () => {
    let schema: SchemaBuilder;
    const storeA = {
        name: 'storeA',
        keyPath: 'id',
        autoIncrement: true,
        indexes: {}
    };
    const storeB = {
        name: 'storeB',
        keyPath: null,
        autoIncrement: false,
        indexes: {}
    };

    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA', { keyPath: 'id', autoIncrement: true })
            .addStore('storeB')
            .define(2)
            .delStore('storeB');
    });

    it('delete store from store map', () => {
        assert(schema._stores['storeB'] === undefined);
    });

    specify('current store to be null', () => {
        assert(schema._current.store === null);
    });

    it('update version map', () => {
        assert.deepEqual(schema._versions[2].dropStores, [storeB]);
    });

    it('throw TypeError when store is not defined', () => {
        assert.throws(() => {
            schema.clone().delStore('storeC');
        }, TypeError);
    });
});


describe('#getStore', () => {
    let schema: SchemaBuilder;
    const storeA = {
        name: 'storeA',
        keyPath: 'id',
        autoIncrement: true,
        indexes: {}
    };
    const storeB = {
        name: 'storeB',
        keyPath: null,
        autoIncrement: false,
        indexes: {}
    };

    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA', { keyPath: 'id', autoIncrement: true })
            .define(2)
            .addStore('storeB')
            .getStore('storeA');
    });

    it('update current store', () => {
        assert(schema._current.version === 2);
        assert.deepEqual(schema._current.store, storeA);
    });

    it('throw TypeError when store is not defined', () => {
        assert.throws(() => {
            schema.clone().getStore('storeC');
        }, TypeError);
    });
});


describe('#addIndex', () => {
    let schema: SchemaBuilder;

    const indexA = {
        storeName: 'storeA',
        name: 'indexA',
        field: 'indexA',
        unique: false,
        multiEntry: false
    };

    const storeA = {
        name: 'storeA',
        keyPath: 'id',
        autoIncrement: true,
        indexes: { indexA }
    };

    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA', { keyPath: 'id', autoIncrement: true })
            .addIndex('indexA', 'indexA');
    });

    it('update storeA description', () => {
        assert.deepEqual(schema._stores['storeA'], storeA);
    });

    it('update version map', () => {
        assert.deepEqual(schema._versions[1].indexes, [indexA]);
    });

    it('throw TypeError when current store is empty', () => {
        assert.throws(() => {
            schema.clone().delStore('storeA').addIndex('indexB', 'indexB');
        }, TypeError);
    });

    it('throw TypeError when index is already defined', () => {
        assert.throws(() => {
            schema.clone().addIndex('indexA', 'indexA');
        }, TypeError);
    });
});

describe('#delIndex', () => {
    let schema: SchemaBuilder;

    const indexA = {
        storeName: 'storeA',
        name: 'indexA',
        field: 'indexA',
        unique: false,
        multiEntry: false
    };

    const storeA = {
        name: 'storeA',
        keyPath: 'id',
        autoIncrement: true,
        indexes: {}
    };

    beforeEach(() => {
        schema = new SchemaBuilder()
            .define(1)
            .addStore('storeA', { keyPath: 'id', autoIncrement: true })
            .addIndex('indexA', 'indexA')
            .define(2)
            .getStore('storeA')
            .delIndex('indexA');
    });

    it('update store map', () => {
        assert.deepEqual(schema._stores['storeA'], storeA);
    });

    it('add dropIndexes', () => {
        assert.deepEqual(schema._versions[2].dropIndexes, [indexA]);
    });

    it('throw TypeError when current store is empty', () => {
        assert.throws(() => {
            schema.clone().define(3).delIndex('storeC');
        }, TypeError);
    });

    it('throw TypeError when index is not found', () => {
        assert.throws(() => {
            schema.clone().delIndex('indexB');
        }, TypeError);
    });
});


describe('#clone', () => {
    it('return new SchemaBuilder', () => {
        const s1 = new SchemaBuilder()
            .define(1)
            .addStore('storeA');

        const s2 = s1.clone();

        assert(s1 !== s2);
        assert(s2 instanceof SchemaBuilder);
        assert(s1._stores !== s2._stores);
    });
});

/* test on migration.test.ts */
describe('#addMigrateTask', noop);
describe('#build', noop);

