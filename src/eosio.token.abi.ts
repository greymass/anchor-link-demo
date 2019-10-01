export default {
    version: 'eosio::abi/1.1',
    types: [],
    structs: [
        {
            name: 'account',
            base: '',
            fields: [
                {
                    name: 'balance',
                    type: 'asset',
                },
            ],
        },
        {
            name: 'close',
            base: '',
            fields: [
                {
                    name: 'owner',
                    type: 'name',
                },
                {
                    name: 'symbol',
                    type: 'symbol',
                },
            ],
        },
        {
            name: 'create',
            base: '',
            fields: [
                {
                    name: 'issuer',
                    type: 'name',
                },
                {
                    name: 'maximum_supply',
                    type: 'asset',
                },
            ],
        },
        {
            name: 'currency_stats',
            base: '',
            fields: [
                {
                    name: 'supply',
                    type: 'asset',
                },
                {
                    name: 'max_supply',
                    type: 'asset',
                },
                {
                    name: 'issuer',
                    type: 'name',
                },
            ],
        },
        {
            name: 'issue',
            base: '',
            fields: [
                {
                    name: 'to',
                    type: 'name',
                },
                {
                    name: 'quantity',
                    type: 'asset',
                },
                {
                    name: 'memo',
                    type: 'string',
                },
            ],
        },
        {
            name: 'open',
            base: '',
            fields: [
                {
                    name: 'owner',
                    type: 'name',
                },
                {
                    name: 'symbol',
                    type: 'symbol',
                },
                {
                    name: 'ram_payer',
                    type: 'name',
                },
            ],
        },
        {
            name: 'retire',
            base: '',
            fields: [
                {
                    name: 'quantity',
                    type: 'asset',
                },
                {
                    name: 'memo',
                    type: 'string',
                },
            ],
        },
        {
            name: 'transfer',
            base: '',
            fields: [
                {
                    name: 'from',
                    type: 'name',
                },
                {
                    name: 'to',
                    type: 'name',
                },
                {
                    name: 'quantity',
                    type: 'asset',
                },
                {
                    name: 'memo',
                    type: 'string',
                },
            ],
        },
    ],
    actions: [
        {
            name: 'close',
            type: 'close',
            ricardian_contract: '',
        },
        {
            name: 'create',
            type: 'create',
            ricardian_contract: '',
        },
        {
            name: 'issue',
            type: 'issue',
            ricardian_contract: '',
        },
        {
            name: 'open',
            type: 'open',
            ricardian_contract: '',
        },
        {
            name: 'retire',
            type: 'retire',
            ricardian_contract: '',
        },
        {
            name: 'transfer',
            type: 'transfer',
            ricardian_contract: '',
        },
    ],
    tables: [
        {
            name: 'accounts',
            index_type: 'i64',
            key_names: [],
            key_types: [],
            type: 'account',
        },
        {
            name: 'stat',
            index_type: 'i64',
            key_names: [],
            key_types: [],
            type: 'currency_stats',
        },
    ],
    ricardian_clauses: [],
    error_messages: [],
    abi_extensions: [],
    variants: [],
}

