import {
    createKeyMulti,
    encodeAddress,
    sortAddresses
} from '@polkadot/util-crypto';

const SS58Prefix = 0;

const Alice = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const Bob = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const Dave = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
const EVE = '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw';

// 多签账户列表
const addresses = [Alice, Bob, Dave];
const threshold = 2;
const index = 0;


/**
 * 
 * 多签地址：对于同一个阈值，相同的签名者，生成的多签账户地址是唯一确定的
 * 
*/

// 生成多签账户
const gen_multi_account = async () => {

    // 通过多签账户列表以及指定阈值生成多签账户
    const multiAddress = createKeyMulti(addresses, threshold);

    // Convert byte array to SS58 encoding.
    const Ss58Address = encodeAddress(multiAddress, SS58Prefix);

    console.log(`\nMultisig Address: ${Ss58Address}`);

    // Take addresses and remove the sender.
    const otherSignatories = addresses.filter((who) => who !== addresses[index]);

    // Sort them by public key.
    const otherSignatoriesSorted = sortAddresses(otherSignatories, SS58Prefix);

    console.log(`\nOther Signatories: ${otherSignatoriesSorted}\n`);
}



export {gen_multi_account, Alice, Bob, EVE};
