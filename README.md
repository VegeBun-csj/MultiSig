# polkadot-js app 多签源码阅读


### 创建多签地址

>在polkadot-js app的目录下，有一个`packages`文件夹，其中每一个文件夹都是对应一个主界面，多签是属于`page-accounts`模块，其中`modals`负责账户页面按钮的`模态弹框`，在账户页面上点击`Multisig`时，会出现以下弹框，下面分析一下代码


![创建多签地址](./img/add_multisig.png)


> 代码路径：`polkadot-js/app/packages/page-accounts/src/modals/MultisigCreate.tsx `
```typescript
import type { ActionStatus } from '@polkadot/react-components/Status/types';
import type { ModalProps } from '../types';

import React, { useCallback, useState } from 'react';

import { Button, Input, InputAddressMulti, InputNumber, Modal } from '@polkadot/react-components';
import { useApi } from '@polkadot/react-hooks';
import { keyring } from '@polkadot/ui-keyring';
import { BN } from '@polkadot/util';

import useKnownAddresses from '../Accounts/useKnownAddresses';
import { useTranslation } from '../translate';

interface Props extends ModalProps {
  className?: string;
  onClose: () => void;
  onStatusChange: (status: ActionStatus) => void;
}

interface CreateOptions {
  genesisHash?: string;
  name: string;
  tags?: string[];
}

const MAX_SIGNATORIES = 16;     // 最大签名者数量
const BN_TWO = new BN(2);       // 最小的阈值


// 创建多签地址
function createMultisig (signatories: string[], threshold: BN | number, { genesisHash, name, tags = [] }: CreateOptions, success: string): ActionStatus {
  // we will fill in all the details below
  const status = { action: 'create' } as ActionStatus;

  try {
    // 创建多签，同时加载
    const result = keyring.addMultisig(signatories, threshold, { genesisHash, name, tags });
    // 获取多签账户对
    const { address } = result.pair;

    status.account = address;
    status.status = 'success';
    status.message = success;
  } catch (error) {
    status.status = 'error';
    status.message = (error as Error).message;
  }

  return status;
}

function Multisig ({ className = '', onClose, onStatusChange }: Props): React.ReactElement<Props> {
  //
  const { api, isDevelopment } = useApi();
  // 翻译
  const { t } = useTranslation();
  // 从可获取的地址中选出签名者列表
  const availableSignatories = useKnownAddresses();
  // 多签名字的合法性
  const [{ isNameValid, name }, setName] = useState({ isNameValid: false, name: '' });
  // 签名者列表
  const [signatories, setSignatories] = useState<string[]>(['']);
  // 阈值
  const [{ isThresholdValid, threshold }, setThreshold] = useState({ isThresholdValid: true, threshold: BN_TWO });

  const _createMultisig = useCallback(
    (): void => {
      const options = { genesisHash: isDevelopment ? undefined : api.genesisHash.toString(), name: name.trim() };
      const status = createMultisig(signatories, threshold, options, t<string>('created multisig'));

      onStatusChange(status);
      onClose();
    },
    [api.genesisHash, isDevelopment, name, onClose, onStatusChange, signatories, t, threshold]
  );

    //多签名长度要大于3
  const _onChangeName = useCallback(
    (name: string) => setName({ isNameValid: (name.trim().length >= 3), name }),
    []
  );

    //多签阈值设定要大于等于2,小于等于签名者数量
  const _onChangeThreshold = useCallback(
    (threshold: BN | undefined) =>
      threshold && setThreshold({ isThresholdValid: threshold.gte(BN_TWO) && threshold.lten(signatories.length), threshold }),
    [signatories]           // 监听signatories
  );

    //多签名和阈值是否合法
  const isValid = isNameValid && isThresholdValid;

  return (
    <Modal
      className={className}
      header={t<string>('Add multisig')}
      onClose={onClose}
      size='large'
    >
      <Modal.Content>
        <Modal.Columns
          hint={
            <>
              <p>{t<string>('The signatories has the ability to create transactions using the multisig and approve transactions sent by others.Once the threshold is reached with approvals, the multisig transaction is enacted on-chain.')}</p>
              <p>{t<string>('Since the multisig function like any other account, once created it is available for selection anywhere accounts are used and needs to be funded before use.')}</p>
            </>
          }
        >
          <InputAddressMulti
            //
            // 创建多签帐号
            // 
            // 当前可用的签名者账户列表
            available={availableSignatories}
            availableLabel={t<string>('available signatories')}
            help={t<string>('The addresses that are able to approve multisig transactions. You can select up to {{maxHelpers}} trusted addresses.', { replace: { maxHelpers: MAX_SIGNATORIES } })}
            maxCount={MAX_SIGNATORIES}
            onChange={setSignatories}
            value={signatories}
            valueLabel={t<string>('selected signatories')}
          />
        </Modal.Columns>
        <Modal.Columns hint={t<string>('The threshold for approval should be less or equal to the number of signatories for this multisig.')}>
          <InputNumber
            help={t<string>('The threshold for this multisig')}
            isError={!isThresholdValid}
            label={t<string>('threshold')}
            onChange={_onChangeThreshold}
            value={threshold}
          />
        </Modal.Columns>
        <Modal.Columns hint={t<string>('The name is for unique identification of the account in your owner lists.')}>
          <Input
            autoFocus
            className='full'
            help={t<string>('Name given to this multisig. You can edit it at any later point in time.')}
            isError={!isNameValid}
            label={t<string>('name')}
            onChange={_onChangeName}
            placeholder={t<string>('multisig name')}
          />
        </Modal.Columns>
      </Modal.Content>
      <Modal.Actions>
        <Button
          icon='plus'
          isDisabled={!isValid}
          // 一旦点击了这个Create的按钮，就会触发_createMultisig函数
          label={t<string>('Create')}
          onClick={_createMultisig}
        />
      </Modal.Actions>
    </Modal>
  );
}
export default React.memo(Multisig);
```




