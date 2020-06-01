<template>
    <div id="app">
        <b-modal :active.sync="signingModalOpen" :width="600">
            <request-modal v-if="signingModalOpen" :req="linkRequest" />
        </b-modal>
        <section class="hero is-primary is-bold">
            <div class="hero-body">
                <div class="container">
                    <h1 class="title">
                        Anchor Link
                    </h1>
                    <h2 class="subtitle">
                        Demo using ESR URIs and Anchor. Go to <a href="https://github.com/greymass/anchor-link">https://github.com/greymass/anchor-link</a> for documentation.
                    </h2>
                </div>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <b-field label="Chain">
                    <b-select v-model="selectedChain">
                        <option
                            v-for="chain in chains"
                            :key="chain"
                            :value="ChainName[chain]"
                        >
                            {{ chain }}
                        </option>
                    </b-select>
                </b-field>
                <b-field grouped>
                    <b-field
                        label="Contract"
                        :message="contractError"
                        :type="{ 'is-danger': contractError }"
                    >
                        <b-input
                            v-model="contract"
                            :loading="contractLoading"
                        />
                    </b-field>
                    <b-field label="Action">
                        <b-select
                            v-model="selectedAction"
                            :disabled="contractError || contractLoading"
                            :loading="contractLoading"
                        >
                            <option
                                v-for="action in contractActions"
                                :key="action"
                            >
                                {{ action }}
                            </option>
                        </b-select>
                    </b-field>
                </b-field>
                <b-field grouped group-multiline>
                    <b-field
                        v-for="field in fields"
                        :key="field.name"
                        :label="field.name"
                    >
                        <b-field v-if="field.type == 'name'">
                            <b-input
                                v-model="actionData[field.name]"
                                :disabled="
                                    placeholderFields.includes(field.name)
                                "
                                :placeholder="
                                    placeholderFields.includes(field.name)
                                        ? 'using signer'
                                        : field.type
                                "
                            />
                            <b-checkbox-button
                                class="signer-button"
                                v-model="placeholderFields"
                                :native-value="field.name"
                            >
                                <b-icon icon="draw" />
                            </b-checkbox-button>
                        </b-field>
                        <b-input
                            v-else
                            v-model="actionData[field.name]"
                            :placeholder="field.type"
                        />
                    </b-field>
                </b-field>
                <b-message
                    :active="!!requestError"
                    type="is-danger"
                    has-icon
                    :duration="0"
                >
                    {{ requestError }}
                </b-message>
                <b-field class="submit-field">
                    <b-button
                        :disabled="!canSubmit"
                        type="is-primary"
                        size="is-medium"
                        icon-right="anchor"
                        @click="doSign"
                    >
                        Sign
                    </b-button>
                </b-field>
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import {Component, Vue, Watch} from 'vue-property-decorator'
import Link from 'anchor-link'
import BrowserTransport from 'anchor-link-browser-transport'
import {ChainName} from 'eosio-uri'
import {Abi} from 'eosjs/dist/eosjs-rpc-interfaces'
import {Debounce} from './utils'
import TokenAbi from './eosio.token.abi'

const ApiNodes: {[chain: number]: string} = {
    [ChainName.EOS]: 'https://eos.greymass.com',
    [ChainName.TELOS]: 'https://telos.greymass.com',
    [ChainName.JUNGLE]: 'https://jungle.greymass.com',
    [ChainName.KYLIN]: 'https://api.kylin.alohaeos.com',
    [ChainName.WORBLI]: 'https://worbli.eosphere.io',
    [ChainName.BOS]: 'https://swedencornet.eossweden.eu',
    [ChainName.MEETONE]: 'https://meetone.eossweden.eu',
    [ChainName.INSIGHTS]: 'https://ireland-history.insights.network',
    [ChainName.BEOS]: 'https://api.beos.world',
}

@Component
export default class App extends Vue {

    get chains() {
        const rv: string[] = []
        for (const n in ChainName) {
            if (!isNaN(parseInt(n, 10)) || n === 'UNKNOWN') {
                continue
            }
            rv.push(n)
        }
        return rv
    }

    get apiNode() {
        return ApiNodes[this.selectedChain] || ApiNodes[ChainName.EOS]
    }

    get link() {
        return new Link({
            transport: new BrowserTransport({requestStatus: false}),
            rpc: this.apiNode,
            chainId: this.selectedChain,
        })
    }

    // possible actions for contract
    get contractActions() {
        if (!this.contractAbi) { return [] }
        return this.contractAbi.actions.map(({name}) => name)
    }

