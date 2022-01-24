/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * @ignore Don't show this file in documentation.
 */

import { Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
    construct,
    decode,
    deriveAddress,
    methods,
    getRegistry,
    PolkadotSS58Format,
    toTxMethod,
} from '@substrate/txwrapper-polkadot';


import { rpcToLocalNode, signWith } from './util';


/**
 * Entry point of the script. This script assumes a Polkadot node is running
 * locally on `http://localhost:9933`.
 */
async function main(): Promise<void> {
    // Wait for the promise to resolve async WASM
    await cryptoWaitReady();
    // Create a new keyring, and add an "Alice" account
    const keyring = new Keyring();
    const alice = keyring.addFromUri('//Alice', { name: 'Alice' }, 'sr25519');
    console.log(
        "Alice's SS58-Encoded Address:",
        deriveAddress(alice.publicKey, PolkadotSS58Format.polkadot)
    );

    // Construct a balance transfer transaction offline.
    // To construct the tx, we need some up-to-date information from the node.
    // `txwrapper` is offline-only, so does not care how you retrieve this info.
    // In this tutorial, we simply send RPC requests to the node.
    const { block } = await rpcToLocalNode('chain_getBlock');
    const blockHash = await rpcToLocalNode('chain_getBlockHash');
    const genesisHash = await rpcToLocalNode('chain_getBlockHash', [0]);
    const metadataRpc = await rpcToLocalNode('state_getMetadata');
    const { specVersion, transactionVersion, specName } = await rpcToLocalNode(
        'state_getRuntimeVersion'
    );

    /**
     * Create Polkadot's type registry.
     *
     * When creating a type registry, it accepts a `asCallsOnlyArg` option which
     * defaults to false. When true this will minimize the size of the metadata
     * to only include the calls. This removes storage, events, etc.
     * This will ultimately decrease the size of the metadata stored in the registry.
     *
     * Example:
     *
     * ```
     * const registry = getRegistry({
     *  chainName: 'Polkadot',
     *	specName,
     *	specVersion,
     *	metadataRpc,
     *  asCallsOnlyArg: true,
     * });
     * ```
     */
    const registry = getRegistry({
        chainName: 'Polkadot',
        specName,
        specVersion,
        metadataRpc,
    });

    /**
     * Now we can create our `balances.transferKeepAlive` unsigned tx. The following
     * function takes the above data as arguments, so it can be performed offline
     * if desired.
     *
     * In order to decrease the size of the metadata returned in the unsigned transaction,
     * be sure to include `asCallsOnlyArg` field in the options.
     * Ex:
     * {
     *   metadataRpc,
     *   registry,
     *   asCallsOnlyArg: true
     * }
     */

    const unsignedBalanceTransfer = methods.balances.transferKeepAlive(
        {
            dest: '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw',			//EVE
            value: 10000,
        },
        {
            address: deriveAddress(alice.publicKey, PolkadotSS58Format.polkadot),
            blockHash,
            blockNumber: registry
                .createType('BlockNumber', block.header.number)
                .toNumber(),
            eraPeriod: 64,
            genesisHash,
            metadataRpc,
            nonce: 0, // Assuming this is Alice's first tx on the chain
            specVersion,
            tip: 0,
            transactionVersion,
        },
        {
            metadataRpc,
            registry,
        }
    );


    /// multisig tx
    const unsigned = methods.multisig.asMulti(
        {
            threshold: 2,
            otherSignatories: [
                '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3', // seed "//Bob",
                '14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q', // seed "//Charlie"
            ],
            maybeTimepoint: null,       // 首次调用为null
            // call data的
            call: unsignedBalanceTransfer.method,
            /***Important
             * method: {
                args,
                name: 'transferKeepAlive',
                pallet: 'balances',
            },
             */
            storeCall: false,
            maxWeight: '100000000000',

        },
        {
            address: deriveAddress(alice.publicKey, PolkadotSS58Format.polkadot),
            blockHash,
            blockNumber: registry
                .createType('BlockNumber', block.header.number)
                .toNumber(),
            eraPeriod: 64,
            genesisHash,
            metadataRpc,
            nonce: 0, // Assuming this is Alice's first tx on the chain
            specVersion,
            tip: 0,
            transactionVersion,
        },
        {
            metadataRpc,
            registry,
        },
    );

    // Decode an unsigned transaction.
    const decodedUnsigned = decode(unsigned, {
        metadataRpc,
        registry,
    });

    console.log(`----------开始解码未签名的多签交易数据(call data)------------`);
    let { threshold, maxWeight, call, otherSignatories } = decodedUnsigned.method.args;
    console.log(`threshold is ${threshold} \n` + `other signatories is ${otherSignatories}\n` + `maxweight is ${maxWeight} \n` + `call data is ${call}\n`);
    // 通过call data构造Call类型参数
    const methodCall = registry.createType('Call', call);
    // 解码为具体的交易method（json）
    const method = toTxMethod(registry, methodCall);
    console.log(`opaque call dest is ${(method.args.dest as { id: string })?.id}`);
    console.log(`opaque call mount is ${method.args.value}`);
    console.log(`------------------解码成功-------------------------`);



    // 对一个未签名的交易构造一个签名payload
    const signingPayload = construct.signingPayload(unsigned, { registry });
    console.log(`\nPayload to Sign: ${signingPayload}`);

    // Decode the information from a signing payload.
    const payloadInfo = decode(signingPayload, {
        metadataRpc,
        registry,
    });

    console.log(`----------开始解码多签交易数据(call data)------------`);
    // let {threshold1, maxWeight1, call1} = payloadInfo.method.args;
    // console.log(`threshold is ${threshold1} \n maxweight is ${maxWeight1} \n call data is ${call1}\n`);
    console.log(`threshold is ${payloadInfo.method.args.threshold} \n`
        + `other signatories is ${payloadInfo.method.args.otherSignatories}\n`
        + `maxweight is ${payloadInfo.method.args.maxWeight} \n`
        + `call data is ${payloadInfo.method.args.call}\n`);
    // 通过call data构造Call类型参数
    const methodCall1 = registry.createType('Call', payloadInfo.method.args.call);
    // 解码为具体的交易method（json）
    const method1 = toTxMethod(registry, methodCall1);
    console.log(`opaque call dest is ${(method1.args.dest as { id: string })?.id}`);
    console.log(`opaque call mount is ${method1.args.value}`);
    console.log(`------------------解码成功-------------------------`);



    // 签名
    const signature = signWith(alice, signingPayload, {
        metadataRpc,
        registry,
    });
    console.log(`\nSignature: ${signature}`);

    // 通过签名构造具签名交易
    const tx = construct.signedTx(unsigned, signature, {
        metadataRpc,
        registry,
    });
    console.log(`\nTransaction to Submit: ${tx}`);

    // Derive the tx hash of a signed transaction offline.
    const expectedTxHash = construct.txHash(tx);
    console.log(`\nExpected Tx Hash: ${expectedTxHash}`);

    // Send the tx to the node. Again, since `txwrapper` is offline-only, this
    // operation should be handled externally. Here, we just send a JSONRPC
    // request directly to the node.
    const actualTxHash = await rpcToLocalNode('author_submitExtrinsic', [tx]);
    console.log(`Actual Tx Hash: ${actualTxHash}`);

    // Decode a signed payload.
    const txInfo = decode(tx, {
        metadataRpc,
        registry,
    });

    console.log(`----------开始解码具签名的多签交易数据(call data)------------`);
    // let {threshold2, maxWeight2, call2} = txInfo.method.args;
    // console.log(`threshold is ${threshold2} \n maxweight is ${maxWeight2} \n call data is ${call2}\n`);
    console.log(`threshold is ${txInfo.method.args.threshold} \n`
        + `other signatories is ${txInfo.method.args.otherSignatories}\n`
        + `maxweight is ${txInfo.method.args.maxWeight} \n`
        + `call data is ${txInfo.method.args.call}\n`);
    // 通过call data构造Call类型参数
    const methodCall2 = registry.createType('Call', txInfo.method.args.call);
    // 解码为具体的交易method（json）
    const method2 = toTxMethod(registry, methodCall2);
    console.log(`opaque call dest is ${(method2.args.dest as { id: string })?.id}`);
    console.log(`opaque call mount is ${method2.args.value}`);
    console.log(`------------------解码成功-------------------------`);
}


main().catch((error) => {
    console.error(error);
    process.exit(1);
});
