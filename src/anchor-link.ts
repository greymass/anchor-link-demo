import {
    AbiProvider,
    ChainName,
    SigningRequest,
    SigningRequestCreateArguments,
    SigningRequestEncodingOptions,
} from 'eosio-uri'
import {JsonRpc} from 'eosjs'
import {EventEmitter} from 'events'
import genUUID from 'uuid/v4'
import {Abi} from 'eosjs/dist/eosjs-rpc-interfaces'

interface CallbackResponse {
    sig: string
    tx?: string
    bn?: string
}

interface LinkOptions {
    /**
     * URL to EOSIO node to communicate with.
     * E.g. "https://eos.greymass.com"
     */
    rpc: string
    /**
     * URL to callback service.
     * E.g. "https://callback.anchor.link"
     */
    service: string
}

export class Link implements AbiProvider {

    static defaultOptions: LinkOptions = {
        rpc: 'https://api.jungle.alohaeos.com',
        service: 'http://localhost:8090',
    }

    readonly rpc: JsonRpc
    private abiCache = new Map<string, Abi>()

    constructor(readonly options: LinkOptions = Link.defaultOptions) {
        this.rpc = new JsonRpc(this.options.rpc)
    }

    async getAbi(account: string) {
        let rv = this.abiCache.get(account)
        if (!rv) {
            rv = (await this.rpc.get_abi(account)).abi as any
            if (rv) {
                this.abiCache.set(account, rv)
            }
        }
        return rv
    }

    request(args: SigningRequestCreateArguments) {
        return new LinkRequest(args, this)
    }

    transact(args: SigningRequestCreateArguments) {
        return new Promise<CallbackResponse>((resolve, reject) => {
            const req = this.request(args)
            req.on('error', reject)
            req.on('response', resolve)
        })
    }

}

export class LinkRequest extends EventEmitter {
    readonly uuid: string

    private socket!: WebSocket
    private req?: SigningRequest
    private reqError?: Error

    constructor(private args: SigningRequestCreateArguments, readonly link: Link) {
        super()
        this.uuid = genUUID()
        this.setupSocket()
        this.setupRequest()
    }

    async getRequest() {
        if (this.req) {
            return this.req
        } else if (this.reqError) {
            throw this.reqError
        } else {
            return waitForEvent<SigningRequest>(this, 'request')
        }
    }

    private setupRequest() {
        const opts: SigningRequestEncodingOptions = {
            abiProvider: this.link,
        }
        const args = {
            ...this.args,
            callback: {
                background: true,
                url: this.link.options.service + '/' + this.uuid,
            },
        }
        SigningRequest.create(args, opts).then((req) => {
            this.req = req
            this.emit('request', req)
        }).catch((error) => {
            this.reqError = error
            this.emit('error', error)
        })
    }

    private setupSocket() {
        const url = this.link.options.service.replace(/^http/, 'ws') + '/' + this.uuid
        this.socket = new WebSocket(url)
        this.socket.onmessage = (event) => {
            readJsonMessage(event)
                .then((response) => {
                    this.emit('response', response)
                }).catch((error) => {
                    this.emit('error', error)
                })
        }
        this.socket.onerror = (event) => {
            // tslint:disable-next-line:no-console
            console.warn('socket error', event)
            // TODO: reconnect with backoff
        }
    }

}

async function waitForMessage(url: string) {
    // TODO: timeout
    return new Promise<any>((resolve, reject) => {
        const socket = new WebSocket(url)
        socket.onerror = reject
        socket.onmessage = (event) => {
            resolve(event.data)
        }
    })
}



async function parseMessage(data: any) {
    let json: string
    if (data instanceof Blob) {
        json = await readBlobAsText(data)
    } else {
        json = data
    }
    return JSON.parse(json)
}

async function waitForCallback(url: string) {
    const data = await waitForMessage(url)
    return await parseMessage(data)
}

function readBlobAsText(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = reject
        reader.onload = () => {
            resolve(reader.result as string)
        }
        reader.readAsText(blob)
    })
}

async function readJsonMessage(event: MessageEvent) {
    let json: string
    if (event.data instanceof Blob) {
        json = await readBlobAsText(event.data)
    } else {
        json = String(event.data)
    }
    return JSON.parse(json)
}

/**
 * Return a promise that will resove when a specific event is emitted.
 */
export function waitForEvent<T>(
    emitter: EventEmitter,
    eventName: string | symbol,
    timeout?: number,
    rejectOnError = true,
): Promise<T> {
    return new Promise((resolve, reject) => {
        emitter.once(eventName, resolve)
        if (rejectOnError) {
            emitter.once('error', reject)
        }
        if (timeout) {
            setTimeout(() => {
                reject(new Error('Timed out'))
            }, timeout)
        }
    })
}
