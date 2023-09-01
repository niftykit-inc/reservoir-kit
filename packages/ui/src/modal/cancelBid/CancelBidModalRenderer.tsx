import React, { FC, useEffect, useState, useCallback, ReactNode } from 'react'
import { useCoinConversion, useReservoirClient, useBids } from '../../hooks'
import { useWalletClient, useNetwork } from 'wagmi'
import { Execute } from '@reservoir0x/reservoir-sdk'
import { getNetwork } from 'wagmi/actions'

export enum CancelStep {
  Cancel,
  Approving,
  Complete,
}

export type CancelBidStepData = {
  totalSteps: number
  stepProgress: number
  currentStep: Execute['steps'][0]
  currentStepItem: NonNullable<Execute['steps'][0]['items']>[0]
}

type ChildrenProps = {
  loading: boolean
  bid?: NonNullable<ReturnType<typeof useBids>['data']>[0]
  tokenId?: string
  cancelStep: CancelStep
  transactionError?: Error | null
  totalUsd: number
  usdPrice: number
  blockExplorerBaseUrl: string
  steps: Execute['steps'] | null
  stepData: CancelBidStepData | null
  setCancelStep: React.Dispatch<React.SetStateAction<CancelStep>>
  cancelOrder: () => void
}

type Props = {
  open: boolean
  bidId?: string
  chainId?: number
  normalizeRoyalties?: boolean
  children: (props: ChildrenProps) => ReactNode
}

export const CancelBidModalRenderer: FC<Props> = ({
  open,
  chainId,
  bidId,
  normalizeRoyalties,
  children,
}) => {
  const [cancelStep, setCancelStep] = useState<CancelStep>(CancelStep.Cancel)
  const [transactionError, setTransactionError] = useState<Error | null>()
  const [stepData, setStepData] = useState<CancelBidStepData | null>(null)
  const [steps, setSteps] = useState<Execute['steps'] | null>(null)

  const { chains } = useNetwork()
  const client = useReservoirClient()

  const currentChain = client?.currentChain()

  const rendererChain = chainId
    ? client?.chains.find(({ id }) => id === chainId) || currentChain
    : currentChain

  const wagmiChain = chains.find(({ id }) => rendererChain?.id === id)
  const { data: wallet } = useWalletClient({ chainId: rendererChain?.id })

  const blockExplorerBaseUrl =
    wagmiChain?.blockExplorers?.default.url || 'https://etherscan.io'

  const { data: bids, isFetchingPage } = useBids(
    {
      ids: bidId,
      normalizeRoyalties,
      includeCriteriaMetadata: true,
      includeRawData: true,
    },
    {
      revalidateFirstPage: true,
    },
    open && bidId ? true : false,
    rendererChain?.id
  )

  const bid = bids && bids[0] ? bids[0] : undefined
  const currency = bid?.price?.currency

  const coinConversion = useCoinConversion(
    open && bid ? 'USD' : undefined,
    currency?.symbol
  )
  const usdPrice = coinConversion.length > 0 ? coinConversion[0].price : 0
  const totalUsd = usdPrice * (bid?.price?.amount?.decimal || 0)

  const cancelOrder = useCallback(() => {
    if (!wallet) {
      const error = new Error('Missing a wallet/signer')
      setTransactionError(error)
      throw error
    }

    if (rendererChain?.id !== getNetwork().chain?.id) {
      const error = new Error(`Mismatching chainIds`)
      setTransactionError(error)
      throw error
    }

    if (!bidId) {
      const error = new Error('Missing bid id to cancel')
      setTransactionError(error)
      throw error
    }

    if (!client) {
      const error = new Error('ReservoirClient was not initialized')
      setTransactionError(error)
      throw error
    }

    setCancelStep(CancelStep.Approving)

    client.actions
      .cancelOrder({
        chainId: rendererChain?.id,
        ids: [bidId],
        wallet,
        onProgress: (steps: Execute['steps']) => {
          if (!steps) {
            return
          }
          setSteps(steps)

          const executableSteps = steps.filter(
            (step) => step.items && step.items.length > 0
          )

          let stepCount = executableSteps.length

          let currentStepItem:
            | NonNullable<Execute['steps'][0]['items']>[0]
            | undefined

          const currentStepIndex = executableSteps.findIndex((step) => {
            currentStepItem = step.items?.find(
              (item) => item.status === 'incomplete'
            )
            return currentStepItem
          })

          const currentStep =
            currentStepIndex > -1
              ? executableSteps[currentStepIndex]
              : executableSteps[stepCount - 1]

          if (currentStepItem) {
            setStepData({
              totalSteps: stepCount,
              stepProgress: currentStepIndex,
              currentStep,
              currentStepItem,
            })
          } else if (
            steps.every(
              (step) =>
                !step.items ||
                step.items.length == 0 ||
                step.items?.every((item) => item.status === 'complete')
            )
          ) {
            setCancelStep(CancelStep.Complete)
          }
        },
      })
      .catch((e: any) => {
        const error = e as any
        const errorStatus = (error as any)?.statusCode
        let message = 'Oops, something went wrong. Please try again.'
        if (errorStatus >= 400 && errorStatus < 500) {
          message = error.message
        }
        const transactionError = new Error(message, {
          cause: error,
        })
        setTransactionError(transactionError)
        setCancelStep(CancelStep.Cancel)
        setStepData(null)
        setSteps(null)
      })
  }, [bidId, client, chainId, wallet])

  useEffect(() => {
    if (!open) {
      setCancelStep(CancelStep.Cancel)
      setTransactionError(null)
      setStepData(null)
      setSteps(null)
    }
  }, [open])

  let tokenId

  if (bid?.criteria?.kind === 'token') {
    tokenId = bid?.tokenSetId?.split(':')[2]
  }

  return (
    <>
      {children({
        loading: isFetchingPage !== undefined ? isFetchingPage : true,
        bid,
        tokenId,
        cancelStep,
        transactionError,
        usdPrice,
        totalUsd,
        blockExplorerBaseUrl,
        steps,
        stepData,
        setCancelStep,
        cancelOrder,
      })}
    </>
  )
}
