import { Task, Processor, Context } from '@cotto/sq';
import { IDBWrapper } from './idb-wrapper';
import { bundle } from '@cotto/utils.ts';

export interface ExtraTrxContext {
    trx: IDBTransaction;
    range: typeof IDBKeyRange;
}

export type TrxContext<T> = Context<T, ExtraTrxContext>;

export type TrxTask<I, O> = Task<I, O, ExtraTrxContext>;

export type TrxMode = 'r' | 'rw';

export class Transaction<I = any, O = any> {
    static parseTrxMode(mode: TrxMode) {
        return mode === 'r' ? 'readonly' : 'readwrite';
    }

    db: IDBWrapper;
    storeNames: string | string[];
    mode: TrxMode;
    _processor: Processor<any, any> = new Processor();

    constructor(db: IDBWrapper, storeNames: string | string[], mode: TrxMode, task?: TrxTask<I, O>) {
        this.db = db;
        this.storeNames = storeNames;
        this.mode = mode;
        task && this._processor.pipe(task);
    }

    pipe<R>(task: TrxTask<O, R>) {
        this._processor.pipe(task);
        return this as any as Transaction<I, R>;
    }

    execute(input: I, timeout = 5000) {
        return this.db.ready().then(() => {
            return new Promise<O>((resolve: Function, reject: any) => {
                const db = this.db.originDB!;
                const range = this.db.IDBKeyrange;
                const mode = Transaction.parseTrxMode(this.mode);
                const trx = db.transaction(this.storeNames, mode);
                const ctx: ExtraTrxContext = { range, trx };

                let trxError: any;

                trx.addEventListener('error', function () {
                    trxError = this.error;
                });

                const done = (taskError: any, result: O) => {
                    const err = taskError || trxError;
                    err ? bundle<any>(trx.abort.bind(trx), reject)(err) : resolve(result);
                };

                return this._processor.run(input, done, ctx, timeout);
            });
        });
    }

    clone() {
        const instance = new Transaction<I, O>(this.db, this.storeNames, this.mode);
        instance._processor = this._processor.clone();
        return instance;
    }
}