    get canSubmit() {
        return !this.contractError && !this.contractLoading && this.resolvedAction
    }

    get resolvedAction() {
        if (!this.fields) { return null }
        const structs = this.contractAbi!.structs.map(({name}) => name)
        const data: any = {}
        for (const {name, type} of this.fields) {
            let value = this.actionData[name]
            if (this.placeholderFields.includes(name)) {
                value = '............1'
            }
            if (type === 'string') {
                value = value || ''
            } else if (structs.includes(type)) {
                try {
                    value = value ? JSON.parse(value) : {}
                } catch (error) {
                    // tslint:disable-next-line:no-console
                    console.warn('error parsing json for field', name, type, error)
                    value = {}
                }
            }
            data[name] = value
        }
        return {
            account: this.contract,
            name: this.selectedAction!,
            authorization: [{actor: '............1', permission: '............1'}],
            data,
        }
    }

    get fields() {
        if (!this.contractAbi || !this.selectedAction) { return null }
        const action = this.contractAbi.actions.find(({name}) => name === this.selectedAction)!
        const type = this.contractAbi.structs.find(({name}) => name === action.type)
        if (!type) { return null }
        return type.fields
    }


    ChainName = ChainName
    selectedChain = ChainName.JUNGLE

    signingModalOpen = false

    contract = 'eosio.token'
    contractAbi: Abi | null = TokenAbi
    contractError: string | null = null
    contractLoading = false

    selectedAction: string | null = 'transfer'
    actionData: any = {to: 'decentiummmm', memo: 'endorse decentium222/feed-me', quantity: '1.0000 EOS'}
    placeholderFields: string[] = ['from']

    requestError: string | null = null

    doSign() {
        this.requestError = null
        this.link.transact({action: this.resolvedAction!}).then((result) => {
            this.$dialog.alert({
                title: 'Success!',
                message: `Transaction ID<br>\n<small>${ result.processed!.id }</small>`,
                size: 'is-small',
            })
        }).catch((error) => {
            this.requestError = error
        })
    }

    @Watch('placeholderFields')
    onPlaceholderFieldsUpdate(fields: string[]) {
        for (const field of fields) {
            delete this.actionData[field]
        }
    }

    // load abi when contract changes
    @Watch('contract')
    @Debounce(200)
    onContractChange(contract: string) {
        this.contractLoading = true
        this.contractError = null
        this.contractAbi = null
        this.link.getAbi(contract).then((abi: any) => {
            if (this.contract === contract) {
                if (!abi || abi.actions.length === 0) {
                    throw new Error('Contract has no actions or invalid ABI')
                }
                this.contractAbi = abi
            }
        }).catch((error) => {
            if (this.contract === contract) {
                this.contractAbi = null
                let message: string = error.message || String(error)
                if (message.startsWith('unknown key')) {
                    message = 'No such contract'
                }
                this.contractError = message
            }
        }).finally(() => {
            if (this.contract === contract) {
                this.contractLoading = false
            }
        })
    }

    // reload abi when chain changes
    @Watch('selectedChain')
    onSelectedChainChange() {
        this.onContractChange(this.contract)
    }

    // set selected action when contract updates
    @Watch('contractActions')
    onContractActionsUpdated(actions: string[]) {
        const selected = this.selectedAction
        if (selected && actions.includes(selected)) {
            return
        }
        this.selectedAction = actions[0] || null
    }

}
</script>

<style lang="scss">
@import "~bulma/sass/utilities/_all";

$primary: #48ad19;
$primary-invert: findColorInvert($primary);
$colors: (
    "white": (
        $white,
        $black
    ),
    "black": (
        $black,
        $white
    ),
    "light": (
        $light,
        $light-invert
    ),
    "dark": (
        $dark,
        $dark-invert
    ),
    "primary": (
        $primary,
        $primary-invert
    ),
    "info": (
        $info,
        $info-invert
    ),
    "success": (
        $success,
        $success-invert
    ),
    "warning": (
        $warning,
        $warning-invert
    ),
    "danger": (
        $danger,
        $danger-invert
    )
);

// // Links
$link: $primary;
$link-invert: $primary-invert;
$link-focus-border: $primary;

// Import Bulma and Buefy styles
@import "~bulma";
@import "~buefy/src/scss/buefy";

.field.is-grouped.is-grouped-multiline .field:last-child {
    margin-bottom: 0.75rem;
}

#app {
    font-family: "Avenir", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    .signer-button {
        .button {
            padding-left: 0.4em;
            padding-right: 0.3em;
        }
        .icon {
            margin: 0;
        }
    }
}
</style>
