# MultiSig
## 什么是多签
> 在以太坊网络上创建的大多数帐户都属于外部帐户类别。
1. `EOA`（External owned accounts）是一个使用传统密钥对的以太坊帐户。换句话说，它们由单个私钥组成，可以用于事务和签名信息。如果您获得了对私钥的访问权，您就获得了对帐户的完全控制权。最流行的钱包，如metamask或imtoken，是简单的EOA，甚至是硬件钱包，如ledger；Nano或trezor也是基于EOA的。这意味着在用户和他们的资金损失之间只有一个停止点，即私钥。
2. 以太坊账户的另一种类是`智能合约账户`。与EOAs一样，智能合约账户都有一个唯一的以太坊公共地址，通过查看以太坊地址无法将其与EOAs区分开来。智能合约账户还可以接收资金并进行类似于EOA的交易。一般来说，密钥的不同之处在于不使用单个私钥来验证事务。相反，账户如何完成交易背后的逻辑是在智能合约代码中定义的。智能合约是在以太坊区块链上运行的程序，在满足一定条件时执行。它们在合约账户中的功能意味着此类账户可以实现访问权限，例如指定谁、如何以及在什么条件下执行交易，以及比EOA更复杂的逻辑；

3. `多签钱包`：
多签名钱包是一种合约账户，交易执行前需要多方确认。在智能合约中，这些当事人（每个人都有一个唯一的以太坊账户地址）被定义为多重签名钱包所有人。只有预定义的所有者数确认事务时(达到阈值)，才会执行事务。

> 通俗点讲，多签钱包适用于一群人需要花费一笔资金，但是其中任何一个人都不能随便花费，需要一定数量的人同意才能花费。


## 多签产品——Gnosis Safe
> Ethereum的多签钱包
### 多签钱包的使用步骤：
1. 发起人创建多签钱包，并邀请其他人加入
2. 所有参与方加入后，多签地址生成，便可以打入资金
3. 任何一方可发起多签的花费，其它参与方进行审批（签名或拒绝），达到签名阈值即可花费资金

### Gnosis Safe——ETH多签钱包
> 首先需要ethereum账户，我这里创建了三个ethereum账户




## Substrate的pallet-multisig分析

### 数据结构
- `Timepoint`：全局外部索引，作为块内的外部索引与该块的高度一起形成。 允许对创建特定组合的多重签名操作的交易进行唯一标识。
```rust
#[derive(Copy, Clone, Eq, PartialEq, Encode, Decode, Default, RuntimeDebug, TypeInfo)]
pub struct Timepoint<BlockNumber> {
	/// The height of the chain at the point in time.
	height: BlockNumber,
	/// The index of the extrinsic at the point in time.
	index: u32,
}
```

- `Multisig`：存储多签的基本信息？？？待后面详解
```rust
#[derive(Clone, Eq, PartialEq, Encode, Decode, Default, RuntimeDebug, TypeInfo)]
pub struct Multisig<BlockNumber, Balance, AccountId> {
	/// The extrinsic when the multisig operation was opened.
	when: Timepoint<BlockNumber>,
	/// The amount held in reserve of the `depositor`, to be returned once the operation ends.
	deposit: Balance,
	/// The account who opened it (i.e. the first to approve it).
	depositor: AccountId,
	/// The approvals achieved so far, including the depositor. Always sorted.
	approvals: Vec<AccountId>,
}
```

- `额外的数据结构`

```rust
// 模糊调用
type OpaqueCall<T> = WrapperKeepOpaque<<T as Config>::Call>;

// call hash
type CallHash = [u8; 32];

// call调用或者hash
enum CallOrHash<T: Config> {
	Call(OpaqueCall<T>, bool),
	Hash([u8; 32]),
}
```


### pallet::config关联类型
- `Event`
- `Call`
- `Currency`: 可质押代币类型
- `DepositBase`：为创建多重签名执行或存储调用所需质押的基本代币数量
- `DepositFactor`：创建多重签名执行时每单位阈值所需的代币数量
- `MaxSignatories`：多重签名中允许的最大签名人数量??
- `WeightInfo`