addMultisig函数：创建多签地址，同时加载该地址
```javascript
  addMultisig(addresses, threshold, meta = {}) {
    // 创建多签地址（其中已经对签名者列表进行排序）
    const address = createKeyMulti(addresses, threshold);
    const who = u8aSorted(addresses.map(who => this.decodeAddress(who))).map(who => this.encodeAddress(who));
    // 加载创建的多签地址（其中keyring.addFromAddress）
    return this.addExternal(address, objectSpread({}, meta, {
      isMultisig: true,
      threshold: bnToBn(threshold).toNumber(),
      who
    }));
  }
```




### React
- useState
- useEffect
- Modal（模态框）
```typescript
<Modal>
    // 模态框内容
    <Modal.Content>
        <Modal.Columns
        ....
        ...
        </Modal.Columns>
        <Modal.Columns
        ....
        ...
        </Modal.Columns>
        <Modal.Columns
        ....
        ...
        </Modal.Columns>
    </Modal.Content>

    // 触发，提交按钮
    <Modal.Actions>
        <Button
          .....
          onClick={}
        />
    </Modal.Actions>
</Modal>
```


## 问题
### pokadot.js 在前端的页面上TimePoint怎么取?
> 账户第一次发起多签交易时，其中有一个reserve的操作，然后在newMultisig，`timepoint`的数据结构
```rust
pub struct Timepoint<BlockNumber> {
    // 区块号
	height: BlockNumber,
    // 交易索引
	index: u32,
}
```
在后续调用的时候应该取reserver的timepoint，一般是第一个交易index

### 前端提取call data(取决于我们现有的东西)

- 如果现有call hash：
>前端无法通过Pallet中的`opaque call hash`来解码得到call的具体调用，因为`call hash`是通过blake2_256进行hash的，哈希是单向不可逆的
```rust
let (call_hash, call_len, maybe_call, store) = match call_or_hash {
	CallOrHash::Call(call, should_store) => {
	    let call_hash = blake2_256(call.encoded());
	    let call_len = call.encoded_len();
	    (call_hash, call_len, Some(call), should_store)
	},
	CallOrHash::Hash(h) => (h, 0, None, false),
};
```
但是可以通过call hash来获取链上存储Calls中的opaque call信息,从而得到具体的call调用
```rust
#[pallet::storage]
pub type Calls<T: Config> =
	StorageMap<_, Identity, [u8; 32], (OpaqueCall<T>, T::AccountId, BalanceOf<T>)>;
```

- 如果现已有encoded call data

通过拉取链上的`metadata`进行解析，decode call data获取到可读的call data
>https://github.com/paritytech/txwrapper-core/blb/main/packages/txwrapper-examples/src/polkadot.ts 

参考`txwrapper-code`，发起multisigi交易，然后解析其中的call data数据


### 学习总结：
- pallet看代码，不懂怎么使用的，多看测试用例（如果谷歌百度不到）
- polkadot-js前端界面，进行extrinsic调用，有些参数不知道怎么用的话，先用图形界面操作，仔细观察交易执行成功后的事件，call data等等。会有启发的，比如这里的time point应该是多少，其实就在操作成功后，会有一个timepoint的事件，还是要彻底搞懂源码！！！


