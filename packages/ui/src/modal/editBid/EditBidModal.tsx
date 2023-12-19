import { useFallbackState, useReservoirClient, useTimeSince } from '../../hooks'
import React, {
  ReactElement,
  Dispatch,
  SetStateAction,
  useEffect,
  useState,
  ComponentPropsWithoutRef,
} from 'react'
import {
  Flex,
  Text,
  Box,
  Button,
  Loader,
  Select,
  FormatWrappedCurrency,
  Popover,
  FormatCryptoCurrency,
  ErrorWell,
  CryptoCurrencyIcon,
} from '../../primitives'
import PseudoInput from '../../primitives/PseudoInput'
import AttributeSelector from '../bid/AttributeSelector'
import { EditBidModalRenderer, EditBidStep } from './EditBidModalRenderer'
import { Modal } from '../Modal'
import TokenPrimitive from '../TokenPrimitive'
import Progress from '../Progress'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faChevronDown,
  faClose,
} from '@fortawesome/free-solid-svg-icons'
import { ReservoirWallet } from '@reservoir0x/reservoir-sdk'
import { WalletClient, formatUnits } from 'viem'
import { formatNumber } from '../../lib/numbers'
import PriceInput from '../../primitives/PriceInput'
import { Dialog } from '../../primitives/Dialog'
import TokenInfo from '../bid/TokenInfo'

const ModalCopy = {
  title: 'Edit Offer',
  ctaClose: 'Close',
  ctaConfirm: 'Confirm',
  ctaConvertManually: 'Convert Manually',
  ctaConvertAutomatically: '',
  ctaAwaitingApproval: 'Waiting for approval...',
  ctaAwaitingValidation: 'Waiting for transaction to be validated',
}

type Props = Pick<Parameters<typeof Modal>['0'], 'trigger'> & {
  openState?: [boolean, Dispatch<SetStateAction<boolean>>]
  bidId?: string
  tokenId?: string
  chainId?: number
  collectionId?: string
  normalizeRoyalties?: boolean
  enableOnChainRoyalties?: boolean
  copyOverrides?: Partial<typeof ModalCopy>
  walletClient?: ReservoirWallet | WalletClient
  onClose?: (data: any, currentStep: EditBidStep) => void
  onEditBidComplete?: (data: any) => void
  onEditBidError?: (error: Error, data: any) => void
  onPointerDownOutside?: ComponentPropsWithoutRef<
    typeof Dialog
  >['onPointerDownOutside']
}

const MINIMUM_AMOUNT = 0.000001
const MAXIMUM_AMOUNT = Infinity