### pallet::storge存储类型

- `Multisigs`：多重签名集合
```rust
pub type Multisigs<T: Config> = StorageDoubleMap<
	_,
	Twox64Concat,
	T::AccountId,
	Blake2_128Concat,
	[u8; 32],
	Multisig<T::BlockNumber, BalanceOf<T>, T::AccountId>,
>;
```
- `Calls`：存储multisig call调用
```rust
#[pallet::storage]
pub type Calls<T: Config> =
	StorageMap<_, Identity, [u8; 32], (OpaqueCall<T>,T::AccountId, BalanceOf<T>)>;
```

### pallet::call可调用函数
- `as_multi_threshold_1`：从调用者这边使用一个单一的approval来调用多签

```rust
pub fn as_multi_threshold_1(
			origin: OriginFor<T>,
			other_signatories: Vec<T::AccountId>,
			call: Box<<T as Config>::Call>,
		) -> DispatchResultWithPostInfo {

			// 
			ensure_sorted_and_insert(...);
			// 创建multiSig账户(账户列表，阈值为1)
			multi_account_id(...，1);
			// call调用
			....
			// 解析调用结果
			....
		}
```


- `as_multi`：创建多签并进行多签call调用

> 如果 `other_signatories` 中有 `threshold - 1`个签名者批准，则注册的approval从一个确定性的组合帐户进行调用；
`费用`：如果这是第一次approval，将保留`DepositBase`，加上`threshold`乘以`DepositFactor`。 一旦这个调用发生或被取消，它就会返回。 
>tip: 除非是最终批准，否则通常使用 `approve_as_multi`，因为它只需要调用的哈希。



- `approve_as_multi`：approve一个多签操作



