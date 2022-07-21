export interface ReservoirKitTheme {
  borderRadius: number
  fonts: {
    body: string
    button: string
    headline: string
  }
  colors: ReservoirKitThemeColors
}

export interface ReservoirKitThemeColors {
  // accent colors
  accentBase: string
  accentBgSubtle: string
  accentBg: string
  accentBgHover: string
  accentBgActive: string
  accentLine: string
  accentBorder: string
  accentBorderHover: string
  accentSolid: string
  accentSolidHover: string
  accentText: string
  accentTextContrast: string

  // neutral colors
  neutralBase: string
  neutralBgSubtle: string
  neutralBg: string
  neutralBgHover: string
  neutralBgActive: string
  neutalLine: string
  neutralBorder: string
  neutralBorderHover: string
  neutralSolid: string
  neutralSolidHover: string
  neutralText: string
  neutralTextContrast: string

  // secondary colors
  secondaryBase: string
  secondaryBgSubtle: string
  secondaryBg: string
  secondaryBgHover: string
  secondaryBgActive: string
  secondaryLine: string
  secondaryBorder: string
  secondaryBorderHover: string
  secondarySolid: string
  secondarySolidHover: string
  secondaryText: string
  secondaryTextContrast: string

  // general colors
  borderColor: string
  textColor: string
  focusColor: string
  errorText: string
  errorAccent: string
  successAccent: string

  // component colors
  reservoirLogoColor: string
  inputBackground: string
  buttonTextColor: string
  overlayBackground: string
  headerBackground: string
  footerBackground: string
  contentBackground: string
  wellBackground: string
}

export type ReservoirKitOverrides = {
  borderRadius?: number
  font?: string
  buttonFont?: string
  headlineFont?: string
  primaryColor?: string
  primaryHoverColor?: string
  wellBackground?: string
  textColor?: string
  headerBackground?: string
  contentBackground?: string
  footerBackground?: string
  overlayBackground?: string
  borderColor?: string
}

type ReservoirKitSharedTheme = Pick<ReservoirKitTheme, 'fonts' | 'borderRadius'>

export const sharedThemeConfig = (
  overrides?: ReservoirKitOverrides
): ReservoirKitSharedTheme => {
  return {
    borderRadius: overrides?.borderRadius || 4,
    fonts: {
      body: overrides?.font || 'sans-serif',
      button: overrides?.buttonFont || overrides?.font || 'sans-serif',
      headline: overrides?.headlineFont || overrides?.font || 'sans-serif',
    },
  }
}
