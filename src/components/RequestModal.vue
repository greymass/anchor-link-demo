<template>
    <div class="box request-modal">
        <div v-if="response && response.tx" class="success">
            <p>
                <b-icon
                    size="is-large"
                    :type="verifyStatus == 'error' ? 'is-danger' : 'is-primary'"
                    :icon="verifyIcon"
                />
            </p>
            <p class="is-size-5" style="margin: 1em 0;">{{ verifyMessage }}</p>
            <p class="is-size-7">
                <a
                    v-if="explorerLink"
                    target="_blank"
                    class="button is-text is-size-7"
                    :href="explorerLink"
                >
                    <b-icon size="is-small" icon="receipt" />
                    <span>{{ response.tx }}</span>
                </a>
                <span v-else>{{ response.tx }}</span>
            </p>
        </div>
        <div v-else-if="response">
            <p>
                <b-icon
                    size="is-large"
                    type="is-primary"
                    icon="check-circle-outline"
                />
            </p>
            <p class="is-size-5">Transaction signed</p>
            <pre class="is-size-7">{{ response.sig }}</pre>
        </div>
        <div v-else>
            <div class="columns is-vcentered">
                <div class="column">
                    <p>
                        Sign using <br /><a
                            class="button is-primary"
                            :href="uri"
                            >Anchor Desktop</a
                        >
                    </p>
                </div>
                <div class="column">
                    <p>Sign using Anchor Mobile</p>
                    <div class="qrcode" v-if="qrcode" v-html="qrcode" />
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import { LinkRequest } from '../anchor-link'
import { SigningRequest, ChainName } from 'eosio-uri'

import * as QRCode from 'qrcode'
import { Action } from 'eosjs/dist/eosjs-serialize'

import * as assert from 'assert'
import { sleep } from '../utils'
import { JsonRpc } from 'eosjs'

const BlockExplorers: {[chain: number]: string} = {
    [ChainName.EOS]: 'https://jungle.bloks.io/transaction/',
    [ChainName.TELOS]: 'https://telos.bloks.io/transaction/',
    [ChainName.JUNGLE]: 'https://jungle.bloks.io/transaction/',
    [ChainName.KYLIN]: 'https://jungle.bloks.io/transaction/',
    [ChainName.WORBLI]: 'https://worbli.bloks.io/transaction/',
    [ChainName.BOS]: 'https://bos.bloks.io/transaction/',
    [ChainName.MEETONE]: 'https://meetone.bloks.io/transaction/',
}

async function getTransaction(txId: string, blockNum: number, rpc: JsonRpc) {
    const fetchTx = async (num: number) => {
        const block = await rpc.get_block(blockNum) as any
        return block.transactions.find(({trx}: any) => trx.id === txId)
    }
    let tx = await fetchTx(blockNum)
    // lookaround if tx is not fund in given block
    if (!tx) {
        const numbers = [1, -1, 2, -2].map((i) => blockNum + i)
        for (const num of numbers) {
            tx = await fetchTx(num)
            if (tx) {
                break
            }
        }
    }
    // TODO: fallback to history api if possible - v1/history/get_transaction
    if (!tx) {
        throw new Error(`Unable to find transaction`)
    }
    return tx
}

/** Deep object equality assertion that allows for eosio-uri placeholders. */
function assertEqual(actual: any, expected: any) {
    const actualType = typeof actual
    const expectedType = typeof expected
    assert.strictEqual(actualType, expectedType)
    if (expectedType === 'object' && expected !== null) {
        const actualKeys = Object.keys(actual)
        const expectedKeys = Object.keys(expected)
        assert.deepStrictEqual(actualKeys, expectedKeys)
        for (const key of expectedKeys) {
            assertEqual(actual[key], expected[key])
        }
    } else {
        // skip equality check for placeholder string
        if (expectedType === 'string' && expected === '............1') {
            return
        }
        assert.deepStrictEqual(actual, expected)
    }
}

@Component
export default class RequestModal extends Vue {
    @Prop({required: true}) req!: LinkRequest

    sigReq: SigningRequest | null = null
    response: any = null
    error: any = null
    qrcode: any = null

    get verifyIcon() {
        if (this.verifyStatus === 'error') {
            return 'alert-circle'
        } else if (this.verifyStatus === 'irreversible') {
            return 'check-circle'
        } else {
            return 'check-circle-outline'
        }
     }
    verifyStatus: string = 'verifying'
    verifyMessage = 'Transaction broadcast, verifying'

    get uri() {
        if (this.sigReq) {
            return this.sigReq.encode()
        }
        return null
    }

    get explorerLink() {
        if (this.response && this.response.tx) {
            // TODO: sig request needs a get chain name that does reverse lookup on ids also
            // this will break on transactions that has a custom chain id
            const chain = this.sigReq!.data.chain_id[1] as number
            const explorer = BlockExplorers[chain]
            if (explorer) {
                return explorer + this.response.tx
            }
        }
        return null
    }

    @Watch('response', {immediate: true})
    onResponseUpdated() {
        this.verify().catch((error) => {
            this.verifyStatus = 'error'
            this.verifyMessage = 'Unable to verify: ' + error.message || String(error)
        })
    }

    async verify() {
        if (this.response && this.response.bn) {
            const blockNum = Number(this.response.bn)
            const block: any = await this.req.link.rpc.get_block(blockNum)
            // TODO: need to recreate txn id here from our signing request and compare
            //       for now just check that the data matches
            await sleep(500)
            const tx = await getTransaction(this.response.tx, blockNum, this.req.link.rpc)
            const reqActions = await this.sigReq!.getActions()
            const txActions = (tx.trx.transaction.actions as typeof reqActions)
                .map(({account, name, authorization, data}) => ({account, name, authorization, data}))
            assertEqual(txActions, reqActions)
            this.verifyStatus = 'verified'
            let d = Infinity
            while (d > 0) {
                const info = await this.req.link.rpc.get_info()
                d = blockNum - info.last_irreversible_block_num
                const s = (Math.max(d, 0) / 2).toFixed(0)
                this.verifyMessage = `Transaction verified, pending irreversibility (${ s }s)`
                await sleep(500)
            }
            this.verifyStatus = 'irreversible'
            this.verifyMessage = 'Transaction confirmed'
        }
    }

    @Watch('uri')
    uriUpdated() {
        if (this.uri) {
            // const code = QRCode.create(this.uri, {errorCorrectionLevel: 'M'})
            QRCode.toString(this.uri.replace(/^eosio:/, 'eosio://'), {type: 'svg'}, (error, result) => {
                if (error) {
                    // tslint:disable-next-line:no-console
                    console.warn('unable to generate qr', error)
                } else {
                    this.qrcode = result
                }
            })
        } else {
            this.qrcode = null
        }
    }

    @Watch('req', {immediate: true})
    reqUpdated(req: LinkRequest, oldReq?: LinkRequest) {
        if (oldReq) {
            oldReq.removeAllListeners()
            this.sigReq = null
            this.response = null
            this.error = null
        }
        req.getRequest().then((sigReq) => {
            this.sigReq = sigReq
        })
        req.on('error', (error) => {
            this.error = error
        })
        req.on('response', (response) => {
            this.response = response
        })
    }

}
</script>

<style scoped lang="scss">
p {
    text-align: center;
}
.qrcode {
    svg {
        display: block;
    }
}
.icon {
    vertical-align: middle;
}
.request-modal .success {
    padding: 1em;
}
</style>
