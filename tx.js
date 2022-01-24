import { ApiPromise, WsProvider, Keyring} from '@polkadot/api';
// Substrate connection config
const WEB_SOCKET = 'ws://localhost:9944';

// This script will wait for n secs before stopping itself
const LASTING_SECS = 20;

const ALICE = '//Alice';
const BOB = '//Bob';
const EVE = '//EVE'
const DAVE = '//DAVE'

const TX_AMT = 1000000000000000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const connectSubstrate = async () => {
    const wsProvider = new WsProvider(WEB_SOCKET);
    const api = await ApiPromise.create({ provider: wsProvider, types: {} });
    return api;
};

// This function returns a tx unsubcription handler
const submitTx = async (api, src, dest, amt) =>{
    await api.tx.balances.transfer(dest.address, amt)
        .signAndSend(src, res => {
            console.log(`Tx status: ${res.status}`);
        });
}



const main = async () => {
    const api = await connectSubstrate();
    const keyring = new Keyring({ type: 'sr25519' });
    console.log('Connected to Substrate');

    const alice = keyring.addFromUri(ALICE);
    const bob = keyring.addFromUri(BOB);
    const eve = keyring.addFromUri(EVE);
    const dave = keyring.addFromUri(DAVE);

    // 将string类型的多签地址转为keyringpair类型
    const multisigAddr = keyring.addFromAddress('1DA4Q6JboQdDYUiZrmJaQF2RfyVP5xkxdVZ27HBhjPNU57h');
    console.log(`多签账户地址为：${multisigAddr.address}`);

    console.log(`alice账户地址为${alice.address}`);
    // 订阅 Alice 的帐号资料
    const sub_alice = await api.query.system.account(alice.address, aliceAcct => {
        console.log("开始订阅Alice账户信息...");
        const aliceFreeSub = aliceAcct.data.free;
        console.log(`Alice账户余额为: ${aliceFreeSub.toHuman()}`);
    });

    // 订阅 多签地址 帐号资料
    const sub_multi = await api.query.system.account(multisigAddr.address, aliceAcct => {
        console.log("开始订阅多签账户信息...");
        const aliceFreeSub = aliceAcct.data.free;
        console.log(`多签账户余额为: ${aliceFreeSub.toHuman()}`);
    });


    // 发送交易
    // submitTx(api, alice, multisig,TX_AMT);

    
    // const multisig = await api.query.multisig(multisigAddr, )

    // alice发起多签交易(通过Alice,Bob,Eve账户生成的多签地址)
/*     await api.tx.multisig.as_multi(2, [bob, eve],multisig.when, api.tx.balances.transfer(dave, 120),false, 0)
        .signAndSend(alice, res => {
            console.log(`Tx status: ${res.status}`);
        });
 */
    //  call data : 0x050300e659a7a1628cdd93febc04a4e0646ea20e9f5f0ce097d9a05290d4a9e054df4e0b00a0724e1809
    //  call hash : 0x0491847e080c5166ded52158d50e5123873156cbe39ca7ba5d1c896f3ab0b817
    //
    //  如果直接通过这个多签地址发起转账,即   submitTx(api, multisig, alice, TX_AMT);     会出现错误：
    //      Error: Cannot sign with a locked key pair（即该账户是被锁定的，只能由多签账户进行操作）
    //  多签账户需要由多签签名人进行操作
    // 

    /* await api.query.multisig.calls('0x0491847e080c5166ded52158d50e5123873156cbe39ca7ba5d1c896f3ab0b817',(call_data, account, balance) => {
        console.log(`call data is ${call_data}`);
        console.log(`multisig is ${account.toString()}`);
        console.log(`deposite balance is ${balance.toHuman()}`);
    }) */


    await sleep(LASTING_SECS * 1000);
};

main()
    .then(() => {
        console.log("successfully exited");
        process.exit(0);
    })
    .catch(err => {
        console.log('error occur:', err);
        process.exit(1);
    })