> `as_multi`和`approve_as_multi`的核心都是`operate`函数
```rust
fn operate(
		who: T::AccountId,
		threshold: u16,
		other_signatories: Vec<T::AccountId>,
		maybe_timepoint: Option<Timepoint<T::BlockNumber>>,
		call_or_hash: CallOrHash<T>,
		max_weight: Weight,
	) -> DispatchResultWithPostInfo {
		// 确保当前调用是阈值至少为2的多签
		ensure!(threshold >= 2, Error::<T>::MinimumThreshold);
		let max_sigs = T::MaxSignatories::get() as usize;
		ensure!(!other_signatories.is_empty(), Error::<T>::TooFewSignatories);
		let other_signatories_len = other_signatories.len();
		ensure!(other_signatories_len < max_sigs, Error::<T>::TooManySignatories);
		//
		// 确保其他签名者列表是已经排序的，再将当前调用者插入到这个签名者列表中（多签中需要保证这个序列）
		//
		// 比如：当前调用者账户为1,其他签名者列表signatories为2,3,4，那么ensure_sorted_and_insert之后的signatories更新为2,3,4,1
		//
		let signatories = Self::ensure_sorted_and_insert(other_signatories, who.clone())?;

		// 根据阈值和签名者列表signatories创建一个多签地址
		let id = Self::multi_account_id(&signatories, threshold);

		//
		// 提取call哈希
		// 
		// 此处的maybe_call可能是None，也可能是一个包含call的option
		// 如果call_or_hash中传入的是call调用，则maybe_call是一个包含call的option
		// 如果call_or_hash中传入的是hash，那么maybe_call为None
		let (call_hash, call_len, maybe_call, store) = match 
		// 对传入的call_or_hash进行模式匹配，判断传入的是一个call调用还是传入的hash，从而返回不同的值
		call_or_hash {
			CallOrHash::Call(call, should_store) => {
				// 将模糊调用的call进行编码
				let call_hash = blake2_256(call.encoded());
				// call的长度
				let call_len = call.encoded_len();
				(call_hash, call_len, Some(call), should_store)
			},
			CallOrHash::Hash(h) => (h, 0, None, false),
		};


		// 判断是否存在相应的多签地址

		//
		// 1. 从Multisigs中 根据多签地址和相应的call hash找到对应的Multisig存储，如果找到（这里应该是approve_multi的调用）
		//
		if let Some(mut m) = <Multisigs<T>>::get(&id, call_hash) {
			// 已经存在；确保存在timepoint
			let timepoint = maybe_timepoint.ok_or(Error::<T>::NoTimepoint)?;
			ensure!(m.when == timepoint, Error::<T>::WrongTimepoint);


			// 当前多签地址已经approval的数量
			let mut approvals = m.approvals.len() as u16;

			// 如果能够在多签账户的approval列表中找到，当前操作账户所在索引，且该索引位于approvals ~ threshold之间（即当前操作账户还未进行approve），那么返回索引option；否则返回None(即已经进行了approve)
			let maybe_pos = m.approvals.binary_search(&who).err().filter(|_| approvals < threshold);

			// 判断是否为option，
			if maybe_pos.is_some() {
				approvals += 1;
			}

			//
			//	maybe_approved_call存储<解码的call调用，call len>
			//
			//	如果approval数量大于等于阈值，则说明当前call调用还需要一个approval就可以执行call调用,此时maybe_approved_call存储当前call的数据
			//	否则，就是approval数量未达到阈值，则无法进行call调用，此时返回maybe_approved_call就为None
			//
			let maybe_approved_call = if approvals >= threshold {
				//
				// 解码，抽取由用户或存储提供的call调用，以供后续approve
				//
				Self::get_call(&call_hash, maybe_call.as_ref())
			} else {
				None
			};

			// 如果当前的maybe_approved_call存在call数据，则说明当前签名数量已经达到阈值，可以执行call调用
			if let Some((call, call_len)) = maybe_approved_call {
				// 确保call调用消耗的weight小于最大weight
				ensure!(call.get_dispatch_info().weight <= max_weight, Error::<T>::MaxWeightTooLow);

				// 在执行调用之前清理存储以避免重入攻击
				<Multisigs<T>>::remove(&id, call_hash);
				Self::clear_call(&call_hash);
				T::Currency::unreserve(&m.depositor, m.deposit);

				// 执行call调用，进行交易
				let result = call.dispatch(RawOrigin::Signed(id.clone()).into());
				Self::deposit_event(Event::MultisigExecuted {
					approving: who,
					timepoint,
					multisig: id,
					call_hash,
					result: result.map(|_| ()).map_err(|e| e.error),
				});
				Ok(get_result_weight(result)
					.map(|actual_weight| {
						T::WeightInfo::as_multi_complete(
							other_signatories_len as u32,
							call_len as u32,
						)
						.saturating_add(actual_weight)
					})
					.into())
			} else {

				// 否则此时maybe_approved_call为None，即没有达到签名数量
				// 那么接下来就需要继续进行签名，增加approval数量来达到阈值要求

				// 获取maybe_call中的store,如果是true，即存储当前的call hash，并进行质押代币，进行approve
				let stored = if let Some(data) = maybe_call.filter(|_| store) {
					Self::store_call_and_reserve(
						who.clone(),
						&call_hash,
						data,
						BalanceOf::<T>::zero(),
					)?;
					true
				} else {
					false
				};

				// 当前账户进行approve（在maybe_pos索引位置增加当前账户）
				if let Some(pos) = maybe_pos {
					// approve操作
					m.approvals.insert(pos, who.clone());
					// 存储这个multisig的call操作
					<Multisigs<T>>::insert(&id, call_hash, m);
					Self::deposit_event(Event::MultisigApproval {
						approving: who,
						timepoint,
						multisig: id,
						call_hash,
					});
				} else {
					// 如果maybe_pos为None，则说明当前账户已经approve过了
					ensure!(stored, Error::<T>::AlreadyApproved);
				}

				let final_weight = if stored {
					T::WeightInfo::as_multi_approve_store(
						other_signatories_len as u32,
						call_len as u32,
					)
				} else {
					T::WeightInfo::as_multi_approve(other_signatories_len as u32, call_len as u32)
				};
				// Call is not made, so the actual weight does not include call
				Ok(Some(final_weight).into())
			}
		} else {

			// 2. 还没有对应的多签

			// 还没有多签的时候，timepoint为None()
			ensure!(maybe_timepoint.is_none(), Error::<T>::UnexpectedTimepoint);

			// 计算需要质押的金额 = 基础质押金额 + 每单位阈值的金额 × 阈值数
			let deposit = T::DepositBase::get() + T::DepositFactor::get() * threshold.into();

			//
			// 存储call 
			//
			let stored = if let Some(data) = maybe_call.filter(|_| store) {
				Self::store_call_and_reserve(who.clone(), &call_hash, data, deposit)?;
				true
			} else {
				T::Currency::reserve(&who, deposit)?;
				false
			};

			// 存储multisig
			<Multisigs<T>>::insert(
				&id,
				call_hash,
				Multisig {
					when: Self::timepoint(),
					deposit,
					depositor: who.clone(),
					approvals: vec![who.clone()],
				},
			);
			Self::deposit_event(Event::NewMultisig { approving: who, multisig: id, call_hash });

			let final_weight = if stored {
				T::WeightInfo::as_multi_create_store(other_signatories_len as u32, call_len as u32)
			} else {
				T::WeightInfo::as_multi_create(other_signatories_len as u32, call_len as u32)
			};
			// Call is not made, so the actual weight does not include call
			Ok(Some(final_weight).into())
		}
	}
```