export function EditBidModal({
  openState,
  bidId,
  tokenId,
  chainId,
  collectionId,
  trigger,
  normalizeRoyalties,
  copyOverrides,
  walletClient,
  onClose,
  onEditBidComplete,
  onEditBidError,
  onPointerDownOutside,
}: Props): ReactElement {
  const copy: typeof ModalCopy = { ...ModalCopy, ...copyOverrides }
  const [open, setOpen] = useFallbackState(
    openState ? openState[0] : false,
    openState
  )

  const client = useReservoirClient()

  const currentChain = client?.currentChain()

  const modalChain = chainId
    ? client?.chains.find(({ id }) => id === chainId) || currentChain
    : currentChain

  return (
    <EditBidModalRenderer
      chainId={modalChain?.id}
      bidId={bidId}
      tokenId={tokenId}
      collectionId={collectionId}
      open={open}
      normalizeRoyalties={normalizeRoyalties}
      walletClient={walletClient}
    >
      {({
        loading,
        bid,
        attributes,
        trait,
        isOracleOrder,
        isTokenBid,
        bidAmount,
        bidAmountUsd,
        token,
        collection,
        editBidStep,
        transactionError,
        hasEnoughNativeCurrency,
        hasEnoughWrappedCurrency,
        amountToWrap,
        balance,
        wrappedBalance,
        wrappedContractName,
        wrappedContractAddress,
        canAutomaticallyConvert,
        convertLink,
        royaltyBps,
        expirationOptions,
        expirationOption,
        usdPrice,
        stepData,
        exchange,
        currency,
        setTrait,
        setBidAmount,
        setExpirationOption,
        editBid,
      }) => {
        const [attributeSelectorOpen, setAttributeSelectorOpen] =
          useState(false)

        const [attributesSelectable, setAttributesSelectable] = useState(false)
        const tokenCount = collection?.tokenCount
          ? +collection.tokenCount
          : undefined

        const itemImage = isTokenBid
          ? bid?.criteria?.data?.token?.image || token?.token?.imageSmall
          : bid?.criteria?.data?.collection?.image || collection?.image

        const previousBidsExpiration = useTimeSince(bid?.expiration)

        useEffect(() => {
          if (editBidStep === EditBidStep.Complete && onEditBidComplete) {
            const data = {
              bid,
              stepData: stepData,
            }
            onEditBidComplete(data)
          }
        }, [editBidStep])

        useEffect(() => {
          if (transactionError && onEditBidError) {
            const data = {
              bid,
              stepData: stepData,
            }
            onEditBidError(transactionError, data)
          }
        }, [transactionError])

        useEffect(() => {
          if (open && attributes) {
            let attributeCount = 0
            for (let i = 0; i < attributes.length; i++) {
              attributeCount += attributes[i].attributeCount || 0
              if (attributeCount >= 2000) {
                break
              }
            }
            if (attributeCount >= 2000) {
              setAttributesSelectable(false)
            } else {
              setAttributesSelectable(true)
            }
          } else {
            setAttributesSelectable(false)
          }
        }, [open, attributes])

        const isBidAvailable = bid && bid.status === 'active' && !loading

        const isBidEditable =
          bid && bid.status === 'active' && !loading && isOracleOrder

        const minimumAmount = exchange?.minPriceRaw
          ? Number(
              formatUnits(
                BigInt(exchange.minPriceRaw),
                currency?.decimals || 18
              )
            )
          : MINIMUM_AMOUNT
        const maximumAmount = exchange?.maxPriceRaw
          ? Number(
              formatUnits(
                BigInt(exchange.maxPriceRaw),
                currency?.decimals || 18
              )
            )
          : MAXIMUM_AMOUNT

        const withinPricingBounds =
          bidAmount !== '' &&
          Number(bidAmount) <= maximumAmount &&
          Number(bidAmount) >= minimumAmount

        const canPurchase = bidAmount !== '' && withinPricingBounds
        const bidAmountNumerical = Number(bidAmount.length > 0 ? bidAmount : 0)

        return (
          <Modal
            trigger={trigger}
            title={copy.title}
            open={open}
            onOpenChange={(open) => {
              if (!open && onClose) {
                const data = {
                  bid,
                  stepData: stepData,
                }
                onClose(data, editBidStep)
              }
              setOpen(open)
            }}
            loading={loading}
            onPointerDownOutside={(e) => {
              if (onPointerDownOutside) {
                onPointerDownOutside(e)
              }
            }}
          >
            {!isBidAvailable && !loading && (
              <Flex
                direction="column"
                justify="center"
                css={{ px: '$4', py: '$6' }}
              >
                <Text style="h6" css={{ textAlign: 'center' }}>
                  Selected offer is no longer available
                </Text>
              </Flex>
            )}
            {!isBidEditable && isBidAvailable && (
              <Flex
                direction="column"
                justify="center"
                css={{ px: '$4', py: '$6' }}
              >
                <Text style="h6" css={{ textAlign: 'center' }}>
                  Selected offer is not an oracle order, so cannot be edited.
                </Text>
              </Flex>
            )}
            {isBidEditable && editBidStep === EditBidStep.Edit && (
              <Flex direction="column">
                <TokenInfo
                  chain={modalChain}
                  token={token ? token : undefined}
                  collection={collection}
                  containerCss={{
                    borderBottom: '1px solid',
                    borderBottomColor: '$neutralLine',
                    borderColor: '$neutralLine',
                  }}
                />
                <Flex
                  justify="between"
                  direction="column"
                  align="center"
                  css={{ width: '100%', p: '$4', gap: 24, overflow: 'hidden' }}
                >
                  <Flex direction="column" css={{ gap: '$2', width: '100%' }}>
                    <Flex justify="between" css={{ gap: '$3' }}>
                      <Text style="subtitle2">Offer Price</Text>
                      <Text
                        as={Flex}
                        css={{ gap: '$1' }}
                        align="center"
                        style="subtitle3"
                      >
                        Balance:{' '}
                        <FormatWrappedCurrency
                          chainId={modalChain?.id}
                          logoWidth={10}
                          textStyle="tiny"
                          amount={wrappedBalance?.value}
                          address={wrappedContractAddress}
                          decimals={wrappedBalance?.decimals}
                          symbol={wrappedBalance?.symbol}
                        />{' '}
                      </Text>
                    </Flex>

                    <Flex css={{ mt: '$2', gap: quantityEnabled ? '$2' : 20 }}>
                      <Text
                        as={Flex}
                        css={{ gap: '$2', flexShrink: 0 }}
                        align="center"
                        style="body1"
                        color="subtle"
                      >
                        <CryptoCurrencyIcon
                          chainId={modalChain?.id}
                          css={{ height: 20 }}
                          address={wrappedContractAddress}
                        />
                        {wrappedContractName}
                      </Text>
                      <Input
                        type="number"
                        value={bidAmountPerUnit}
                        onChange={(e) => {
                          setBidAmountPerUnit(e.target.value)
                        }}
                        placeholder="Enter price"
                        containerCss={{
                          width: '100%',
                        }}
                        css={{
                          textAlign: 'center',
                          '@bp1': {
                            textAlign: 'left',
                          },
                        }}
                      />
                      {topOfferButtonEnabled ? (
                        <Button
                          color="secondary"
                          size="none"
                          css={{
                            height: 44,
                            px: '$4',
                            borderRadius: 8,
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                          onClick={handleSetBestOffer}
                        >
                          Best Offer
                        </Button>
                      ) : null}
                    </Flex>

                    {totalBidAmount !== 0 && !withinPricingBounds && (
                      <Box>
                        <Text style="body2" color="error">
                          {maximumAmount !== Infinity
                            ? `Amount must be between ${formatNumber(
                                minimumAmount
                              )} - ${formatNumber(maximumAmount)}`
                            : `Amount must be higher than ${formatNumber(
                                minimumAmount
                              )}`}
                        </Text>
                      </Box>
                    )}

                    {attributes &&
                      attributes.length > 0 &&
                      (attributesSelectable || trait) &&
                      !tokenId &&
                      traitBidSupported && (
                        <>
                          <Popover.Root
                            open={attributeSelectorOpen}
                            onOpenChange={
                              attributesSelectable
                                ? setAttributeSelectorOpen
                                : undefined
                            }
                          >
                            <Popover.Trigger asChild>
                              {trait ? (
                                <PseudoInput css={{ py: '$3' }}>
                                  <Flex
                                    justify="between"
                                    css={{
                                      gap: '$2',
                                      alignItems: 'center',
                                      color: '$neutralText',
                                    }}
                                  >
                                    <Box
                                      css={{
                                        maxWidth: 385,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Text color="accent" style="subtitle1">
                                        {trait?.key}:{' '}
                                      </Text>
                                      <Text style="subtitle1">
                                        {trait?.value}
                                      </Text>
                                    </Box>
                                    <Flex
                                      css={{
                                        alignItems: 'center',
                                        gap: '$2',
                                      }}
                                    >
                                      {trait?.floorAskPrice && (
                                        <Box css={{ flex: 'none' }}>
                                          <FormatCryptoCurrency
                                            amount={trait?.floorAskPrice}
                                            maximumFractionDigits={2}
                                            logoWidth={11}
                                            textStyle="body1"
                                          />
                                        </Box>
                                      )}
                                      <FontAwesomeIcon
                                        style={{
                                          cursor: 'pointer',
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          setTrait(undefined)
                                        }}
                                        icon={faClose}
                                        width={16}
                                        height={16}
                                      />
                                    </Flex>
                                  </Flex>
                                </PseudoInput>
                              ) : (
                                <Button
                                  color="ghost"
                                  css={{
                                    color: '$accentText',
                                    fontWeight: 500,
                                    fontSize: 14,
                                    maxWidth: 'max-content',
                                  }}
                                  size="none"
                                >
                                  + Add Attribute
                                </Button>
                              )}
                            </Popover.Trigger>
                            <Popover.Content
                              side="bottom"
                              align="start"
                              sideOffset={-20}
                              style={{ maxWidth: '100vw' }}
                            >
                              <AttributeSelector
                                attributes={attributes}
                                tokenCount={tokenCount}
                                setTrait={setTrait}
                                setOpen={setAttributeSelectorOpen}
                              />
                            </Popover.Content>
                          </Popover.Root>
                        </>
                      )}
                  </Flex>

                  {quantityEnabled ? (
                    <Flex
                      justify="between"
                      align="center"
                      css={{ gap: '$5', width: '100%' }}
                    >
                      <Flex
                        direction="column"
                        align="start"
                        css={{ gap: '$2', flexShrink: 0 }}
                      >
                        <Text style="subtitle2">Quantity</Text>
                        <Text
                          color="subtle"
                          style="body3"
                          css={{
                            display: 'none',
                            '@bp1': {
                              display: 'block',
                            },
                          }}
                        >
                          Offers can be accepted separately
                        </Text>
                      </Flex>
                      <QuantitySelector
                        quantity={quantity}
                        setQuantity={setQuantity}
                        min={1}
                        max={999999}
                        css={{ justifyContent: 'space-between', width: '100%' }}
                      />
                    </Flex>
                  ) : null}

                  <Flex direction="column" css={{ gap: '$2', width: '100%' }}>
                    <Text as={Box} style="subtitle2">
                      Expiration Date
                    </Text>
                    <Flex css={{ gap: '$2' }}>
                      <Select
                        css={{
                          flex: 1,
                          '@bp1': {
                            width: 160,
                            flexDirection: 'row',
                          },
                        }}
                        value={expirationOption?.text || ''}
                        onValueChange={(value: string) => {
                          const option = expirationOptions.find(
                            (option) => option.value == value
                          )
                          if (option) {
                            setExpirationOption(option)
                          }
                        }}
                      >
                        {expirationOptions
                          .filter(({ value }) => value !== 'custom')
                          .map((option) => (
                            <Select.Item key={option.text} value={option.value}>
                              <Select.ItemText>{option.text}</Select.ItemText>
                            </Select.Item>
                          ))}
                      </Select>
                      <DateInput
                        ref={datetimeElement}
                        icon={
                          <FontAwesomeIcon
                            icon={faCalendar}
                            width={14}
                            height={16}
                          />
                        }
                        value={expirationDate}
                        options={{
                          chainId: modalChain?.id,
                          minDate: MINIMUM_DATE,
                          enableTime: true,
                          minuteIncrement: 1,
                        }}
                        defaultValue={expirationDate}
                        onChange={(e: any) => {
                          if (Array.isArray(e)) {
                            const customOption = expirationOptions.find(
                              (option) => option.value === 'custom'
                            )
                            if (customOption) {
                              setExpirationOption({
                                ...customOption,
                                relativeTime: e[0] / 1000,
                              })
                            }
                          }
                        }}
                        containerCss={{
                          width: 46,
                          '@bp1': {
                            flex: 1,
                            width: '100%',
                          },
                        }}
                        css={{
                          padding: 0,
                          '@bp1': {
                            padding: '12px 16px 12px 48px',
                          },
                        }}
                      />
                    </Flex>
                  </Flex>

                  <Flex
                    justify="between"
                    align="center"
                    css={{ gap: '$4', width: '100%' }}
                  >
                    <Text style="h6">Total Offer Price</Text>
                    <Flex direction="column" align="end">
                      <FormatWrappedCurrency
                        chainId={modalChain?.id}
                        logoWidth={16}
                        textStyle="h6"
                        amount={totalBidAmount}
                        address={currency?.contract}
                        decimals={currency?.decimals}
                        symbol={currency?.symbol}
                      />
                      <FormatCurrency
                        style="subtitle3"
                        color="subtle"
                        amount={totalBidAmountUsd}
                      />
                    </Flex>
                  </Flex>
                  <Box css={{ width: '100%', mt: 'auto' }}>
                    {oracleEnabled && (
                      <Text
                        style="body2"
                        color="subtle"
                        css={{
                          mb: 10,
                          textAlign: 'center',
                          width: '100%',
                          display: 'block',
                        }}
                      >
                        You can change or cancel your offer for free on{' '}
                        {localMarketplace?.title}.
                      </Text>
                    )}
                    {!canPurchase && (
                      <Button disabled={true} css={{ width: '100%' }}>
                        {copy.ctaBidDisabled}
                      </Button>
                    )}
                    {canPurchase && hasEnoughWrappedCurrency && (
                      <Button
                        onClick={() => placeBid()}
                        css={{ width: '100%' }}
                      >
                        {ctaButtonText}
                      </Button>
                    )}
                    {canPurchase && !hasEnoughWrappedCurrency && (
                      <>
                        {!hasEnoughNativeCurrency && (
                          <Flex css={{ gap: '$2', mt: 10 }} justify="center">
                            <Text style="body3" color="error">
                              {balance?.symbol || 'ETH'} Balance
                            </Text>
                            <FormatCryptoCurrency
                              chainId={modalChain?.id}
                              amount={balance?.value}
                              symbol={balance?.symbol}
                            />
                          </Flex>
                        )}
                        <Flex
                          css={{
                            gap: '$2',
                            mt: 10,
                            overflow: 'hidden',
                            flexDirection: 'column-reverse',
                            '@bp1': {
                              flexDirection: 'row',
                            },
                          }}
                        >
                          <Button
                            disabled={providerOptionsContext.disableJumperLink}
                            css={{ flex: '1 0 auto' }}
                            color="secondary"
                            onClick={() => {
                              window.open(convertLink, '_blank')
                            }}
                          >
                            {providerOptionsContext.disableJumperLink
                              ? ctaButtonText
                              : copy.ctaConvertManually}
                          </Button>
                          {canAutomaticallyConvert && (
                            <Button
                              css={{ flex: 1, maxHeight: 44 }}
                              disabled={!hasEnoughNativeCurrency}
                              onClick={() => placeBid()}
                            >
                              <Text style="h6" color="button" ellipsify>
                                {copy.ctaConvertAutomatically.length > 0
                                  ? copy.ctaConvertAutomatically
                                  : `Convert ${amountToWrap} ${
                                      balance?.symbol || 'ETH'
                                    } for me`}
                              </Text>
                            </Button>
                          )}
                        </Flex>
                      </>
                    )}
                  </Box>
                </Flex>
              </Flex>
              // <Flex direction="column">
              //   {transactionError && <ErrorWell error={transactionError} />}
              //   <Box css={{ p: '$4', borderBottom: '1px solid $borderColor' }}>
              //     <TokenPrimitive
              //       chain={modalChain}
              //       img={itemImage}
              //       name={bid?.criteria?.data?.token?.name}
              //       price={bid?.price?.amount?.decimal}
              //       priceSubtitle="Price"
              //       royaltiesBps={royaltyBps}
              //       usdPrice={
              //         (bid?.price?.amount?.decimal as number) * (usdPrice || 0)
              //       }
              //       collection={bid?.criteria?.data?.collection?.name || ''}
              //       currencyContract={bid?.price?.currency?.contract}
              //       currencyDecimals={bid?.price?.currency?.decimals}
              //       currencySymbol={bid?.price?.currency?.symbol}
              //       expires={previousBidsExpiration}
              //       source={(bid?.source?.icon as string) || ''}
              //     />
              //   </Box>
              //   <Flex direction="column" css={{ px: '$4', py: '$2' }}>
              //     <Flex css={{ mb: '$2' }} justify="between">
              //       <Text style="subtitle3" color="subtle" as="p">
              //         Set New Offer
              //       </Text>
              //       {wrappedBalance?.value ? (
              //         <Text
              //           as={Flex}
              //           css={{ gap: '$1' }}
              //           align="center"
              //           style="tiny"
              //         >
              //           Balance:{' '}
              //           <FormatWrappedCurrency
              //             chainId={modalChain?.id}
              //             logoWidth={10}
              //             textStyle="tiny"
              //             amount={wrappedBalance?.value}
              //             decimals={wrappedBalance?.decimals}
              //             address={wrappedContractAddress}
              //             symbol={wrappedBalance?.symbol}
              //           />{' '}
              //         </Text>
              //       ) : null}
              //     </Flex>
              //     <Flex direction="column" css={{ gap: '$2' }}>
              //       <PriceInput
              //         chainId={modalChain?.id}
              //         price={bidAmount ? bidAmountNumerical : undefined}
              //         collection={collection}
              //         currency={currency}
              //         usdPrice={usdPrice}
              //         quantity={1}
              //         placeholder={'Enter an offer price'}
              //         onChange={(e) => {
              //           if (e.target.value === '') {
              //             setBidAmount('')
              //           } else {
              //             setBidAmount(e.target.value)
              //           }
              //         }}
              //         onBlur={() => {
              //           if (bidAmountNumerical === undefined) {
              //             setBidAmount('')
              //           }
              //         }}
              //       />
              //       {bidAmount !== '0' &&
              //         bidAmount !== '' &&
              //         !withinPricingBounds && (
              //           <Box>
              //             <Text style="body3" color="error">
              //               {maximumAmount !== Infinity
              //                 ? `Amount must be between ${formatNumber(
              //                     minimumAmount
              //                   )} - ${formatNumber(maximumAmount)}`
              //                 : `Amount must be higher than ${formatNumber(
              //                     minimumAmount
              //                   )}`}
              //             </Text>
              //           </Box>
              //         )}
              //     </Flex>
              //     {attributes &&
              //       attributes.length > 0 &&
              //       (attributesSelectable || trait) &&
              //       !isTokenBid && (
              //         <Flex direction="column" css={{ mb: '$3', mt: '$4' }}>
              //           <Text
              //             as="div"
              //             css={{ mb: '$2' }}
              //             style="subtitle3"
              //             color="subtle"
              //           >
              //             Attributes
              //           </Text>
              //           <Popover.Root
              //             open={attributeSelectorOpen}
              //             onOpenChange={
              //               attributesSelectable
              //                 ? setAttributeSelectorOpen
              //                 : undefined
              //             }
              //           >
              //             <Popover.Trigger asChild>
              //               <PseudoInput>
              //                 <Flex
              //                   justify="between"
              //                   css={{
              //                     gap: '$2',
              //                     alignItems: 'center',
              //                     color: '$neutralText',
              //                   }}
              //                 >
              //                   {trait ? (
              //                     <>
              //                       <Box
              //                         css={{
              //                           maxWidth: 385,
              //                           overflow: 'hidden',
              //                           textOverflow: 'ellipsis',
              //                           whiteSpace: 'nowrap',
              //                         }}
              //                       >
              //                         <Text color="accent" style="subtitle1">
              //                           {trait?.key}:{' '}
              //                         </Text>
              //                         <Text style="subtitle1">
              //                           {trait?.value}
              //                         </Text>
              //                       </Box>
              //                       <Flex
              //                         css={{
              //                           alignItems: 'center',
              //                           gap: '$2',
              //                         }}
              //                       >
              //                         {trait?.floorAskPrice && (
              //                           <Box css={{ flex: 'none' }}>
              //                             <FormatCryptoCurrency
              //                               chainId={modalChain?.id}
              //                               amount={trait?.floorAskPrice}
              //                               maximumFractionDigits={2}
              //                               logoWidth={11}
              //                             />
              //                           </Box>
              //                         )}
              //                         <FontAwesomeIcon
              //                           style={{
              //                             cursor: 'pointer',
              //                           }}
              //                           onClick={(e) => {
              //                             e.preventDefault()
              //                             setTrait(undefined)
              //                           }}
              //                           icon={faClose}
              //                           width={16}
              //                           height={16}
              //                         />
              //                       </Flex>
              //                     </>
              //                   ) : (
              //                     <>
              //                       <Text
              //                         css={{
              //                           color: '$neutralText',
              //                         }}
              //                       >
              //                         All Attributes
              //                       </Text>
              //                       <FontAwesomeIcon
              //                         icon={faChevronDown}
              //                         width={16}
              //                         height={16}
              //                       />
              //                     </>
              //                   )}
              //                 </Flex>
              //               </PseudoInput>
              //             </Popover.Trigger>
              //             <Popover.Content sideOffset={-50}>
              //               <AttributeSelector
              //                 chainId={modalChain?.id}
              //                 attributes={attributes}
              //                 tokenCount={tokenCount}
              //                 setTrait={setTrait}
              //                 setOpen={setAttributeSelectorOpen}
              //               />
              //             </Popover.Content>
              //           </Popover.Root>
              //         </Flex>
              //       )}
              //     <Box css={{ mb: '$3', mt: '$4' }}>
              //       <Text
              //         as="div"
              //         css={{ mb: '$2' }}
              //         style="subtitle3"
              //         color="subtle"
              //       >
              //         Expiration Date
              //       </Text>
              //       <Select
              //         value={expirationOption?.text || ''}
              //         onValueChange={(value: string) => {
              //           const option = expirationOptions.find(
              //             (option) => option.value == value
              //           )
              //           if (option) {
              //             setExpirationOption(option)
              //           }
              //         }}
              //       >
              //         {expirationOptions
              //           .filter(({ value }) => value !== 'custom')
              //           .map((option) => (
              //             <Select.Item key={option.text} value={option.value}>
              //               <Select.ItemText>{option.text}</Select.ItemText>
              //             </Select.Item>
              //           ))}
              //       </Select>
              //     </Box>

              //     <Flex
              //       css={{
              //         gap: '$3',
              //         py: '$3',
              //       }}
              //     >
              //       {hasEnoughWrappedCurrency || !canPurchase ? (
              //         <>
              //           <Button
              //             onClick={() => {
              //               setOpen(false)
              //             }}
              //             color="secondary"
              //             css={{ flex: 1 }}
              //           >
              //             {copy.ctaClose}
              //           </Button>
              //           <Button
              //             disabled={!canPurchase}
              //             onClick={editBid}
              //             css={{ flex: 1 }}
              //           >
              //             {copy.ctaConfirm}
              //           </Button>
              //         </>
              //       ) : (
              //         <Box css={{ width: '100%', mt: 'auto' }}>
              //           {!hasEnoughNativeCurrency && (
              //             <Flex css={{ gap: '$2', mt: 10 }} justify="center">
              //               <Text style="body3" color="error">
              //                 {balance?.symbol || 'ETH'} Balance
              //               </Text>
              //               <FormatCryptoCurrency
              //                 chainId={modalChain?.id}
              //                 amount={balance?.value}
              //                 symbol={balance?.symbol}
              //               />
              //             </Flex>
              //           )}
              //           <Flex
              //             css={{
              //               gap: '$2',
              //               mt: 10,
              //               overflow: 'hidden',
              //               flexDirection: 'column-reverse',
              //               '@bp1': {
              //                 flexDirection: 'row',
              //               },
              //             }}
              //           >
              //             <Button
              //               css={{ flex: '1 0 auto' }}
              //               color="secondary"
              //               onClick={() => {
              //                 window.open(convertLink, '_blank')
              //               }}
              //             >
              //               {copy.ctaConvertManually}
              //             </Button>

              //             {canAutomaticallyConvert && (
              //               <Button
              //                 css={{ flex: 1, maxHeight: 44 }}
              //                 disabled={!hasEnoughNativeCurrency}
              //                 onClick={editBid}
              //               >
              //                 <Text style="h6" color="button" ellipsify>
              //                   {copy.ctaConvertAutomatically.length > 0
              //                     ? copy.ctaConvertAutomatically
              //                     : `Convert ${amountToWrap} ${
              //                         balance?.symbol || 'ETH'
              //                       } for me`}
              //                 </Text>
              //               </Button>
              //             )}
              //           </Flex>
              //         </Box>
              //       )}
              //     </Flex>
              //   </Flex>
              // </Flex>
            )}
            {editBidStep === EditBidStep.Approving && (
              <Flex direction="column">
                <Box css={{ p: '$4', borderBottom: '1px solid $borderColor' }}>
                  <TokenPrimitive
                    chain={modalChain}
                    img={itemImage}
                    name={bid?.criteria?.data?.token?.name}
                    price={Number(bidAmount)}
                    usdPrice={bidAmountUsd}
                    collection={collection?.name || ''}
                    currencyContract={bid?.price?.currency?.contract}
                    currencyDecimals={bid?.price?.currency?.decimals}
                    currencySymbol={bid?.price?.currency?.symbol}
                    expires={`in ${expirationOption.text.toLowerCase()}`}
                    source={(bid?.source?.icon as string) || ''}
                  />
                </Box>
                {!stepData && <Loader css={{ height: 206 }} />}
                {stepData && (
                  <>
                    <Progress
                      title={
                        stepData?.currentStepItem.txHashes
                          ? 'Finalizing on blockchain'
                          : 'Approve Reservoir Oracle to update the offer'
                      }
                      txHashes={stepData?.currentStepItem?.txHashes}
                    />
                  </>
                )}
                <Button disabled={true} css={{ m: '$4' }}>
                  <Loader />
                  {stepData?.currentStepItem.txHashes
                    ? copy.ctaAwaitingValidation
                    : copy.ctaAwaitingApproval}
                </Button>
              </Flex>
            )}
            {editBidStep === EditBidStep.Complete && (
              <Flex direction="column">
                <Flex
                  css={{
                    p: '$4',
                    py: '$5',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box css={{ color: '$successAccent', mb: 24 }}>
                    <FontAwesomeIcon icon={faCheckCircle} size="3x" />
                  </Box>
                  <Text style="h5" css={{ mb: '$4' }}>
                    Offer Updated!
                  </Text>
                  <Text style="body2" color="subtle" css={{ mb: 24 }}>
                    Your offer for{' '}
                    <Text style="body2" color="base">
                      {token?.token?.name}
                    </Text>{' '}
                    has been updated.
                  </Text>
                </Flex>
                <Button
                  onClick={() => {
                    setOpen(false)
                  }}
                  css={{ m: '$4' }}
                >
                  {copy.ctaClose}
                </Button>
              </Flex>
            )}
          </Modal>
        )
      }}
    </EditBidModalRenderer>
  )
}

EditBidModal.Custom = EditBidModalRenderer
