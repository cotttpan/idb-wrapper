import { EventEmitter } from 'events';
import { TrxProcessor, TrxTask, TrxMode } from './transaction';
import { SchemaBuilder } from './schema-builder';
import { bundle } from '@cotto/utils.ts';

export interface IDBWrapperEventMap {
    active: IDBDatabase;
    error: DOMException;
}

export interface IDBWrapperOptions {
    IDBFactory?: IDBFactory;
    IDBKeyRange?: typeof IDBKeyRange;
}

export class IDBWrapper extends EventEmitter {
    name: string;
    originDB?: IDBDatabase;
    IDBFactory: IDBFactory;
    IDBKeyrange: typeof IDBKeyRange;

    constructor(name: string, options: IDBWrapperOptions = {}) {
        super();
        this.name = name;
        this.IDBFactory = options.IDBFactory || indexedDB;
        this.IDBKeyrange = options.IDBKeyRange || IDBKeyRange;
    }

    get storeNames(): string[] {
        const db = this.originDB;
        return db ? Array.from(db.objectStoreNames) : [];
    }

    get isOpen() {
        try {
            this.originDB!.transaction(this.storeNames).abort();
            return true;

        } catch (err) {
            return false;
        }
    }

    on<K extends keyof IDBWrapperEventMap>(event: K, listener: (value: IDBWrapperEventMap[K]) => any) {
        return super.on(event, listener);
    }

    once<K extends keyof IDBWrapperEventMap>(event: K, listener: (value: IDBWrapperEventMap[K]) => any) {
        return super.once(event, listener);
    }

    ready(timeout = 5000) {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const tid = setTimeout(() => {
                const message = 'Timeout on IDBWrapper#ready. There is possibility that IDBDatabase is closed.';
                return reject(new Error(message));
            }, timeout);

            const expose = bundle<IDBDatabase>(clearTimeout.bind(null, tid), resolve);
            return this.isOpen ? expose(this.originDB!) : this.once('active', expose);
        });
    }

    open(schema: SchemaBuilder) {
        const self = this;
        const req = this.IDBFactory.open(this.name, schema.version);
        req.onupgradeneeded = schema.build(this);
        req.onsuccess = onsuccess;
        req.onerror = onerror;
        return this;

        function onsuccess(this: IDBRequest) {
            const db: IDBDatabase = this.result;
            self.originDB = db;
            self.emit('active', db);
        }

        function onerror(this: IDBRequest) {
            self.emit('error', this.error);
        }
    }

    async close() {
        const db = await this.ready();
        return db.close();
    }

    async delete() {
        const self = this;
        await this.ready();
        await this.close();

        return new Promise<void>((resolve, reject) => {
            const req = this.IDBFactory.deleteDatabase(this.name);
            req.onsuccess = onsuccess;
            req.onerror = onerror;
            req.onblocked = onerror;

            function onsuccess() {
                self.originDB = undefined;
                resolve();
            }

            function onerror(this: IDBRequest) {
                reject(this.error);
            }
        });
    }

    transaction<I = any, O = any>(storeNames: string | string[], mode: TrxMode, task: TrxTask<I, O>) {
        return new TrxProcessor<I, O>(this, storeNames, mode, task);
    }
}
