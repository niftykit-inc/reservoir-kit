import { erc20ABI, useContractReads } from 'wagmi'
import { fetchBalance } from '@wagmi/core'
import { Address, formatUnits, parseUnits, zeroAddress } from 'viem'
import { useReservoirClient, useCurrencyConversions } from '.'
import { useEffect, useMemo, useState } from 'react'
import { ReservoirChain } from '@reservoir0x/reservoir-sdk'
import { PaymentToken } from '@reservoir0x/reservoir-sdk/src/utils/paymentTokens'
import useSWR from 'swr'

export type EnhancedCurrency =
  | NonNullable<ReservoirChain['paymentTokens']>[0] & {
      usdPrice?: number
      usdPriceRaw?: bigint
      usdTotalPriceRaw?: bigint
      usdTotalFormatted?: string
      balance?: string | number | bigint
      currencyTotalRaw?: bigint
      currencyTotalFormatted?: string
    }

// Fetcher function
const fetchNativeBalances = async (tokens?: PaymentToken[]) => {
  const balancePromises = tokens?.map((currency) =>
    fetchBalance({ address: currency.address })
  )

  const settledResults = balancePromises
    ? await Promise.allSettled(balancePromises)
    : []

  return settledResults.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  )
}

export default function (
  open: boolean,
  address: Address,
  preferredCurrency: PaymentToken,
  preferredCurrencyTotalPrice: bigint,
  chainId?: number
) {
  const client = useReservoirClient()
  const chain =
    chainId !== undefined
      ? client?.chains.find((chain) => chain.id === chainId)
      : client?.currentChain()

  const allPaymentTokens = useMemo(() => {
    let paymentTokens = chain?.paymentTokens

    if (
      !paymentTokens
        ?.map((currency) => currency.address.toLowerCase())
        .includes(preferredCurrency.address.toLowerCase())
    ) {
      paymentTokens?.push(preferredCurrency)
    }
    return paymentTokens
  }, [chain?.paymentTokens, preferredCurrency.address])

  const nonNativeCurrencies = useMemo(() => {
    return allPaymentTokens?.filter(
      (currency) => currency.address !== zeroAddress
    )
  }, [allPaymentTokens])

  const nativeCurrencies = useMemo(() => {
    return allPaymentTokens?.filter(
      (currency) => currency.address === zeroAddress
    )
  }, [allPaymentTokens])

  const { data: nonNativeBalances } = useContractReads({
    contracts: open
      ? nonNativeCurrencies?.map((currency) => ({
          abi: erc20ABI,
          address: currency.address as `0x${string}`,
          chainId: chainId,
          functionName: 'balanceOf',
          args: [address],
        }))
      : [],
    enabled: open,
    allowFailure: false,
  })

  const { data: nativeBalances } = useSWR(
    allPaymentTokens,
    () => fetchNativeBalances(allPaymentTokens),
    {
      revalidateOnFocus: false, // you can customize SWR behavior using its options
      // ... other SWR options
    }
  )

  const preferredCurrencyConversions = useCurrencyConversions(
    preferredCurrency?.address,
    chain,
    open ? allPaymentTokens : undefined
  )

  const paymentTokens = useMemo(() => {
    if (!open) {
      return []
    }

    return allPaymentTokens
      ?.map((currency, i) => {
        let balance: string | number | bigint = 0n
        if (currency.address === zeroAddress) {
          const index =
            nativeCurrencies?.findIndex(
              (nativeCurrency) =>
                nativeCurrency.symbol === currency.symbol &&
                nativeCurrency.chainId === currency.chainId
            ) || 0

          balance = nativeBalances?.[index]?.value.toBigInt() ?? 0n
        } else {
          const index =
            nonNativeCurrencies?.findIndex(
              (nonNativeCurrency) =>
                nonNativeCurrency.symbol === currency.symbol &&
                nonNativeCurrency.address.toLowerCase() ===
                  currency.address.toLowerCase()
            ) || 0
          balance =
            nonNativeBalances &&
            nonNativeBalances[index] &&
            (typeof nonNativeBalances[index] === 'string' ||
              typeof nonNativeBalances[index] === 'number' ||
              typeof nonNativeBalances[index] === 'bigint')
              ? (nonNativeBalances[index] as string | number | bigint)
              : 0n
        }

        const conversionData = preferredCurrencyConversions?.data?.[i]

        const currencyTotalRaw = conversionData?.conversion
          ? (preferredCurrencyTotalPrice * parseUnits('1', currency.decimals)) /
            parseUnits(
              conversionData?.conversion?.toString(),
              preferredCurrency.decimals
            )
          : undefined

        const currencyTotalFormatted = currencyTotalRaw
          ? formatUnits(currencyTotalRaw, currency.decimals)
          : undefined

        const usdPrice = Number(conversionData?.usd ?? 0)
        const usdPriceRaw = parseUnits(usdPrice.toString(), 6)
        const usdTotalPriceRaw = conversionData?.usd
          ? (preferredCurrencyTotalPrice * usdPriceRaw) /
            parseUnits('1', preferredCurrency?.decimals)
          : undefined

        const usdTotalFormatted = usdTotalPriceRaw
          ? formatUnits(usdTotalPriceRaw, 6)
          : undefined

        return {
          ...currency,
          address: currency.address.toLowerCase(),
          usdPrice,
          usdPriceRaw,
          usdTotalPriceRaw,
          usdTotalFormatted,
          balance,
          currencyTotalRaw,
          currencyTotalFormatted,
        }
      })
      .sort((a, b) => {
        // If user has a balance for the listed currency, return first. Otherwise sort currencies by total usdPrice
        if (a.address === preferredCurrency.address && Number(a.balance) > 0)
          return -1
        if (b.address === preferredCurrency.address && Number(b.balance) > 0)
          return 1
        return Number(b.usdPrice ?? 0) - Number(a.usdPrice ?? 0)
      }) as EnhancedCurrency[]
  }, [
    address,
    preferredCurrency.address,
    preferredCurrencyTotalPrice,
    chainId,
    allPaymentTokens,
    nonNativeBalances,
    nativeBalances,
    // nativeBalance,
  ])

  return paymentTokens
}