- `cancel_as_multi`：拒绝一个多签操作

```rust
pub fn cancel_as_multi(
			origin: OriginFor<T>,
			threshold: u16,
			other_signatories: Vec<T::AccountId>,
			timepoint: Timepoint<T::BlockNumber>,
			call_hash: [u8; 32],
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(threshold >= 2, Error::<T>::MinimumThreshold);
			let max_sigs = T::MaxSignatories::get() as usize;
			ensure!(!other_signatories.is_empty(), Error::<T>::TooFewSignatories);
			ensure!(other_signatories.len() < max_sigs, Error::<T>::TooManySignatories);
			let signatories = Self::ensure_sorted_and_insert(other_signatories, who.clone())?;

			let id = Self::multi_account_id(&signatories, threshold);

			let m = <Multisigs<T>>::get(&id, call_hash).ok_or(Error::<T>::NotFound)?;
			ensure!(m.when == timepoint, Error::<T>::WrongTimepoint);
			ensure!(m.depositor == who, Error::<T>::NotOwner);

			let err_amount = T::Currency::unreserve(&m.depositor, m.deposit);
			debug_assert!(err_amount.is_zero());
			<Multisigs<T>>::remove(&id, &call_hash);
			Self::clear_call(&call_hash);

			Self::deposit_event(Event::MultisigCancelled {
				cancelling: who,
				timepoint,
				multisig: id,
				call_hash,
			});
			Ok(())
		}
```

### pallet::multisig Test
> 运行pallet multisig测试





### 疑点
> Q1：为什么需要设置一个最大签名者数量？  
answer ：由于链上存储资源是有限的，无限制的多签数量会占用较多的链上资源。几万人的多签是不能的!

> Q2：如果多签账户中一个用户的私钥丢失了怎么办?  
answer：多签里还有一种操作就是移除多签用户列表中的用户。此时就可以移除这个用户的账户，然后让该用户再创建一个账户地址，再将其加入进来

> Q3：substrate的pallet支持加人吗？  
answer：不可以，其中阈值没办法修改，在进行as multi调用的时候就已经根据设定的阈值生成多签账户了，阈值在这个substrate里面不是一个storage，它是临时传入的，没法修改账户阈值



## Reference
https://academy.binance.com/zh/articles/what-is-a-multisig-wallet

https://www.sohu.com/a/438632290_100217347

https://www.parity.io/blog/building-a-hot-wallet-with-substrate-primitives/


add multiSig to substrate: https://shirshak55.github.io/articles/adding-multisig-to-substrate/

useing multiSig：https://www.youtube.com/watch?v=ZJLqszvhMyM

